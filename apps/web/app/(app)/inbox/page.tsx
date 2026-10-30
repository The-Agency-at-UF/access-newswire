import { EmptyState } from '@/components/ui/EmptyState'

/**
 * Shared-inbox triage. Empty until the mail connection (Phase 2) ingests and
 * labels messages from theagency@newswire.com.
 */
export default function InboxPage() {
  return (
    <div className="page page--list">
      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>Inbox</h1>
        <span className="hint hint--muted">The shared inbox, labelled and matched to clients.</span>
      </div>

      <div className="card">
        <EmptyState title="No mail yet">
          Once the shared inbox is connected, release info, client updates and sales handoffs land
          here labelled and routed to each client&rsquo;s owner.
        </EmptyState>
      </div>
    </div>
  )
}
