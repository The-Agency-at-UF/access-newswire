-- The shared inbox (AGENTS.md §12) on Microsoft Graph, read-only.
--
-- Graph notifies /api/webhooks/mail → enqueue_mail_sync() queues email.sync →
-- the worker pulls new messages with a delta query, stores them (email.ingest)
-- and classifies them (email.classify). A cron job renews the Graph
-- subscription and runs a fallback sync in case a notification was missed.

create extension if not exists pg_cron;

create table public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  provider text not null default 'graph' check (provider = 'graph'),
  mailbox text not null check (mailbox = lower(btrim(mailbox)) and mailbox like '%_@_%'),
  subscription_id text unique,
  subscription_expires_at timestamptz,
  -- Shared secret Graph echoes back on every notification. Worker/webhook only.
  client_state text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  -- Graph delta cursor. Worker only.
  delta_link text,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (org_id, mailbox),
  unique (org_id, id)
);

select private.secure_table('public.mail_accounts', 'admins');
-- Secrets and cursors stay server-side; people see status only.
revoke select, insert, update on public.mail_accounts from authenticated;
grant select (id, org_id, provider, mailbox, subscription_id, subscription_expires_at, last_synced_at, last_error, created_at)
  on public.mail_accounts to authenticated;
grant insert (mailbox) on public.mail_accounts to authenticated;

create table public.emails (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  mail_account_id uuid,
  provider_message_id text not null,
  internet_message_id text,
  thread_id text,
  from_address text,
  from_name text,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  -- Untrusted (AGENTS.md §2.8): data for the classifier and people, never instructions.
  body_text text,
  body_html text,
  received_at timestamptz,
  has_attachments boolean not null default false,
  label public.email_label,
  confidence numeric(4, 3) check (confidence between 0 and 1),
  client_id uuid,
  owner_id uuid,
  suggested_action text,
  extracted jsonb not null default '{}'::jsonb check (jsonb_typeof(extracted) = 'object'),
  status public.email_status not null default 'new',
  classified_by text check (classified_by in ('rule', 'model', 'person')),
  classified_at timestamptz,
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_message_id),
  unique (org_id, id),
  foreign key (org_id, mail_account_id) references public.mail_accounts (org_id, id) on delete set null (mail_account_id),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete set null (client_id),
  foreign key (org_id, owner_id) references public.team_members (org_id, id) on delete set null (owner_id),
  foreign key (org_id, handled_by) references public.team_members (org_id, id) on delete set null (handled_by)
);

create index emails_inbox_idx on public.emails (org_id, status, received_at desc);
create index emails_client_idx on public.emails (client_id, received_at desc);
create index emails_owner_idx on public.emails (owner_id, status);
create index emails_thread_idx on public.emails (org_id, thread_id);

create trigger emails_updated_at before update on public.emails
  for each row execute function private.set_updated_at();

-- Written by the worker; people change labels and status through the RPCs below.
select private.secure_table('public.emails', 'read');

alter table public.documents
  add constraint documents_email_fkey
  foreign key (org_id, email_id) references public.emails (org_id, id) on delete set null (email_id);
alter table public.releases
  add constraint releases_source_email_fkey
  foreign key (org_id, source_email_id) references public.emails (org_id, id) on delete set null (source_email_id);

-- Learned sender → client/label matches. Checked before the classifier runs.
create table public.sender_rules (
  id uuid primary key default gen_random_uuid(),
  org_id text not null default public.current_org_id(),
  -- A full address (ana@ridgeline.example) or a domain (@ridgeline.example).
  pattern text not null check (pattern = lower(btrim(pattern)) and pattern like '%@_%'),
  client_id uuid,
  label public.email_label,
  created_by uuid default public.current_member_id(),
  created_at timestamptz not null default now(),
  unique (org_id, pattern),
  check (client_id is not null or label is not null),
  foreign key (org_id, client_id) references public.clients (org_id, id) on delete cascade,
  foreign key (org_id, created_by) references public.team_members (org_id, id) on delete set null (created_by)
);

select private.secure_table('public.sender_rules', 'shared');

/*
 * A person relabels or reassigns an email. With p_remember, the sender is
 * remembered so the next email from them routes without the classifier
 * (AGENTS.md §12.7).
 */
