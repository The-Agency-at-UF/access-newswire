'use server'

/**
 * Server actions behind the backend console. Each one validates its form with
 * zod, then goes through the signed-in user's Supabase client, so RLS and the
 * database's rules (gates, immutability, do-not-contact, admin-only writes)
 * decide what's allowed. Errors come back as the database phrased them.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Enums } from '@access/db'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import type { ActionState } from './actions'

const id = z.guid()
const optionalId = z.union([z.literal(''), z.guid()]).optional().transform((v) => v || null)
const optionalText = z.string().trim().optional().transform((v) => v || null)
const json = z.string().transform((text, ctx) => {
  try {
    return JSON.parse(text || '{}') as unknown
  } catch {
    ctx.addIssue({ code: 'custom', message: 'not valid JSON' })
    return z.NEVER
  }
})

const ARTIFACT_TYPES = ['research', 'onboarding_deck', 'strategy', 'press_release', 'media_list', 'pitch_set', 'report'] as const
const EMAIL_LABELS = ['release_info', 'client_update', 'sales_handoff', 'social', 'auto_notification', 'other'] as const
const FRAMEWORK_KINDS = [
  'research', 'onboarding_deck', 'strategy', 'press_release_write', 'press_release_edit',
  'media_list', 'pitch_set', 'report', 'email_classify',
] as const satisfies readonly Enums<'framework_kind'>[]

type Supabase = Awaited<ReturnType<typeof supabaseServer>>

/** Parse the form, run the action, report the result, refresh the console. */
async function run<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  fn: (input: z.output<S>, db: Supabase, session: Awaited<ReturnType<typeof requireOrgSession>>) => Promise<string>,
): Promise<ActionState> {
  const session = await requireOrgSession()
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }
  }
  try {
    const message = await fn(parsed.data, await supabaseServer(), session)
    revalidatePath('/dev', 'layout')
    return { ok: true, message }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/** Throw the database's error, else return the data (null only for writes that select nothing). */
function check<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message)
  return result.data as NonNullable<T>
}

// ---------------------------------------------------------------- jobs

export async function startJob(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({
      type: z.enum([
        'research.run', 'onboarding.generate', 'strategy.phase', 'release.draft', 'release.edit',
        'medialist.build', 'pitches.generate', 'document.index', 'export.render', 'stats.import',
      ]),
      client_id: optionalId,
      release_id: optionalId,
      artifact_id: optionalId,
      input: json,
    }),
    async (input, db) => {
      const jobId = check(
        await db.rpc('enqueue_job', {
          p_type: input.type,
          p_input: input.input as never,
          p_client_id: input.client_id ?? undefined,
          p_release_id: input.release_id ?? undefined,
          p_artifact_id: input.artifact_id ?? undefined,
        }),
      )
      return `Queued ${input.type} (${String(jobId).slice(0, 8)}). Start the worker to run it.`
    },
  )
}

export async function cancelJob(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ job_id: id }), async ({ job_id }, db) => {
    check(await db.rpc('cancel_job', { p_job_id: job_id }))
    return 'Canceled.'
  })
}

// ---------------------------------------------------------------- releases, meetings

export async function createRelease(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ client_id: id, title: z.string().trim().min(1), due_on: optionalText, roadmap_item: optionalText }),
    async (input, db) => {
      check(
        await db.rpc('create_release', {
          p_client_id: input.client_id,
          p_title: input.title,
          p_due_on: input.due_on ?? undefined,
          p_roadmap_item: input.roadmap_item ?? undefined,
        }),
      )
      return `Release "${input.title}" created.`
    },
  )
}

export async function markUploaded(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ release_id: id }), async ({ release_id }, db) => {
    check(await db.rpc('mark_access_uploaded', { p_release_id: release_id }))
    return 'Recorded the ACCESS upload.'
  })
}

export async function recordMeeting(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({
      client_id: id,
      kind: z.enum(['meeting_1', 'meeting_2', 'check_in']),
      held_on: optionalText,
      notes: optionalText,
    }),
    async (input, db) => {
      check(await db.from('meetings').insert({ client_id: input.client_id, kind: input.kind, held_on: input.held_on, notes: input.notes }))
      return input.held_on ? 'Meeting recorded as held.' : 'Meeting recorded (not held yet).'
    },
  )
}

