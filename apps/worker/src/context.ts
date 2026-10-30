import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@access/db'
import type { Env } from './env'
import type { Sql } from './lib/db'
import { PermanentError } from './lib/errors'

export type Job = Tables<'jobs'>

export interface TaskContext {
  job: Job
  sql: Sql
  storage: SupabaseClient<Database>
  env: Env
  /** Report progress to the UI (jobs.progress over Realtime). */
  progress(percent: number, message?: string): Promise<void>
  /** Throw if someone canceled the job; call between expensive steps. */
  checkCanceled(): Promise<void>
  log(message: string, extra?: Record<string, unknown>): void
}

export type Task = (ctx: TaskContext) => Promise<Record<string, unknown> | void>

export class CanceledError extends Error {
  override name = 'CanceledError'
}

export function requireInput<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined || value === '') {
    throw new PermanentError(`job input is missing ${name}`)
  }
  return value
}
