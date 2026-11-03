import Link from 'next/link'
import { pressReleaseSchema, releaseEditSchema } from '@access/ai/schemas'
import { JobActivity } from '@/components/JobActivity'
import { LiveRefresh } from '@/components/LiveRefresh'
import { AiDraftBadge, SectionLabel, StatusPill } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { STATUS_LABEL } from '@/lib/clientState'
import { ORIGIN_LABEL, type EditedRelease, type WrittenRelease } from '@/lib/releaseDraft'
import { autoReleaseMode, badge } from '@/lib/selectors/stages'
import { supabaseServer } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { StagePage } from '../StagePage'
import { ReleaseEditor, ReviewPanel } from './ReleaseControls'

const due = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const REVIEW_ACTION = { submitted: 'Sent for review', approved: 'Approved', changes_requested: 'Changes requested' }

/**
 * Press releases. L2 clients send their own draft and we suggest edits; L1 and
 * L3 releases we write. Needs an approved strategy and Meeting 2, unless the
 * client was onboarded before the app.
 *
 * Every save is a new version; `?v=` shows an earlier one read-only. Review
 * runs on the latest version only.
 */
export default async function ReleasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ v?: string }>
}) {
  const { clientId } = await params
  const { client, release, artifacts } = await getWorkspace(clientId)
  const weEdit = autoReleaseMode(client.tier) === 'B'

  if (!release) {
    return (
      <StagePage clientId={clientId} gate="releases" title="No releases yet">
        {weEdit
          ? 'The client sends each draft; suggested edits show here for review, and export with tracked changes.'
          : 'Each release is drafted from the approved strategy and roadmap, then reviewed here before export.'}{' '}
        Start one from a release-info email in the Inbox.
      </StagePage>
    )
  }

  const supabase = await supabaseServer()
  const artifact = artifacts.find((a) => a.type === 'press_release' && a.release_id === release.id) ?? null
  const [jobs, versions] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, type, status, progress, progress_message, error, created_at')
      .eq('release_id', release.id)
      .order('created_at', { ascending: false })
      .limit(4),
    artifact
      ? supabase
          .from('artifact_versions')
          .select('id, version, content, origin, created_at, author:team_members(name)')
          .eq('artifact_id', artifact.id)
          .order('version', { ascending: false })
      : null,
  ])
  if (jobs.error) throw new Error(`Could not load activity: ${jobs.error.message}`)
  if (versions?.error) throw new Error(`Could not load the draft: ${versions.error.message}`)

  const allVersions = versions?.data ?? []
  const latest = allVersions[0] ?? null
  const requested = Number((await searchParams).v)
  const shown = allVersions.find((v) => v.version === requested) ?? latest
  const isLatest = shown?.id === latest?.id

  const reviews = allVersions.length
    ? await supabase
        .from('approvals')
        .select('id, action, comment, created_at, artifact_version_id, actor:team_members(name)')
        .in(
          'artifact_version_id',
          allVersions.map((v) => v.id),
        )
        .order('created_at', { ascending: false })
    : null
  if (reviews?.error) throw new Error(`Could not load the review history: ${reviews.error.message}`)
  const versionNumber = new Map(allVersions.map((v) => [v.id, v.version]))

  const written = shown && release.mode === 'write' ? pressReleaseSchema.safeParse(shown.content) : null
  const edited = shown && release.mode === 'edit' ? releaseEditSchema.safeParse(shown.content) : null
  const unreadable = (written && !written.success) || (edited && !edited.success)
  const status = artifact?.status ?? 'draft'
  const base = `/clients/${clientId}/releases`

  const draft = written?.success ? (
    <WrittenView release={written.data} clientName={client.name} />
  ) : edited?.success ? (
    <EditedView release={edited.data} />
  ) : null

  return (
    <div className="page">
      <LiveRefresh tables={['jobs', 'artifacts', 'artifact_versions']} />

      <div className="stage">
        <div className="stage__main stack" style={{ gap: 16 }}>
          <div className="card card--pad" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{release.title}</h2>
              {artifact && <StatusPill badge={badge(STATUS_LABEL[status])} />}
              {shown?.origin === 'ai' && <AiDraftBadge />}
            </div>
            <span className="hint hint--muted">
              {release.mode === 'edit' ? 'We edit the client’s draft' : 'We write'}
              {release.due_on && ` · due ${due.format(new Date(release.due_on))}`}
              {shown && ` · version ${shown.version}`}
              {release.source_email_id && (
                <>
                  {' · '}
                  <Link href={`/inbox?folder=handled&id=${release.source_email_id}`}>from this email</Link>
                </>
              )}
            </span>
            {artifact?.approved_version_id && status !== 'approved' && (
              <span className="hint">
                An earlier version is approved, and media lists use it until this one is approved.
              </span>
            )}
          </div>

          {shown && !isLatest && (
            <div className="card card--pad row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span className="hint">You&rsquo;re viewing version {shown.version}, read-only.</span>
              <Link href={base} className="btn btn--sm">
                Back to the latest
              </Link>
            </div>
          )}

          <div className="card">
            {!shown ? (
              <EmptyState title="Drafting">
                The first draft shows here when it&rsquo;s ready. Progress is on the right.
              </EmptyState>
            ) : unreadable ? (
              <EmptyState title="This version can’t be shown">
                Its content doesn&rsquo;t match the {release.mode === 'edit' ? 'edit' : 'release'} format.
              </EmptyState>
            ) : isLatest && artifact && status !== 'archived' ? (
              written?.success ? (
                <ReleaseEditor mode="write" artifactId={artifact.id} versionId={shown.id} content={written.data}>
                  {draft}
                </ReleaseEditor>
              ) : edited?.success ? (
                <ReleaseEditor mode="edit" artifactId={artifact.id} versionId={shown.id} content={edited.data}>
                  {draft}
                </ReleaseEditor>
              ) : null
            ) : (
              draft
            )}
          </div>
        </div>

        <aside className="stage__rail">
          <div className="card card--pad" style={{ gap: 12 }}>
            <SectionLabel>Review</SectionLabel>
            {!latest || !artifact ? (
              <span className="hint hint--muted">Review opens once there&rsquo;s a draft.</span>
            ) : (
              <>
                <span className="hint">
                  {status === 'approved'
                    ? `Version ${latest.version} is approved. Media lists read this version.`
                    : status === 'in_review'
                      ? `Version ${latest.version} is waiting for review. Any team member can approve it.`
                      : `Version ${latest.version} is a draft. Edit it, then send it for review.`}
                </span>
                <ReviewPanel clientId={clientId} versionId={latest.id} status={status} />
              </>
            )}
            {reviews?.data && reviews.data.length > 0 && (
              <div className="stack" style={{ gap: 8 }}>
                {reviews.data.map((r) => (
                  <div key={r.id} className="stack" style={{ gap: 2 }}>
                    <span style={{ fontSize: 13 }}>
                      <strong>{REVIEW_ACTION[r.action]}</strong> · v{versionNumber.get(r.artifact_version_id)} ·{' '}
                      {r.actor?.name ?? 'Someone'}
                    </span>
                    <span className="hint hint--muted">{when.format(new Date(r.created_at))}</span>
                    {r.comment && <span className="hint">&ldquo;{r.comment}&rdquo;</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {allVersions.length > 0 && (
            <div className="card card--pad" style={{ gap: 8 }}>
              <SectionLabel>Versions</SectionLabel>
              {allVersions.map((v) => (
                <Link
                  key={v.id}
                  href={v.id === latest?.id ? base : `${base}?v=${v.version}`}
                  aria-current={v.id === shown?.id ? 'page' : undefined}
                  className="stack"
                  style={{ gap: 2, color: 'inherit', textDecoration: 'none' }}
                >
                  <span style={{ fontSize: 13, fontWeight: v.id === shown?.id ? 600 : 400 }}>
                    v{v.version} · {ORIGIN_LABEL[v.origin]}
                    {v.author?.name && ` · ${v.author.name}`}
                    {v.id === artifact?.approved_version_id && ' · approved'}
                  </span>
                  <span className="hint hint--muted">{when.format(new Date(v.created_at))}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="card card--pad" style={{ gap: 12 }}>
            <SectionLabel>Activity</SectionLabel>
            <JobActivity jobs={jobs.data} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function WrittenView({ release, clientName }: { release: WrittenRelease; clientName: string }) {
  return (
    <div className="docBody">
      <div className="docSection">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{release.headline}</h2>
        {release.subheadline && <span className="hint">{release.subheadline}</span>}
      </div>
      {release.sections.map((section, i) => (
        <div key={section.id} className="docSection">
          {section.heading && <h3>{section.heading}</h3>}
          <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>
            {i === 0 && <strong>{release.dateline} — </strong>}
            {section.body}
          </p>
        </div>
      ))}
      <div className="docSection">
        <h3>About {clientName}</h3>
        <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>
          {release.boilerplate}
        </p>
      </div>
    </div>
  )
}

function EditedView({ release }: { release: EditedRelease }) {
  return (
    <div className="docBody">
      {release.sections.map((section) => {
        const edits = release.suggested_edits.filter((e) => e.section_id === section.id)
        return (
          <div key={section.id} className="docSection">
            {section.heading && <h3>{section.heading}</h3>}
            <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>
              {section.body}
            </p>
            {edits.map((edit, i) => (
              <div key={i} className="editCard">
                <span className="editFrom">{edit.original}</span>
                <span className="editTo">{edit.suggestion}</span>
                <span className="hint hint--muted">{edit.reason}</span>
              </div>
            ))}
          </div>
        )
      })}
      {release.suggested_edits.length === 0 && (
        <div className="docSection">
          <span className="hint hint--muted">No suggested changes: the client&rsquo;s draft goes as written.</span>
        </div>
      )}
    </div>
  )
}
