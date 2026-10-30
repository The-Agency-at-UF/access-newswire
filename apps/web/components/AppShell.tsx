'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'
import { activeNav, breadcrumb, parseRoute } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { Segmented } from './ui/controls'

/**
 * Sidebar, top bar and toast host.
 *
 * Mounted once in the app layout so the store — the "My clients" filter and
 * the toast — survives navigation.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const route = parseRoute(pathname)
  const current = activeNav(route)
  const { state, actions } = useStore()
  const { user } = useUser()

  // Set by the workspace layout once it has loaded the client.
  const workspaceClient = state.workspace?.id === route.clientId ? state.workspace : null

  const navProps = (key: string) => ({
    className: 'navItem',
    'aria-current': (current === key ? 'page' : undefined) as 'page' | undefined,
  })

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark" aria-hidden>
            A
          </div>
          <div className="stack">
            <span className="brandName">ACCESS PR</span>
            <span className="brandSub">Workflow assistant</span>
          </div>
        </div>

        <Link href="/inbox" {...navProps('inbox')}>
          Inbox
        </Link>

        <Link href="/clients" {...navProps('clients')}>
          Clients
        </Link>

        {workspaceClient && (
          <Link href={`/clients/${workspaceClient.id}/overview`} className="navSubItem">
            <span className="navDot" aria-hidden />
            {workspaceClient.name}
          </Link>
        )}

        <Link href="/approvals" {...navProps('approvals')}>
          Approvals
        </Link>

        <Link href="/journalists" {...navProps('journalists')}>
          Journalists
        </Link>

        <Link href="/settings" {...navProps('settings')}>
          Settings
        </Link>

        <span className="sectionLabel sectionLabel--sm" style={{ padding: '16px 10px 4px' }}>
          COMPANION
        </span>

        <Link href="/companion" {...navProps('companion')}>
          Teams / Slack bot
          <span className="navNote">preview</span>
        </Link>

        <Link href="/dev" className="navItem">
          Backend console
          <span className="navNote">dev</span>
        </Link>

        <div className="sidebarFoot">
          <span className="sectionLabel sectionLabel--sm" style={{ padding: '0 6px' }}>
            VIEW
          </span>
          <Segmented
            label="Client view"
            grow
            value={state.mine ? 'mine' : 'all'}
            onChange={(value) => actions.setMine(value === 'mine')}
            options={[
              { value: 'mine', label: 'My clients' },
              { value: 'all', label: 'All' },
            ]}
          />
          <span className="sidebarNote">
            The app drafts, organizes and exports.{' '}
            <span style={{ color: 'var(--ink)', fontWeight: 500 }}>People send.</span>
          </span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="crumb">{breadcrumb(route, workspaceClient?.name ?? null)}</div>
          <div className="search">
            <span aria-hidden style={{ fontSize: 13 }}>
              ⌕
            </span>
            <input placeholder="Search clients, docs, journalists…" aria-label="Search" />
            <span className="kbd">⌘K</span>
          </div>
          <div className="who">
            <UserButton />
            {user?.firstName && <span style={{ fontWeight: 500 }}>{user.firstName}</span>}
          </div>
        </header>

        {children}
      </main>

      {state.toast && (
        <div className="toast" role="status" aria-live="polite">
          {state.toast}
        </div>
      )}
    </div>
  )
}
