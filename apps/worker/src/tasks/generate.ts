/**
 * The generation tasks (AGENTS.md §10, §11):
 *
 *   research.run · onboarding.generate · strategy.phase · release.draft
 *   release.edit · medialist.build · pitches.generate
 *
 * One path for all of them: framework → context → Claude (structured output)
 * → a new artifact_versions row (origin 'ai') → generations log. The artifact
 * is created if needed, which is where the database's stage gates apply.
 *
 * Idempotent by job_id: if this job already wrote a version, it's returned.
 */

import {
  buildPrompt,
  createClaude,
  embed,
  generateStructured,
  mediaListRankingSchema,
  onboardingDeckSchema,
  onlyFoundSources,
  onlyKnownJournalists,
  pitchSetSchema,
  pressReleaseSchema,
  releaseEditSchema,
  researchSchema,
  researchWithWebSearch,
  strategySchema,
  toPgVector,
  type ApprovedArtifact,
  type ChunkInput,
  type FrameworkKind,
  type GenerationTask,
  type TriggerInput,
} from '@access/ai'
import type { Tables } from '@access/db'
import { z } from 'zod'
import type { Task, TaskContext } from '../context'
import { PermanentError } from '../lib/errors'
import { extractTextFrom } from '../lib/extract'
import { download } from '../lib/files'
import { activeFramework } from '../lib/frameworks'
import { logGeneration } from '../lib/generations'

type ArtifactType = Tables<'artifacts'>['type']

const inputSchema = z.object({
  instructions: z.string().max(4000).nullable().optional(),
  /** Regenerate one section of the latest version; the rest is kept. */
  section_id: z.string().nullable().optional(),
  /** release.edit: the client's draft, if it isn't the release's source email. */
  draft_document_id: z.guid().nullable().optional(),
  draft_text: z.string().max(100_000).nullable().optional(),
})

interface Stage {
  type: ArtifactType
  framework: FrameworkKind | ((release: Tables<'releases'> | null) => FrameworkKind)
  upstream: ArtifactType[]
  schema: z.ZodType
  title: (client: Tables<'clients'>, release: Tables<'releases'> | null) => string
}

const STAGES: Record<GenerationTask, Stage | null> = {
  'email.classify': null,
  'research.run': {
    type: 'research',
    framework: 'research',
    upstream: [],
    schema: researchSchema,
    title: (c) => `${c.name} — preliminary research`,
  },
  'onboarding.generate': {
    type: 'onboarding_deck',
    framework: 'onboarding_deck',
    upstream: ['research'],
    schema: onboardingDeckSchema,
    title: (c) => `${c.name} — onboarding deck`,
  },
  'strategy.phase': {
    type: 'strategy',
    framework: 'strategy',
    upstream: ['research', 'onboarding_deck'],
    schema: strategySchema,
    title: (c) => `${c.name} — six-month strategy`,
  },
  'release.draft': {
    type: 'press_release',
    framework: 'press_release_write',
    upstream: ['research', 'strategy'],
    schema: pressReleaseSchema,
    title: (_c, r) => r?.title ?? 'Press release',
  },
  'release.edit': {
    type: 'press_release',
    framework: 'press_release_edit',
    upstream: ['strategy'],
    schema: releaseEditSchema,
    title: (_c, r) => r?.title ?? 'Press release',
  },
  'medialist.build': {
    type: 'media_list',
    framework: 'media_list',
    upstream: ['strategy', 'press_release'],
    schema: mediaListRankingSchema,
    title: (_c, r) => `${r?.title ?? 'Release'} — media list`,
  },
  'pitches.generate': {
    type: 'pitch_set',
    framework: 'pitch_set',
    upstream: ['press_release', 'media_list'],
    schema: pitchSetSchema,
    title: (_c, r) => `${r?.title ?? 'Release'} — pitches`,
  },
}

const RELEASE_TYPES: ArtifactType[] = ['press_release', 'media_list', 'pitch_set']

