-- Immutable artifact versions and the review trail (AGENTS.md §2.2, §2.3, §2.9).
--
-- A person or the worker inserts a version; it is never updated. Approval
-- goes through approve_version(), which logs the approval and points
-- artifacts.approved_version_id at the version in one transaction.

create table public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  artifact_id uuid not null,
  -- Assigned on insert: 1, 2, 3… per artifact.
  version integer not null default 0,
  -- { sections: [{ id, heading, body }], ...type-specific } (AGENTS.md §10).
  content jsonb not null check (coalesce(jsonb_typeof(content -> 'sections'), '') = 'array'),
  origin public.version_origin not null,
  generation_id uuid,
  -- The version this one was edited or regenerated from.
  parent_version_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (artifact_id, version),
  unique (org_id, id),
  unique (artifact_id, id),
  -- AI output is always traceable to the logged call that produced it.
  check (origin <> 'ai' or generation_id is not null),
  foreign key (org_id, artifact_id) references public.artifacts (org_id, id) on delete cascade,
  foreign key (org_id, generation_id) references public.generations (org_id, id),
  foreign key (artifact_id, parent_version_id) references public.artifact_versions (artifact_id, id),
  foreign key (org_id, created_by) references public.team_members (org_id, id)
);

create index artifact_versions_artifact_idx on public.artifact_versions (artifact_id, version desc);

alter table public.artifacts
  add constraint artifacts_approved_version_fkey
  foreign key (id, approved_version_id) references public.artifact_versions (artifact_id, id)
  on delete set null (approved_version_id);

create or replace function private.artifact_versions_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.artifacts;
begin
  -- Lock the artifact so concurrent saves get consecutive version numbers.
  select * into a from public.artifacts where id = new.artifact_id for update;
  if not found then
    raise exception 'artifact % not found', new.artifact_id using errcode = 'P0002';
  end if;
  if a.status = 'archived' then
    raise exception 'this artifact is archived' using errcode = 'P0001';
  end if;

  new.org_id := a.org_id;
  new.created_at := now();
  new.version := coalesce(
    (select max(version) from public.artifact_versions where artifact_id = a.id), 0) + 1;

  -- A person's edit is theirs; only the worker writes AI output (AGENTS.md §2.9).
  if coalesce(auth.role(), '') = 'authenticated' then
    if new.origin = 'ai' then
      raise exception 'people save human or mixed versions; AI versions come from the worker'
        using errcode = '42501';
    end if;
    new.created_by := public.current_member_id();
    new.generation_id := null;
  end if;

  return new;
end
$$;

create trigger artifact_versions_before_insert before insert on public.artifact_versions
  for each row execute function private.artifact_versions_before_insert();

-- A new version is a new draft, whatever the artifact's status was. The
-- approved version stays approved; downstream keeps reading it.
create or replace function private.artifact_versions_after_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.artifacts set status = 'draft' where id = new.artifact_id;
  return null;
end
$$;

create trigger artifact_versions_after_insert after insert on public.artifact_versions
  for each row execute function private.artifact_versions_after_insert();

-- Append-only. The single exception is an admin purge (delete_client), which
-- sets app.allow_purge for its own transaction.
create or replace function private.reject_mutation_unless_purge() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.allow_purge', true) = 'on' then
    return old;
  end if;
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'P0001', hint = 'Insert a new row instead.';
end
$$;

create trigger artifact_versions_append_only before update or delete on public.artifact_versions
  for each row execute function private.reject_mutation_unless_purge();

select private.secure_table('public.artifact_versions', 'read');
grant insert (artifact_id, content, origin, parent_version_id) on public.artifact_versions to authenticated;
create policy artifact_versions_insert on public.artifact_versions
  for insert to authenticated with check (org_id = (select public.current_org_id()));

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  artifact_version_id uuid not null,
  action public.approval_action not null,
  actor_id uuid not null,
  comment text,
  created_at timestamptz not null default now(),
  check (action <> 'changes_requested' or length(btrim(comment)) > 0),
  foreign key (org_id, artifact_version_id) references public.artifact_versions (org_id, id) on delete cascade,
  foreign key (org_id, actor_id) references public.team_members (org_id, id)
);

