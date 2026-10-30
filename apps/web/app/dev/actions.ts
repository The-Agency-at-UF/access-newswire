'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { clientInputSchema } from '@/lib/validation/client'

export type ActionState = { ok: boolean; message: string } | null

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrgSession()

  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') }
  }

  // org_id is left to the column default, which reads it from the Clerk token.
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('clients').insert(parsed.data).select('name').single()
  if (error) return { ok: false, message: error.message }

  revalidatePath('/dev')
  revalidatePath('/clients')
  return { ok: true, message: `Created ${data.name}.` }
}

export async function deleteClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireOrgSession()

  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { ok: false, message: 'Invalid client id.' }

  // delete_client purges the client's history too (versions are otherwise
  // append-only) and refuses anyone but an org admin.
  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('delete_client', { p_client_id: id.data })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/dev')
  revalidatePath('/clients')
  return { ok: true, message: 'Deleted.' }
}
