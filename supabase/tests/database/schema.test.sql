-- Every table in public follows the tenancy rules (AGENTS.md §2.6, §5):
-- RLS on, an org_id column, a select policy scoped by org, and no grants to
-- anon or TRUNCATE for authenticated.
begin;
-- On the hosted project the CLI logs in as a temporary role that can't see the
-- `extensions` schema (pgTAP); run as postgres, as the local stack did.
set local role postgres;
set local search_path = public, extensions;
select plan(6);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity$$,
  'every public table has RLS enabled'
);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_attribute a
        where a.attrelid = c.oid and a.attname = 'org_id' and a.attnotnull and not a.attisdropped
      )$$,
  'every public table has a non-null org_id'
);

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname and p.cmd = 'SELECT'
          and p.qual like '%current_org_id()%'
      )$$,
  'every public table has an org-scoped select policy'
);

select is_empty(
  $$select table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'$$,
  'anon has no table privileges in public'
);

select is_empty(
  $$select table_name from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'authenticated'
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')$$,
  'authenticated has no TRUNCATE, REFERENCES or TRIGGER in public'
);

-- Trigger functions can't be called directly; Supabase's own rls_auto_enable
-- (the "enable RLS on new tables" setting) is one.
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)$$,
  'anon can execute no public functions'
);

select * from finish();
rollback;
