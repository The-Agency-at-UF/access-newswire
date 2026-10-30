'use client'

/**
 * UI-only state shared across routes: the "My clients" filter, the client the
 * open workspace belongs to, and the toast. Data lives in Supabase and is read
 * by server components; nothing here is persisted.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface AppState {
  /** "My clients" vs "All" — a UI filter, never a security boundary. */
  mine: boolean
  /** The signed-in person's `team_members.id`; null if registration failed. */
  memberId: string | null
  /** The client whose workspace is open, for the sidebar and breadcrumb. */
  workspace: { id: string; name: string } | null
  toast: string | null
}

export interface AppActions {
  setMine: (mine: boolean) => void
  setWorkspace: (workspace: AppState['workspace']) => void
  /** Show a short confirmation in the toast. */
  flash: (message: string) => void
}

const StoreContext = createContext<{ state: AppState; actions: AppActions } | null>(null)

export function StoreProvider({ memberId, children }: { memberId: string | null; children: ReactNode }) {
  const [state, setState] = useState<AppState>({ mine: true, memberId, workspace: null, toast: null })
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    },
    [],
  )

  const flash = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setState((s) => ({ ...s, toast: message }))
    toastTimer.current = setTimeout(() => {
      setState((s) => ({ ...s, toast: null }))
    }, 2400)
  }, [])

  const actions = useMemo<AppActions>(
    () => ({
      setMine: (mine) => setState((s) => ({ ...s, mine })),
      setWorkspace: (workspace) => setState((s) => ({ ...s, workspace })),
      flash,
    }),
    [flash],
  )

  return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used inside <StoreProvider>')
  return value
}
