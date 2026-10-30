import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { ActionForm } from '../ActionForm'
import { activateFramework, addFrameworkVersion, saveOrgSettings } from '../console-actions'
import styles from '../dev.module.css'

export const metadata = { title: 'Frameworks & settings — Backend console' }

const KINDS = [
  'research', 'onboarding_deck', 'strategy', 'press_release_write', 'press_release_edit',
  'media_list', 'pitch_set', 'report', 'email_classify',
]

export default async function SettingsPage() {
  const session = await requireOrgSession()
  const db = await supabaseServer()

  const [frameworks, settings, generations] = await Promise.all([
    db.from('frameworks').select('id, kind, version, title, body, is_active, is_placeholder, created_at').order('kind').order('version', { ascending: false }),
    db.from('org_settings').select('classify_threshold, access_csv_columns').maybeSingle(),
    db.from('generations').select('task, model, cost_usd, input_tokens, output_tokens, cache_read_input_tokens, created_at').order('created_at', { ascending: false }).limit(200),
  ])

  // Spend by task over the last 200 calls.
  const spend = new Map<string, { calls: number; cost: number }>()
  for (const g of generations.data ?? []) {
    const row = spend.get(g.task) ?? { calls: 0, cost: 0 }
    spend.set(g.task, { calls: row.calls + 1, cost: row.cost + Number(g.cost_usd ?? 0) })
  }

  return (
    <>
      <section className={styles.card}>
        <h2>Frameworks</h2>
        <p className={styles.muted}>
          The team&apos;s prompts, one active version per kind (AGENTS.md §10). A kind with none gets a marked PLACEHOLDER
          the first time it&apos;s used. Bodies never change; save a new version instead. Admins only.
        </p>
        {session.isAdmin && (
          <ActionForm action={addFrameworkVersion} submit="Save new version">
            <label>Kind<select name="kind">{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>Title<input name="title" required /></label>
            <label><span><input type="checkbox" name="activate" defaultChecked /> make active</span></label>
            <label className={styles.wide}>Body (paste the team&apos;s framework verbatim)<textarea name="body" rows={8} required /></label>
          </ActionForm>
        )}
        <table className={styles.table}>
          <thead><tr><th>Kind</th><th>Version</th><th>Title</th><th>State</th><th /></tr></thead>
          <tbody>
            {(frameworks.data ?? []).map((f) => (
              <tr key={f.id}>
                <td>{f.kind}</td>
                <td>v{f.version}</td>
                <td title={f.body.slice(0, 500)}>{f.title}</td>
                <td>
                  {f.is_active && <span className={styles.pill}>active</span>} {f.is_placeholder && <span className={styles.pill}>placeholder</span>}
                </td>
                <td>
                  {session.isAdmin && !f.is_active && (
                    <ActionForm action={activateFramework} submit="Activate" inline>
                      <input type="hidden" name="framework_id" value={f.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card}>
        <h2>Org settings</h2>
        {session.isAdmin ? (
          <ActionForm action={saveOrgSettings} submit="Save settings">
            <label>Classifier routing threshold (0–1)
              <input name="classify_threshold" type="number" step="0.05" min="0" max="1" defaultValue={settings.data?.classify_threshold ?? 0.75} />
            </label>
            <label className={styles.wide}>
              ACCESS media-list CSV columns ([{'{'}header, field{'}'}]; fields: first_name, last_name, name, email, title, outlet, beats, relevance_reason)
              <textarea
                name="access_csv_columns"
                rows={8}
                defaultValue={JSON.stringify(settings.data?.access_csv_columns ?? [
                  { header: 'First Name', field: 'first_name' },
                  { header: 'Last Name', field: 'last_name' },
                  { header: 'Email', field: 'email' },
                  { header: 'Outlet', field: 'outlet' },
                  { header: 'Title', field: 'title' },
                  { header: 'Beats', field: 'beats' },
                ], null, 2)}
              />
            </label>
          </ActionForm>
        ) : (
          <pre className={styles.pre}>{JSON.stringify(settings.data ?? 'defaults', null, 2)}</pre>
        )}
      </section>

      <section className={styles.card}>
        <h2>AI spend (last 200 calls)</h2>
        <table className={styles.table}>
          <thead><tr><th>Task</th><th>Calls</th><th>Cost (list price)</th></tr></thead>
          <tbody>
            {[...spend].map(([task, row]) => (
              <tr key={task}><td>{task}</td><td>{row.calls}</td><td>${row.cost.toFixed(4)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
