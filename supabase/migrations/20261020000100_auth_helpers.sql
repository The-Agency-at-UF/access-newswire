-- Claim helpers for Clerk-issued tokens (Supabase third-party auth).
--
-- Clerk session tokens carry the active organization either as v1 claims
-- (`org_id`, `org_role` = 'org:admin') or as the compact v2 `o` claim
-- (`o.id`, `o.rol` = 'admin'). Every RLS policy goes through these helpers so
-- both shapes keep working.

create or replace function public.current_org_id() returns text
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')
$$;

create or replace function public.current_user_id() returns text
language sql stable
set search_path = ''
as $$
  select auth.jwt()->>'sub'
$$;

create or replace function public.is_org_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(
    auth.jwt()->>'org_role' = 'org:admin' or auth.jwt()->'o'->>'rol' = 'admin',
    false
  )
$$;

-- What Postgres sees for the caller. Used by the /dev page to check that the
-- Clerk ↔ Supabase integration is wired up; exposes nothing the caller's own
-- token doesn't already contain.
create or replace function public.whoami() returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'role', auth.role(),
    'user_id', public.current_user_id(),
    'org_id', public.current_org_id(),
    'is_admin', public.is_org_admin()
  )
$$;

revoke execute on function public.current_org_id(), public.current_user_id(),
  public.is_org_admin(), public.whoami() from public, anon;
grant execute on function public.current_org_id(), public.current_user_id(),
  public.is_org_admin(), public.whoami() to authenticated, service_role;
