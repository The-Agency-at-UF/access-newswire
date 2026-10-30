-- The workflow rules the database enforces: stage gates, tier rules,
-- immutable versions, approvals, do-not-contact, the job queue, and purge.
begin;
-- On the hosted project the CLI logs in as a temporary role that can't see the
-- `extensions` schema (pgTAP); run as postgres, as the local stack did.
set local role postgres;
set local search_path = public, extensions;
select plan(55);

-- ------------------------------------------------------------ fixtures (as owner)

insert into public.team_members (id, org_id, clerk_user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'org_a', 'user_alice', 'Alice', 'org:member'),
  ('00000000-0000-0000-0000-0000000000a2', 'org_a', 'user_adam', 'Adam', 'org:admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'org_b', 'user_bob', 'Bob', 'org:member');

insert into public.clients (id, org_id, name, tier, onboarded_externally, owner_id) values
  ('00000000-0000-0000-0000-00000000c001', 'org_a', 'Nova', 'L3', false, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c002', 'org_a', 'Legacy', 'L2', true, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c003', 'org_a', 'Lite', 'L1', true, null);

insert into public.outlets (id, org_id, name) values ('00000000-0000-0000-0000-0000000000f1', 'org_a', 'Mining Weekly');
insert into public.journalists (id, org_id, name, email, outlet_id, do_not_contact) values
  ('00000000-0000-0000-0000-0000000000d1', 'org_a', 'Jo Reporter', 'jo@mw.example', '00000000-0000-0000-0000-0000000000f1', false),
  ('00000000-0000-0000-0000-0000000000d2', 'org_a', 'Dee Noc', 'dee@mw.example', '00000000-0000-0000-0000-0000000000f1', true);

insert into public.generations (id, org_id, model, task) values
  ('00000000-0000-0000-0000-0000000000e1', 'org_a', 'claude-opus-5-5', 'research.run');

-- ------------------------------------------------------------ as Alice (org_a member)

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"user_alice","role":"authenticated","o":{"id":"org_a","rol":"member"}}', true);

-- Onboarding chain on Nova (L3, onboarded in the app).
select lives_ok($$insert into public.artifacts (client_id, type, title)
  values ('00000000-0000-0000-0000-00000000c001', 'research', 'Nova research')$$,
  'research can start any time');
select throws_ok($$insert into public.artifacts (client_id, type, title)
  values ('00000000-0000-0000-0000-00000000c001', 'onboarding_deck', 'Nova deck')$$,
  'P0001', 'The onboarding deck builds from approved research.', 'deck waits for approved research');

select throws_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[]}', 'ai' from public.artifacts where title = 'Nova research'$$,
  '42501', null, 'people cannot write AI versions');
select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[{"id":"s1","heading":"About","body":"v1"}]}', 'human' from public.artifacts where title = 'Nova research'$$,
  'a person saves version 1');
select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[{"id":"s1","heading":"About","body":"v2"}]}', 'mixed' from public.artifacts where title = 'Nova research'$$,
  'a person saves version 2');
select results_eq($$select v.version, v.created_by from public.artifact_versions v
  join public.artifacts a on a.id = v.artifact_id where a.title = 'Nova research' order by version$$,
  $$values (1, '00000000-0000-0000-0000-0000000000a1'::uuid), (2, '00000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'versions number themselves and record the author');
select throws_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"body":"no sections"}', 'human' from public.artifacts where title = 'Nova research'$$,
  '23514', null, 'content must have a sections array');

select throws_ok($$update public.artifact_versions set content = '{"sections":[]}'$$,
  '42501', null, 'people have no UPDATE on versions');
select throws_ok($$update public.artifacts set approved_version_id = null where title = 'Nova research'$$,
  '42501', null, 'approved_version_id cannot be set directly');

select throws_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id
   where a.title = 'Nova research' and v.version = 1))$$,
  'P0001', 'only the latest version can be reviewed', 'an older version cannot be approved');
select lives_ok($$select public.submit_for_review(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id
   where a.title = 'Nova research' and v.version = 2), 'ready')$$, 'submit for review');
select is((select status::text from public.artifacts where title = 'Nova research'), 'in_review', 'status is in review');
select lives_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id
   where a.title = 'Nova research' and v.version = 2))$$, 'any member approves the latest version');