export async function setOnboardedExternally(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ client_id: id, value: z.enum(['true', 'false']) }), async (input, db) => {
    check(await db.from('clients').update({ onboarded_externally: input.value === 'true' }).eq('id', input.client_id))
    return input.value === 'true' ? 'Marked as onboarded before the app.' : 'Onboarding gates apply again.'
  })
}

// ---------------------------------------------------------------- artifacts

export async function createArtifact(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ client_id: id, release_id: optionalId, type: z.enum(ARTIFACT_TYPES), title: z.string().trim().min(1) }),
    async (input, db) => {
      check(await db.from('artifacts').insert(input))
      return `${input.type} created.`
    },
  )
}

export async function saveVersion(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ artifact_id: id, content: json }), async (input, db) => {
    const [latest] = check(
      await db.from('artifact_versions').select('id, origin').eq('artifact_id', input.artifact_id).order('version', { ascending: false }).limit(1),
    )
    check(
      await db.from('artifact_versions').insert({
        artifact_id: input.artifact_id,
        content: input.content as never,
        // A person editing an AI draft makes it mixed; otherwise it's theirs.
        origin: latest && latest.origin !== 'human' ? 'mixed' : 'human',
        parent_version_id: latest?.id ?? null,
      }),
    )
    return 'Saved a new version.'
  })
}

export async function reviewVersion(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ version_id: id, action: z.enum(['submit', 'approve', 'changes']), comment: optionalText }),
    async (input, db) => {
      if (input.action === 'submit') check(await db.rpc('submit_for_review', { p_version_id: input.version_id, p_comment: input.comment ?? undefined }))
      if (input.action === 'approve') check(await db.rpc('approve_version', { p_version_id: input.version_id, p_comment: input.comment ?? undefined }))
      if (input.action === 'changes') check(await db.rpc('request_changes', { p_version_id: input.version_id, p_comment: input.comment ?? '' }))
      return { submit: 'Submitted for review.', approve: 'Approved.', changes: 'Changes requested.' }[input.action]
    },
  )
}

export async function archiveArtifact(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ artifact_id: id }), async ({ artifact_id }, db) => {
    check(await db.rpc('archive_artifact', { p_artifact_id: artifact_id }))
    return 'Archived.'
  })
}

// ---------------------------------------------------------------- documents

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export async function uploadDocument(_prev: ActionState, formData: FormData) {
  const file = formData.get('file')
  formData.delete('file')
  return run(formData, z.object({ client_id: id, title: optionalText }), async (input, db, session) => {
    if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file.')
    if (file.size > MAX_UPLOAD_BYTES) throw new Error('Files are limited to 25 MB.')

    const documentId = crypto.randomUUID()
    const filename = file.name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-') || 'file'
    const path = `${session.orgId}/${input.client_id}/${documentId}/${filename}`

    // Storage policy: the first path segment must be the caller's org.
    const { error: uploadError } = await db.storage.from('client-files').upload(path, file, { contentType: file.type || undefined })
    if (uploadError) throw new Error(uploadError.message)

    // A pending document queues document.index automatically.
    check(
      await db.from('documents').insert({
        id: documentId,
        client_id: input.client_id,
        source: 'upload',
        bucket: 'client-files',
        storage_path: path,
        mime: file.type || null,
        title: input.title ?? file.name,
        size_bytes: file.size,
      }),
    )
    return `Uploaded ${file.name}; indexing is queued.`
  })
}

// ---------------------------------------------------------------- inbox

export async function addMailbox(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ mailbox: z.email().transform((v) => v.toLowerCase()) }), async ({ mailbox }, db) => {
    check(await db.from('mail_accounts').insert({ mailbox }))
    return `Connected ${mailbox}; subscription and first sync are queued.`
  })
}

