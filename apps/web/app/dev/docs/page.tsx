import { requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { ActionForm } from '../ActionForm'
import { startJob, uploadDocument } from '../console-actions'
import { LiveRefresh } from '../LiveRefresh'
import styles from '../dev.module.css'

export const metadata = { title: 'Documents & search — Backend console' }

export default async function DocsPage({ searchParams }: { searchParams: Promise<{ client?: string; q?: string }> }) {
  await requireOrgSession()
  const { client, q } = await searchParams
  const db = await supabaseServer()

  const [clients, documents] = await Promise.all([
    db.from('clients').select('id, name').order('name'),
    db.from('documents').select('id, client_id, title, source, bucket, storage_path, index_status, index_error, size_bytes, created_at')
      .order('created_at', { ascending: false }).limit(40),
  ])
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]))

  // Keyword search from the server: the Voyage key is worker-only, so no embedding here.
  const results = client && q ? await db.rpc('match_chunks', { p_client_id: client, p_query_embedding: null as never, p_query_text: q, p_match_count: 8 }) : null

  // Short-lived signed links (AGENTS.md §9), created under the caller's storage policy.
  const links = new Map<string, string>()
  for (const doc of documents.data ?? []) {
    const { data } = await db.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 300)
    if (data?.signedUrl) links.set(doc.id, data.signedUrl)
  }

  return (
    <>
      <section className={styles.card}>
        <h2>Upload</h2>
        <ActionForm action={uploadDocument} submit="Upload">
          <label>Client
            <select name="client_id" required defaultValue="">
              <option value="">Choose…</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Title<input name="title" placeholder="defaults to the filename" /></label>
          <label className={styles.wide}>File (PDF, DOCX, TXT, HTML, CSV; 25 MB)<input type="file" name="file" required /></label>
        </ActionForm>
      </section>

      <section className={styles.card}>
        <h2>Search a client&apos;s documents</h2>
        <form className={styles.form} method="get">
          <label>Client
            <select name="client" defaultValue={client ?? ''} required>
              <option value="">Choose…</option>
              {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Query<input name="q" defaultValue={q ?? ''} required /></label>
          <div className={styles.formFoot}><button type="submit">Search</button></div>
        </form>
        {results?.error && <p className={styles.err}>{results.error.message}</p>}
        {results?.data && (results.data.length === 0 ? <p className={styles.muted}>No matches.</p> : (
          <table className={styles.table}>
            <thead><tr><th>Document</th><th>Chunk</th><th>Score</th><th>Text</th></tr></thead>
            <tbody>
              {results.data.map((r) => (
                <tr key={r.chunk_id}>
                  <td>{r.document_title}</td><td>{r.chunk_index}</td><td>{r.score.toFixed(4)}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 300 }}>{r.content.slice(0, 300)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </section>

      <section className={styles.card}>
        <h2>Documents <LiveRefresh tables={['documents']} /></h2>
        <table className={styles.table}>
          <thead><tr><th>Title</th><th>Client</th><th>Source</th><th>Index</th><th>Size</th><th /></tr></thead>
          <tbody>
            {(documents.data ?? []).map((d) => (
              <tr key={d.id}>
                <td>{links.has(d.id) ? <a href={links.get(d.id)}>{d.title}</a> : d.title}</td>
                <td>{d.client_id ? clientName.get(d.client_id) : 'inbox'}</td>
                <td>{d.source} · {d.bucket}</td>
                <td><span className={styles.pill}>{d.index_status}</span> <span className={styles.err}>{d.index_error}</span></td>
                <td>{d.size_bytes ? `${Math.ceil(d.size_bytes / 1024)} KB` : '—'}</td>
                <td>
                  {d.bucket !== 'exports' && (
                    <ActionForm action={startJob} submit="Re-index" inline>
                      <input type="hidden" name="type" value="document.index" />
                      <input type="hidden" name="client_id" value={d.client_id ?? ''} />
                      <input type="hidden" name="input" value={JSON.stringify({ document_id: d.id })} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  )
}