select results_eq($$select a.status::text, v.version from public.artifacts a
  join public.artifact_versions v on v.id = a.approved_version_id where a.title = 'Nova research'$$,
  $$values ('approved', 2)$$, 'approval sets status and approved_version_id together');
select results_eq($$select action::text, actor_id from public.approvals order by created_at$$,
  $$values ('submitted', '00000000-0000-0000-0000-0000000000a1'::uuid), ('approved', '00000000-0000-0000-0000-0000000000a1'::uuid)$$,
  'the review trail records who did what');

select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[]}', 'human' from public.artifacts where title = 'Nova research'$$, 'edit after approval');
select results_eq($$select a.status::text, v.version from public.artifacts a
  join public.artifact_versions v on v.id = a.approved_version_id where a.title = 'Nova research'$$,
  $$values ('draft', 2)$$, 'a new version is a draft; downstream still reads approved v2');

select lives_ok($$insert into public.artifacts (client_id, type, title)
  values ('00000000-0000-0000-0000-00000000c001', 'onboarding_deck', 'Nova deck')$$,
  'deck opens once research is approved');
select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[]}', 'human' from public.artifacts where title = 'Nova deck'$$, 'deck v1');
select lives_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id where a.title = 'Nova deck'))$$,
  'deck approved');
select throws_ok($$insert into public.artifacts (client_id, type, title)
  values ('00000000-0000-0000-0000-00000000c001', 'strategy', 'Nova strategy')$$,
  'P0001', 'Strategy needs an approved deck and Meeting 1 feedback.', 'strategy waits for Meeting 1');
select lives_ok($$insert into public.meetings (client_id, kind, held_on)
  values ('00000000-0000-0000-0000-00000000c001', 'meeting_1', current_date)$$, 'Meeting 1 held');
select lives_ok($$insert into public.artifacts (client_id, type, title)
  values ('00000000-0000-0000-0000-00000000c001', 'strategy', 'Nova strategy')$$,
  'strategy opens after deck + Meeting 1');
select throws_ok($$select public.create_release('00000000-0000-0000-0000-00000000c001', 'Launch')$$,
  'P0001', 'Releases unlock once the strategy is approved after Meeting 2.', 'releases wait for strategy + Meeting 2');

-- Release loop on Legacy (L2, onboarded before the app).
select lives_ok($$select public.create_release('00000000-0000-0000-0000-00000000c002', 'Q4 results')$$,
  'an existing client starts releases without onboarding');
select is((select mode::text from public.releases where title = 'Q4 results'), 'edit', 'L2 releases default to edit mode');

select lives_ok($$insert into public.artifacts (client_id, release_id, type, title)
  select client_id, id, 'press_release', 'Q4 release' from public.releases where title = 'Q4 results'$$,
  'press release artifact');
select throws_ok($$insert into public.artifacts (client_id, release_id, type, title)
  select client_id, id, 'media_list', 'Q4 list' from public.releases where title = 'Q4 results'$$,
  'P0001', 'Media lists pull from an approved release.', 'media list waits for the approved release');
select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[]}', 'human' from public.artifacts where title = 'Q4 release'$$, 'release v1');
select lives_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id where a.title = 'Q4 release'))$$,
  'release approved');
select lives_ok($$insert into public.artifacts (client_id, release_id, type, title)
  select client_id, id, 'media_list', 'Q4 list' from public.releases where title = 'Q4 results'$$,
  'media list opens');

select throws_ok($$select public.save_media_list_version(
  (select id from public.artifacts where title = 'Q4 list'), '{"sections":[]}',
  '[{"journalist_id":"00000000-0000-0000-0000-0000000000d1"},{"journalist_id":"00000000-0000-0000-0000-0000000000d2"}]')$$,
  'P0001', 'this journalist is marked do-not-contact', 'a do-not-contact journalist cannot be included');
select lives_ok($$select public.save_media_list_version(
  (select id from public.artifacts where title = 'Q4 list'), '{"sections":[]}',
  '[{"journalist_id":"00000000-0000-0000-0000-0000000000d1","relevance_reason":"covers lithium"},
    {"journalist_id":"00000000-0000-0000-0000-0000000000d2","included":false}]')$$,
  'they can be listed as excluded');
select results_eq($$select j.name, e.included, e.position from public.media_list_entries e
  join public.journalists j on j.id = e.journalist_id order by e.position$$,
  $$values ('Jo Reporter'::text, true, 0), ('Dee Noc'::text, false, 1)$$, 'entries saved in order with the version');
