'use client'

import { useState } from 'react'
import { useSupabaseBrowser } from '@/lib/supabase/browser'
import styles from './dev.module.css'

/**
 * The same RLS check as the server panel, but from the browser with the
 * user's Clerk token and the publishable key — the path Realtime will use.
 */
export function BrowserCheck() {
  const supabase = useSupabaseBrowser()
  const [result, setResult] = useState<string>('Not run yet.')

  const run = async () => {
    setResult('Running…')
    const [who, clients] = await Promise.all([
      supabase.rpc('whoami'),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
    ])
    if (who.error) return setResult(`whoami failed: ${who.error.message}`)
    if (clients.error) return setResult(`clients failed: ${clients.error.message}`)
    setResult(JSON.stringify({ whoami: who.data, visibleClients: clients.count }, null, 2))
  }

  return (
    <div>
      <button type="button" onClick={run}>
        Query from the browser
      </button>
      <pre className={styles.pre}>{result}</pre>
    </div>
  )
}
