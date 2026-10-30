/**
 * document.index — extract text, chunk it, embed it, store the chunks
 * (AGENTS.md §10.4). Rerunning replaces the document's chunks.
 *
 * Without VOYAGE_API_KEY chunks are stored unembedded: keyword search still
 * works, and a later re-index adds the vectors.
 */

import { chunkText, embed, toPgVector } from '@access/ai'
import type { Tables } from '@access/db'
import { requireInput, type Task } from '../context'
import { extractTextFrom } from '../lib/extract'
import { download } from '../lib/files'

export const documentIndex: Task = async (ctx) => {
  const documentId = requireInput(ctx.job.input && (ctx.job.input as { document_id?: string }).document_id, 'document_id')
  const [doc] = await ctx.sql<Tables<'documents'>[]>`
    select * from public.documents where id = ${documentId} and org_id = ${ctx.job.org_id}`
  if (!doc) return { skipped: 'document no longer exists' }

  await ctx.sql`update public.documents set index_status = 'indexing', index_error = null where id = ${doc.id}`

  try {
    await ctx.progress(10, 'Downloading')
    const bytes = await download(ctx, doc.bucket, doc.storage_path)
    const filename = doc.storage_path.split('/').pop() ?? doc.title

    await ctx.progress(30, 'Reading')
    const text = await extractTextFrom(bytes, doc.mime, filename)
    if (!text?.trim()) {
      await ctx.sql`update public.documents set index_status = 'skipped', indexed_at = now() where id = ${doc.id}`
      return { chunks: 0, reason: text === null ? 'unsupported file type' : 'no text found' }
    }

    const chunks = chunkText(text)
    await ctx.checkCanceled()

    let vectors: number[][] | null = null
    if (ctx.env.VOYAGE_API_KEY) {
      await ctx.progress(55, `Embedding ${chunks.length} chunks`)
      vectors = (await embed(chunks.map((chunk) => chunk.content), 'document', { apiKey: ctx.env.VOYAGE_API_KEY })).vectors
    }

    await ctx.progress(85, 'Saving')
    await ctx.sql.begin(async (tx) => {
      await tx`delete from public.document_chunks where document_id = ${doc.id} and org_id = ${doc.org_id}`
      for (const [i, chunk] of chunks.entries()) {
        const vector = vectors?.[i]
        await tx`
          insert into public.document_chunks (org_id, document_id, client_id, chunk_index, content, tokens, embedding)
          values (${doc.org_id}, ${doc.id}, ${doc.client_id}, ${chunk.index}, ${chunk.content}, ${chunk.tokens},
                  ${vector ? toPgVector(vector) : null}::extensions.vector)`
      }
      await tx`
        update public.documents set index_status = 'indexed', indexed_at = now(), index_error = null
        where id = ${doc.id}`
    })

    return { chunks: chunks.length, embedded: vectors !== null }
  } catch (error) {
    await ctx.sql`
      update public.documents set index_status = 'failed', index_error = ${String((error as Error).message).slice(0, 500)}
      where id = ${doc.id}`
    throw error
  }
}