export const generate: Task = async (ctx) => {
  const task = ctx.job.type as GenerationTask
  const stage = STAGES[task]
  if (!stage) throw new PermanentError(`${task} is not a generation task`)
  const input = inputSchema.parse(ctx.job.input)
  const org = ctx.job.org_id

  // Idempotency: a version this job already wrote.
  const [done] = await ctx.sql<{ id: string; artifact_id: string }[]>`
    select v.id, v.artifact_id from public.artifact_versions v
    join public.generations g on g.id = v.generation_id
    where g.job_id = ${ctx.job.id} and v.org_id = ${org}`
  if (done) return { artifact_id: done.artifact_id, version_id: done.id, reused: true }

  if (!ctx.env.ANTHROPIC_API_KEY) throw new PermanentError('ANTHROPIC_API_KEY is not set on the worker.')
  const claude = createClaude(ctx.env.ANTHROPIC_API_KEY)

  const [client] = await ctx.sql<Tables<'clients'>[]>`
    select * from public.clients where id = ${ctx.job.client_id} and org_id = ${org}`
  if (!client) throw new PermanentError('job has no client in this org')

  const isReleaseWork = RELEASE_TYPES.includes(stage.type)
  const [release] = isReleaseWork
    ? await ctx.sql<Tables<'releases'>[]>`
        select * from public.releases where id = ${ctx.job.release_id} and client_id = ${client.id} and org_id = ${org}`
    : []
  if (isReleaseWork && !release) throw new PermanentError(`${task} needs a release`)

  await ctx.progress(5, 'Preparing')
  const artifact = await findOrCreateArtifact(ctx, client, release ?? null, stage)
  const frameworkKind = typeof stage.framework === 'function' ? stage.framework(release ?? null) : stage.framework
  const framework = await activeFramework(ctx.sql, org, frameworkKind)

  const upstream = await approvedUpstream(ctx, client.id, release?.id ?? null, stage.upstream)
  const [latest] = await ctx.sql<Tables<'artifact_versions'>[]>`
    select * from public.artifact_versions where artifact_id = ${artifact.id} order by version desc limit 1`

  const trigger: TriggerInput = { instructions: input.instructions ?? null, data: {} }
  const data = trigger.data as Record<string, unknown>

  if (release) {
    data.release = { title: release.title, mode: release.mode, due_on: release.due_on, roadmap_item: release.roadmap_item }
    if (release.source_email_id) trigger.email = await emailInput(ctx, release.source_email_id)
  }
  if (stage.type === 'strategy') {
    data.meetings = await ctx.sql`
      select kind, held_on, notes from public.meetings
      where client_id = ${client.id} and org_id = ${org} order by coalesce(held_on, scheduled_for::date)`
  }
  if (task === 'release.edit') {
    data.client_draft = await clientDraft(ctx, input, trigger)
  }

  let candidates: { id: string }[] = []
  if (task === 'medialist.build') {
    candidates = await ctx.sql`
      select j.id, j.name, j.title, o.name as outlet, j.beats,
             exists (select 1 from public.core_lists cl where cl.client_id = ${client.id} and cl.journalist_id = j.id) as on_core_list
      from public.journalists j left join public.outlets o on o.id = j.outlet_id
      where j.org_id = ${org} and not j.do_not_contact
      order by on_core_list desc, j.name
      limit 150`
    if (candidates.length === 0) throw new PermanentError('the journalist directory has no contactable journalists yet')
    data.candidates = candidates
  }
  if (task === 'pitches.generate') {
    const listVersion = upstream.find((a) => a.type === 'media_list') as (ApprovedArtifact & { versionId: string }) | undefined
    candidates = await ctx.sql`
      select j.id, j.name, j.title, o.name as outlet, j.beats, e.relevance_reason
      from public.media_list_entries e
      join public.journalists j on j.id = e.journalist_id
      left join public.outlets o on o.id = j.outlet_id
      where e.artifact_version_id = ${listVersion?.versionId ?? null} and e.included and not j.do_not_contact
      order by e.position`
    if (candidates.length === 0) throw new PermanentError('the approved media list has no journalists to pitch')
    data.journalists = candidates
  }
  if (input.section_id) {
    if (!latest) throw new PermanentError('there is no version to regenerate a section of')
    data.regenerate_section_id = input.section_id
    data.current_version = latest.content
    trigger.instructions = `Rewrite only the section "${input.section_id}". Return the full artifact; other sections are kept as they are.${
      input.instructions ? `\n\n${input.instructions}` : ''
    }`
  }

  await ctx.progress(15, 'Finding relevant documents')
  const chunks = await retrieve(ctx, client, release ?? null, input.instructions ?? null)
  await ctx.checkCanceled()

  const prompt = buildPrompt({
    framework: { id: framework.id, title: framework.title, body: framework.body },
    client: {
      name: client.name,
      tier: client.tier,
      industry: client.industry,
      website: client.website,
      release_cadence: client.release_cadence,
      profile: (client.profile ?? {}) as Record<string, unknown>,
    },
    upstream,
    chunks,
    trigger,
  })
  const refs = {
    framework_id: framework.id,
    upstream_version_ids: upstream.map((a) => (a as ApprovedArtifact & { versionId: string }).versionId),
    chunk_count: chunks.length,
    section_id: input.section_id ?? null,
  }

  let generationId: string
  let content: Record<string, unknown>

  if (task === 'research.run') {
    await ctx.progress(25, 'Researching on the web')
    const research = await researchWithWebSearch(claude, prompt)
    await logGeneration(ctx, task, research, framework.id, { ...refs, step: 'web_search', sources: research.sources.length })
    await ctx.checkCanceled()

    await ctx.progress(65, 'Writing up the research')
    const structured = await generateStructured(
      claude,
      task,
      withFindings(prompt, research.findings, research.sources),
      researchSchema,
    )
    generationId = await logGeneration(ctx, task, structured, framework.id, { ...refs, step: 'structure' })
    content = {
      ...structured.output,
      sections: onlyFoundSources(structured.output.sections, research.sources.map((s) => s.url)),
      sources: research.sources,
    }
  } else {
    await ctx.progress(30, 'Drafting')
    const result = await generateStructured(claude, task, prompt, stage.schema)
    generationId = await logGeneration(ctx, task, result, framework.id, refs)
    content = result.output as Record<string, unknown>

    if (task === 'medialist.build') {
      content.ranked = onlyKnownJournalists(content.ranked as { journalist_id: string }[], candidates.map((c) => c.id))
    }
    if (task === 'pitches.generate') {
      content.pitches = onlyKnownJournalists(content.pitches as { journalist_id: string }[], candidates.map((c) => c.id))
    }
  }

  if (input.section_id && latest) content = mergeSection(latest.content as Record<string, unknown>, content, input.section_id)
  const origin = input.section_id && latest && latest.origin !== 'ai' ? 'mixed' : 'ai'

  await ctx.progress(90, 'Saving')
  const versionId = await ctx.sql.begin(async (tx) => {
    const [version] = await tx<{ id: string }[]>`
      insert into public.artifact_versions (org_id, artifact_id, content, origin, generation_id, parent_version_id)
      values (${org}, ${artifact.id}, ${tx.json(content as never)}, ${origin}, ${generationId}, ${latest?.id ?? null})
      returning id`
    if (task === 'medialist.build') {
      for (const [position, row] of (content.ranked as { journalist_id: string; relevance_reason: string; include: boolean }[]).entries()) {
        await tx`
          insert into public.media_list_entries (org_id, artifact_version_id, journalist_id, relevance_reason, included, position)
          values (${org}, ${version!.id}, ${row.journalist_id}, ${row.relevance_reason}, ${row.include}, ${position})`
      }
    }
    return version!.id
  })

  await ctx.sql`update public.jobs set artifact_id = ${artifact.id} where id = ${ctx.job.id}`
  return { artifact_id: artifact.id, version_id: versionId }
}

