-- Clients and their service tier.

create type public.tier as enum ('L1', 'L2', 'L3');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  name text not null check (length(btrim(name)) > 0),
  website text,
  industry text,
  tier public.tier not null,
  release_cadence text,
  -- "My clients" filter only; not a security boundary (AGENTS.md §7).
  owner_id uuid,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- The owner must belong to the same org as the client.
  foreign key (org_id, owner_id) references public.team_members (org_id, id)
    on delete set null (owner_id)
);

create index clients_org_name_idx on public.clients (org_id, name);
create index clients_owner_idx on public.clients (owner_id);

alter table public.clients enable row level security;

create policy "clients_select" on public.clients
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "clients_insert" on public.clients
  for insert to authenticated
  with check (org_id = (select public.current_org_id()));

create policy "clients_update" on public.clients
  for update to authenticated
  using (org_id = (select public.current_org_id()))
  with check (org_id = (select public.current_org_id()));

create policy "clients_delete" on public.clients
  for delete to authenticated
  using (org_id = (select public.current_org_id()) and (select public.is_org_admin()));

grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
