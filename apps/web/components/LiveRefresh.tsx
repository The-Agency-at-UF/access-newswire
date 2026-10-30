'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseBrowser } from '@/lib/supabase/browser'

/**
 * Re-render the page when any of these tables change (Supabase Realtime,
 * filtered by RLS to the caller's org). The way the UI watches jobs (AGENTS.md §11).
 * Returns the channel state.
 */
export function useLiveRefresh(tables: string[]): string {
  const supabase = useSupabaseBrowser()
  const router = useRouter()
  const [status, setStatus] = useState('connecting')
  const key = tables.join(',')

  useEffect(() => {
    let channel = supabase.channel(`live-${key}`)
    for (const table of key.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh())
    }
    channel.subscribe((state) => setStatus(state.toLowerCase()))
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, router, key])

  return status
}

/** Keep a server-rendered page current without showing anything. */
export function LiveRefresh({ tables }: { tables: string[] }) {
  useLiveRefresh(tables)
  return null
}
