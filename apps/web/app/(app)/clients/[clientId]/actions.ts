'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'

export type WorkspaceActionState = { ok: boolean; message: string } | null

/**
 * Mark a client as onboarded before the app (or undo it). The database then
 * lets their releases start without research, a deck or a strategy.
 */
export async function setOnboardedExternallyAction(
  _prev: WorkspaceActionState,
  formData: FormData,
): Promise<WorkspaceActionState> {
  await requireOrgSession()
  const parsed = z
    .object({ client_id: z.uuid(), value: z.enum(['true', 'false']) })
    .safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { ok: false, message: 'Invalid client.' }

  const value = parsed.data.value === 'true'
  const { error } = await (await supabaseServer())
    .from('clients')
    .update({ onboarded_externally: value })
    .eq('id', parsed.data.client_id)
  if (error) return { ok: false, message: error.message }

  revalidatePath(`/clients/${parsed.data.client_id}`, 'layout')
  revalidatePath('/clients')
  return { ok: true, message: value ? 'Marked as onboarded before the app.' : 'Onboarding stages apply again.' }
}
