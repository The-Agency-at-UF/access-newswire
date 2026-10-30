-- Media lists, outreach, coverage and ACCESS stats (AGENTS.md §1, §8, §13).

-- Journalists on one media-list version. Like the version, an entry list is
-- fixed once written; changing the selection saves a new version.
create table public.media_list_entries (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  artifact_version_id uuid not null,
  journalist_id uuid not null,
  relevance_reason text,
  included boolean not null default true,
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (artifact_version_id, journalist_id),
  foreign key (org_id, artifact_version_id) references public.artifact_versions (org_id, id) on delete cascade,
  foreign key (org_id, journalist_id) references public.journalists (org_id, id)
);

create index media_list_entries_version_idx on public.media_list_entries (artifact_version_id, position);

create or replace function private.media_list_entries_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.artifacts;
  v public.artifact_versions;
begin
  select * into v from public.artifact_versions where id = new.artifact_version_id;
  select * into a from public.artifacts where id = v.artifact_id;

  if a.type <> 'media_list' then
    raise exception 'entries belong to a media-list version' using errcode = 'P0001';
  end if;
  if a.approved_version_id = v.id then
    raise exception 'an approved media list cannot change; save a new version' using errcode = 'P0001';
  end if;
  if new.included then
    perform private.assert_contactable(new.journalist_id);
  end if;

  new.org_id := v.org_id;
  return new;
end
$$;

create trigger media_list_entries_before_insert before insert on public.media_list_entries
  for each row execute function private.media_list_entries_before_insert();
create trigger media_list_entries_append_only before update or delete on public.media_list_entries
  for each row execute function private.reject_mutation_unless_purge();

-- Written with their version through save_media_list_version() or by the worker.
select private.secure_table('public.media_list_entries', 'read');

/*
 * Save a person's media-list edit as a new version plus its entries, in one
 * transaction. p_entries: [{ journalist_id, relevance_reason?, included?, position? }].
 */
create or replace function public.save_media_list_version(
  p_artifact_id uuid,
  p_content jsonb,
  p_entries jsonb,
  p_parent_version_id uuid default null,
  p_origin public.version_origin default 'human'
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_id uuid;
begin
  perform private.assert_member();
  if not exists (
    select 1 from public.artifacts
    where id = p_artifact_id and org_id = public.current_org_id() and type = 'media_list'
  ) then
    raise exception 'media list not found' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then
    raise exception 'entries must be an array' using errcode = '22023';
  end if;

  insert into public.artifact_versions (artifact_id, content, origin, parent_version_id)
  values (p_artifact_id, p_content, p_origin, p_parent_version_id)
  returning id into version_id;

  insert into public.media_list_entries (org_id, artifact_version_id, journalist_id, relevance_reason, included, position)
  select public.current_org_id(), version_id, (e ->> 'journalist_id')::uuid, e ->> 'relevance_reason',
         coalesce((e ->> 'included')::boolean, true),
         coalesce((e ->> 'position')::integer, (ord - 1)::integer)
  from jsonb_array_elements(p_entries) with ordinality as t(e, ord);

  return version_id;
end
$$;

revoke execute on function public.save_media_list_version(uuid, jsonb, jsonb, uuid, public.version_origin) from public, anon;
grant execute on function public.save_media_list_version(uuid, jsonb, jsonb, uuid, public.version_origin) to authenticated;

-- The pitch log. People send pitches themselves; this records it (§2.1).
create table public.outreach (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  release_id uuid not null,
  journalist_id uuid not null,
  pitch_version_id uuid,
  pitched_at timestamptz not null default now(),
  pitched_by uuid default public.current_member_id(),
  outcome public.outreach_outcome not null default 'pending',
  outcome_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (client_id, release_id) references public.releases (client_id, id) on delete cascade,
  foreign key (org_id, journalist_id) references public.journalists (org_id, id),
  foreign key (org_id, pitch_version_id) references public.artifact_versions (org_id, id),
  foreign key (org_id, pitched_by) references public.team_members (org_id, id)
);

create index outreach_release_idx on public.outreach (release_id, pitched_at desc);
create index outreach_journalist_idx on public.outreach (journalist_id, pitched_at desc);

create or replace function private.outreach_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approved uuid;
begin
  perform private.assert_not_l1(new.client_id, 'L1 clients run their own outreach.');
  perform private.assert_contactable(new.journalist_id);

  select approved_version_id into approved from public.artifacts
  where release_id = new.release_id and type = 'pitch_set' and status <> 'archived';
  if approved is null then
    raise exception 'Log outreach once the pitches are approved.' using errcode = 'P0001', hint = 'stage_gate';
  end if;
  if new.pitch_version_id is not null and new.pitch_version_id <> approved then
    raise exception 'outreach must use the approved pitch set' using errcode = 'P0001';
  end if;
  new.pitch_version_id := approved;
  return new;
end
$$;

create trigger outreach_before_insert before insert on public.outreach
  for each row execute function private.outreach_before_insert();

select private.secure_table('public.outreach', 'members');
revoke update on public.outreach from authenticated;
grant update (outcome, outcome_at, notes) on public.outreach to authenticated;

-- Earned placements.
create table public.coverage (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  release_id uuid,
  journalist_id uuid,
  outlet_id uuid,
  title text,
  url text not null check (url ~* '^https?://'),
  published_on date,
  type public.coverage_type not null default 'article',
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  unique (org_id, url),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (client_id, release_id) references public.releases (client_id, id) on delete set null (release_id),
  foreign key (org_id, journalist_id) references public.journalists (org_id, id) on delete set null (journalist_id),
  foreign key (org_id, outlet_id) references public.outlets (org_id, id) on delete set null (outlet_id),
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create index coverage_client_idx on public.coverage (client_id, published_on desc);
select private.secure_table('public.coverage', 'members');

-- Imported ACCESS metrics. The export's columns are still open (§16), so the
-- row is stored as-is in `metrics`; stats.import maps it to a release.
create table public.access_stats (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  client_id uuid not null,
  release_id uuid,
  period_start date not null,
  period_end date not null,
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object'),
  source_document_id uuid,
  imported_by uuid,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique nulls not distinct (client_id, release_id, period_start, period_end),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (client_id, release_id) references public.releases (client_id, id) on delete cascade,
  foreign key (org_id, source_document_id) references public.documents (org_id, id) on delete set null (source_document_id),
  foreign key (org_id, imported_by) references public.team_members (org_id, id) on delete set null (imported_by)
);

create index access_stats_release_idx on public.access_stats (release_id);
select private.secure_table('public.access_stats', 'read');
