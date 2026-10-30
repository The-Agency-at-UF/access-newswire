'use client'

import { useMemo } from 'react'
import { useSession } from '@clerk/nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'
import { publicEnv } from '@/lib/env'

/**
 * Supabase in the browser, as the signed-in user. Same RLS as the server
 * client; this one is for Realtime subscriptions and live reads. Mutations
 * still go through server actions.
 */
export function useSupabaseBrowser() {
  const { session } = useSession()

  return useMemo(() => {
    const env = publicEnv()
    return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      accessToken: async () => (await session?.getToken()) ?? null,
    })
  }, [session])
}
