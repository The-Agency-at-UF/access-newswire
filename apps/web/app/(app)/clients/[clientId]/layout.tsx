import { TierBadge } from '@/components/ui/badges'
import { getWorkspace } from '@/lib/workspace'
import { WorkspaceTabs } from './WorkspaceTabs'

/**
 * Client workspace chrome: who this is, their tier, and the stage tabs.
 *
 * The tab list is tier-dependent — L1 clients build their own media lists and
 * run their own outreach, so those two tabs don't exist for them.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const { client } = await getWorkspace(clientId)

  return (
    <>
      <div className="wsHeader">
        <div className="wsHeaderTop">
          <div className="stack" style={{ gap: 6 }}>
            <div className="wsTitleRow">
              <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>
                {client.name}
              </h1>
              <TierBadge tier={client.tier} />
            </div>
            <div className="wsMeta">
              {client.industry && <span>{client.industry}</span>}
              <span>
                Owner:{' '}
                <span style={{ color: 'var(--ink)', fontWeight: 500 }}>
                  {client.owner?.name ?? 'Unassigned'}
                </span>
              </span>
              {client.release_cadence && <span>{client.release_cadence} releases</span>}
            </div>
          </div>
        </div>

        <WorkspaceTabs clientId={client.id} clientName={client.name} tier={client.tier} />
      </div>

      {children}
    </>
  )
}