async function findOrCreateArtifact(
  ctx: TaskContext,
  client: Tables<'clients'>,
  release: Tables<'releases'> | null,
  stage: Stage,
): Promise<Tables<'artifacts'>> {
  const [existing] = await ctx.sql<Tables<'artifacts'>[]>`
    select * from public.artifacts
    where org_id = ${client.org_id} and client_id = ${client.id} and type = ${stage.type}
      and release_id is not distinct from ${release?.id ?? null} and status <> 'archived'`
  if (existing) return existing

  // The insert trigger enforces the stage gates and tier rules.
  const [created] = await ctx.sql<Tables<'artifacts'>[]>`
    insert into public.artifacts (org_id, client_id, release_id, type, title, created_by)
    values (${client.org_id}, ${client.id}, ${release?.id ?? null}, ${stage.type}, ${stage.title(client, release)}, ${ctx.job.created_by})
    returning *`
  return created!
}

/** Upstream artifacts' approved versions only (AGENTS.md §2.2). */
async function approvedUpstream(ctx: TaskContext, clientId: string, releaseId: string | null, types: ArtifactType[]) {
  if (types.length === 0) return []
  const rows = await ctx.sql<{ type: string; title: string; version: number; content: unknown; version_id: string }[]>`
    select a.type, a.title, v.version, v.content, v.id as version_id
    from public.artifacts a join public.artifact_versions v on v.id = a.approved_version_id
    where a.org_id = ${ctx.job.org_id} and a.client_id = ${clientId} and a.status <> 'archived'
      and a.type = any(${types}::public.artifact_type[])
      and (a.release_id is null or a.release_id = ${releaseId})`
  return rows.map((row) => ({ type: row.type, title: row.title, version: row.version, content: row.content, versionId: row.version_id }))
}

