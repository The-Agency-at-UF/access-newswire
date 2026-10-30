-- Background work (AGENTS.md §11) on Supabase Queues (pgmq) and the log of
-- every Claude call (§10).
--
-- A job is a row in `jobs` (what the UI watches over Realtime) plus a message
-- {"job_id": ...} on the `jobs` queue (what the worker reads). Both are written
-- in one transaction by private.enqueue(), so neither exists without the other.

create extension if not exists pgmq;
select pgmq.create('jobs');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  type text not null check (type in (
    'research.run', 'onboarding.generate', 'strategy.phase',
    'release.draft', 'release.edit', 'medialist.build', 'pitches.generate',
    'email.sync', 'email.ingest', 'email.classify', 'mail.renew_subscription',
    'document.index', 'export.render', 'stats.import'
  )),
  status public.job_status not null default 'queued',
  progress smallint not null default 0 check (progress between 0 and 100),
  progress_message text,
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object'),
  output jsonb,
  error text,
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts > 0),
  -- Collapses duplicate requests (e.g. a webhook firing twice) while one is pending.
  dedupe_key text,
  client_id uuid,
  release_id uuid,
  artifact_id uuid,
  created_by uuid,
  msg_id bigint,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (client_id, release_id) references public.releases (client_id, id) on delete cascade,
  foreign key (org_id, artifact_id) references public.artifacts (org_id, id) on delete cascade,
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create unique index jobs_dedupe_idx on public.jobs (org_id, type, dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');
create index jobs_org_recent_idx on public.jobs (org_id, created_at desc);
create index jobs_artifact_idx on public.jobs (artifact_id) where artifact_id is not null;

create trigger jobs_updated_at before update on public.jobs
  for each row execute function private.set_updated_at();

-- Created only through enqueue_job(); progress is written by the worker.
select private.secure_table('public.jobs', 'read');

create or replace function private.enqueue(
  p_org_id text,
  p_type text,
  p_input jsonb default '{}'::jsonb,
  p_client_id uuid default null,
  p_release_id uuid default null,
  p_artifact_id uuid default null,
  p_created_by uuid default null,
  p_dedupe_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id uuid;
begin
  if p_dedupe_key is not null then
    select id into job_id from public.jobs
    where org_id = p_org_id and type = p_type and dedupe_key = p_dedupe_key
      and status in ('queued', 'running');
    if found then
      return job_id;
    end if;
  end if;

  insert into public.jobs (org_id, type, input, client_id, release_id, artifact_id, created_by, dedupe_key)
  values (p_org_id, p_type, coalesce(p_input, '{}'::jsonb), p_client_id, p_release_id, p_artifact_id,
          p_created_by, p_dedupe_key)
  returning id into job_id;

  update public.jobs
  set msg_id = (select pgmq.send('jobs', jsonb_build_object('job_id', job_id)))
  where id = job_id;

  return job_id;
end
$$;

-- What a signed-in member may start. Inbox and mail jobs are system-only.
create or replace function public.enqueue_job(
  p_type text,
  p_input jsonb default '{}'::jsonb,
  p_client_id uuid default null,
  p_release_id uuid default null,
  p_artifact_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
begin
  if p_type not in (
    'research.run', 'onboarding.generate', 'strategy.phase',
    'release.draft', 'release.edit', 'medialist.build', 'pitches.generate',
    'document.index', 'export.render', 'stats.import'
  ) then
    raise exception 'job type % cannot be started by a person', p_type using errcode = '42501';
  end if;

  -- The same-org foreign keys on jobs reject ids from another org.
  return private.enqueue(public.current_org_id(), p_type, p_input, p_client_id, p_release_id,
                         p_artifact_id, member);
end
$$;

revoke execute on function public.enqueue_job(text, jsonb, uuid, uuid, uuid) from public, anon;
grant execute on function public.enqueue_job(text, jsonb, uuid, uuid, uuid) to authenticated;

-- Stop a job. A queued job never starts; a running one stops at its next checkpoint.
create or replace function public.cancel_job(p_job_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_member();
  update public.jobs
  set status = 'canceled', finished_at = now()
  where id = p_job_id and org_id = public.current_org_id() and status in ('queued', 'running');
end
$$;

revoke execute on function public.cancel_job(uuid) from public, anon;
grant execute on function public.cancel_job(uuid) to authenticated;

-- Every new upload or attachment gets indexed (AGENTS.md §11: document.index).
create or replace function private.documents_enqueue_index() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.index_status = 'pending' then
    perform private.enqueue(new.org_id, 'document.index', jsonb_build_object('document_id', new.id),
                            new.client_id, null, null, new.created_by, new.id::text);
  end if;
  return new;
end
$$;

create trigger documents_enqueue_index after insert on public.documents
  for each row execute function private.documents_enqueue_index();

-- One row per Claude (or Voyage) call: what ran, on what, and what it cost.
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  job_id uuid,
  framework_id uuid,
  model text not null,
  -- The task that made the call, e.g. 'release.draft' or 'email.classify'.
  task text not null,
  -- What went in, by reference: framework, artifact versions, chunk ids, email id.
  inputs jsonb not null default '{}'::jsonb,
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer,
  cache_read_input_tokens integer,
  cost_usd numeric(12, 6),
  latency_ms integer,
  stop_reason text,
  request_id text,
  error text,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, job_id) references public.jobs (org_id, id) on delete set null (job_id),
  foreign key (org_id, framework_id) references public.frameworks (org_id, id) on delete set null (framework_id)
);

create index generations_org_recent_idx on public.generations (org_id, created_at desc);
create index generations_job_idx on public.generations (job_id);

select private.secure_table('public.generations', 'read');
