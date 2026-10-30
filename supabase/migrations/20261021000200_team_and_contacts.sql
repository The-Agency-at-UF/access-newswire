-- Inbox shifts, client contacts, and per-org settings.

create table public.inbox_duty (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  member_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (org_id, member_id) references public.team_members (org_id, id) on delete cascade
);

create index inbox_duty_window_idx on public.inbox_duty (org_id, starts_at, ends_at);
select private.secure_table('public.inbox_duty', 'shared');

-- Who is on inbox duty at a moment (several people may overlap).
create or replace function public.inbox_duty_at(p_org_id text, p_at timestamptz default now())
returns setof uuid
language sql stable
security invoker
set search_path = ''
as $$
  select member_id from public.inbox_duty
  where org_id = p_org_id and p_at >= starts_at and p_at < ends_at
$$;

revoke execute on function public.inbox_duty_at(text, timestamptz) from public, anon;
grant execute on function public.inbox_duty_at(text, timestamptz) to authenticated, service_role;

-- People at a client. A contact's address routes their mail to the client.
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  email text check (email = lower(btrim(email)) and email like '%_@_%'),
  title text,
  is_spokesperson boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, email),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade
);

create index client_contacts_client_idx on public.client_contacts (client_id);
select private.secure_table('public.client_contacts', 'members');

-- One row per org; absent means defaults. Admin-only (AGENTS.md §7).
create table public.org_settings (
  org_id text primary key default public.current_org_id(),
  -- Email classifications at or above this confidence route straight to the
  -- client's owner; below it they go to Unmatched for whoever is on duty.
  classify_threshold numeric(3, 2) not null default 0.75 check (classify_threshold between 0 and 1),
  -- ACCESS media-list upload: ordered [{ "header": "...", "field": "..." }].
  -- The real ACCESS format is still open (AGENTS.md §16); edit in Settings.
  access_csv_columns jsonb not null default '[
    {"header": "First Name", "field": "first_name"},
    {"header": "Last Name", "field": "last_name"},
    {"header": "Email", "field": "email"},
    {"header": "Outlet", "field": "outlet"},
    {"header": "Title", "field": "title"},
    {"header": "Beats", "field": "beats"}
  ]'::jsonb check (jsonb_typeof(access_csv_columns) = 'array'),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger org_settings_updated_at before update on public.org_settings
  for each row execute function private.set_updated_at();
select private.secure_table('public.org_settings', 'admins');
