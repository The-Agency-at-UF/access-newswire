'use client'

import Link from 'next/link'
import { StatusPill, TierBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { currentStage, type MeetingDates } from '@/lib/selectors/stages'
import { useStore } from '@/lib/store'
import type { ClientState, Tier } from '@/lib/types'

export interface ClientListRow {
  id: string
  name: string
  industry: string | null
  tier: Tier
  release_cadence: string | null
  owner_id: string | null
  created_at: string
  owner: { name: string } | null
  cs: ClientState
  meetingDates: MeetingDates
}

const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * "My clients" vs "All" filters on owner only — ownership is a working filter,
 * not a permission boundary (AGENTS.md §7).
 */
export function ClientTable({ clients }: { clients: ClientListRow[] }) {
  const { state } = useStore()
  const rows = state.mine ? clients.filter((client) => client.owner_id === state.memberId) : clients

  const newClient = (
    <Link href="/clients/new" className="btn btn--primary btn--tall" style={{ borderRadius: 8 }}>
      + New client
    </Link>
  )

  return (
    <div className="page page--list">
      <div className="spread">
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>
          Clients{' '}
          <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>
            — {state.mine ? 'My clients' : 'All clients'} ({rows.length})
          </span>
        </h1>
        {newClient}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          {clients.length === 0 ? (
            <EmptyState title="No clients yet">
              Add a client from a sales handoff to start research and onboarding.
            </EmptyState>
          ) : (
            <EmptyState title="None of the clients are yours yet">
              Switch the sidebar view to All to see the team&rsquo;s {clients.length}.
            </EmptyState>
          )}
        </div>
      ) : (
        <div className="card card--scroll">
          <div className="tHead t-clients">
            <span>Client</span>
            <span>Tier</span>
            <span>Owner</span>
            <span>Cadence</span>
            <span>Current stage</span>
            <span>Added</span>
          </div>

          {rows.map((client) => {
            const stage = currentStage(client.tier, client.cs, client.meetingDates)
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}/overview`}
                className="tRow tRow--link t-clients"
              >
                <span className="row" style={{ gap: 10 }}>
                  <span className="initials">{initials(client.name)}</span>
                  <span className="cellStack">
                    <span className="cellStrong">{client.name}</span>
                    {client.industry && <span className="note">{client.industry}</span>}
                  </span>
                </span>
                <TierBadge tier={client.tier} />
                <span>{client.owner?.name ?? '—'}</span>
                <span className="cellMono">{client.release_cadence ?? '—'}</span>
                <span className="row" style={{ gap: 10 }}>
                  <span>{stage.label}</span>
                  <StatusPill badge={stage.st} />
                </span>
                <span className="hint hint--muted">{added.format(new Date(client.created_at))}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