create or replace function public.correct_email(
  p_email_id uuid,
  p_client_id uuid,
  p_label public.email_label,
  p_remember boolean default true
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  e public.emails;
  owner uuid;
begin
  select * into e from public.emails where id = p_email_id and org_id = public.current_org_id() for update;
  if not found then
    raise exception 'email not found' using errcode = 'P0002';
  end if;

  if p_client_id is not null then
    select owner_id into owner from public.clients where id = p_client_id and org_id = e.org_id;
    if not found then
      raise exception 'client not found' using errcode = 'P0002';
    end if;
  end if;

  update public.emails set
    client_id = p_client_id,
    label = p_label,
    owner_id = owner,
    confidence = null,
    classified_by = 'person',
    classified_at = now(),
    status = case
      when status = 'handled' then 'handled'
      when p_label = 'auto_notification' then 'muted'
      when p_client_id is null then 'unmatched'
      else 'routed'
    end::public.email_status
  where id = e.id;

  if p_remember and e.from_address is not null then
    insert into public.sender_rules (org_id, pattern, client_id, label, created_by)
    values (e.org_id, lower(e.from_address), p_client_id, p_label, member)
    on conflict (org_id, pattern) do update
      set client_id = excluded.client_id, label = excluded.label, created_by = excluded.created_by;
  end if;
end
$$;

-- Mark an email handled, or reopen it. Handled lives in our DB only (§12).
create or replace function public.set_email_handled(p_email_id uuid, p_handled boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
begin
  update public.emails set
    status = case
      when p_handled then 'handled'
      when label = 'auto_notification' then 'muted'
      when client_id is null then 'unmatched'
      else 'routed'
    end::public.email_status,
    handled_by = case when p_handled then member end,
    handled_at = case when p_handled then now() end
  where id = p_email_id and org_id = public.current_org_id();
  if not found then
    raise exception 'email not found' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.correct_email(uuid, uuid, public.email_label, boolean),
  public.set_email_handled(uuid, boolean) from public, anon;
grant execute on function public.correct_email(uuid, uuid, public.email_label, boolean),
  public.set_email_handled(uuid, boolean) to authenticated;

-- Called by the mail webhook (service role) for each Graph notification.
-- Returns false if the subscription or client_state doesn't match, so the
-- webhook can ignore forged notifications.
create or replace function public.enqueue_mail_sync(p_subscription_id text, p_client_state text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.mail_accounts;
begin
  select * into acct from public.mail_accounts where subscription_id = p_subscription_id;
  if not found or acct.client_state is distinct from p_client_state then
    return false;
  end if;
  perform private.enqueue(acct.org_id, 'email.sync', jsonb_build_object('mail_account_id', acct.id),
                          null, null, null, null, 'sync:' || acct.id);
  return true;
end
$$;

revoke execute on function public.enqueue_mail_sync(text, text) from public, anon, authenticated;
grant execute on function public.enqueue_mail_sync(text, text) to service_role;

-- A new mailbox gets its subscription and first sync straight away.
create or replace function private.mail_accounts_after_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue(new.org_id, 'mail.renew_subscription', jsonb_build_object('mail_account_id', new.id),
                          null, null, null, null, 'renew:' || new.id);
  perform private.enqueue(new.org_id, 'email.sync', jsonb_build_object('mail_account_id', new.id),
                          null, null, null, null, 'sync:' || new.id);
  return null;
end
$$;

create trigger mail_accounts_after_insert after insert on public.mail_accounts
  for each row execute function private.mail_accounts_after_insert();

-- Every 15 minutes: renew subscriptions within a day of expiry, and sync each
-- mailbox in case a notification never arrived.
create or replace function private.enqueue_mail_maintenance() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acct public.mail_accounts;
begin
  for acct in select * from public.mail_accounts loop
    if acct.subscription_expires_at is null or acct.subscription_expires_at < now() + interval '24 hours' then
      perform private.enqueue(acct.org_id, 'mail.renew_subscription', jsonb_build_object('mail_account_id', acct.id),
                              null, null, null, null, 'renew:' || acct.id);
    end if;
    perform private.enqueue(acct.org_id, 'email.sync', jsonb_build_object('mail_account_id', acct.id),
                            null, null, null, null, 'sync:' || acct.id);
  end loop;
end
$$;

select cron.schedule('mail-maintenance', '*/15 * * * *', 'select private.enqueue_mail_maintenance()');
