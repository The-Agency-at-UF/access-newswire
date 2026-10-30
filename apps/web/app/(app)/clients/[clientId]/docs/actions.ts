'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { uploadClientDocument } from '@/lib/documents'
import { supabaseServer } from '@/lib/supabase/server'

export type UploadState = { ok: boolean; message: string } | null

const uploadSchema = z.object({
  client_id: z.uuid(),
  title: z.string().trim().max(300).optional().transform((v) => v || null),
})

/** Upload a file to the client's knowledge base; indexing is queued by the insert. */
export async function uploadDocumentAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const session = await requireOrgSession()
  const parsed = uploadSchema.safeParse({ client_id: formData.get('client_id'), title: formData.get('title') ?? undefined })
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join(' · ') }

  try {
    const name = await uploadClientDocument(await supabaseServer(), {
      orgId: session.orgId,
      clientId: parsed.data.client_id,
      file: formData.get('file'),
      title: parsed.data.title,
    })
    revalidatePath(`/clients/${parsed.data.client_id}/docs`)
    return { ok: true, message: `Uploaded ${name}. Indexing is queued.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/** Queue indexing again for a document that failed or was skipped. */
export async function reindexDocumentAction(_prev: UploadState, formData: FormData): Promise<UploadState> {
  await requireOrgSession()
  const parsed = z.object({ client_id: z.uuid(), document_id: z.uuid() }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: 'Invalid document.' }

  const { error } = await (await supabaseServer()).rpc('enqueue_job', {
    p_type: 'document.index',
    p_client_id: parsed.data.client_id,
    p_input: { document_id: parsed.data.document_id },
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath(`/clients/${parsed.data.client_id}/docs`)
  return { ok: true, message: 'Indexing is queued.' }
}
