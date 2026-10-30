'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { clientInputSchema } from '@/lib/validation/client'

export type IntakeState = { message: string } | null

/** Create the client and open its workspace. */
export async function createClientAction(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  await requireOrgSession()

  const parsed = clientInputSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { message: parsed.error.issues.map((issue) => issue.message).join(' · ') }
  }

  // org_id is left to the column default, which reads it from the Clerk token.
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('clients').insert(parsed.data).select('id').single()
  if (error) return { message: error.message }

  revalidatePath('/clients')
  redirect(`/clients/${data.id}/overview`)
}
