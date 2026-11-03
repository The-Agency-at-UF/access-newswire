'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { pressReleaseSchema, releaseEditSchema } from '@access/ai/schemas'
import { requireOrgSession } from '@/lib/auth'
import { editedFromForm, nextOrigin, writtenFromForm } from '@/lib/releaseDraft'
import { supabaseServer } from '@/lib/supabase/server'

export type ReleaseActionState = { ok: boolean; message: string } | null

const issues = (error: z.ZodError) => error.issues.map((issue) => issue.message).join(' · ')

/**
 * Save an edit as a new version (versions are never overwritten). Refuses if
 * someone saved a newer version since the form was opened. The database puts
 * the release back in draft; an approved version stays approved until a newer
 * one is approved.
 */
export async function saveReleaseAction(_prev: ReleaseActionState, formData: FormData): Promise<ReleaseActionState> {
  await requireOrgSession()
  const parsed = z
    .object({ artifact_id: z.uuid(), parent_version_id: z.uuid() })
    .safeParse({ artifact_id: formData.get('artifact_id'), parent_version_id: formData.get('parent_version_id') })
  if (!parsed.success) return { ok: false, message: 'Invalid release.' }
  const db = await supabaseServer()

  const [{ data: artifact, error: artifactError }, { data: latest, error: latestError }] = await Promise.all([
    db.from('artifacts').select('id, client_id, type, release:releases(mode)').eq('id', parsed.data.artifact_id).maybeSingle(),
    db
      .from('artifact_versions')
      .select('id, origin, content')
      .eq('artifact_id', parsed.data.artifact_id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (artifactError || latestError) return { ok: false, message: (artifactError ?? latestError)!.message }
  if (!artifact || artifact.type !== 'press_release' || !artifact.release) return { ok: false, message: 'Release not found.' }
  if (!latest || latest.id !== parsed.data.parent_version_id) {
    return { ok: false, message: 'Someone saved a newer version. Reload to see it before editing.' }
  }

  let content: unknown
  if (artifact.release.mode === 'edit') {
    const previous = releaseEditSchema.safeParse(latest.content)
    if (!previous.success) return { ok: false, message: 'The current version isn’t in the edit format.' }
    content = editedFromForm(formData, previous.data)
  } else {
    const written = pressReleaseSchema
      .refine((r) => r.headline, 'Add a headline.')
      .refine((r) => r.dateline, 'Add a dateline.')
      .refine((r) => r.sections.length > 0, 'Keep at least one section.')
      .safeParse(writtenFromForm(formData))
    if (!written.success) return { ok: false, message: issues(written.error) }
    content = written.data
  }

  const { error } = await db.from('artifact_versions').insert({
    artifact_id: artifact.id,
    content: content as never,
    origin: nextOrigin(latest.origin),
    parent_version_id: latest.id,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath(`/clients/${artifact.client_id}/releases`)
  return { ok: true, message: 'Saved a new version.' }
}

const reviewSchema = z
  .object({
    client_id: z.uuid(),
    version_id: z.uuid(),
    action: z.enum(['submit', 'approve', 'changes']),
    comment: z.string().trim().max(2000).optional().transform((v) => v || null),
  })
  .refine((r) => r.action !== 'changes' || r.comment, { message: 'Say what needs to change.', path: ['comment'] })

const REVIEWED = { submit: 'Sent for review.', approve: 'Approved.', changes: 'Changes requested.' }

/**
 * Send for review, approve or request changes. The database functions check
 * that it's the latest version and log who did it; any team member may approve.
 */
export async function reviewReleaseAction(_prev: ReleaseActionState, formData: FormData): Promise<ReleaseActionState> {
  await requireOrgSession()
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: issues(parsed.error) }
  const { version_id, action, comment } = parsed.data
  const db = await supabaseServer()

  const { error } =
    action === 'submit'
      ? await db.rpc('submit_for_review', { p_version_id: version_id, p_comment: comment ?? undefined })
      : action === 'approve'
        ? await db.rpc('approve_version', { p_version_id: version_id, p_comment: comment ?? undefined })
        : await db.rpc('request_changes', { p_version_id: version_id, p_comment: comment ?? '' })
  if (error) return { ok: false, message: error.message }

  revalidatePath(`/clients/${parsed.data.client_id}/releases`)
  return { ok: true, message: REVIEWED[action] }
}
