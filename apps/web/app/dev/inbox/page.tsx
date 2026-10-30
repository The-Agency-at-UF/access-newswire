import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { ActionForm } from '../ActionForm'
import { addMailbox, addSenderRule, correctEmail, setHandled } from '../console-actions'
import { LiveRefresh } from '../LiveRefresh'
import styles from '../dev.module.css'

export const metadata = { title: 'Inbox — Backend console' }

const LABELS = ['release_info', 'client_update', 'sales_handoff', 'social', 'auto_notification', 'other']

export default async function InboxPage() {
  const session = await requireOrgSession()
  const db = await supabaseServer()

  const [accounts, emails, clients, rules] = await Promise.all([
    db.from('mail_accounts').select('id, mailbox, subscription_id, subscription_expires_at, last_synced_at, last_error'),
    db.from('emails').select('id, from_address, subject, label, confidence, status, classified_by, client_id, suggested_action, received_at, created_at')
      .order('created_at', { ascending: false }).limit(40),
    db.from('clients').select('id, name').order('name'),
    db.from('sender_rules').select('id, pattern, client_id, label').order('pattern'),
  ])
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]))
  const clientOptions = (clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)

  return (
    <>
      <section className={styles.card}>
        <h2>Mailbox</h2>
        <p className={styles.muted}>
          Read-only Microsoft Graph. Connecting queues a Graph subscription and a first sync; the worker needs the
          MS_GRAPH_* variables and MAIL_WEBHOOK_URL. Admins only.
        </p>
        {(accounts.data ?? []).map((a) => (
          <p key={a.id}>
            <strong>{a.mailbox}</strong> · subscription {a.subscription_id ? `until ${a.subscription_expires_at}` : 'not yet'} · last
            sync {a.last_synced_at ?? 'never'} {a.last_error && <span className={styles.err}>· {a.last_error}</span>}
          </p>
        ))}
        {session.isAdmin && (
          <ActionForm action={addMailbox} submit="Connect mailbox">
            <label>Shared mailbox<input name="mailbox" type="email" placeholder="theagency@newswire.com" required /></label>
          </ActionForm>
        )}
      </section>

      <section className={styles.card}>
        <h2>Emails <LiveRefresh tables={['emails']} /></h2>
        <table className={styles.table}>
          <thead><tr><th>From</th><th>Subject</th><th>Status</th><th>Label</th><th>Client</th><th>By</th><th>Correct</th><th /></tr></thead>
          <tbody>
            {(emails.data ?? []).map((e) => (
              <tr key={e.id}>
                <td>{e.from_address}</td>
                <td title={e.suggested_action ?? ''}>{e.subject}</td>
                <td><span className={styles.pill}>{e.status}</span></td>
                <td>{e.label ?? '—'} {e.confidence != null && <span className={styles.muted}>({Number(e.confidence).toFixed(2)})</span>}</td>
                <td>{e.client_id ? clientName.get(e.client_id) : '—'}</td>
                <td>{e.classified_by ?? '—'}</td>
                <td>
                  <ActionForm action={correctEmail} submit="Save" inline>
                    <input type="hidden" name="email_id" value={e.id} />
                    <select name="client_id" defaultValue={e.client_id ?? ''}><option value="">no client</option>{clientOptions}</select>
                    <select name="label" defaultValue={e.label ?? 'other'}>{LABELS.map((l) => <option key={l}>{l}</option>)}</select>
                    <label className={styles.inline}><input type="checkbox" name="remember" defaultChecked /> remember sender</label>
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={setHandled} submit={e.status === 'handled' ? 'Reopen' : 'Handled'} inline>
                    <input type="hidden" name="email_id" value={e.id} />
                    <input type="hidden" name="handled" value={String(e.status !== 'handled')} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card}>
        <h2>Sender rules</h2>
        <p className={styles.muted}>Checked before the classifier. An address or @domain; set a client, a label, or both.</p>
        <ActionForm action={addSenderRule} submit="Add rule">
          <label>Pattern<input name="pattern" placeholder="@ridgeline.example" required /></label>
          <label>Client<select name="client_id" defaultValue=""><option value="">—</option>{clientOptions}</select></label>
          <label>Label<select name="label" defaultValue=""><option value="">—</option>{LABELS.map((l) => <option key={l}>{l}</option>)}</select></label>
        </ActionForm>
        <table className={styles.table}>
          <thead><tr><th>Pattern</th><th>Client</th><th>Label</th></tr></thead>
          <tbody>
            {(rules.data ?? []).map((r) => (
              <tr key={r.id}><td>{r.pattern}</td><td>{r.client_id ? clientName.get(r.client_id) : '—'}</td><td>{r.label ?? '—'}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
