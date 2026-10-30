import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'
import { publicEnv } from '@/lib/env'

/**
 * Supabase with the secret key. This bypasses RLS, so every query made with it
 * must filter by `org_id` explicitly (AGENTS.md §2.7). Only for callers that
 * have no user session — webhooks today, the worker later.
 */
export function supabaseAdmin() {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) throw new Error('Missing env: SUPABASE_SECRET_KEY. See apps/web/.env.example.')

  return createClient<Database>(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
