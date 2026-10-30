import Link from 'next/link'
import { SectionLabel } from '@/components/ui/badges'
import { Pipeline } from '@/components/ui/Pipeline'
import { pipeline } from '@/lib/selectors/stages'
import { ONBOARDING_STAGES, RELEASE_STAGES, TIERS } from '@/lib/tokens'
import { getWorkspace } from '@/lib/workspace'

const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/**
 * The client's at-a-glance page: where onboarding and the current release
 * stand, who they are, and what came in from the inbox.
 */
export default async function OverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const { client, release, cs, meetingDates } = await getWorkspace(clientId)
  const t = TIERS[client.tier]

  const profile: [string, string][] = [
    ['Website', client.website ?? '—'],
    ['Industry', client.industry ?? '—'],
    ['Cadence', client.release_cadence ?? '—'],
    ['Owner', client.owner?.name ?? 'Unassigned'],
    ['Added', added.format(new Date(client.created_at))],
  ]

  return (
    <div className="page">
      <div className="card card--pad" style={{ padding: '18px 22px 20px', gap: 16 }}>
        <SectionLabel>Onboarding</SectionLabel>
        <Pipeline
          nodes={pipeline(ONBOARDING_STAGES, cs, meetingDates)}
          clientId={clientId}
          label="Onboarding stages"
        />

        <div className="divider" />

        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <SectionLabel>Current release</SectionLabel>
          <span className={release ? undefined : 'hint hint--muted'}>{release?.title ?? 'None yet'}</span>
          <span className="hint">Stages shown for {client.tier}</span>
        </div>
        <Pipeline
          nodes={pipeline(RELEASE_STAGES[client.tier], cs, meetingDates)}
          clientId={clientId}
          label="Release stages"
        />
      </div>

      <div className="grid">
        <div className="card card--pad">
          <SectionLabel>Client profile</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px 14px' }}>
            {profile.map(([key, value]) => (
              <span key={key} style={{ display: 'contents' }}>
                <span className="hint hint--muted">{key}</span>
                <span>{value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="card card--pad" style={{ gap: 8 }}>
          <SectionLabel>Latest from inbox</SectionLabel>
          <span className="hint hint--muted">Nothing yet.</span>
        </div>

        <div className="card card--pad">
          <SectionLabel>ACCESS stats · last 30 days</SectionLabel>
          <span className="hint hint--muted">No releases distributed yet.</span>
          <Link href={`/clients/${clientId}/reporting`} style={{ fontWeight: 500, fontSize: 12.5 }}>
            Open reporting →
          </Link>
        </div>
      </div>

      <div className="serviceNote">
        <SectionLabel size="sm">SERVICE · {t.name}</SectionLabel>
        <span style={{ flex: 1, minWidth: 260 }}>{t.inc}</span>
        <span className="hint hint--muted">
          {t.up} <span style={{ fontStyle: 'italic' }}>Internal note.</span>
        </span>
      </div>
    </div>
  )
}
