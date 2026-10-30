import Link from 'next/link'
import { z } from 'zod'
import { LiveRefresh } from '@/components/LiveRefresh'
import { LabelChip, SectionLabel } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { requireOrgSession } from '@/lib/auth'
import {
  FOLDERS,
  LABEL_NAMES,
  confidenceText,
  defaultFolder,
  emailChips,
  folderFilter,
  parseFolder,
  type FolderFilter,
  type FolderKey,
} from '@/lib/selectors/inbox'
import { supabaseServer } from '@/lib/supabase/server'
import { LABEL_COLORS } from '@/lib/tokens'
import { CorrectionForm, HandledButton } from './TriageControls'

export const metadata = { title: 'Inbox' }

/** The filter methods `applyFolder` needs from a Supabase query on `emails`. */
interface Filterable<T> {
  in(column: string, values: readonly string[]): T
  eq(column: string, value: string): T
}

function applyFolder<T extends Filterable<T>>(query: T, filter: FolderFilter): T {
  let q = query.in('status', filter.statuses)
  if (filter.label) q = q.eq('label', filter.label)
  if (filter.ownerId) q = q.eq('owner_id', filter.ownerId)
  return q
}

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const full = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

function when(iso: string): string {
  const date = new Date(iso)
  return date.toDateString() === new Date().toDateString() ? time.format(date) : day.format(date)
}

const CLASSIFIED_BY: Record<string, string> = {
  person: 'Set by a person',
  rule: 'Matched by a sender rule',
  model: 'Suggested by AI',
}

const EXTRACTED_FIELDS: [string, string][] = [
  ['company_name', 'Company'],
  ['contact_name', 'Contact'],
  ['contact_email', 'Contact email'],
  ['release_topic', 'Release topic'],
  ['requested_date', 'Requested date'],
  ['tier_hint', 'Tier'],
]