/** Top chunks from the client's knowledge base: hybrid when embeddings are available. */
async function retrieve(
  ctx: TaskContext,
  client: Tables<'clients'>,
  release: Tables<'releases'> | null,
  instructions: string | null,
): Promise<ChunkInput[]> {
  const query = [release?.title, release?.roadmap_item, instructions, client.name].filter(Boolean).join(' ')
  let vector: string | null = null
  if (ctx.env.VOYAGE_API_KEY && query) {
    const [first] = (await embed([query], 'query', { apiKey: ctx.env.VOYAGE_API_KEY })).vectors
    vector = first ? toPgVector(first) : null
  }
  // The worker bypasses RLS; client.id was loaded with the job's org filter.
  return ctx.sql<ChunkInput[]>`
    select document_title, content
    from public.match_chunks(${client.id}, ${vector}::extensions.vector, ${query}, 8)`
}

async function emailInput(ctx: TaskContext, emailId: string) {
  const [email] = await ctx.sql<Tables<'emails'>[]>`
    select * from public.emails where id = ${emailId} and org_id = ${ctx.job.org_id}`
  return email
    ? { from: email.from_address, subject: email.subject, body: email.body_text, received_at: email.received_at }
    : null
}

async function clientDraft(ctx: TaskContext, input: z.infer<typeof inputSchema>, trigger: TriggerInput): Promise<string> {
  if (input.draft_text) return input.draft_text
  if (input.draft_document_id) {
    const [doc] = await ctx.sql<Tables<'documents'>[]>`
      select * from public.documents where id = ${input.draft_document_id} and org_id = ${ctx.job.org_id}`
    if (!doc) throw new PermanentError('draft document not found')
    const text = await extractTextFrom(await download(ctx, doc.bucket, doc.storage_path), doc.mime, doc.storage_path)
    if (text?.trim()) return text
  }
  if (trigger.email?.body) return trigger.email.body
  throw new PermanentError("release.edit needs the client's draft: upload it, paste it, or start the release from their email")
}

/** The research write-up step: the same prompt plus the findings and the only citable sources. */
function withFindings(
  prompt: ReturnType<typeof buildPrompt>,
  findings: string,
  sources: { url: string; title: string }[],
): ReturnType<typeof buildPrompt> {
  const first = prompt.messages[0]!
  const note =
    `<research_findings>\n${findings}\n</research_findings>\n\n` +
    `<sources>\n${sources.map((s) => `${s.url} — ${s.title}`).join('\n')}\n</sources>\n\n` +
    'Write up the research. Cite only URLs from <sources> in each section\'s source_urls.'
  return { system: prompt.system, messages: [{ role: 'user', content: `${first.content as string}\n\n${note}` }] }
}

/** Keep every section of the current version except the one being regenerated. */
export function mergeSection(
  current: Record<string, unknown>,
  generated: Record<string, unknown>,
  sectionId: string,
): Record<string, unknown> {
  type Section = { id: string }
  const currentSections = (current.sections as Section[] | undefined) ?? []
  const replacement = ((generated.sections as Section[] | undefined) ?? []).find((s) => s.id === sectionId)
  if (!replacement) throw new PermanentError(`the regenerated output has no section "${sectionId}"`)
  const sections = currentSections.some((s) => s.id === sectionId)
    ? currentSections.map((s) => (s.id === sectionId ? replacement : s))
    : [...currentSections, replacement]
  return { ...current, sections }
}
