import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Everything waiting on a person.
 *
 * Approving here is the same action as approving inside a stage: it locks that
 * version, and downstream stages start reading it. Nothing is auto-approved.
 */
export default function ApprovalsPage() {
  return (
    <div className="page page--list">
      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>Approvals</h1>
        <span className="hint hint--muted">
          Approving locks the version that downstream stages use.
        </span>
      </div>

      <div className="card">
        <EmptyState title="Nothing waiting">
          Drafts sent for review — research, decks, strategies, releases, media lists and pitches —
          show up here.
        </EmptyState>
      </div>
    </div>
  )
}
