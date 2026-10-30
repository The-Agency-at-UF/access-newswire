'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'

export type JobActionState = { ok: boolean; message: string } | null

/** Stop a queued or running job; the worker stops at its next checkpoint. */
export async function cancelJobAction(_prev: JobActionState, formData: FormData): Promise<JobActionState> {
  await requireOrgSession()
  const jobId = z.uuid().safeParse(formData.get('job_id'))
  if (!jobId.success) return { ok: false, message: 'Invalid job id.' }

  const { error } = await (await supabaseServer()).rpc('cancel_job', { p_job_id: jobId.data })
  if (error) return { ok: false, message: error.message }

  revalidatePath('/clients', 'layout')
  return { ok: true, message: 'Canceled.' }
}
