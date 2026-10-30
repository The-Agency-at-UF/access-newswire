import { EmptyState } from '@/components/ui/EmptyState'

/**
 * The shared journalist directory.
 *
 * One table across all clients, so outreach and coverage history follow a
 * contact rather than being rebuilt per client. Contact data is never
 * generated — where it comes from is still an open decision.
 */
export default function JournalistsPage() {
  return (
    <div className="page page--list">
      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>Journalists</h1>
        <span className="hint hint--muted">
          Shared directory. Outreach and coverage history follow each contact across clients. Data
          source TBD.
        </span>
      </div>

      <div className="card">
        <EmptyState title="No journalists yet">
          Media lists draw only from this directory — names, titles and emails are never generated.
        </EmptyState>
      </div>
    </div>
  )
}
