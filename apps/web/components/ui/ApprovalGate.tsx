import Link from 'next/link'
import type { Gate } from '@/lib/selectors/stages'

/**
 * Shown instead of a stage when its upstream input is not approved yet.
 *
 * This is the visible half of AGENTS.md rule 2: a stage reads only approved
 * output, so there is nothing to show until the gate opens.
 */
export function ApprovalGate({ gate, clientId }: { gate: Gate; clientId: string }) {
  return (
    <div className="gate">
      <div className="gateCard">
        <span className="gateLabel">APPROVAL GATE</span>
        <span className="cardTitle">{gate.msg}</span>
        <Link href={`/clients/${clientId}/${gate.tab}`} className="btn btn--primary">
          {gate.label} →
        </Link>
      </div>
    </div>
  )
}
