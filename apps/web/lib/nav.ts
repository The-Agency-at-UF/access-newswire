/**
 * Route parsing. The design keeps navigation in component state; here it lives
 * in the URL instead, so every screen is linkable and the back button works.
 */

import { tabLabel } from './selectors/stages'
import type { WorkspaceTab } from './types'

export type Section =
  | 'inbox'
  | 'clients'
  | 'intake'
  | 'workspace'
  | 'approvals'
  | 'journalists'
  | 'settings'
  | 'companion'

export interface Route {
  section: Section
  /** Set for workspace routes. */
  clientId: string | null
  tab: WorkspaceTab | null
}

const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  'overview',
  'research',
  'onboarding',
  'strategy',
  'releases',
  'media',
  'pitches',
  'reporting',
  'docs',
]

function isWorkspaceTab(value: string): value is WorkspaceTab {
  return (WORKSPACE_TABS as readonly string[]).includes(value)
}

export function parseRoute(pathname: string): Route {
  const [, first, second, third] = pathname.split('/')

  if (first === 'clients') {
    if (!second) return { section: 'clients', clientId: null, tab: null }
    if (second === 'new') return { section: 'intake', clientId: null, tab: null }
    return {
      section: 'workspace',
      clientId: second,
      tab: third && isWorkspaceTab(third) ? third : 'overview',
    }
  }

  if (
    first === 'inbox' ||
    first === 'approvals' ||
    first === 'journalists' ||
    first === 'settings' ||
    first === 'companion'
  ) {
    return { section: first, clientId: null, tab: null }
  }

  return { section: 'inbox', clientId: null, tab: null }
}

/** The breadcrumb shown in the top bar. `clientName` is the open workspace's client. */
export function breadcrumb(route: Route, clientName: string | null): string {
  switch (route.section) {
    case 'inbox':
      return 'Inbox'
    case 'clients':
      return 'Clients'
    case 'intake':
      return 'Clients / New client'
    case 'approvals':
      return 'Approvals'
    case 'journalists':
      return 'Journalists'
    case 'settings':
      return 'Settings'
    case 'companion':
      return 'Companion / Teams · Slack preview'
    case 'workspace': {
      return `Clients / ${clientName ?? '…'} / ${route.tab ? tabLabel(route.tab) : ''}`
    }
  }
}

/** Which sidebar item should read as current. */
export function activeNav(route: Route): string {
  if (route.section === 'workspace' || route.section === 'intake') return 'clients'
  return route.section
}
