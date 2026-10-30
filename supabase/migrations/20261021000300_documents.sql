-- Files and their retrieval index (AGENTS.md §8, §9, §10.4).

create extension if not exists vector with schema extensions;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  -- Null for org-level files such as templates.
  client_id uuid,
  source public.document_source not null,
  bucket text not null check (bucket in ('client-files', 'exports', 'templates')),
  -- {org_id}/{client_id}/{document_id}/{filename}, or {org_id}/templates/...
  storage_path text not null,
  mime text,
  title text not null check (length(btrim(title)) > 0),
  size_bytes bigint check (size_bytes >= 0),
  -- Set for inbox attachments; the foreign key is added with `emails`.
  email_id uuid,
  index_status public.index_status not null default 'pending',
  index_error text,
  indexed_at timestamptz,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  unique (bucket, storage_path),
  unique (org_id, id),
  check (split_part(storage_path, '/', 1) = org_id),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create index documents_client_idx on public.documents (client_id, created_at desc);
create index documents_pending_idx on public.documents (index_status) where index_status in ('pending', 'failed');

select private.secure_table('public.documents', 'members');
-- Indexing state is the worker's; people may only rename.
revoke update on public.documents from authenticated;
grant update (title) on public.documents to authenticated;

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  document_id uuid not null,
  -- Denormalized from the document so retrieval filters on one column.
  client_id uuid,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  tokens integer check (tokens >= 0),
  -- Voyage embeddings (1024 dimensions). Null until embedded.
  embedding extensions.vector(1024),
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index),
  foreign key (org_id, document_id) references public.documents (org_id, id) on delete cascade
);

create index document_chunks_client_idx on public.document_chunks (client_id);
create index document_chunks_fts_idx on public.document_chunks using gin (fts);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Written only by the worker's document.index task.
select private.secure_table('public.document_chunks', 'read');

/*
 * Hybrid retrieval for one client: semantic (pgvector cosine) and full-text
 * results merged by reciprocal rank fusion. Pass a null embedding for a
 * keyword-only search (the browser can't embed: the Voyage key is worker-only).
 *
 * security invoker: users see only their org's chunks through RLS. The worker
 * connects as a role that bypasses RLS, and must only pass a client_id it has
 * already checked belongs to the job's org (AGENTS.md §2.7).
 */
create or replace function public.match_chunks(
  p_client_id uuid,
  p_query_embedding extensions.vector(1024),
  p_query_text text,
  p_match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title text,
  chunk_index integer,
  content text,
  score double precision
)
language sql stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      case when coalesce(btrim(p_query_text), '') = '' then null
           else websearch_to_tsquery('english', p_query_text) end as tsq,
      least(greatest(p_match_count, 1), 50) as k
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding operator(extensions.<=>) p_query_embedding) as rank
    from public.document_chunks c
    where c.client_id = p_client_id
      and c.embedding is not null
      and p_query_embedding is not null
    order by c.embedding operator(extensions.<=>) p_query_embedding
    limit (select k * 4 from q)
  ),
  keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q.tsq) desc) as rank
    from public.document_chunks c, q
    where c.client_id = p_client_id
      and q.tsq is not null
      and c.fts @@ q.tsq
    order by ts_rank_cd(c.fts, q.tsq) desc
    limit (select k * 4 from q)
  )
  select c.id, c.document_id, d.title, c.chunk_index, c.content,
         coalesce(1.0 / (60 + s.rank), 0) + coalesce(1.0 / (60 + kw.rank), 0) as score
  from semantic s
  full outer join keyword kw on kw.id = s.id
  join public.document_chunks c on c.id = coalesce(s.id, kw.id)
  join public.documents d on d.id = c.document_id
  order by score desc
  limit (select k from q)
$$;

revoke execute on function public.match_chunks(uuid, extensions.vector, text, integer) from public, anon;
grant execute on function public.match_chunks(uuid, extensions.vector, text, integer) to authenticated, service_role;
