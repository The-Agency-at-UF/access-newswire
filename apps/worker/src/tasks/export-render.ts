/**
 * export.render — an artifact's **approved** version as .docx, .pptx or .csv
 * in the `exports` bucket, with a `documents` row (AGENTS.md §13). The app
 * only produces files; people send them.
 */

import { renderDeck, renderDocx, renderMediaListCsv, type CsvColumn, type MediaListRow } from '@access/exports'
import type { Tables } from '@access/db'
import { z } from 'zod'
import type { Task } from '../context'
import { PermanentError } from '../lib/errors'
import { safeFilename, upload } from '../lib/files'

const inputSchema = z.object({
  artifact_id: z.guid(),
  format: z.enum(['docx', 'pptx', 'csv']),
})

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
} as const

const DEFAULT_COLUMNS: CsvColumn[] = [
  { header: 'First Name', field: 'first_name' },
  { header: 'Last Name', field: 'last_name' },
  { header: 'Email', field: 'email' },
  { header: 'Outlet', field: 'outlet' },
]

interface Content {
  sections?: { id: string; heading: string; body: string; speaker_notes?: string }[]
  headline?: string
  subheadline?: string | null
  dateline?: string
  boilerplate?: string
  suggested_edits?: { section_id: string; original: string; suggestion: string; reason: string }[]
}

export const exportRender: Task = async (ctx) => {
  const input = inputSchema.parse(ctx.job.input)
  const [artifact] = await ctx.sql<(Tables<'artifacts'> & { client_name: string })[]>`
    select a.*, c.name as client_name from public.artifacts a join public.clients c on c.id = a.client_id
    where a.id = ${input.artifact_id} and a.org_id = ${ctx.job.org_id}`
  if (!artifact) throw new PermanentError('artifact not found')
  if (!artifact.approved_version_id) throw new PermanentError('only approved work can be exported')

  const [version] = await ctx.sql<Tables<'artifact_versions'>[]>`
    select * from public.artifact_versions where id = ${artifact.approved_version_id}`
  const content = (version!.content ?? {}) as Content
  const sections = content.sections ?? []

  await ctx.progress(30, `Rendering ${input.format}`)
  let bytes: Uint8Array

  if (input.format === 'csv') {
    if (artifact.type !== 'media_list') throw new PermanentError('CSV export is for media lists')
    const rows = await ctx.sql<MediaListRow[]>`
      select j.name, j.email, j.title, o.name as outlet, j.beats, e.relevance_reason
      from public.media_list_entries e
      join public.journalists j on j.id = e.journalist_id
      left join public.outlets o on o.id = j.outlet_id
      where e.artifact_version_id = ${version!.id} and e.included and not j.do_not_contact
      order by e.position`
    const [settings] = await ctx.sql<{ access_csv_columns: CsvColumn[] }[]>`
      select access_csv_columns from public.org_settings where org_id = ${ctx.job.org_id}`
    bytes = new TextEncoder().encode(renderMediaListCsv(rows, settings?.access_csv_columns ?? DEFAULT_COLUMNS))
  } else if (input.format === 'pptx') {
    if (artifact.type !== 'onboarding_deck') throw new PermanentError('PPTX export is for onboarding decks')
    bytes = await renderDeck({
      title: artifact.title,
      subtitle: artifact.client_name,
      slides: sections.map((s) => ({ heading: s.heading, body: s.body, speaker_notes: s.speaker_notes ?? null })),
    })
  } else {
    bytes = await renderDocx({
      title: artifact.title,
      subtitle: artifact.client_name,
      sections,
      release:
        artifact.type === 'press_release' && content.headline
          ? {
              headline: content.headline,
              subheadline: content.subheadline ?? null,
              dateline: content.dateline ?? '',
              boilerplate: content.boilerplate ?? '',
            }
          : null,
      suggestedEdits: content.suggested_edits ?? null,
    })
  }

  await ctx.progress(70, 'Saving')
  const [doc] = await ctx.sql<{ id: string }[]>`select gen_random_uuid() as id`
  const filename = safeFilename(`${artifact.title} v${version!.version}.${input.format}`)
  const path = `${ctx.job.org_id}/${artifact.client_id}/${doc!.id}/${filename}`
  await upload(ctx, 'exports', path, bytes, MIME[input.format])

  await ctx.sql`
    insert into public.documents (id, org_id, client_id, source, bucket, storage_path, mime, title, size_bytes,
                                  index_status, created_by)
    values (${doc!.id}, ${ctx.job.org_id}, ${artifact.client_id}, 'generated', 'exports', ${path}, ${MIME[input.format]},
            ${filename}, ${bytes.byteLength}, 'skipped', ${ctx.job.created_by})`

  return { document_id: doc!.id, path }
}
