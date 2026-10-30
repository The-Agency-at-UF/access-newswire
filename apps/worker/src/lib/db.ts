import postgres from 'postgres'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'
import type { Env } from '../env'

export type Sql = postgres.Sql

/**
 * Postgres as the connection's role, which bypasses RLS. Every query that
 * touches tenant data must filter by org_id explicitly (AGENTS.md §2.7).
 * `prepare: false` keeps it compatible with Supabase's transaction pooler.
 */
export function connect(env: Env): Sql {
  return postgres(env.DATABASE_URL, { max: env.WORKER_CONCURRENCY + 2, prepare: false, onnotice: () => {} })
}

/** Storage only (files in client-files / exports / templates). */
export function storageClient(env: Env): SupabaseClient<Database> {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
