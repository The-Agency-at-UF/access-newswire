/**
 * stats.import — an uploaded ACCESS stats CSV into `access_stats`. ACCESS's
 * export format is still open (AGENTS.md §16), so every row is kept as-is
 * and numeric columns are totalled; an import for the same client, release
 * and period replaces the previous one.
 */

import { parse } from 'csv-parse/sync'
import type { Tables } from '@access/db'
import { z } from 'zod'
import type { Task } from '../context'
import { PermanentError } from '../lib/errors'
import { download } from '../lib/files'

const inputSchema = z.object({
  document_id: z.guid(),
  release_id: z.guid().nullable().optional(),
  period_start: z.iso.date(),
  period_end: z.iso.date(),
})

const MAX_ROWS = 5000

export function totals(rows: Record<string, string>[]): Record<string, number> {
  const sums: Record<string, number> = {}
  const columns = Object.keys(rows[0] ?? {})
  for (const column of columns) {
    const values = rows.map((row) => (row[column] ?? '').replace(/[,$%\s]/g, ''))
    if (values.length && values.every((value) => value === '' || Number.isFinite(Number(value)))) {
      sums[column] = values.reduce((sum, value) => sum + (value === '' ? 0 : Number(value)), 0)
    }
  }
  return sums
}

export const statsImport: Task = async (ctx) => {
  const input = inputSchema.parse(ctx.job.input)
  if (!ctx.job.client_id) throw new PermanentError('stats import needs a client')

  const [doc] = await ctx.sql<Tables<'documents'>[]>`
    select * from public.documents
    where id = ${input.document_id} and org_id = ${ctx.job.org_id} and client_id = ${ctx.job.client_id}`
  if (!doc) throw new PermanentError('stats file not found for this client')

  const text = new TextDecoder().decode(await download(ctx, doc.bucket, doc.storage_path))
  const rows = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true }) as Record<string, string>[]
  if (rows.length === 0) throw new PermanentError('the CSV has no rows')
  if (rows.length > MAX_ROWS) throw new PermanentError(`the CSV has more than ${MAX_ROWS} rows`)

  const metrics = { columns: Object.keys(rows[0]!), rows, totals: totals(rows) }
  await ctx.sql`
    insert into public.access_stats (org_id, client_id, release_id, period_start, period_end, metrics, source_document_id, imported_by)
    values (${ctx.job.org_id}, ${ctx.job.client_id}, ${input.release_id ?? null}, ${input.period_start}, ${input.period_end},
            ${ctx.sql.json(metrics as never)}, ${doc.id}, ${ctx.job.created_by})
    on conflict (client_id, release_id, period_start, period_end) do update
      set metrics = excluded.metrics, source_document_id = excluded.source_document_id,
          imported_by = excluded.imported_by, created_at = now()`

  return { rows: rows.length, totals: metrics.totals }
}
