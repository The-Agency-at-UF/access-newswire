/**
 * Renders the demo data (`data.ts`) as one SQL statement for a demo team.
 *
 * Everything runs in a single `do` block, so a seed or reset either applies in
 * full or not at all. Times are SQL expressions (`now() - interval …`), so the
 * data is relative to when it's seeded, not when it's rendered.
 *
 * Both statements refuse to touch a team that holds anything that isn't demo
 * data: a client without `profile.demo`, or mail that didn't come from here.
 */

import { randomUUID } from 'node:crypto'
import { costUsd, ROUTES } from '@access/ai'
import {
  CLIENTS,
  DOCUMENTS,
  EMAILS,
  MEETINGS,
  MEMBERS,
  ONBOARDING,
  PRESENTER_FALLBACK,
  RELEASES,
  SHARED_INBOX,
  type ClientKey,
  type DemoArtifact,
  type DemoClient,
  type DemoEmail,
  type EmailKey,
  type MemberKey,
  type OwnerKey,
} from './data'

const ORG_ID = /^org_[A-Za-z0-9]+$/
const DEMO_MEMBER_PREFIX = 'demo_'
/** LIKE pattern for demo members (the underscore escaped). */
const DEMO_MEMBER_LIKE = 'demo\\_%'
const DEMO_MESSAGE_PREFIX = 'demo-'
const BLOCK_QUOTE = '$demo$'

export function assertOrgId(orgId: string): void {
  if (!ORG_ID.test(orgId)) throw new Error(`"${orgId}" isn't a Clerk organization id (org_…)`)
}

/** A SQL expression, written into the statement as is. */
class Raw {
  constructor(readonly sql: string) {}
}
const raw = (sql: string) => new Raw(sql)

/** A value as a SQL literal. Objects become jsonb. */
export function literal(value: unknown): string {
  if (value instanceof Raw) return value.sql
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`not a finite number: ${value}`)
    return String(value)
  }
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
  return `${literal(JSON.stringify(value))}::jsonb`
}

const textArray = (values: string[]) => raw(`array[${values.map(literal).join(', ')}]::text[]`)
const hoursAgo = (hours: number) => raw(`now() - interval '${hours} hours'`)
const daysAgo = (days: number) => raw(`now() - interval '${days} days'`)
const dateIn = (days: number) => raw(`current_date + ${days}`)

function insert(table: string, row: Record<string, unknown>): string {
  const columns = Object.keys(row)
  return `insert into public.${table} (${columns.join(', ')}) values (${columns.map((c) => literal(row[c])).join(', ')});`
}

function guard(org: string): string[] {
  return [
    `if exists (select 1 from public.clients where org_id = ${literal(org)} and coalesce(profile ->> 'demo', '') <> 'true') then`,
    `  raise exception 'This team has clients that are not demo data. Nothing was changed.';`,
    'end if;',
    `if exists (select 1 from public.emails where org_id = ${literal(org)} and provider_message_id not like ${literal(`${DEMO_MESSAGE_PREFIX}%`)}) then`,
    `  raise exception 'This team has mail that is not demo data. Nothing was changed.';`,
    'end if;',
  ]
}

/** Deletes everything in the team except its real members' own rows. */
function wipe(org: string): string[] {
  const o = literal(org)
  return [
    // Versions and approvals are append-only; this is the same purge delete_client() uses.
    `perform set_config('app.allow_purge', 'on', true);`,
    `delete from pgmq.q_jobs where message ->> 'job_id' in (select id::text from public.jobs where org_id = ${o});`,
    `delete from public.clients where org_id = ${o};`,
    ...[
      'emails',
      'documents',
      'generations',
      'jobs',
      'frameworks',
      'sender_rules',
      'inbox_duty',
      'mail_accounts',
      'journalists',
      'outlets',
      'org_settings',
    ].map((table) => `delete from public.${table} where org_id = ${o};`),
    `delete from public.team_members where org_id = ${o} and clerk_user_id like ${literal(DEMO_MEMBER_LIKE)};`,
  ]
}

