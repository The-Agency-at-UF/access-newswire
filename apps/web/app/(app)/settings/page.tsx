import { SectionLabel } from '@/components/ui/badges'
import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { AddShiftForm, ConnectMailboxForm, RemoveShiftButton, ShiftTime } from './InboxSettings'

/**
 * Settings — the tier matrix, the team, the shared mailbox, inbox duty, the
 * prompt frameworks and the export formats. The L3 "confirm" is an open decision from AGENTS.md §16.
 */

interface TierRow {
  stage: string
  l1: string
  l2: string
  l3: string
  /** L3 coverage of onboarding/strategy is assumed, not confirmed. */
  confirmL3?: boolean
  /** The L2 cell is the tier's defining difference. */
  emphasizeL2?: boolean
}

const TIER_MATRIX: readonly TierRow[] = [
  {
    stage: 'Research, onboarding deck, strategy',
    l1: '✓',
    l2: '✓',
    l3: '✓',
    confirmL3: true,
  },
  {
    stage: 'Press release',
    l1: 'We write',
    l2: 'We edit client’s',
    l3: 'We write',
    emphasizeL2: true,
  },
  { stage: 'Media list', l1: 'Client does', l2: '✓', l3: '✓' },
  { stage: 'Upload to ACCESS', l1: '—', l2: '✓', l3: '✓' },
  { stage: 'Outreach / pitches', l1: 'Client does', l2: '✓', l3: '✓' },
  { stage: 'ACCESS stats reporting', l1: '✓', l2: '✓', l3: '✓' },
]

const synced = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const clientCount = (n: number) => `${n} client${n === 1 ? '' : 's'}`

export default async function SettingsPage() {
  const muted = { color: 'var(--ink-faint)' }

  const session = await requireOrgSession()
  const supabase = await supabaseServer()
  const [team, clients, mailboxes, shifts] = await Promise.all([
    supabase.from('team_members').select('id, name, email').order('name'),
    supabase.from('clients').select('owner_id'),
    supabase.from('mail_accounts').select('id, mailbox, subscription_id, subscription_expires_at, last_synced_at, last_error'),
    supabase
      .from('inbox_duty')
      .select('id, member_id, starts_at, ends_at')
      .gt('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(20),
  ])
  if (team.error) throw new Error(`Could not load the team: ${team.error.message}`)
  if (clients.error) throw new Error(`Could not load clients: ${clients.error.message}`)
  if (mailboxes.error) throw new Error(`Could not load the mailbox: ${mailboxes.error.message}`)
  if (shifts.error) throw new Error(`Could not load inbox duty: ${shifts.error.message}`)
  const memberName = new Map(team.data.map((m) => [m.id, m.name]))

  const owned = new Map<string, number>()
  for (const { owner_id } of clients.data) {
    if (owner_id) owned.set(owner_id, (owned.get(owner_id) ?? 0) + 1)
  }

  return (
    <div className="page page--list">
      <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>Settings</h1>

      <div className="card card--scroll">
        <div style={{ padding: '16px 20px 10px' }}>
          <SectionLabel>Service tiers · stages included</SectionLabel>
        </div>

        <div
          className="tHead t-tiers"
          style={{ padding: 0, borderTop: '1px solid var(--line-soft)', borderBottom: 0 }}
        >
          <span style={{ padding: '9px 20px' }}>STAGE</span>
          <span style={{ padding: '9px 12px' }}>L1</span>
          <span style={{ padding: '9px 12px' }}>L2</span>
          <span style={{ padding: '9px 12px' }}>L3</span>
        </div>

        {TIER_MATRIX.map((row) => (
          <div
            key={row.stage}
            className="tRow t-tiers"
            style={{ padding: 0, borderTop: '1px solid var(--line-faint)', borderBottom: 0 }}
          >
            <span style={{ padding: '10px 20px' }}>{row.stage}</span>
            <span style={{ padding: '10px 12px', ...(row.l1 === 'Client does' || row.l1 === '—' ? muted : {}) }}>
              {row.l1}
            </span>
            <span
              style={{ padding: '10px 12px', fontWeight: row.emphasizeL2 ? 600 : undefined }}
            >
              {row.l2}
            </span>
            <span style={{ padding: '10px 12px' }}>
              {row.l3}
              {row.confirmL3 && (
                <span style={{ color: 'var(--warn)', fontSize: 11.5 }}> confirm</span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div
        className="grid grid--start"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        <div className="card card--pad" style={{ padding: '18px 20px', gap: 10 }}>
          <SectionLabel>Team &amp; owners</SectionLabel>
          {team.data.map((member) => (
            <div key={member.id} className="spread">
              <span className="cellStack">
                <span className="cellStrong">{member.name}</span>
                {member.email && <span className="cellSub">{member.email}</span>}
              </span>
              <span className="hint hint--muted">{clientCount(owned.get(member.id) ?? 0)}</span>
            </div>
          ))}
          {team.data.length === 0 && (
            <span className="hint hint--muted">Members appear here when they sign in.</span>
          )}
        </div>

        <div className="card card--pad" style={{ padding: '18px 20px', gap: 10 }}>
          <SectionLabel>Shared mailbox</SectionLabel>
          {mailboxes.data.map((a) => (
            <div key={a.id} className="cellStack">
              <span className="cellStrong">{a.mailbox}</span>
              <span className="cellSub">
                {a.subscription_id ? 'Receiving new mail' : 'Waiting for the mail subscription'}
                {' · '}
                {a.last_synced_at ? `last synced ${synced.format(new Date(a.last_synced_at))}` : 'not synced yet'}
              </span>
              {a.last_error && <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>{a.last_error}</span>}
            </div>
          ))}
          {mailboxes.data.length === 0 &&
            (session.isAdmin ? (
              <>
                <span className="hint hint--muted">
                  Read-only access (Microsoft Graph <span className="mono">Mail.Read</span>). Nothing is ever sent.
                </span>
                <ConnectMailboxForm />
              </>
            ) : (
              <span className="hint hint--muted">Not connected yet. An admin connects it here.</span>
            ))}
        </div>

        <div className="card card--pad" style={{ padding: '18px 20px', gap: 10 }}>
          <SectionLabel>Inbox duty</SectionLabel>
          <span className="hint hint--muted">Whoever is on duty gets the mail the classifier couldn&rsquo;t place.</span>
          {shifts.data.map((s) => (
            <div key={s.id} className="spread">
              <span className="cellStack">
                <span className="cellStrong">{memberName.get(s.member_id) ?? 'Unknown'}</span>
                <span className="cellSub">
                  <ShiftTime startsAt={s.starts_at} endsAt={s.ends_at} />
                </span>
              </span>
              <RemoveShiftButton id={s.id} />
            </div>
          ))}
          {shifts.data.length === 0 && <span className="hint hint--muted">No shifts scheduled.</span>}
          {team.data.length > 0 && <AddShiftForm members={team.data} />}
        </div>

        <div className="card card--pad" style={{ padding: '18px 20px', gap: 10 }}>
          <SectionLabel>Prompt frameworks</SectionLabel>
          <span className="hint hint--muted">
            None loaded yet. The team&rsquo;s research, deck, strategy, release and pitch frameworks
            are loaded as written.
          </span>
        </div>

        <div className="card card--pad" style={{ padding: '18px 20px', gap: 10 }}>
          <SectionLabel>Export formats</SectionLabel>
          <span className="hint hint--muted">
            None set up yet. The ACCESS media-list column map and the strategy template go here.
          </span>
        </div>
      </div>
    </div>
  )
}