create index approvals_version_idx on public.approvals (artifact_version_id, created_at);

create trigger approvals_append_only before update or delete on public.approvals
  for each row execute function private.reject_mutation_unless_purge();

-- Written only by the RPCs below.
select private.secure_table('public.approvals', 'read');

-- Lock and return the artifact behind a version, checking it's the caller's
-- org, the latest version, and not archived.
create or replace function private.latest_version_artifact(p_version_id uuid)
returns public.artifacts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.artifact_versions;
  a public.artifacts;
begin
  select * into v from public.artifact_versions
  where id = p_version_id and org_id = public.current_org_id();
  if not found then
    raise exception 'version not found' using errcode = 'P0002';
  end if;

  select * into a from public.artifacts where id = v.artifact_id for update;
  if a.status = 'archived' then
    raise exception 'this artifact is archived' using errcode = 'P0001';
  end if;
  if v.version <> (select max(version) from public.artifact_versions where artifact_id = a.id) then
    raise exception 'only the latest version can be reviewed' using errcode = 'P0001';
  end if;
  return a;
end
$$;

create or replace function public.submit_for_review(p_version_id uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  a public.artifacts := private.latest_version_artifact(p_version_id);
begin
  update public.artifacts set status = 'in_review' where id = a.id;
  insert into public.approvals (org_id, artifact_version_id, action, actor_id, comment)
  values (a.org_id, p_version_id, 'submitted', member, p_comment);
end
$$;

-- Any team member may approve (decided 2026-10-20). Logged with who and when.
create or replace function public.approve_version(p_version_id uuid, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  a public.artifacts := private.latest_version_artifact(p_version_id);
begin
  if a.type = 'media_list' and exists (
    select 1 from public.media_list_entries e
    join public.journalists j on j.id = e.journalist_id
    where e.artifact_version_id = p_version_id and e.included and j.do_not_contact
  ) then
    raise exception 'this list includes a journalist marked do-not-contact' using errcode = 'P0001';
  end if;

  update public.artifacts set status = 'approved', approved_version_id = p_version_id where id = a.id;
  insert into public.approvals (org_id, artifact_version_id, action, actor_id, comment)
  values (a.org_id, p_version_id, 'approved', member, p_comment);
end
$$;

create or replace function public.request_changes(p_version_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  a public.artifacts := private.latest_version_artifact(p_version_id);
begin
  update public.artifacts set status = 'draft' where id = a.id;
  insert into public.approvals (org_id, artifact_version_id, action, actor_id, comment)
  values (a.org_id, p_version_id, 'changes_requested', member, p_comment);
end
$$;

create or replace function public.archive_artifact(p_artifact_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_member();
  update public.artifacts set status = 'archived'
  where id = p_artifact_id and org_id = public.current_org_id();
  if not found then
    raise exception 'artifact not found' using errcode = 'P0002';
  end if;
end
$$;

-- Delete a client and everything under it, history included. Admins only.
create or replace function public.delete_client(p_client_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_member();
  if not public.is_org_admin() then
    raise exception 'only org admins can delete clients' using errcode = '42501';
  end if;
  perform set_config('app.allow_purge', 'on', true);
  delete from public.clients where id = p_client_id and org_id = public.current_org_id();
  if not found then
    raise exception 'client not found' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.submit_for_review(uuid, text), public.approve_version(uuid, text),
  public.request_changes(uuid, text), public.archive_artifact(uuid), public.delete_client(uuid)
  from public, anon;
grant execute on function public.submit_for_review(uuid, text), public.approve_version(uuid, text),
  public.request_changes(uuid, text), public.archive_artifact(uuid), public.delete_client(uuid)
  to authenticated;
