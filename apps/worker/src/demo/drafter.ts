/**
 * A stand-in for the worker during demos: picks up release drafts queued in the
 * demo team, shows progress for about half a minute, then writes a
 * pre-written draft instead of calling Claude.
 *
 * Only touches jobs in the demo team (every query filters by its org id,
 * because the secret key bypasses RLS). Its usage rows say `stand_in` and cost
 * nothing, so they can't be mistaken for real calls.
 */

import { createClient } from '@supabase/supabase-js'
import { ROUTES, type GenerationTask } from '@access/ai'
import type { Database, Json } from '@access/db'
import { STAND_IN_DRAFTS, type EmailKey } from './data'

const TASKS = ['release.draft', 'release.edit'] as const
const STEPS: [number, string][] = [
  [15, 'Reading the email and the client’s documents'],
  [45, 'Drafting'],
  [80, 'Checking the draft against the strategy'],
]
const STEP_MS = 9_000
const POLL_MS = 2_000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const dateline = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

type Db = ReturnType<typeof createClient<Database>>

/** For writes that return nothing. */
function ok(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message)
}

function must<R extends { data: unknown; error: { message: string } | null }>(result: R): NonNullable<R['data']> {
  if (result.error) throw new Error(result.error.message)
  if (result.data == null) throw new Error('not found')
  return result.data as NonNullable<R['data']>
}

/** A plain draft from the email when there's no pre-written one. */
function fallback(mode: 'write' | 'edit', title: string, body: string, clientName: string) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)
  const sections = (paragraphs.length ? paragraphs : [body.trim() || title]).map((p, i) => ({
    id: `section-${i + 1}`,
    heading: i === 0 ? 'Opening' : `Section ${i + 1}`,
    body: p,
  }))
  return mode === 'edit'
    ? { sections, suggested_edits: [] }
    : { headline: title, subheadline: null, dateline: '{date}', sections, boilerplate: `About ${clientName}.` }
}

async function draft(db: Db, orgId: string, job: Database['public']['Tables']['jobs']['Row']) {
  const claimed = must(
    await db
      .from('jobs')
      .update({ status: 'running', attempts: job.attempts + 1, started_at: new Date().toISOString(), progress: 5 })
      .eq('id', job.id)
      .eq('org_id', orgId)
      .eq('status', 'queued')
      .select('id'),
  )
  if (claimed.length === 0) return
  console.log(`Drafting ${job.type} ${job.id}`)

  for (const [progress, message] of STEPS) {
    ok(await db.from('jobs').update({ progress, progress_message: message }).eq('id', job.id).eq('org_id', orgId))
    await sleep(STEP_MS)
    const { status } = must(await db.from('jobs').select('status').eq('id', job.id).eq('org_id', orgId).single())
    if (status === 'canceled') return console.log(`Canceled ${job.id}`)
  }

  const release = must(
    await db
      .from('releases')
      .select('id, title, mode, due_on, client:clients(id, name), email:emails(provider_message_id, body_text)')
      .eq('id', job.release_id!)
      .eq('org_id', orgId)
      .single(),
  )
  const key = release.email?.provider_message_id.replace(/^demo-/, '') as EmailKey | undefined
  const canned = (key && STAND_IN_DRAFTS[key]) || fallback(release.mode, release.title, release.email?.body_text ?? '', release.client!.name)
  const due = release.due_on ? new Date(release.due_on) : new Date(Date.now() + 7 * 864e5)
  const content = JSON.parse(JSON.stringify(canned).replaceAll('{date}', dateline.format(due))) as Json

  const existing = await db
    .from('artifacts')
    .select('id')
    .eq('org_id', orgId)
    .eq('release_id', release.id)
    .eq('type', 'press_release')
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  const artifact = existing.data ?? must(
    await db
      .from('artifacts')
      .insert({
        org_id: orgId,
        client_id: release.client!.id,
        release_id: release.id,
        type: 'press_release',
        title: release.title,
        created_by: job.created_by,
      })
      .select('id')
      .single(),
  )
  const parent = must(
    await db.from('artifact_versions').select('id').eq('artifact_id', artifact.id).order('version', { ascending: false }).limit(1),
  )[0]
  const task = job.type as GenerationTask
  const generation = must(
    await db
      .from('generations')
      .insert({
        org_id: orgId,
        job_id: job.id,
        model: ROUTES[task].model,
        task,
        inputs: { demo: true, stand_in: true },
        cost_usd: 0,
        latency_ms: STEPS.length * STEP_MS,
        stop_reason: 'stand_in',
      })
      .select('id')
      .single(),
  )
  ok(
    await db.from('artifact_versions').insert({
      org_id: orgId,
      artifact_id: artifact.id,
      content,
      origin: 'ai',
      generation_id: generation.id,
      parent_version_id: parent?.id ?? null,
    }),
  )
  ok(
    await db
      .from('jobs')
      .update({ status: 'succeeded', progress: 100, progress_message: null, artifact_id: artifact.id, finished_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('org_id', orgId),
  )
  console.log(`Draft ready for "${release.title}"`)
}

export async function runDrafter(orgId: string): Promise<never> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (apps/web/.env).')
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  console.log(`Stand-in drafter watching ${orgId}. Ctrl-C to stop.`)

  for (;;) {
    const jobs = must(
      await db.from('jobs').select('*').eq('org_id', orgId).eq('status', 'queued').in('type', TASKS).order('created_at'),
    )
    for (const job of jobs) {
      await draft(db, orgId, job).catch(async (error: Error) => {
        console.error(`Failed ${job.id}: ${error.message}`)
        await db.from('jobs').update({ status: 'failed', error: error.message, finished_at: new Date().toISOString() }).eq('id', job.id).eq('org_id', orgId)
      })
    }
    await sleep(POLL_MS)
  }
}
