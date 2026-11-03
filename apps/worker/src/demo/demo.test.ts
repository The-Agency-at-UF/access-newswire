import { describe, expect, it } from 'vitest'
import {
  onboardingDeckSchema,
  pressReleaseSchema,
  releaseEditSchema,
  researchSchema,
  strategySchema,
} from '@access/ai'
import { CLIENTS, EMAILS, ONBOARDING, RELEASES } from './data'
import { literal, resetSql, seedSql } from './sql'

const ORG = 'org_demo123'

describe('demo data', () => {
  it('matches the schemas the app reads versions with', () => {
    const schemas = { research: researchSchema, onboarding_deck: onboardingDeckSchema, strategy: strategySchema }
    for (const r of RELEASES) {
      for (const v of r.versions) {
        const result = (r.mode === 'edit' ? releaseEditSchema : pressReleaseSchema).safeParse(v.content)
        expect(result.success, `${r.title}: ${result.error?.message}`).toBe(true)
      }
    }
    for (const a of ONBOARDING) {
      for (const v of a.versions) expect(schemas[a.type].safeParse(v.content).success, `${a.client} ${a.type}`).toBe(true)
    }
  })

  it('quotes suggested edits exactly from the draft', () => {
    for (const r of RELEASES.filter((r) => r.mode === 'edit')) {
      for (const v of r.versions) {
        const { sections, suggested_edits } = releaseEditSchema.parse(v.content)
        for (const edit of suggested_edits) {
          expect(sections.find((s) => s.id === edit.section_id)?.body, edit.original).toContain(edit.original)
        }
      }
    }
  })

  it('starts releases only from release-info mail for the same client, and only where the tier allows the mode', () => {
    for (const r of RELEASES) {
      const email = EMAILS[r.sourceEmail]
      expect(email.label).toBe('release_info')
      expect(email.client).toBe(r.client)
      expect(r.mode).toBe(CLIENTS[r.client].tier === 'L2' ? 'edit' : 'write')
      expect(CLIENTS[r.client].onboardedExternally).toBe(true)
    }
  })

  it('reviews only versions that exist, and approves the latest', () => {
    for (const a of [...RELEASES, ...ONBOARDING]) {
      for (const review of a.reviews ?? []) expect(review.version).toBeLessThanOrEqual(a.versions.length)
      const last = a.reviews?.at(-1)
      if (a.status === 'approved') expect(last).toMatchObject({ action: 'approved', version: a.versions.length })
      if (a.status === 'in_review') expect(last).toMatchObject({ action: 'submitted', version: a.versions.length })
    }
  })
})

describe('demo SQL', () => {
  it('escapes quotes and writes objects as jsonb', () => {
    expect(literal("it's")).toBe("'it''s'")
    expect(literal({ a: "b'c" })).toBe(`'{"a":"b''c"}'::jsonb`)
    expect(literal(null)).toBe('null')
  })

  it('only accepts Clerk org ids', () => {
    expect(() => seedSql("org_x'; drop table clients; --")).toThrow()
    expect(() => resetSql('')).toThrow()
  })

  it('refuses teams with real data before deleting anything', () => {
    for (const sql of [seedSql(ORG), resetSql(ORG)]) {
      const guard = sql.indexOf('not demo data')
      expect(guard).toBeGreaterThan(-1)
      expect(guard).toBeLessThan(sql.indexOf('delete from'))
      expect(sql).not.toMatch(/delete from public\.\w+;/)
      expect(sql).toContain(`delete from public.team_members where org_id = '${ORG}' and clerk_user_id like 'demo\\_%'`)
    }
  })

  it('prefers the named presenter, safely quoted', () => {
    expect(seedSql(ORG)).not.toContain('lower(email)')
    expect(seedSql(ORG, "o'neil@x.example")).toContain(`order by lower(email) = lower('o''neil@x.example') desc, created_at`)
  })

  it('seeds every client as demo data', () => {
    const sql = seedSql(ORG)
    expect(sql.match(/insert into public\.clients /g)).toHaveLength(Object.keys(CLIENTS).length)
    expect(sql.match(/"demo":true/g)?.length).toBeGreaterThanOrEqual(Object.keys(CLIENTS).length)
  })
})