function block(org: string, body: string[]): string {
  const statement = [
    `do ${BLOCK_QUOTE}`,
    'declare',
    '  v_presenter uuid;',
    'begin',
    ...guard(org),
    ...wipe(org),
    ...body,
    'end',
    `${BLOCK_QUOTE};`,
  ].join('\n')
  if (statement.split(BLOCK_QUOTE).length !== 3) throw new Error(`demo data can't contain ${BLOCK_QUOTE}`)
  return statement
}

function summary(org: string): string {
  const count = (table: string) => `(select count(*) from public.${table} where org_id = ${literal(org)}) as ${table}`
  return `select ${['clients', 'emails', 'releases', 'artifact_versions', 'documents', 'jobs'].map(count).join(', ')};`
}

export function resetSql(orgId: string): string {
  assertOrgId(orgId)
  return `${block(orgId, [])}\n${summary(orgId)}\n`
}

export function seedSql(orgId: string): string {
  assertOrgId(orgId)
  return `${block(orgId, seedStatements(orgId))}\n${summary(orgId)}\n`
}

function seedStatements(org: string): string[] {
  const out: string[] = []
  const memberIds = Object.fromEntries(Object.keys(MEMBERS).map((k) => [k, randomUUID()])) as Record<MemberKey, string>
  const clientIds = Object.fromEntries(Object.keys(CLIENTS).map((k) => [k, randomUUID()])) as Record<ClientKey, string>
  const emailIds = Object.fromEntries(Object.keys(EMAILS).map((k) => [k, randomUUID()])) as Record<EmailKey, string>

  const member = (key: MemberKey) => memberIds[key]
  const owner = (key: OwnerKey) =>
    key === 'presenter' ? raw(`coalesce(v_presenter, ${literal(memberIds[PRESENTER_FALLBACK])})`) : memberIds[key]
  const clientOwner = (key: ClientKey) => owner(CLIENTS[key].owner)

  // Whoever already belongs to the team is the presenter: they own a few
  // clients and are on inbox duty, so "Assigned to me" and Unmatched have mail.
  out.push(
    `select id into v_presenter from public.team_members where org_id = ${literal(org)}` +
      ` and clerk_user_id not like ${literal(DEMO_MEMBER_LIKE)} order by created_at limit 1;`,
  )

  for (const [key, m] of Object.entries(MEMBERS) as [MemberKey, { name: string; email: string }][]) {
    out.push(
      insert('team_members', {
        id: memberIds[key],
        org_id: org,
        clerk_user_id: `${DEMO_MEMBER_PREFIX}${key}`,
        name: m.name,
        email: m.email,
        role: 'org:member',
      }),
    )
  }

  out.push(
    insert('inbox_duty', { org_id: org, member_id: owner('presenter'), starts_at: hoursAgo(2), ends_at: hoursAgo(-6) }),
    insert('inbox_duty', { org_id: org, member_id: member('iris'), starts_at: hoursAgo(-22), ends_at: hoursAgo(-30) }),
  )

  for (const [key, c] of Object.entries(CLIENTS) as [ClientKey, DemoClient][]) {
    out.push(
      insert('clients', {
        id: clientIds[key],
        org_id: org,
        name: c.name,
        website: `https://${c.website}`,
        industry: c.industry,
        tier: c.tier,
        release_cadence: c.cadence,
        owner_id: clientOwner(key),
        profile: { demo: true, about: c.about },
        onboarded_externally: c.onboardedExternally,
        created_at: daysAgo(c.addedDaysAgo),
      }),
      insert('client_contacts', {
        org_id: org,
        client_id: clientIds[key],
        name: c.contact.name,
        email: c.contact.email,
        title: c.contact.title,
        is_spokesperson: true,
      }),
    )
  }

  for (const [key, e] of Object.entries(EMAILS) as [EmailKey, DemoEmail][]) {
    const { requested_date_in_days, ...fields } = e.extracted ?? {}
    const extracted = {
      company_name: null,
      contact_name: null,
      contact_email: null,
      release_topic: null,
      requested_date: null,
      tier_hint: null,
      ...fields,
    }
    const routedOwner = e.client && e.status !== 'unmatched' && e.status !== 'muted' ? clientOwner(e.client) : null
    out.push(
      insert('emails', {
        id: emailIds[key],
        org_id: org,
        provider_message_id: `${DEMO_MESSAGE_PREFIX}${key}`,
        internet_message_id: `<${key}@demo.example>`,
        thread_id: `${DEMO_MESSAGE_PREFIX}thread-${key}`,
        from_address: e.from.address,
        from_name: e.from.name,
        to_addresses: textArray([SHARED_INBOX]),
        subject: e.subject,
        body_text: e.body,
        received_at: hoursAgo(e.hoursAgo),
        label: e.label,
        confidence: e.confidence,
        client_id: e.client ? clientIds[e.client] : null,
        owner_id: routedOwner,
        suggested_action: e.suggestedAction,
        extracted:
          requested_date_in_days == null
            ? extracted
            : raw(
                `${literal(extracted)} || jsonb_build_object('requested_date', to_char(current_date + ${requested_date_in_days}, 'YYYY-MM-DD'))`,
              ),
        status: e.status,
        classified_by: e.classifiedBy,
        classified_at: hoursAgo(e.hoursAgo - 0.02),
        handled_by: e.status === 'handled' ? (routedOwner ?? owner('presenter')) : null,
        handled_at: e.status === 'handled' ? hoursAgo(Math.max(e.hoursAgo - 1, 0.1)) : null,
        created_at: hoursAgo(e.hoursAgo),
      }),
    )
  }

  for (const d of DOCUMENTS) {
    const id = randomUUID()
    const failed = d.error !== undefined
    out.push(
      insert('documents', {
        id,
        org_id: org,
        client_id: clientIds[d.client],
        source: 'upload',
        bucket: 'client-files',
        storage_path: `${org}/${clientIds[d.client]}/${id}/${d.filename}`,
        mime: d.mime,
        title: d.title,
        size_bytes: d.sizeBytes,
        index_status: failed ? 'failed' : 'indexed',
        index_error: d.error ?? null,
        indexed_at: failed ? null : daysAgo(d.daysAgo),
        created_by: clientOwner(d.client),
        created_at: daysAgo(d.daysAgo),
      }),
      ...d.chunks.map((content, i) =>
        insert('document_chunks', {
          org_id: org,
          document_id: id,
          client_id: clientIds[d.client],
          chunk_index: i,
          content,
          tokens: Math.ceil(content.split(/\s+/).length * 1.3),
        }),
      ),
      insert('jobs', {
        org_id: org,
        type: 'document.index',
        status: failed ? 'failed' : 'succeeded',
        progress: failed ? 0 : 100,
        progress_message: failed ? null : `Indexed ${d.chunks.length} ${d.chunks.length === 1 ? 'chunk' : 'chunks'}`,
        input: { document_id: id },
        error: d.error ?? null,
        attempts: 1,
        dedupe_key: id,
        client_id: clientIds[d.client],
        created_by: clientOwner(d.client),
        started_at: daysAgo(d.daysAgo),
        finished_at: daysAgo(d.daysAgo),
        created_at: daysAgo(d.daysAgo),
      }),
    )
  }

  for (const m of MEETINGS) {
    out.push(
      insert('meetings', {
        org_id: org,
        client_id: clientIds[m.client],
        kind: m.kind,
        scheduled_for: m.scheduledInDays !== undefined ? raw(`date_trunc('day', now()) + interval '${m.scheduledInDays} days 14 hours'`) : m.heldDaysAgo !== undefined ? daysAgo(m.heldDaysAgo) : null,
        held_on: m.heldDaysAgo !== undefined ? raw(`current_date - ${m.heldDaysAgo}`) : null,
        notes: m.notes ?? null,
        created_by: clientOwner(m.client),
      }),
    )
  }

  /** An artifact's versions, the AI jobs and calls behind them, its reviews and its status. */
  const artifactHistory = (
    artifactId: string,
    a: DemoArtifact,
    ctx: { client: ClientKey; releaseId: string | null; createdHoursAgo: number; content: (c: Record<string, unknown>) => unknown },
  ) => {
    const versionIds = a.versions.map(() => randomUUID())
    a.versions.forEach((v, i) => {
      let generationId: string | null = null
      if (v.origin === 'ai') {
        const jobId = randomUUID()
        generationId = randomUUID()
        const at = ctx.createdHoursAgo - i * 2
        const model = ROUTES[a.task].model
        const usage = { input_tokens: 9_400 + i * 800, output_tokens: 1_850, cache_read_input_tokens: 6_200 }
        out.push(
          insert('jobs', {
            id: jobId,
            org_id: org,
            type: a.task,
            status: 'succeeded',
            progress: 100,
            progress_message: 'Draft ready',
            input: {},
            attempts: 1,
            client_id: clientIds[ctx.client],
            release_id: ctx.releaseId,
            artifact_id: artifactId,
            created_by: clientOwner(ctx.client),
            started_at: hoursAgo(at),
            finished_at: hoursAgo(at - 0.01),
            created_at: hoursAgo(at),
          }),
          insert('generations', {
            id: generationId,
            org_id: org,
            job_id: jobId,
            model,
            task: a.task,
            inputs: { demo: true },
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_input_tokens: usage.cache_read_input_tokens,
            cost_usd: costUsd(model, usage),
            latency_ms: 34_000,
            stop_reason: 'end_turn',
            created_at: hoursAgo(at - 0.01),
          }),
        )
      }
      out.push(
        insert('artifact_versions', {
          id: versionIds[i],
          org_id: org,
          artifact_id: artifactId,
          content: ctx.content(v.content),
          origin: v.origin,
          generation_id: generationId,
          parent_version_id: i > 0 ? versionIds[i - 1] : null,
          created_by: v.by ? member(v.by) : null,
        }),
      )
    })
    for (const r of a.reviews ?? []) {
      out.push(
        insert('approvals', {
          org_id: org,
          artifact_version_id: versionIds[r.version - 1],
          action: r.action,
          actor_id: member(r.by),
          comment: r.comment ?? null,
          created_at: hoursAgo(r.hoursAgo),
        }),
      )
    }
    out.push(
      `update public.artifacts set status = ${literal(a.status)}, approved_version_id = ${literal(
        a.status === 'approved' ? versionIds.at(-1) : null,
      )} where id = ${literal(artifactId)};`,
    )
  }

  const TITLES = { research: 'preliminary research', onboarding_deck: 'onboarding deck', strategy: 'six-month strategy' }
  for (const a of ONBOARDING) {
    const id = randomUUID()
    out.push(
      insert('artifacts', {
        id,
        org_id: org,
        client_id: clientIds[a.client],
        type: a.type,
        title: `${CLIENTS[a.client].name} — ${TITLES[a.type]}`,
        created_by: clientOwner(a.client),
        created_at: daysAgo(a.createdDaysAgo),
      }),
    )
    artifactHistory(id, a, { client: a.client, releaseId: null, createdHoursAgo: a.createdDaysAgo * 24, content: (c) => c })
  }

  for (const r of RELEASES) {
    const releaseId = randomUUID()
    const artifactId = randomUUID()
    out.push(
      insert('releases', {
        id: releaseId,
        org_id: org,
        client_id: clientIds[r.client],
        title: r.title,
        mode: r.mode,
        due_on: dateIn(r.dueInDays),
        source_email_id: emailIds[r.sourceEmail],
        created_by: clientOwner(r.client),
        created_at: hoursAgo(r.createdHoursAgo),
      }),
      insert('artifacts', {
        id: artifactId,
        org_id: org,
        client_id: clientIds[r.client],
        release_id: releaseId,
        type: 'press_release',
        title: r.title,
        created_by: clientOwner(r.client),
        created_at: hoursAgo(r.createdHoursAgo),
      }),
    )
    // The dateline carries the release's due date.
    const content = (c: Record<string, unknown>) =>
      raw(`replace(${literal(JSON.stringify(c))}, '{date}', to_char(current_date + ${r.dueInDays}, 'FMMonth FMDD, YYYY'))::jsonb`)
    artifactHistory(artifactId, r, { client: r.client, releaseId, createdHoursAgo: r.createdHoursAgo, content })
  }

  return out
}
