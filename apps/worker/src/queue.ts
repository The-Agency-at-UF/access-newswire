/**
 * The queue loop. A job is a `jobs` row plus a {"job_id"} message on the pgmq
 * `jobs` queue (see migration …000600).
 *
 * Reading a message hides it for VISIBILITY_SECONDS; if the worker dies, it
 * reappears and another worker picks it up. Tasks are idempotent by job_id, so
 * a rerun finishes the job rather than duplicating it.
 */

import { setTimeout as sleep } from 'node:timers/promises'
import type { Env } from './env'
import { CanceledError, type Job, type Task, type TaskContext } from './context'
import type { Sql } from './lib/db'
import { backoffSeconds, describe, isRetryable } from './lib/errors'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'

const QUEUE = 'jobs'
const VISIBILITY_SECONDS = 600

interface Message {
  msg_id: string
  message: { job_id?: string }
}

export interface Worker {
  stop(): Promise<void>
}

export function startWorker(deps: {
  env: Env
  sql: Sql
  storage: SupabaseClient<Database>
  tasks: Record<string, Task>
  log: (message: string, extra?: Record<string, unknown>) => void
}): Worker {
  const { env, sql, log } = deps
  let running = true

  async function processOne(): Promise<boolean> {
    // Long-poll up to 5s so an idle worker isn't hammering the database.
    const messages = await sql<Message[]>`
      select msg_id::text, message from pgmq.read_with_poll(${QUEUE}, ${VISIBILITY_SECONDS}, 1, 5, 250)`
    const msg = messages[0]
    if (!msg) return false

    const jobId = msg.message.job_id
    const [job] = jobId ? await sql<Job[]>`select * from public.jobs where id = ${jobId}` : []
    if (!job || ['succeeded', 'failed', 'canceled'].includes(job.status)) {
      await sql`select pgmq.delete(${QUEUE}, ${msg.msg_id}::bigint)`
      return true
    }

    const task = deps.tasks[job.type]
    const [started] = await sql<Job[]>`
      update public.jobs set status = 'running', attempts = attempts + 1, error = null,
        started_at = coalesce(started_at, now())
      where id = ${job.id} and status in ('queued', 'running')
      returning *`
    if (!started) {
      await sql`select pgmq.delete(${QUEUE}, ${msg.msg_id}::bigint)`
      return true
    }

    const ctx: TaskContext = {
      job: started,
      sql,
      storage: deps.storage,
      env,
      log: (message, extra) => log(message, { job_id: job.id, type: job.type, ...extra }),
      async progress(percent, message) {
        await sql`
          update public.jobs set progress = ${Math.max(0, Math.min(99, Math.round(percent)))},
            progress_message = ${message ?? null}
          where id = ${job.id} and status = 'running'`
      },
      async checkCanceled() {
        const [row] = await sql<{ status: string }[]>`select status from public.jobs where id = ${job.id}`
        if (row?.status === 'canceled') throw new CanceledError('canceled')
      },
    }

    try {
      if (!task) throw new Error(`no task registered for ${job.type}`)
      ctx.log('start', { attempt: started.attempts })
      const output = (await task(ctx)) ?? {}
      await sql`
        update public.jobs set status = 'succeeded', progress = 100, progress_message = null,
          output = ${sql.json(output as never)}, finished_at = now()
        where id = ${job.id} and status = 'running'`
      await sql`select pgmq.delete(${QUEUE}, ${msg.msg_id}::bigint)`
      ctx.log('done')
    } catch (error) {
      if (error instanceof CanceledError) {
        await sql`select pgmq.delete(${QUEUE}, ${msg.msg_id}::bigint)`
        ctx.log('canceled')
        return true
      }

      const message = describe(error).slice(0, 2000)
      const retry = isRetryable(error) && started.attempts < started.max_attempts
      if (retry) {
        const delay = backoffSeconds(started.attempts)
        await sql`update public.jobs set status = 'queued', error = ${message} where id = ${job.id}`
        await sql`select pgmq.set_vt(${QUEUE}, ${msg.msg_id}::bigint, ${delay})`
        ctx.log('retrying', { error: message, in_seconds: delay })
      } else {
        await sql`
          update public.jobs set status = 'failed', error = ${message}, finished_at = now()
          where id = ${job.id}`
        await sql`select pgmq.archive(${QUEUE}, ${msg.msg_id}::bigint)`
        ctx.log('failed', { error: message })
      }
    }
    return true
  }

  async function loop(slot: number) {
    while (running) {
      try {
        await processOne()
      } catch (error) {
        // Connection trouble: back off and keep going.
        log('queue error', { slot, error: describe(error) })
        await sleep(5000)
      }
    }
  }

  const loops = Array.from({ length: env.WORKER_CONCURRENCY }, (_, slot) => loop(slot))
  log('worker started', { concurrency: env.WORKER_CONCURRENCY })

  return {
    async stop() {
      running = false
      await Promise.all(loops)
    },
  }
}
