'use server'

import { revalidatePath } from 'next/cache'
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
