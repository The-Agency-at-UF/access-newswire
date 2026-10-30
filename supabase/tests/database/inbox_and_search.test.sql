-- Documents → indexing jobs, hybrid search, inbox corrections, the mail
-- webhook's subscription check, and framework immutability.
begin;
-- On the hosted project the CLI logs in as a temporary role that can't see the
-- `extensions` schema (pgTAP); run as postgres, as the local stack did.
set local role postgres;
set local search_path = public, extensions;
select plan(13);

insert into public.team_members (id, org_id, clerk_user_id, name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'org_a', 'user_alice', 'Alice', 'org:member'),
  ('00000000-0000-0000-0000-0000000000a2', 'org_a', 'user_adam', 'Adam', 'org:admin');
insert into public.clients (id, org_id, name, tier, owner_id) values
  ('00000000-0000-0000-0000-00000000c001', 'org_a', 'Ridgeline', 'L2', '00000000-0000-0000-0000-0000000000a2');
insert into public.mail_accounts (id, org_id, mailbox, subscription_id, client_state) values
  ('00000000-0000-0000-0000-0000000000ab', 'org_a', 'theagency@newswire.example', 'sub-1', 'secret-state');
insert into public.emails (id, org_id, provider_message_id, from_address, subject, status) values
  ('00000000-0000-0000-0000-0000000000e1', 'org_a', 'msg-1', 'ana@ridgeline.example', 'Survey results', 'unmatched');

select is((select count(*)::int from public.jobs where type in ('mail.renew_subscription', 'email.sync')), 2,
  'a new mailbox gets a subscription job and a first sync');

-- Webhook check (service role).
set local role service_role;
select is(public.enqueue_mail_sync('sub-1', 'wrong'), false, 'a notification with the wrong client_state is ignored');
select is(public.enqueue_mail_sync('sub-1', 'secret-state'), true, 'a genuine notification queues a sync');
select is((select count(*)::int from public.jobs where type = 'email.sync'), 1,
  'repeat notifications collapse into the pending sync');
set local role postgres;

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"user_alice","role":"authenticated","o":{"id":"org_a","rol":"member"}}', true);

-- Documents.
select lives_ok($$insert into public.documents (client_id, source, bucket, storage_path, title, mime)
  values ('00000000-0000-0000-0000-00000000c001', 'upload', 'client-files',
          'org_a/00000000-0000-0000-0000-00000000c001/x/survey.pdf', 'Survey', 'application/pdf')$$,
  'a member uploads a document');
select is((select count(*)::int from public.jobs where type = 'document.index'), 1, 'which queues indexing');
select throws_ok($$insert into public.documents (source, bucket, storage_path, title)
  values ('upload', 'client-files', 'org_b/x/y.pdf', 'Wrong org path')$$,
  '23514', null, 'storage paths must start with the org id');
select throws_ok($$update public.documents set index_status = 'indexed'$$, '42501', null,
  'indexing state is the worker''s');

set local role postgres;
insert into public.document_chunks (org_id, document_id, client_id, chunk_index, content)
select 'org_a', id, client_id, 0, 'Nevada lithium survey results came in above estimates.' from public.documents;
set local role authenticated;

select results_eq($$select document_title from public.match_chunks('00000000-0000-0000-0000-00000000c001', null, 'lithium survey')$$,
  $$values ('Survey'::text)$$, 'keyword search finds the chunk without an embedding');

-- Inbox correction teaches a sender rule.
select lives_ok($$select public.correct_email('00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-00000000c001', 'release_info')$$, 'a member reassigns an email');
select results_eq($$select status::text, owner_id, classified_by from public.emails$$,
  $$values ('routed', '00000000-0000-0000-0000-0000000000a2'::uuid, 'person')$$,
  'it routes to the client''s owner');
select results_eq($$select pattern, client_id from public.sender_rules$$,
  $$values ('ana@ridgeline.example', '00000000-0000-0000-0000-00000000c001'::uuid)$$,
  'and the sender is remembered');

-- Frameworks: body is fixed once written.
set local role postgres;
insert into public.frameworks (org_id, kind, version, title, body)
values ('org_a', 'research', 1, 'Research', 'Original text');
select throws_ok($$update public.frameworks set body = 'Rewritten'$$, 'P0001', null,
  'a framework''s body never changes; add a version instead');

select * from finish();
rollback;
