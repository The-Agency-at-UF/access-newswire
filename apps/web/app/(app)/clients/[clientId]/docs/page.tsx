import { LiveRefresh } from '@/components/LiveRefresh'
import { SectionLabel } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabaseServer } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'
import { DocsTable, type DocRow } from './DocsTable'
import { UploadForm } from './UploadForm'

/**
 * The client's knowledge base: uploads, inbox attachments and generated files,
 * with their index state live, and search over what's indexed.
 */
export default async function DocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { clientId } = await params
  const q = (await searchParams).q?.trim().slice(0, 200) || null
  const { client } = await getWorkspace(clientId)
  const supabase = await supabaseServer()

  const [documents, results] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, source, bucket, storage_path, index_status, index_error, size_bytes, created_at')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    // Keyword search from the server: the Voyage key is worker-only, so no
    // query embedding here and match_chunks ranks on full text alone.
    q
      ? supabase.rpc('match_chunks', { p_client_id: client.id, p_query_embedding: null as never, p_query_text: q, p_match_count: 8 })
      : null,
  ])
  if (documents.error) throw new Error(`Could not load documents: ${documents.error.message}`)

  // Short-lived signed links (AGENTS.md §9), one batch per bucket.
  const links = new Map<string, string>()
  const byBucket = new Map<string, typeof documents.data>()
  for (const d of documents.data) byBucket.set(d.bucket, [...(byBucket.get(d.bucket) ?? []), d])
  await Promise.all(
    [...byBucket].map(async ([bucket, docs]) => {
      const { data } = await supabase.storage.from(bucket).createSignedUrls(docs.map((d) => d.storage_path), 300)
      docs.forEach((doc, i) => {
        const url = data?.[i]?.signedUrl
        if (url) links.set(doc.id, url)
      })
    }),
  )

  const rows: DocRow[] = documents.data.map((d) => ({
    id: d.id,
    title: d.title,
    source: d.source,
    index_status: d.index_status,
    index_error: d.index_error,
    size_bytes: d.size_bytes,
    created_at: d.created_at,
    href: links.get(d.id) ?? null,
  }))

  return (
    <div className="page">
      <LiveRefresh tables={['documents']} />

      <div className="grid grid--start">
        <UploadForm clientId={client.id} />

        <div className="card card--pad" style={{ gap: 12 }}>
          <SectionLabel>Search {client.name}&rsquo;s documents</SectionLabel>
          <form method="get" className="row" style={{ gap: 10 }}>
            <input className="input" name="q" defaultValue={q ?? ''} placeholder="e.g. Series B, spokesperson, launch date" />
            <button type="submit" className="btn">
              Search
            </button>
          </form>
          {results?.error && (
            <span role="alert" style={{ color: 'var(--danger)', fontSize: 12.5 }}>
              {results.error.message}
            </span>
          )}
          {results?.data &&
            (results.data.length === 0 ? (
              <span className="hint hint--muted">No matches in indexed documents.</span>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {results.data.map((r) => (
                  <div key={r.chunk_id} className="stack" style={{ gap: 2 }}>
                    <span className="cellStrong">{r.document_title}</span>
                    <span className="hint">{r.content.length > 280 ? `${r.content.slice(0, 280)}…` : r.content}</span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <EmptyState title="No documents yet">
            Uploads, inbox attachments and generated files for this client appear here, indexed for search.
          </EmptyState>
        ) : (
          <DocsTable clientId={client.id} docs={rows} />
        )}
      </div>
    </div>
  )
}
