import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Teams/Slack companion. v1 is one-way alerts sent from the worker; an
 * interactive bot is a later nice-to-have.
 */
export default function CompanionPage() {
  return (
    <div className="page page--list">
      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>
          Teams / Slack bot
        </h1>
        <span className="hint hint--muted">Alerts to each client&rsquo;s owner. Platform TBD.</span>
      </div>

      <div className="card">
        <EmptyState title="No alerts yet">
          When an email is routed to a client, its owner gets a one-way alert with a link back to the
          app.
        </EmptyState>
      </div>
    </div>
  )
}