select throws_ok($$select public.mark_access_uploaded((select id from public.releases where title = 'Q4 results'))$$,
  'P0001', 'Upload to ACCESS once the release and its media list are approved.', 'upload waits for the approved list');
select lives_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id where a.title = 'Q4 list'))$$,
  'media list approved');
select lives_ok($$select public.mark_access_uploaded((select id from public.releases where title = 'Q4 results'))$$,
  'ACCESS upload recorded');
select is((select access_uploaded_by from public.releases where title = 'Q4 results'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'with who uploaded it');

select throws_ok($$insert into public.core_lists (client_id, journalist_id)
  values ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-0000000000d2')$$,
  'P0001', 'this journalist is marked do-not-contact', 'do-not-contact stays off core lists');
select throws_ok($$insert into public.outreach (client_id, release_id, journalist_id)
  select client_id, id, '00000000-0000-0000-0000-0000000000d1' from public.releases where title = 'Q4 results'$$,
  'P0001', 'Log outreach once the pitches are approved.', 'outreach waits for approved pitches');
select lives_ok($$insert into public.artifacts (client_id, release_id, type, title)
  select client_id, id, 'pitch_set', 'Q4 pitches' from public.releases where title = 'Q4 results'$$, 'pitch set opens');
select lives_ok($$insert into public.artifact_versions (artifact_id, content, origin)
  select id, '{"sections":[]}', 'human' from public.artifacts where title = 'Q4 pitches'$$, 'pitches v1');
select lives_ok($$select public.approve_version(
  (select v.id from public.artifact_versions v join public.artifacts a on a.id = v.artifact_id where a.title = 'Q4 pitches'))$$,
  'pitches approved');
select lives_ok($$insert into public.outreach (client_id, release_id, journalist_id)
  select client_id, id, '00000000-0000-0000-0000-0000000000d1' from public.releases where title = 'Q4 results'$$,
  'outreach logged');
select ok((select o.pitch_version_id = a.approved_version_id from public.outreach o
  join public.artifacts a on a.release_id = o.release_id and a.type = 'pitch_set'),
  'outreach records the approved pitch set');
select throws_ok($$insert into public.outreach (client_id, release_id, journalist_id)
  select client_id, id, '00000000-0000-0000-0000-0000000000d2' from public.releases where title = 'Q4 results'$$,
  'P0001', 'this journalist is marked do-not-contact', 'no outreach to do-not-contact');

-- Tier: Lite is L1.
select lives_ok($$select public.create_release('00000000-0000-0000-0000-00000000c003', 'Lite news')$$, 'L1 release');
select is((select mode::text from public.releases where title = 'Lite news'), 'write', 'L1 releases are written by us');

-- Jobs.
select isnt((select public.enqueue_job('research.run', '{}', '00000000-0000-0000-0000-00000000c001')), null,
  'a member can start a job');
select ok((select msg_id is not null and status = 'queued' and created_by = '00000000-0000-0000-0000-0000000000a1'
  from public.jobs where type = 'research.run'), 'the job row and its queue message exist together');
select throws_ok($$select public.enqueue_job('email.sync')$$, '42501', null, 'inbox jobs are system-only');

-- ------------------------------------------------------------ as Bob (org_b)

select set_config('request.jwt.claims',
  '{"sub":"user_bob","role":"authenticated","o":{"id":"org_b","rol":"member"}}', true);
select is_empty('select 1 from public.artifacts union all select 1 from public.jobs union all select 1 from public.journalists',
  'another org sees none of it');
select throws_ok($$select public.approve_version(
  (select '00000000-0000-0000-0000-000000000000'::uuid))$$, 'P0002', 'version not found',
  'and cannot approve anything outside it');

-- ------------------------------------------------------------ purge

select set_config('request.jwt.claims',
  '{"sub":"user_alice","role":"authenticated","o":{"id":"org_a","rol":"member"}}', true);
select throws_ok($$select public.delete_client('00000000-0000-0000-0000-00000000c001')$$,
  '42501', 'only org admins can delete clients', 'members cannot purge a client');
select set_config('request.jwt.claims',
  '{"sub":"user_adam","role":"authenticated","o":{"id":"org_a","rol":"admin"}}', true);
select lives_ok($$select public.delete_client('00000000-0000-0000-0000-00000000c001')$$,
  'an admin purges a client, history included');

select * from finish();
rollback;
