/**
 * Output schemas, one per artifact type (AGENTS.md §10): every artifact is
 * `{ sections: [{ id, heading, body }], ...typeSpecific }`.
 *
 * These go to Claude as structured-output formats, so keep them to plain
 * objects, strings, arrays, booleans, enums and nullables. Range and length
 * checks belong in the post-parse checks below, not in the schema.
 */

import { z } from 'zod'

export const sectionSchema = z.object({
  id: z.string().describe('Stable slug, e.g. "about" or "slide-3"; kept across regenerations'),
  heading: z.string(),
  body: z.string(),
})

export type Section = z.infer<typeof sectionSchema>

export const researchSchema = z.object({
  sections: z.array(
    sectionSchema.extend({
      source_urls: z.array(z.string()).describe('URLs from the provided source list that support this section'),
    }),
  ),
  competitors: z.array(
    z.object({ name: z.string(), what: z.string(), press: z.string(), gap: z.string() }),
  ),
  open_questions: z.array(z.string()).describe('What to ask the client in Meeting 1'),
})

/** One section per slide. */
export const onboardingDeckSchema = z.object({
  sections: z.array(sectionSchema.extend({ speaker_notes: z.string() })),
})

export const strategySchema = z.object({
  sections: z.array(sectionSchema),
  phases: z.array(
    z.object({
      name: z.string(),
      months: z.string().describe('e.g. "Months 1–2"'),
      goals: z.array(z.string()),
      tactics: z.array(z.string()),
    }),
  ),
  roadmap: z.array(z.object({ month: z.string(), item: z.string(), pillar: z.string() })),
  angle_bank: z.array(z.object({ angle: z.string(), hook: z.string(), pillar: z.string() })),
})

export const pressReleaseSchema = z.object({
  headline: z.string(),
  subheadline: z.string().nullable(),
  dateline: z.string().describe('City, State — Month Day, Year'),
  sections: z.array(sectionSchema),
  boilerplate: z.string().describe('About the company'),
})

/** L2: we edit the client's draft rather than write our own. */
export const releaseEditSchema = z.object({
  sections: z.array(sectionSchema).describe("The client's draft, split into sections, unchanged"),
  suggested_edits: z.array(
    z.object({
      section_id: z.string(),
      original: z.string().describe('Exact text from the draft'),
      suggestion: z.string(),
      reason: z.string(),
    }),
  ),
})

export const mediaListRankingSchema = z.object({
  sections: z.array(sectionSchema).describe('Short notes on the list as a whole'),
  ranked: z.array(
    z.object({
      journalist_id: z.string().describe('An id from the candidate list; never invent one'),
      relevance_reason: z.string(),
      include: z.boolean(),
    }),
  ),
})

export const pitchSetSchema = z.object({
  sections: z.array(sectionSchema).describe('The base pitch the per-journalist pitches adapt'),
  pitches: z.array(
    z.object({
      journalist_id: z.string().describe('An id from the media list; never invent one'),
      subject: z.string(),
      body: z.string(),
    }),
  ),
})

export const EMAIL_LABELS = [
  'release_info',
  'client_update',
  'sales_handoff',
  'social',
  'auto_notification',
  'other',
] as const

/** Fixed fields only: the classifier can label and extract, never act (AGENTS.md §2.8). */
export const emailClassificationSchema = z.object({
  label: z.enum(EMAIL_LABELS),
  client_id: z.string().nullable().describe('An id from the client list, or null if unsure'),
  confidence: z.number().describe('0 to 1'),
  suggested_action: z.string().describe('One short sentence for the person handling it'),
  extracted: z.object({
    company_name: z.string().nullable(),
    contact_name: z.string().nullable(),
    contact_email: z.string().nullable(),
    release_topic: z.string().nullable(),
    requested_date: z.string().nullable().describe('ISO date if the email names one'),
    tier_hint: z.enum(['L1', 'L2', 'L3']).nullable().describe('Sales handoffs only'),
  }),
})

export type EmailClassification = z.infer<typeof emailClassificationSchema>

// ------------------------------------------------------------ post-parse checks

export class InvalidOutputError extends Error {
  override name = 'InvalidOutputError'
}

/**
 * Keep only rows whose journalist_id was offered. Claude ranks and explains;
 * it never supplies a contact (AGENTS.md §2.4). Unknown ids are dropped, and
 * an output that offered nothing usable is rejected.
 */
export function onlyKnownJournalists<T extends { journalist_id: string }>(rows: T[], allowed: Iterable<string>): T[] {
  const ids = new Set(allowed)
  const kept = rows.filter((row) => ids.has(row.journalist_id))
  if (rows.length > 0 && kept.length === 0) {
    throw new InvalidOutputError('output named no journalist from the candidate list')
  }
  const seen = new Set<string>()
  return kept.filter((row) => (seen.has(row.journalist_id) ? false : (seen.add(row.journalist_id), true)))
}

/** Drop cited URLs that the research step didn't actually find. */
export function onlyFoundSources<T extends { source_urls: string[] }>(sections: T[], found: Iterable<string>): T[] {
  const urls = new Set(found)
  return sections.map((section) => ({ ...section, source_urls: section.source_urls.filter((url) => urls.has(url)) }))
}

/** Clamp confidence into [0, 1] and drop a client_id that wasn't offered. */
export function sanitizeClassification(
  output: EmailClassification,
  clientIds: Iterable<string>,
): EmailClassification {
  const ids = new Set(clientIds)
  return {
    ...output,
    client_id: output.client_id && ids.has(output.client_id) ? output.client_id : null,
    confidence: Math.min(1, Math.max(0, Number.isFinite(output.confidence) ? output.confidence : 0)),
  }
}