export async function correctEmail(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ email_id: id, client_id: optionalId, label: z.enum(EMAIL_LABELS), remember: z.literal('on').optional() }),
    async (input, db) => {
      check(
        await db.rpc('correct_email', {
          p_email_id: input.email_id,
          p_client_id: input.client_id as string,
          p_label: input.label,
          p_remember: input.remember === 'on',
        }),
      )
      return input.remember ? 'Corrected, and the sender is remembered.' : 'Corrected.'
    },
  )
}

export async function setHandled(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ email_id: id, handled: z.enum(['true', 'false']) }), async (input, db) => {
    check(await db.rpc('set_email_handled', { p_email_id: input.email_id, p_handled: input.handled === 'true' }))
    return input.handled === 'true' ? 'Handled.' : 'Reopened.'
  })
}

export async function addSenderRule(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ pattern: z.string().trim().toLowerCase().min(3), client_id: optionalId, label: z.union([z.literal(''), z.enum(EMAIL_LABELS)]).transform((v) => v || null) }),
    async (input, db) => {
      check(await db.from('sender_rules').insert(input))
      return `Rule for ${input.pattern} added.`
    },
  )
}

// ---------------------------------------------------------------- directory

export async function addOutlet(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ name: z.string().trim().min(1), type: optionalText, region: optionalText, url: optionalText }), async (input, db) => {
    check(await db.from('outlets').insert(input))
    return `${input.name} added.`
  })
}

export async function addJournalist(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({
      name: z.string().trim().min(1),
      email: z.union([z.literal(''), z.email()]).transform((v) => v.toLowerCase() || null),
      title: optionalText,
      outlet_id: optionalId,
      beats: z.string().optional().transform((v) => (v ?? '').split(',').map((b) => b.trim().toLowerCase()).filter(Boolean)),
    }),
    async (input, db) => {
      check(await db.from('journalists').insert({ ...input, source: 'manual' }))
      return `${input.name} added.`
    },
  )
}

export async function setDoNotContact(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ journalist_id: id, value: z.enum(['true', 'false']), reason: optionalText }), async (input, db) => {
    check(
      await db
        .from('journalists')
        .update({ do_not_contact: input.value === 'true', do_not_contact_reason: input.value === 'true' ? input.reason : null })
        .eq('id', input.journalist_id),
    )
    return input.value === 'true' ? 'Marked do-not-contact.' : 'Contactable again.'
  })
}

export async function addToCoreList(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ client_id: id, journalist_id: id }), async (input, db) => {
    check(await db.from('core_lists').insert(input))
    return 'Added to the core list.'
  })
}

// ---------------------------------------------------------------- frameworks & settings (admins)

export async function addFrameworkVersion(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({ kind: z.enum(FRAMEWORK_KINDS), title: z.string().trim().min(1), body: z.string().trim().min(1), activate: z.literal('on').optional() }),
    async (input, db) => {
      const [latest] = check(await db.from('frameworks').select('version').eq('kind', input.kind).order('version', { ascending: false }).limit(1))
      const created = check(
        await db
          .from('frameworks')
          .insert({ kind: input.kind, title: input.title, body: input.body, version: (latest?.version ?? 0) + 1 })
          .select('id, version')
          .single(),
      )
      if (input.activate) check(await db.rpc('activate_framework', { p_framework_id: created.id }))
      return `Saved ${input.kind} v${created.version}${input.activate ? ' and made it active' : ''}.`
    },
  )
}

export async function activateFramework(_prev: ActionState, formData: FormData) {
  return run(formData, z.object({ framework_id: id }), async ({ framework_id }, db) => {
    check(await db.rpc('activate_framework', { p_framework_id: framework_id }))
    return 'Active.'
  })
}

export async function saveOrgSettings(_prev: ActionState, formData: FormData) {
  return run(
    formData,
    z.object({
      classify_threshold: z.coerce.number().min(0).max(1),
      access_csv_columns: json.pipe(z.array(z.object({ header: z.string().min(1), field: z.string().min(1) }))),
    }),
    async (input, db, session) => {
      check(await db.from('org_settings').upsert({ org_id: session.orgId, ...input }))
      return 'Settings saved.'
    },
  )
}
