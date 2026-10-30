-- The approval chain and tier rules, enforced in the database (AGENTS.md §1,
-- §2.2, §8). These mirror `gates()` in apps/web/lib/selectors/stages.ts:
--
--   research ✓ → deck ✓ + Meeting 1 → strategy ✓ + Meeting 2 → release ✓
--     → media list ✓ → pitches            (✓ = has an approved version)
--
-- Clients with onboarded_externally skip everything before releases.
-- L1 clients have no media list, ACCESS upload or outreach; L2 releases
-- default to edit mode.

create or replace function private.has_approved(
  p_client_id uuid,
  p_type public.artifact_type,
  p_release_id uuid default null
) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.artifacts
    where client_id = p_client_id
      and type = p_type
      and approved_version_id is not null
      and status <> 'archived'
      and release_id is not distinct from p_release_id
  )
$$;

create or replace function private.gate_error(p_message text) returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = 'stage_gate';
end
$$;

-- ---------------------------------------------------------------- releases

create or replace function private.releases_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
begin
  select * into c from public.clients where id = new.client_id;

  if new.mode is null then
    new.mode := case when c.tier = 'L2' then 'edit' else 'write' end;
  end if;

  if not c.onboarded_externally and not (
    private.has_approved(c.id, 'strategy') and private.meeting_held(c.id, 'meeting_2')
  ) then
    perform private.gate_error('Releases unlock once the strategy is approved after Meeting 2.');
  end if;

  new.access_uploaded_at := null;
  new.access_uploaded_by := null;
  return new;
end
$$;

create trigger releases_before_insert before insert on public.releases
  for each row execute function private.releases_before_insert();

-- Start a release. Leave p_mode null to take the tier default.
create or replace function public.create_release(
  p_client_id uuid,
  p_title text,
  p_due_on date default null,
  p_roadmap_item text default null,
  p_mode public.release_mode default null,
  p_source_email_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  release_id uuid;
begin
  insert into public.releases (org_id, client_id, title, due_on, roadmap_item, mode, source_email_id, created_by)
  values (public.current_org_id(), p_client_id, p_title, p_due_on, p_roadmap_item, p_mode, p_source_email_id, member)
  returning id into release_id;
  return release_id;
end
$$;

revoke execute on function public.create_release(uuid, text, date, text, public.release_mode, uuid) from public, anon;
grant execute on function public.create_release(uuid, text, date, text, public.release_mode, uuid) to authenticated;

-- Record that someone uploaded the release and its media list to ACCESS by
-- hand (the app never uploads; AGENTS.md §2.1, §13).
create or replace function public.mark_access_uploaded(p_release_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid := private.assert_member();
  r public.releases;
  tier public.tier;
begin
  select * into r from public.releases
  where id = p_release_id and org_id = public.current_org_id()
  for update;
  if not found then
    raise exception 'release not found' using errcode = 'P0002';
  end if;

  select c.tier into tier from public.clients c where c.id = r.client_id;
  if tier = 'L1' then
    perform private.gate_error('L1 clients upload to ACCESS themselves.');
  end if;
  if not private.has_approved(r.client_id, 'press_release', r.id)
     or not private.has_approved(r.client_id, 'media_list', r.id) then
    perform private.gate_error('Upload to ACCESS once the release and its media list are approved.');
  end if;

  update public.releases set access_uploaded_at = now(), access_uploaded_by = member where id = r.id;
end
$$;

revoke execute on function public.mark_access_uploaded(uuid) from public, anon;
grant execute on function public.mark_access_uploaded(uuid) to authenticated;

-- ---------------------------------------------------------------- artifacts

create or replace function private.artifacts_before_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.clients;
begin
  select * into c from public.clients where id = new.client_id;

  new.status := 'draft';
  new.approved_version_id := null;

  case new.type
    when 'onboarding_deck' then
      if not c.onboarded_externally and not private.has_approved(c.id, 'research') then
        perform private.gate_error('The onboarding deck builds from approved research.');
      end if;
    when 'strategy' then
      if not c.onboarded_externally and not (
        private.has_approved(c.id, 'onboarding_deck') and private.meeting_held(c.id, 'meeting_1')
      ) then
        perform private.gate_error('Strategy needs an approved deck and Meeting 1 feedback.');
      end if;
    when 'media_list' then
      if c.tier = 'L1' then
        perform private.gate_error('L1 clients build their own media lists.');
      end if;
      if not private.has_approved(c.id, 'press_release', new.release_id) then
        perform private.gate_error('Media lists pull from an approved release.');
      end if;
    when 'pitch_set' then
      if c.tier = 'L1' then
        perform private.gate_error('L1 clients run their own outreach.');
      end if;
      if not private.has_approved(c.id, 'media_list', new.release_id) then
        perform private.gate_error('Pitches use an approved media list.');
      end if;
    else
      null;
  end case;

  return new;
end
$$;

create trigger artifacts_before_insert before insert on public.artifacts
  for each row execute function private.artifacts_before_insert();
