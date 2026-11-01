import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ApprovalGate } from '@/components/ui/ApprovalGate'
import { EmptyState } from '@/components/ui/EmptyState'
import { gates, type GatedTab } from '@/lib/selectors/stages'
import { getWorkspace } from '@/lib/workspace'

/**
 * A workspace stage with nothing in it yet. Gated stages show their approval
 * gate first, since they read only the approved output upstream (AGENTS.md §2).
 */
export async function StagePage({
  clientId,
  gate,
  notForL1,
  title,
  children,
}: {
  clientId: string
  gate?: GatedTab
  /** L1 clients build their own media lists and run their own outreach. */
  notForL1?: boolean
  title: string
  children: ReactNode
}) {
  const { client, cs } = await getWorkspace(clientId)
  if (notForL1 && client.tier === 'L1') notFound()

  if (gate) {
    const blocking = gates(cs, { onboardedExternally: client.onboarded_externally })[gate]
    if (blocking.blocked) return <ApprovalGate gate={blocking} clientId={clientId} />
  }

  return (
    <div className="page">
      <div className="card">
        <EmptyState title={title}>{children}</EmptyState>
      </div>
    </div>
  )
}
