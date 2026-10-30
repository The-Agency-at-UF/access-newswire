-- Meetings (Meeting 1, Meeting 2, check-ins) and releases (one announcement).

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  kind public.meeting_kind not null,
  scheduled_for timestamptz,
  -- Set once the meeting has happened; this is what the gates read.
  held_on date,
  notes text,
  document_id uuid,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, document_id) references public.documents (org_id, id) on delete set null (document_id),
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create index meetings_client_idx on public.meetings (client_id, kind);
select private.secure_table('public.meetings', 'members');

create or replace function private.meeting_held(p_client_id uuid, p_kind public.meeting_kind)
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings
    where client_id = p_client_id and kind = p_kind and held_on is not null
  )
$$;

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  -- Defaults from the client's tier: L2 edits the client's draft, else we write.
  mode public.release_mode not null,
  due_on date,
  -- The strategy roadmap item this release delivers, if any.
  roadmap_item text,
  -- Set when a release is started from an email; FK added with `emails`.
  source_email_id uuid,
  access_uploaded_at timestamptz,
  access_uploaded_by uuid,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  -- Target for (client_id, release_id) keys, so children can't cross clients.
  unique (client_id, id),
  check ((access_uploaded_at is null) = (access_uploaded_by is null)),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, access_uploaded_by) references public.team_members (org_id, id),
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

create index releases_client_due_idx on public.releases (client_id, due_on);
create index releases_due_idx on public.releases (org_id, due_on);

create trigger releases_updated_at before update on public.releases
  for each row execute function private.set_updated_at();

select private.secure_table('public.releases', 'members');
-- ACCESS upload is recorded through mark_access_uploaded(), which checks tier and approvals.
revoke update on public.releases from authenticated;
grant update (title, mode, due_on, roadmap_item) on public.releases to authenticated;
