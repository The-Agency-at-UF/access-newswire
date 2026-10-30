-- Shared building blocks for the rest of the schema: enums from AGENTS.md §8,
-- a `private` schema for helpers the Data API must not expose, and one helper
-- that applies the standard RLS + grants to an org-scoped table.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- enums

create type public.artifact_status as enum ('draft', 'in_review', 'approved', 'archived');
create type public.artifact_type as enum (
  'research', 'onboarding_deck', 'strategy', 'press_release', 'media_list', 'pitch_set', 'report'
);
create type public.email_label as enum (
  'release_info', 'client_update', 'sales_handoff', 'social', 'auto_notification', 'other'
);
create type public.release_mode as enum ('write', 'edit');
create type public.version_origin as enum ('ai', 'human', 'mixed');

-- Not in §8's enum list, but each column they type is.
create type public.email_status as enum ('new', 'routed', 'unmatched', 'handled', 'muted');
create type public.approval_action as enum ('submitted', 'approved', 'changes_requested');
create type public.meeting_kind as enum ('meeting_1', 'meeting_2', 'check_in');
create type public.document_source as enum ('upload', 'email_attachment', 'generated', 'note');
create type public.index_status as enum ('pending', 'indexing', 'indexed', 'failed', 'skipped');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');
create type public.outreach_outcome as enum (
  'pending', 'no_response', 'replied', 'interested', 'declined', 'covered'
);
create type public.coverage_type as enum ('article', 'broadcast', 'podcast', 'social', 'syndication', 'other');
create type public.framework_kind as enum (
  'research', 'onboarding_deck', 'strategy', 'press_release_write', 'press_release_edit',
  'media_list', 'pitch_set', 'report', 'email_classify'
);

-- ---------------------------------------------------------------- helpers

create or replace function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- For append-only tables (AGENTS.md §2.3).
create or replace function private.reject_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only: % is not allowed', tg_table_name, tg_op
    using errcode = 'P0001', hint = 'Insert a new row instead.';
end
$$;

-- The signed-in caller's team_members.id in their active org, or null.
create or replace function public.current_member_id() returns uuid
language sql stable
security definer
set search_path = ''
as $$
  select id from public.team_members
  where org_id = public.current_org_id() and clerk_user_id = public.current_user_id()
$$;

revoke execute on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated, service_role;

-- Raise unless the caller is a registered member of their active org.
create or replace function private.assert_member() returns uuid
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  member uuid := public.current_member_id();
begin
  if member is null then
    raise exception 'not a member of the active organization' using errcode = '42501';
  end if;
  return member;
end
$$;

/*
 * Standard tenancy for an org-scoped table: RLS on, a select policy for the
 * caller's org, writes by mode, and grants stated explicitly (AGENTS.md §5).
 *
 *   members  — members insert/update; admins delete
 *   shared   — members insert/update/delete (lists people curate together)
 *   admins   — members read; admins write
 *   read     — members read; writes only via service role or RPCs
 */
create or replace function private.secure_table(p_table regclass, p_mode text) returns void
language plpgsql
set search_path = ''
as $$
declare
  n text := (select relname from pg_catalog.pg_class where oid = p_table);
  org text := 'org_id = (select public.current_org_id())';
  admin text := '(select public.is_org_admin())';
begin
  if p_mode not in ('members', 'shared', 'admins', 'read') then
    raise exception 'unknown mode %', p_mode;
  end if;

  execute format('alter table %s enable row level security', p_table);
  execute format('revoke all on %s from anon, authenticated', p_table);
  execute format('grant all on %s to service_role', p_table);
  execute format('grant select on %s to authenticated', p_table);
  execute format('create policy %I on %s for select to authenticated using (%s)', n || '_select', p_table, org);

  if p_mode in ('members', 'shared') then
    execute format('grant insert, update, delete on %s to authenticated', p_table);
    execute format('create policy %I on %s for insert to authenticated with check (%s)', n || '_insert', p_table, org);
    execute format('create policy %I on %s for update to authenticated using (%s) with check (%s)', n || '_update', p_table, org, org);
    execute format('create policy %I on %s for delete to authenticated using (%s%s)', n || '_delete', p_table, org,
      case when p_mode = 'members' then ' and ' || admin else '' end);
  elsif p_mode = 'admins' then
    execute format('grant insert, update, delete on %s to authenticated', p_table);
    execute format('create policy %I on %s for insert to authenticated with check (%s and %s)', n || '_insert', p_table, org, admin);
    execute format('create policy %I on %s for update to authenticated using (%s and %s) with check (%s and %s)', n || '_update', p_table, org, admin, org, admin);
    execute format('create policy %I on %s for delete to authenticated using (%s and %s)', n || '_delete', p_table, org, admin);
  end if;
end
$$;

-- ---------------------------------------------------------------- team

-- Members who leave the Clerk org are deactivated, not deleted: immutable
-- versions and approvals keep pointing at who wrote and approved them.
alter table public.team_members add column deactivated_at timestamptz;

-- ---------------------------------------------------------------- clients

-- Clients that were onboarded before this app skip the onboarding gates
-- (research → deck → Meeting 1 → strategy → Meeting 2) and go straight to
-- releases; their existing strategy docs are uploaded as context.
alter table public.clients
  add column onboarded_externally boolean not null default false,
  -- Target for same-org foreign keys from every client-scoped table.
  add constraint clients_org_id_id_key unique (org_id, id);
