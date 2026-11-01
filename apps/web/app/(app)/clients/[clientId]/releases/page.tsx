import Link from 'next/link'
import { pressReleaseSchema, releaseEditSchema } from '@access/ai/schemas'
import { JobActivity } from '@/components/JobActivity'
import { LiveRefresh } from '@/components/LiveRefresh'
import { AiDraftBadge, SectionLabel, StatusPill } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { autoReleaseMode, badge } from '@/lib/selectors/stages'
import { supabaseServer } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { StagePage } from '../StagePage'

const due = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Press releases. L2 clients send their own draft and we suggest edits; L1 and
 * L3 releases we write. Needs an approved strategy and Meeting 2, unless the
 * client was onboarded before the app.
 */
export default async function ReleasesPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const { client, release, artifacts, cs } = await getWorkspace(clientId)
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
  const [jobs, version] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, type, status, progress, progress_message, error, created_at')
      .eq('release_id', release.id)
      .order('created_at', { ascending: false })
      .limit(4),
    artifact
      ? supabase
          .from('artifact_versions')
          .select('id, version, content, origin, created_at')
          .eq('artifact_id', artifact.id)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()
      : null,
  ])
  if (jobs.error) throw new Error(`Could not load activity: ${jobs.error.message}`)
  if (version?.error) throw new Error(`Could not load the draft: ${version.error.message}`)

  const latest = version?.data ?? null
  const written = latest && release.mode === 'write' ? pressReleaseSchema.safeParse(latest.content) : null
  const edited = latest && release.mode === 'edit' ? releaseEditSchema.safeParse(latest.content) : null
  const unreadable = (written && !written.success) || (edited && !edited.success)

  return (
    <div className="page">
      <LiveRefresh tables={['jobs', 'artifacts', 'artifact_versions']} />

      <div className="stage">
        <div className="stage__main stack" style={{ gap: 16 }}>
          <div className="card card--pad" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>{release.title}</h2>
              <StatusPill badge={badge(cs.release)} />
              {latest?.origin === 'ai' && <AiDraftBadge />}
            </div>
            <span className="hint hint--muted">
              {release.mode === 'edit' ? 'We edit the client’s draft' : 'We write'}
              {release.due_on && ` · due ${due.format(new Date(release.due_on))}`}
              {latest && ` · version ${latest.version}`}
              {release.source_email_id && (
                <>
                  {' · '}
                  <Link href={`/inbox?folder=handled&id=${release.source_email_id}`}>from this email</Link>
                </>
              )}
            </span>
          </div>

          <div className="card">
            {!latest ? (
              <EmptyState title="Drafting">
                The first draft shows here when it&rsquo;s ready. Progress is on the right.
              </EmptyState>
            ) : unreadable ? (
              <EmptyState title="This version can’t be shown">
                Its content doesn&rsquo;t match the {release.mode === 'edit' ? 'edit' : 'release'} format.
              </EmptyState>
            ) : written?.success ? (
              <div className="docBody">
                <div className="docSection">
                  <h2 style={{ fontSize: 20, fontWeight: 600 }}>{written.data.headline}</h2>
                  {written.data.subheadline && <span className="hint">{written.data.subheadline}</span>}
                </div>
                {written.data.sections.map((section, i) => (
                  <div key={section.id} className="docSection">
                    {section.heading && <h3>{section.heading}</h3>}
                    <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>
                      {i === 0 && <strong>{written.data.dateline} — </strong>}
                      {section.body}
                    </p>
                  </div>
                ))}
                <div className="docSection">
                  <h3>About {client.name}</h3>
                  <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>{written.data.boilerplate}</p>
                </div>
              </div>
            ) : edited?.success ? (
              <div className="docBody">
                {edited.data.sections.map((section) => {
                  const edits = edited.data.suggested_edits.filter((e) => e.section_id === section.id)
                  return (
                    <div key={section.id} className="docSection">
                      {section.heading && <h3>{section.heading}</h3>}
                      <p className="prose" style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p>
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
              </div>
            ) : null}
          </div>
        </div>

        <aside className="stage__rail">
          <div className="card card--pad" style={{ gap: 12 }}>
            <SectionLabel>Activity</SectionLabel>
            <JobActivity jobs={jobs.data} />
          </div>
          <div className="card card--pad" style={{ gap: 8 }}>
            <SectionLabel>Review</SectionLabel>
            <span className="hint hint--muted">
              Editing, sending for review and approving happen here next. Media lists read only the approved version.
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}
