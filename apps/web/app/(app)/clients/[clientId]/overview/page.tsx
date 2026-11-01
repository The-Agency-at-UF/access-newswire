import Link from 'next/link'
import { JobActivity } from '@/components/JobActivity'
import { LiveRefresh } from '@/components/LiveRefresh'
import { LabelChip, SectionLabel } from '@/components/ui/badges'
import { Pipeline } from '@/components/ui/Pipeline'
import { emailChips, folderOf } from '@/lib/selectors/inbox'
import { pipeline } from '@/lib/selectors/stages'
import { supabaseServer } from '@/lib/supabase/server'
import { LABEL_COLORS, ONBOARDING_STAGES, RELEASE_STAGES, TIERS } from '@/lib/tokens'
import { getWorkspace } from '@/lib/workspace'
import { OnboardedToggle } from '../OnboardedToggle'

const added = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/**
 * The client's at-a-glance page: where onboarding and the current release
 * stand, who they are, and what came in from the inbox.
 */
export default async function OverviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const { client, release, cs, meetingDates } = await getWorkspace(clientId)
  const t = TIERS[client.tier]

  const supabase = await supabaseServer()
  const [jobs, mail] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, type, status, progress, progress_message, error, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('emails')
      .select('id, subject, from_name, from_address, label, status, client_id, received_at, created_at')
      .eq('client_id', client.id)
      .neq('status', 'muted')
      .order('received_at', { ascending: false, nullsFirst: false })
      .limit(3),
  ])
  if (jobs.error) throw new Error(`Could not load activity: ${jobs.error.message}`)
  if (mail.error) throw new Error(`Could not load mail: ${mail.error.message}`)

  const profile: [string, string][] = [
    ['Website', client.website ?? '—'],
    ['Industry', client.industry ?? '—'],
    ['Cadence', client.release_cadence ?? '—'],
    ['Owner', client.owner?.name ?? 'Unassigned'],
    ['Added', added.format(new Date(client.created_at))],
  ]

  return (
    <div className="page">
      <LiveRefresh tables={['jobs', 'artifacts', 'emails']} />

      <div className="card card--pad" style={{ padding: '18px 22px 20px', gap: 16 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <SectionLabel>Onboarding</SectionLabel>
          {client.onboarded_externally && <span className="hint hint--muted">Onboarded before the app</span>}
          <span className="pushRight">
            <OnboardedToggle clientId={client.id} onboardedExternally={client.onboarded_externally} />
          </span>
        </div>
        {!client.onboarded_externally && (
          <Pipeline
            nodes={pipeline(ONBOARDING_STAGES, cs, meetingDates)}
            clientId={clientId}
            label="Onboarding stages"
          />
        )}

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
          {mail.data.length === 0 ? (
            <span className="hint hint--muted">Nothing yet.</span>
          ) : (
            mail.data.map((e) => (
              <Link key={e.id} href={`/inbox?folder=${folderOf(e.status)}&id=${e.id}`} className="stack" style={{ gap: 3 }}>
                <span className="row" style={{ gap: 6 }}>
                  {emailChips(e).map((chip) => (
                    <LabelChip key={chip} label={chip} swatch={LABEL_COLORS[chip]} size="xs" />
                  ))}
                  <span className="note">
                    {e.from_name || e.from_address} · {shortDay.format(new Date(e.received_at ?? e.created_at))}
                  </span>
                </span>
                <span style={{ fontWeight: 500 }}>{e.subject || '(no subject)'}</span>
              </Link>
            ))
          )}
        </div>

        <div className="card card--pad">
          <SectionLabel>ACCESS stats · last 30 days</SectionLabel>
          <span className="hint hint--muted">No releases distributed yet.</span>
          <Link href={`/clients/${clientId}/reporting`} style={{ fontWeight: 500, fontSize: 12.5 }}>
            Open reporting →
          </Link>
        </div>

        <div className="card card--pad" style={{ gap: 12 }}>
          <SectionLabel>Activity</SectionLabel>
          <JobActivity jobs={jobs.data} />
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
