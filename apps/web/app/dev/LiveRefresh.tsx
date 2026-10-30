'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseBrowser } from '@/lib/supabase/browser'
import styles from './dev.module.css'

/**
 * Re-render the page when any of these tables change (Supabase Realtime,
 * filtered by RLS to the caller's org). The way the UI watches jobs (AGENTS.md §11).
 */
export function LiveRefresh({ tables }: { tables: string[] }) {
  const supabase = useSupabaseBrowser()
  const router = useRouter()
  const [status, setStatus] = useState('connecting')
  const key = tables.join(',')

  useEffect(() => {
    let channel = supabase.channel(`dev-live-${key}`)
    for (const table of key.split(',')) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => router.refresh())
    }
    channel.subscribe((state) => setStatus(state.toLowerCase()))
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [supabase, router, key])

  return <span className={styles.pill}>live: {status}</span>
}
