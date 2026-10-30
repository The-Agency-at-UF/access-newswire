'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'

export type SettingsActionState = { ok: boolean; message: string } | null

function issues(error: z.ZodError): SettingsActionState {
  return { ok: false, message: error.issues.map((issue) => issue.message).join(' · ') }
}

/**
 * Connect the shared mailbox (admins; RLS enforces it). The new row queues the
 * Graph subscription and a first sync in the worker.
 */
export async function connectMailboxAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const session = await requireOrgSession()
  if (!session.isAdmin) return { ok: false, message: 'Only an admin can connect the mailbox.' }
  const parsed = z.object({ mailbox: z.email().transform((v) => v.toLowerCase()) }).safeParse(Object.fromEntries(formData))
  if (!parsed.success) return issues(parsed.error)

  const { error } = await (await supabaseServer()).from('mail_accounts').insert({ mailbox: parsed.data.mailbox })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/settings')
  return { ok: true, message: `Connected ${parsed.data.mailbox}. The first sync is queued.` }
}

const shiftSchema = z
  .object({ member_id: z.uuid(), starts_at: z.iso.datetime(), ends_at: z.iso.datetime() })
  .refine((s) => s.ends_at > s.starts_at, { message: 'The shift has to end after it starts.' })

/** Add an inbox-duty shift. Times arrive as UTC ISO strings, converted in the browser. */
export async function addShiftAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  await requireOrgSession()
  const parsed = shiftSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return issues(parsed.error)

  const { error } = await (await supabaseServer()).from('inbox_duty').insert(parsed.data)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/settings')
  revalidatePath('/inbox')
  return { ok: true, message: 'Shift added.' }
}

export async function removeShiftAction(_prev: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  await requireOrgSession()
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Invalid shift.' }

  const { error } = await (await supabaseServer()).from('inbox_duty').delete().eq('id', id.data)
  if (error) return { ok: false, message: error.message }

  revalidatePath('/settings')
  revalidatePath('/inbox')
  return { ok: true, message: 'Shift removed.' }
}
