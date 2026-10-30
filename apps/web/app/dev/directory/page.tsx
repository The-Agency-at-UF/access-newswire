import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { ActionForm } from '../ActionForm'
import { addJournalist, addOutlet, addToCoreList, setDoNotContact } from '../console-actions'
import styles from '../dev.module.css'

export const metadata = { title: 'Directory — Backend console' }

export default async function DirectoryPage() {
  await requireOrgSession()
  const db = await supabaseServer()

  const [outlets, journalists, clients, core] = await Promise.all([
    db.from('outlets').select('id, name, type, region').order('name'),
    db.from('journalists').select('id, name, email, title, beats, do_not_contact, do_not_contact_reason, outlet:outlets(name)').order('name'),
    db.from('clients').select('id, name, tier').order('name'),
    db.from('core_lists').select('client_id, journalist_id'),
  ])
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]))
  const coreFor = new Map<string, string[]>()
  for (const row of core.data ?? []) coreFor.set(row.journalist_id, [...(coreFor.get(row.journalist_id) ?? []), clientName.get(row.client_id) ?? '?'])

  return (
    <>
      <section className={styles.card}>
        <h2>Outlets</h2>
        <ActionForm action={addOutlet} submit="Add outlet">
          <label>Name<input name="name" required /></label>
          <label>Type<input name="type" placeholder="trade, online…" /></label>
          <label>Region<input name="region" /></label>
          <label>URL<input name="url" /></label>
        </ActionForm>
        <p className={styles.muted}>{(outlets.data ?? []).map((o) => o.name).join(' · ') || 'None yet.'}</p>
      </section>

      <section className={styles.card}>
        <h2>Journalists</h2>
        <p className={styles.muted}>The only source of contact details (AGENTS.md §2.4). Do-not-contact is enforced on core lists, media lists and outreach.</p>
        <ActionForm action={addJournalist} submit="Add journalist">
          <label>Name<input name="name" required /></label>
          <label>Email<input name="email" type="email" /></label>
          <label>Title<input name="title" /></label>
          <label>Outlet
            <select name="outlet_id" defaultValue=""><option value="">—</option>{(outlets.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </label>
          <label>Beats<input name="beats" placeholder="mining, energy" /></label>
        </ActionForm>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Outlet</th><th>Beats</th><th>Core list for</th><th>Do not contact</th><th>Add to core list</th></tr></thead>
          <tbody>
            {(journalists.data ?? []).map((j) => (
              <tr key={j.id}>
                <td>{j.name} <span className={styles.muted}>{j.email}</span></td>
                <td>{j.outlet?.name ?? '—'}</td>
                <td>{j.beats.join(', ')}</td>
                <td>{(coreFor.get(j.id) ?? []).join(', ') || '—'}</td>
                <td>
                  <ActionForm action={setDoNotContact} submit={j.do_not_contact ? 'DNC — clear' : 'Mark DNC'} inline danger={!j.do_not_contact}>
                    <input type="hidden" name="journalist_id" value={j.id} />
                    <input type="hidden" name="value" value={String(!j.do_not_contact)} />
                    {!j.do_not_contact && <input name="reason" placeholder="reason" />}
                  </ActionForm>
                </td>
                <td>
                  <ActionForm action={addToCoreList} submit="Add" inline>
                    <input type="hidden" name="journalist_id" value={j.id} />
                    <select name="client_id" required defaultValue="">
                      <option value="">client…</option>
                      {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.tier})</option>)}
                    </select>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
