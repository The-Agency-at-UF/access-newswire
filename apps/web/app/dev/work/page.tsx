import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { ActionForm } from '../ActionForm'
import {
  archiveArtifact,
  cancelJob,
  createArtifact,
  createRelease,
  markUploaded,
  recordMeeting,
  reviewVersion,
  saveVersion,
  setOnboardedExternally,
  startJob,
} from '../console-actions'
import { LiveRefresh } from '../LiveRefresh'
import styles from '../dev.module.css'

export const metadata = { title: 'Releases & artifacts — Backend console' }

const JOB_TYPES = [
  'research.run', 'onboarding.generate', 'strategy.phase', 'release.draft', 'release.edit',
  'medialist.build', 'pitches.generate', 'document.index', 'export.render', 'stats.import',
]
const ARTIFACT_TYPES = ['research', 'onboarding_deck', 'strategy', 'press_release', 'media_list', 'pitch_set', 'report']
const EXPORTS: Record<string, string[]> = {
  onboarding_deck: ['pptx'],
  media_list: ['csv'],
  research: ['docx'],
  strategy: ['docx'],
  press_release: ['docx'],
  pitch_set: ['docx'],
  report: ['docx'],
}

export default async function WorkPage() {
  await requireOrgSession()
  const db = await supabaseServer()

  const [clients, releases, artifacts, versions, jobs, meetings] = await Promise.all([
    db.from('clients').select('id, name, tier, onboarded_externally').order('name'),
    db.from('releases').select('id, client_id, title, mode, due_on, access_uploaded_at').order('created_at', { ascending: false }).limit(30),
    db.from('artifacts').select('id, client_id, release_id, type, title, status, approved_version_id').order('updated_at', { ascending: false }).limit(40),
    db.from('artifact_versions').select('id, artifact_id, version, origin, content, created_at').order('version', { ascending: false }).limit(400),
    db.from('jobs').select('id, type, status, progress, progress_message, error, attempts, created_at').order('created_at', { ascending: false }).limit(25),
    db.from('meetings').select('client_id, kind, held_on').not('held_on', 'is', null),
  ])

  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]))
  const releaseTitle = new Map((releases.data ?? []).map((r) => [r.id, r.title]))
  const latest = new Map<string, NonNullable<typeof versions.data>[number]>()
  for (const v of versions.data ?? []) if (!latest.has(v.artifact_id)) latest.set(v.artifact_id, v)
  const approvedNumber = new Map((versions.data ?? []).map((v) => [v.id, v.version]))
  const held = new Set((meetings.data ?? []).map((m) => `${m.client_id}:${m.kind}`))

  const clientSelect = (name = 'client_id', required = true) => (
    <select name={name} required={required} defaultValue="">
      <option value="">{required ? 'Choose…' : '—'}</option>
      {(clients.data ?? []).map((c) => (
        <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>
      ))}
    </select>
  )
  const releaseSelect = (
    <select name="release_id" defaultValue="">
      <option value="">—</option>
      {(releases.data ?? []).map((r) => (
        <option key={r.id} value={r.id}>{clientName.get(r.client_id)} · {r.title}</option>
      ))}
    </select>
  )

  return (
    <>
      <section className={styles.card}>
        <h2>Jobs <LiveRefresh tables={['jobs', 'artifacts', 'artifact_versions']} /></h2>
        <p className={styles.muted}>
          Queued jobs run when the worker is up (<code>pnpm --filter @access/worker dev</code>). AI jobs need a client
          (and a release for release work); export.render needs an artifact and <code>{'{"format":"docx"}'}</code>.
        </p>
        <ActionForm action={startJob} submit="Queue job">
          <label>Type<select name="type">{JOB_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Client{clientSelect('client_id', false)}</label>
          <label>Release{releaseSelect}</label>
          <label>Artifact id<input name="artifact_id" placeholder="optional uuid" /></label>
          <label className={styles.wide}>Input (JSON)<textarea name="input" defaultValue="{}" /></label>
        </ActionForm>
        <table className={styles.table}>
          <thead><tr><th>Type</th><th>Status</th><th>Progress</th><th>Tries</th><th>Error</th><th /></tr></thead>
          <tbody>
            {(jobs.data ?? []).map((job) => (
              <tr key={job.id}>
                <td>{job.type}</td>
                <td><span className={styles.pill}>{job.status}</span></td>
                <td>{job.progress}% {job.progress_message ?? ''}</td>
                <td>{job.attempts}</td>
                <td className={styles.err}>{job.error?.slice(0, 120)}</td>
                <td>
                  {(job.status === 'queued' || job.status === 'running') && (
                    <ActionForm action={cancelJob} submit="Cancel" inline danger>
                      <input type="hidden" name="job_id" value={job.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card}>
        <h2>Onboarding gates</h2>
        <table className={styles.table}>
          <thead><tr><th>Client</th><th>Onboarded before the app</th><th>Meeting 1</th><th>Meeting 2</th></tr></thead>
          <tbody>
            {(clients.data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <ActionForm action={setOnboardedExternally} submit={c.onboarded_externally ? 'Yes — undo' : 'No — mark existing'} inline>
                    <input type="hidden" name="client_id" value={c.id} />
                    <input type="hidden" name="value" value={String(!c.onboarded_externally)} />
                  </ActionForm>
                </td>
                <td>{held.has(`${c.id}:meeting_1`) ? 'held' : '—'}</td>
                <td>{held.has(`${c.id}:meeting_2`) ? 'held' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionForm action={recordMeeting} submit="Record meeting">
          <label>Client{clientSelect()}</label>
          <label>Kind<select name="kind"><option>meeting_1</option><option>meeting_2</option><option>check_in</option></select></label>
          <label>Held on<input type="date" name="held_on" /></label>
          <label className={styles.wide}>Notes<textarea name="notes" /></label>
        </ActionForm>
      </section>

      <section className={styles.card}>
        <h2>Releases</h2>
        <ActionForm action={createRelease} submit="Create release">
          <label>Client{clientSelect()}</label>
          <label>Title<input name="title" required /></label>
          <label>Due<input type="date" name="due_on" /></label>
          <label>Roadmap item<input name="roadmap_item" /></label>
        </ActionForm>
        <table className={styles.table}>
          <thead><tr><th>Client</th><th>Title</th><th>Mode</th><th>Due</th><th>ACCESS</th></tr></thead>
          <tbody>
            {(releases.data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{clientName.get(r.client_id)}</td>
                <td>{r.title}</td>
                <td>{r.mode}</td>
                <td>{r.due_on ?? '—'}</td>
                <td>
                  {r.access_uploaded_at ? (
                    `uploaded ${new Date(r.access_uploaded_at).toLocaleDateString()}`
                  ) : (
                    <ActionForm action={markUploaded} submit="Mark uploaded" inline>
                      <input type="hidden" name="release_id" value={r.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card}>
        <h2>Artifacts</h2>
        <ActionForm action={createArtifact} submit="Create artifact">
          <label>Client{clientSelect()}</label>
          <label>Release{releaseSelect}</label>
          <label>Type<select name="type">{ARTIFACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Title<input name="title" required /></label>
        </ActionForm>
        {(artifacts.data ?? []).map((a) => {
          const v = latest.get(a.id)
          return (
            <details key={a.id} className={styles.card}>
              <summary>
                <strong>{a.title}</strong> · {clientName.get(a.client_id)}
                {a.release_id ? ` · ${releaseTitle.get(a.release_id) ?? 'release'}` : ''} · {a.type} ·{' '}
                <span className={styles.pill}>{a.status}</span> · latest v{v?.version ?? '—'}
                {v ? ` (${v.origin === 'ai' ? 'AI DRAFT' : v.origin})` : ''} · approved{' '}
                {a.approved_version_id ? `v${approvedNumber.get(a.approved_version_id) ?? '?'}` : '—'}
              </summary>
              <div className={styles.actions}>
                {v && (
                  <>
                    <ActionForm action={reviewVersion} submit="Submit for review" inline>
                      <input type="hidden" name="version_id" value={v.id} />
                      <input type="hidden" name="action" value="submit" />
                    </ActionForm>
                    <ActionForm action={reviewVersion} submit="Approve latest" inline>
                      <input type="hidden" name="version_id" value={v.id} />
                      <input type="hidden" name="action" value="approve" />
                    </ActionForm>
                    <ActionForm action={reviewVersion} submit="Request changes" inline>
                      <input type="hidden" name="version_id" value={v.id} />
                      <input type="hidden" name="action" value="changes" />
                      <input name="comment" placeholder="what to change" required />
                    </ActionForm>
                  </>
                )}
                {(EXPORTS[a.type] ?? []).map((format) => (
                  <ActionForm key={format} action={startJob} submit={`Export ${format}`} inline>
                    <input type="hidden" name="type" value="export.render" />
                    <input type="hidden" name="client_id" value={a.client_id} />
                    <input type="hidden" name="input" value={JSON.stringify({ artifact_id: a.id, format })} />
                  </ActionForm>
                ))}
                <ActionForm action={archiveArtifact} submit="Archive" inline danger>
                  <input type="hidden" name="artifact_id" value={a.id} />
                </ActionForm>
              </div>
              <ActionForm action={saveVersion} submit="Save as new version">
                <input type="hidden" name="artifact_id" value={a.id} />
                <label className={styles.wide}>
                  Content (JSON, needs a sections array)
                  <textarea name="content" defaultValue={JSON.stringify(v?.content ?? { sections: [] }, null, 2)} rows={10} />
                </label>
              </ActionForm>
            </details>
          )
        })}
      </section>
    </>
  )
}
