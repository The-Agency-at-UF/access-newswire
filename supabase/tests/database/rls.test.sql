-- RLS for team_members and clients: a member of one org sees and changes
-- nothing in another, and deletes are admin-only.
begin;
-- On the hosted project the CLI logs in as a temporary role that can't see the
-- `extensions` schema (pgTAP); run as postgres, as the local stack did.
set local role postgres;
set local search_path = public, extensions;
select plan(17);

-- Fixtures, written as the table owner (RLS does not apply).
insert into public.team_members (id, org_id, clerk_user_id, name, role) values
  ('00000000-0000-0000-0000-00000000000a', 'org_a', 'user_a', 'Alice', 'org:member'),
  ('00000000-0000-0000-0000-00000000000b', 'org_b', 'user_b', 'Bob', 'org:admin');
insert into public.clients (org_id, name, tier) values
  ('org_a', 'Acme', 'L1'),
  ('org_b', 'Bravo', 'L2');

-- Act as Alice: a plain member of org_a, v2 (`o`) claims.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"user_a","role":"authenticated","o":{"id":"org_a","rol":"member"}}', true);

select results_eq('select name from public.clients', $$values ('Acme')$$,
  'a member sees only their org''s clients');
select results_eq('select name from public.team_members', $$values ('Alice')$$,
  'a member sees only their org''s team');
select is(public.current_org_id(), 'org_a', 'org id is read from the v2 `o` claim');
select is(public.is_org_admin(), false, 'a member is not an admin');

select lives_ok($$insert into public.clients (name, tier) values ('Delta', 'L3')$$,
  'a member can create a client');
select results_eq($$select org_id from public.clients where name = 'Delta'$$,
  $$values ('org_a'::text)$$, 'org_id defaults to the caller''s org');
select throws_ok($$insert into public.clients (org_id, name, tier) values ('org_b', 'Sneaky', 'L1')$$,
  '42501', null, 'a member cannot create a client in another org');

select is_empty($$update public.clients set name = 'Hacked' where name = 'Bravo' returning 1$$,
  'a member cannot update another org''s client');
select is_empty($$delete from public.clients where name = 'Acme' returning 1$$,
  'a member cannot delete a client');

select throws_ok(
  $$insert into public.clients (name, tier, owner_id)
    values ('Cross', 'L1', '00000000-0000-0000-0000-00000000000b')$$,
  '23503', null, 'a client cannot be owned by someone in another org');

select throws_ok($$insert into public.team_members (clerk_user_id, name) values ('user_x', 'Mallory')$$,
  '42501', null, 'a member cannot add someone else to the team');
select is_empty($$update public.team_members set role = 'org:admin' where clerk_user_id = 'user_b' returning 1$$,
  'a member cannot edit another member');

-- Alice's own row is a different user in a fresh session, so test self-registration as Carol.
select set_config('request.jwt.claims',
  '{"sub":"user_c","role":"authenticated","o":{"id":"org_a","rol":"member"}}', true);
select lives_ok($$insert into public.team_members (clerk_user_id, name) values ('user_c', 'Carol')$$,
  'a member can register themselves');

-- Act as an org_a admin with v1 claims.
select set_config('request.jwt.claims',
  '{"sub":"user_a","role":"authenticated","org_id":"org_a","org_role":"org:admin"}', true);
select is(public.is_org_admin(), true, 'admin is read from the v1 org_role claim');
select isnt_empty($$delete from public.clients where name = 'Acme' returning 1$$,
  'an admin can delete a client');
select is_empty($$delete from public.clients where name = 'Bravo' returning 1$$,
  'an admin cannot delete another org''s client');

-- A signed-in user with no active organization sees nothing.
select set_config('request.jwt.claims', '{"sub":"user_a","role":"authenticated"}', true);
select is_empty('select 1 from public.clients', 'no active org means no rows');

select * from finish();
rollback;
