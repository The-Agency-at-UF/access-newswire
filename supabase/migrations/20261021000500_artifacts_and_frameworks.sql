-- Artifacts (research, deck, strategy, release, media list, pitch set, report)
-- and the frameworks that generate them. Versions and approvals follow in
-- …000700; the gates that decide when an artifact may exist in …000800.

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  release_id uuid,
  type public.artifact_type not null,
  title text not null check (length(btrim(title)) > 0),
  status public.artifact_status not null default 'draft',
  -- What downstream stages read (AGENTS.md §2.2). FK added with versions.
  approved_version_id uuid,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  -- Release work hangs off a release; onboarding work off the client.
  check (case
    when type in ('press_release', 'media_list', 'pitch_set') then release_id is not null
    when type in ('research', 'onboarding_deck', 'strategy') then release_id is null
    else true
  end),
  check (status <> 'approved' or approved_version_id is not null),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (client_id, release_id) references public.releases (client_id, id) on delete cascade,
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

-- One live artifact per stage: per release for release work, per client for onboarding.
create unique index artifacts_one_per_release_idx on public.artifacts (release_id, type)
  where release_id is not null and status <> 'archived';
create unique index artifacts_one_per_client_idx on public.artifacts (client_id, type)
  where release_id is null and type in ('research', 'onboarding_deck', 'strategy') and status <> 'archived';
create index artifacts_client_idx on public.artifacts (client_id, type);
create index artifacts_review_idx on public.artifacts (org_id, status) where status = 'in_review';

create trigger artifacts_updated_at before update on public.artifacts
  for each row execute function private.set_updated_at();

select private.secure_table('public.artifacts', 'members');
-- Status and approved_version_id move only through the approval RPCs.
revoke insert, update on public.artifacts from authenticated;
grant insert (client_id, release_id, type, title) on public.artifacts to authenticated;
grant update (title) on public.artifacts to authenticated;

-- The team's prompts/templates (AGENTS.md §10). Versioned: a framework's body
-- never changes once written, so every generation can name what produced it.
create table public.frameworks (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  kind public.framework_kind not null,
  version integer not null check (version > 0),
  title text not null,
  body text not null check (length(btrim(body)) > 0),
  -- An approved artifact to rework, e.g. the example onboarding deck.
  example_artifact_id uuid,
  is_active boolean not null default false,
  -- Seeded stand-ins until the team's real frameworks are loaded.
  is_placeholder boolean not null default false,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  unique (org_id, kind, version),
  unique (org_id, id),
  foreign key (org_id, example_artifact_id) references public.artifacts (org_id, id) on delete set null (example_artifact_id),
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create unique index frameworks_one_active_idx on public.frameworks (org_id, kind) where is_active;

create or replace function private.frameworks_immutable_body() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body or new.kind is distinct from old.kind
     or new.version is distinct from old.version then
    raise exception 'a framework''s kind, version and body are fixed; add a new version instead'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

create trigger frameworks_immutable_body before update on public.frameworks
  for each row execute function private.frameworks_immutable_body();

select private.secure_table('public.frameworks', 'admins');

-- Make one version the active framework for its kind (admins only).
create or replace function public.activate_framework(p_framework_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.frameworks;
begin
  perform private.assert_member();
  if not public.is_org_admin() then
    raise exception 'only org admins can change frameworks' using errcode = '42501';
  end if;

  select * into f from public.frameworks
  where id = p_framework_id and org_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'framework not found' using errcode = 'P0002';
  end if;

  update public.frameworks set is_active = false
  where org_id = f.org_id and kind = f.kind and is_active and id <> f.id;
  update public.frameworks set is_active = true where id = f.id;
end
$$;

revoke execute on function public.activate_framework(uuid) from public, anon;
grant execute on function public.activate_framework(uuid) to authenticated;
