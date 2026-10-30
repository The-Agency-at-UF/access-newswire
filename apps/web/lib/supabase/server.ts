import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'
import { publicEnv } from '@/lib/env'

/**
 * Supabase as the signed-in user. Clerk's session token is the access token,
 * so every query runs under RLS scoped to the active organization.
 */
export async function supabaseServer() {
  const env = publicEnv()
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    accessToken: async () => (await auth()).getToken(),
  })
}