/**
 * Shared-inbox triage (AGENTS.md §12): folders over the classified mail, the
 * message list, and a preview with the classifier's read and the controls to
 * correct it. Email content is untrusted, so it's shown as plain text only.
 */
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; id?: string }>
}) {
  const session = await requireOrgSession()
  const params = await searchParams
  const db = await supabaseServer()
  const now = new Date().toISOString()

  const [me, duty, members, clients] = await Promise.all([
    db.from('team_members').select('id').eq('clerk_user_id', session.userId).maybeSingle(),
    db.from('inbox_duty').select('member_id').lte('starts_at', now).gt('ends_at', now),
    db.from('team_members').select('id, name'),
    db.from('clients').select('id, name').order('name'),
  ])
  const memberId = me.data?.id ?? null
  const memberName = new Map((members.data ?? []).map((m) => [m.id, m.name]))
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]))
  const onDuty = (duty.data ?? []).map((d) => d.member_id)

  const folder: FolderKey = parseFolder(params.folder) ?? defaultFolder(memberId !== null && onDuty.includes(memberId))
  const filter = folderFilter(folder, memberId)

  // Counts for the open folders only; Handled and Auto grow without bound.
  const countedFolders = FOLDERS.filter((f) => !f.quiet)
  const [counts, list] = await Promise.all([
    Promise.all(
      countedFolders.map(async (f) => {
        const ff = folderFilter(f.key, memberId)
        if (!ff) return [f.key, 0] as const
        const { count } = await applyFolder(db.from('emails').select('id', { count: 'exact', head: true }), ff)
        return [f.key, count ?? 0] as const
      }),
    ),
    filter
      ? applyFolder(
          db
            .from('emails')
            .select('id, from_name, from_address, subject, body_text, label, status, client_id, received_at, created_at, has_attachments'),
          filter,
        )
          .order('received_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(100)
      : null,
  ])
  if (list?.error) throw new Error(`Could not load mail: ${list.error.message}`)
  const count = new Map<FolderKey, number>(counts)
  const emails = list?.data ?? []

  const selectedId = z.uuid().safeParse(params.id).success ? (params.id as string) : null
  const [selected, attachments] = selectedId
    ? await Promise.all([
        db.from('emails').select('*').eq('id', selectedId).maybeSingle(),
        db.from('documents').select('id, title, bucket, storage_path, size_bytes').eq('email_id', selectedId),
      ])
    : [null, null]
  const email = selected?.data ?? null

  const links = new Map<string, string>()
  await Promise.all(
    (attachments?.data ?? []).map(async (doc) => {
      const { data } = await db.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 300)
      if (data?.signedUrl) links.set(doc.id, data.signedUrl)
    }),
  )

  const href = (next: { folder?: FolderKey; id?: string }) => {
    const q = new URLSearchParams({ folder: next.folder ?? folder })
    if (next.id) q.set('id', next.id)
    return `/inbox?${q}`
  }

  const extracted = (email?.extracted ?? {}) as Record<string, unknown>
  const extractedRows = EXTRACTED_FIELDS.filter(([key]) => typeof extracted[key] === 'string' && extracted[key])

  return (
    <div className="page page--list">
      <LiveRefresh tables={['emails']} />

      <div className="stack" style={{ gap: 2 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.015em' }}>Inbox</h1>
        <span className="hint hint--muted">
          {onDuty.length
            ? `On inbox duty now: ${onDuty.map((id) => memberName.get(id) ?? 'Unknown').join(', ')}`
            : 'No one is on inbox duty right now.'}
        </span>
      </div>

      <div className="stage">
        <nav className="stage__side card card--pad" style={{ gap: 2, padding: 8 }} aria-label="Folders">
          {FOLDERS.map((f, i) => (
            <span key={f.key} style={{ display: 'contents' }}>
              {f.quiet && !FOLDERS[i - 1]?.quiet && <div className="divider" style={{ margin: '6px 0' }} />}
              <Link
                href={href({ folder: f.key })}
                className={f.quiet ? 'folderBtn folderBtn--muted' : 'folderBtn'}
                aria-current={f.key === folder ? 'page' : undefined}
              >
                <span>{f.name}</span>
                {!f.quiet && (
                  <span
                    className="folderCount"
                    style={f.key === 'unmatched' && count.get(f.key) ? { color: 'var(--danger)' } : undefined}
                  >
                    {count.get(f.key) ?? 0}
                  </span>
                )}
              </Link>
            </span>
          ))}
        </nav>

        <div className="stage__main" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
          <div className="card card--flush" style={{ flex: '1 1 300px', maxWidth: 440 }}>
            {emails.length === 0 ? (
              <EmptyState title={folder === 'mine' && !memberId ? 'Not registered yet' : 'Nothing here'}>
                {folder === 'unmatched'
                  ? 'Mail the classifier couldn’t place lands here for whoever is on inbox duty.'
                  : folder === 'mine'
                    ? 'Mail routed to your clients shows up here.'
                    : 'No messages in this folder.'}
              </EmptyState>
            ) : (
              emails.map((e) => (
                <Link
                  key={e.id}
                  href={href({ id: e.id })}
                  className={e.status === 'muted' || e.status === 'handled' ? 'mailRow mailRow--muted' : 'mailRow'}
                  aria-current={e.id === selectedId ? 'true' : undefined}
                >
                  <span className={e.status === 'handled' || e.status === 'muted' ? 'mailDot' : 'mailDot mailDot--unread'} />
                  <span className="stack" style={{ gap: 3, minWidth: 0, flex: 1 }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="cellStrong" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.from_name || e.from_address || 'Unknown sender'}
                      </span>
                      <span className="cellMono">{when(e.received_at ?? e.created_at)}</span>
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.subject || '(no subject)'}
                    </span>
                    <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      {emailChips(e).map((chip) => (
                        <LabelChip key={chip} label={chip} swatch={LABEL_COLORS[chip]} size="xs" />
                      ))}
                      {e.status === 'new' && <span className="note">Classifying…</span>}
                      {e.client_id && <span className="note">{clientName.get(e.client_id)}</span>}
                      {e.has_attachments && <span className="note">Attachment</span>}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>

          <div className="card card--pad" style={{ flex: '2 1 420px', gap: 16, minWidth: 0 }}>
            {!email ? (
              <EmptyState title="Select a message">
                The preview shows the classifier&rsquo;s label, client and suggested action, with controls to correct them.
              </EmptyState>
            ) : (
              <>
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {emailChips(email).map((chip) => (
                      <LabelChip key={chip} label={chip} swatch={LABEL_COLORS[chip]} />
                    ))}
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>{email.subject || '(no subject)'}</h2>
                  <span className="hint">
                    {email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address}
                    {' · '}
                    {full.format(new Date(email.received_at ?? email.created_at))}
                  </span>
                </div>

                <div className="serviceNote" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <SectionLabel size="sm">Triage</SectionLabel>
                    {email.classified_by === 'model' && <span className="aiDraft">AI</span>}
                    <span className="hint hint--muted">
                      {email.classified_by ? CLASSIFIED_BY[email.classified_by] ?? email.classified_by : 'Not classified yet'}
                      {confidenceText(email.confidence) && ` · ${confidenceText(email.confidence)} confident`}
                    </span>
                  </div>
                  <span>
                    {email.label ? LABEL_NAMES[email.label] : 'No label'} ·{' '}
                    {email.client_id ? (
                      <Link href={`/clients/${email.client_id}/overview`}>{clientName.get(email.client_id) ?? 'Client'}</Link>
                    ) : (
                      'No client'
                    )}
                    {email.owner_id && ` · Owner: ${memberName.get(email.owner_id) ?? 'Unknown'}`}
                  </span>
                  {email.suggested_action && <span className="hint">{email.suggested_action}</span>}
                  {extractedRows.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '4px 12px' }}>
                      {extractedRows.map(([key, name]) => (
                        <span key={key} style={{ display: 'contents' }}>
                          <span className="hint hint--muted">{name}</span>
                          <span>{String(extracted[key])}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                  <div className="prose" style={{ flex: '1 1 320px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minWidth: 0 }}>
                    {email.body_text?.trim() || '(no text body)'}
                  </div>
                  <div className="stack" style={{ flex: '0 0 220px', gap: 16 }}>
                    <HandledButton emailId={email.id} handled={email.status === 'handled'} />
                    <CorrectionForm
                      emailId={email.id}
                      clientId={email.client_id}
                      label={email.label}
                      clients={clients.data ?? []}
                    />
                    {(attachments?.data?.length ?? 0) > 0 && (
                      <div className="stack" style={{ gap: 6 }}>
                        <SectionLabel size="sm">Attachments</SectionLabel>
                        {attachments?.data?.map((doc) =>
                          links.has(doc.id) ? (
                            <a key={doc.id} href={links.get(doc.id)} target="_blank" rel="noreferrer">
                              {doc.title}
                            </a>
                          ) : (
                            <span key={doc.id}>{doc.title}</span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
