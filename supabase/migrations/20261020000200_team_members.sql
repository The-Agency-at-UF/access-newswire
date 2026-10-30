-- Staff of the ACCESS PR team, one row per Clerk organization membership.
-- Kept in sync by the Clerk webhook (organizationMembership.*) and by the app
-- registering the signed-in member on first visit.

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  clerk_user_id text not null,
  name text not null,
  email text,
  -- Mirrors the Clerk org role for display. Authorization never reads it:
  -- admin checks use the token (public.is_org_admin()).
  role text not null default 'org:member',
  slack_user_id text,
  teams_user_id text,
  created_at timestamptz not null default now(),
  unique (org_id, clerk_user_id),
  -- Target for same-org foreign keys, e.g. clients.owner_id.
  unique (org_id, id)
);

alter table public.team_members enable row level security;

create policy "team_members_select" on public.team_members
  for select to authenticated
  using (org_id = (select public.current_org_id()));

-- Members may register themselves; admins may add anyone in their org.
create policy "team_members_insert" on public.team_members
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and (clerk_user_id = (select public.current_user_id()) or (select public.is_org_admin()))
  );

create policy "team_members_update" on public.team_members
  for update to authenticated
  using (
    org_id = (select public.current_org_id())
    and (clerk_user_id = (select public.current_user_id()) or (select public.is_org_admin()))
  )
  with check (
    org_id = (select public.current_org_id())
    and (clerk_user_id = (select public.current_user_id()) or (select public.is_org_admin()))
  );

create policy "team_members_delete" on public.team_members
  for delete to authenticated
  using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));

grant select, insert, update, delete on public.team_members to authenticated;
grant all on public.team_members to service_role;
