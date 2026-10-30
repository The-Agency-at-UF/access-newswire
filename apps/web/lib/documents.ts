import 'server-only'
import type { supabaseServer } from '@/lib/supabase/server'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '@/lib/uploads'

/**
 * Store an upload in `client-files` and record its `documents` row, as the
 * signed-in user. The storage policy requires the first path segment to be
 * the caller's org (AGENTS.md §9); a pending row queues `document.index`.
 */
export async function uploadClientDocument(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  { orgId, clientId, file, title }: { orgId: string; clientId: string; file: unknown; title: string | null },
): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Files are limited to ${MAX_UPLOAD_MB} MB.`)

  const documentId = crypto.randomUUID()
  const filename = file.name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-') || 'file'
  const path = `${orgId}/${clientId}/${documentId}/${filename}`

  const { error: uploadError } = await db.storage.from('client-files').upload(path, file, { contentType: file.type || undefined })
  if (uploadError) throw new Error(uploadError.message)

  const { error } = await db.from('documents').insert({
    id: documentId,
    client_id: clientId,
    source: 'upload',
    bucket: 'client-files',
    storage_path: path,
    mime: file.type || null,
    title: title ?? file.name,
    size_bytes: file.size,
  })
  if (error) {
    // Don't leave an orphaned object behind a failed insert.
    await db.storage.from('client-files').remove([path])
    throw new Error(error.message)
  }
  return file.name
}
