-- The shared contact directory (AGENTS.md §2.4, §2.10).
--
-- Journalist names, titles and emails come only from here: Claude ranks and
-- explains, it never writes a contact. do_not_contact is checked wherever a
-- journalist could be pitched: core lists, media lists, outreach.

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  name text not null check (length(btrim(name)) > 0),
  -- Free text until the team settles on categories (print, online, trade, broadcast…).
  type text,
  region text,
  url text,
  created_at timestamptz not null default now(),
  unique (org_id, id)
);

create unique index outlets_org_name_idx on public.outlets (org_id, lower(name));
select private.secure_table('public.outlets', 'members');

create table public.journalists (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  name text not null check (length(btrim(name)) > 0),
  outlet_id uuid,
  title text,
  beats text[] not null default '{}',
  email text check (email = lower(btrim(email)) and email like '%_@_%'),
  -- Where the contact came from (manual, import, ACCESS…); still open in §16.
  source text not null default 'manual',
  verified_at timestamptz,
  do_not_contact boolean not null default false,
  do_not_contact_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, email),
  foreign key (org_id, outlet_id) references public.outlets (org_id, id) on delete set null (outlet_id)
);

create index journalists_beats_idx on public.journalists using gin (beats);
create index journalists_outlet_idx on public.journalists (outlet_id);

create trigger journalists_updated_at before update on public.journalists
  for each row execute function private.set_updated_at();

select private.secure_table('public.journalists', 'members');

create or replace function private.assert_contactable(p_journalist_id uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.journalists where id = p_journalist_id and do_not_contact) then
    raise exception 'this journalist is marked do-not-contact' using errcode = 'P0001', hint = 'do_not_contact';
  end if;
end
$$;

create or replace function private.assert_not_l1(p_client_id uuid, p_message text) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if (select tier from public.clients where id = p_client_id) = 'L1' then
    raise exception '%', p_message using errcode = 'P0001', hint = 'stage_gate';
  end if;
end
$$;

-- Each client's reusable base list.
create table public.core_lists (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  client_id uuid not null,
  journalist_id uuid not null,
  added_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  unique (client_id, journalist_id),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, journalist_id) references public.journalists (org_id, id) on delete cascade,
  foreign key (org_id, added_by) references public.team_members (org_id, id) on delete set null (added_by)
);

create or replace function private.core_lists_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_not_l1(new.client_id, 'L1 clients build their own media lists.');
  perform private.assert_contactable(new.journalist_id);
  return new;
end
$$;

create trigger core_lists_before_insert before insert on public.core_lists
  for each row execute function private.core_lists_before_insert();

select private.secure_table('public.core_lists', 'shared');
