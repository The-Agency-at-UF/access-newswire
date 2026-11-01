'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'

export type InboxActionState = { ok: boolean; message: string } | null

const EMAIL_LABELS = ['release_info', 'client_update', 'sales_handoff', 'social', 'auto_notification', 'other'] as const

const correctionSchema = z.object({
  email_id: z.uuid(),
  client_id: z.union([z.literal(''), z.uuid()]).transform((v) => v || null),
  label: z.enum(EMAIL_LABELS),
  remember: z.literal('on').optional(),
})

/**
 * Relabel or reassign a message. With "remember", `correct_email()` also
 * writes a `sender_rules` row so the sender routes the same way next time.
 */
export async function correctEmailAction(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  await requireOrgSession()
  const parsed = correctionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join(' · ') }

  const { error } = await (await supabaseServer()).rpc('correct_email', {
    p_email_id: parsed.data.email_id,
    // The function takes null for "no client"; the generated type says string.
    p_client_id: parsed.data.client_id as string,
    p_label: parsed.data.label,
    p_remember: parsed.data.remember === 'on',
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/inbox')
  return { ok: true, message: parsed.data.remember ? 'Saved. The sender will route this way next time.' : 'Saved.' }
}

/** Mark a message handled, or reopen it. Handled lives in our database, not the mailbox. */
export async function setHandledAction(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  await requireOrgSession()
  const parsed = z
    .object({ email_id: z.uuid(), handled: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: 'Invalid message.' }

  const handled = parsed.data.handled === 'true'
  const { error } = await (await supabaseServer()).rpc('set_email_handled', {
    p_email_id: parsed.data.email_id,
    p_handled: handled,
  })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/inbox')
  return { ok: true, message: handled ? 'Marked handled.' : 'Reopened.' }
}

const startReleaseSchema = z.object({
  email_id: z.uuid(),
  title: z.string().trim().min(1, 'Give the release a title.').max(200),
  due_on: z.union([z.literal(''), z.iso.date()]).transform((v) => v || null),
  instructions: z.string().trim().max(4000).optional().transform((v) => v || null),
})

/**
 * Start a release from a client's email: create it (the database checks the
 * gates and picks write or edit from the tier), queue the first draft, and
 * mark the email handled. The draft lands on the Releases tab for review.
 */
export async function startReleaseAction(_prev: InboxActionState, formData: FormData): Promise<InboxActionState> {
  await requireOrgSession()
  const parsed = startReleaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join(' · ') }
  const input = parsed.data
  const db = await supabaseServer()

  const { data: email, error: emailError } = await db.from('emails').select('id, client_id').eq('id', input.email_id).maybeSingle()
  if (emailError) return { ok: false, message: emailError.message }
  if (!email?.client_id) return { ok: false, message: 'Set the client for this email first.' }

  const { data: existing } = await db.from('releases').select('id').eq('source_email_id', email.id).maybeSingle()
  if (existing) return { ok: false, message: 'A release was already started from this email.' }

  const { data: releaseId, error } = await db.rpc('create_release', {
    p_client_id: email.client_id,
    p_title: input.title,
    p_due_on: input.due_on ?? undefined,
    p_source_email_id: email.id,
  })
  if (error) return { ok: false, message: error.message }

  const { data: release, error: releaseError } = await db.from('releases').select('mode').eq('id', releaseId).single()
  if (releaseError) return { ok: false, message: releaseError.message }

  // L2 is edit mode: the email body is the client's draft unless they attached one.
  const { error: jobError } = await db.rpc('enqueue_job', {
    p_type: release.mode === 'edit' ? 'release.edit' : 'release.draft',
    p_client_id: email.client_id,
    p_release_id: releaseId,
    p_input: { instructions: input.instructions },
  })
  if (jobError) return { ok: false, message: `The release was created, but the draft couldn't be queued: ${jobError.message}` }

  await db.rpc('set_email_handled', { p_email_id: email.id, p_handled: true })

  revalidatePath('/inbox')
  revalidatePath(`/clients/${email.client_id}`, 'layout')
  redirect(`/clients/${email.client_id}/releases`)
}
