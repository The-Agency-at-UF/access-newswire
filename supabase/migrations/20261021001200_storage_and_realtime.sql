-- Storage buckets (AGENTS.md §9) and Realtime for what the UI watches (§11).

insert into storage.buckets (id, name, public) values
  ('client-files', 'client-files', false),
  ('exports', 'exports', false),
  ('templates', 'templates', false)
on conflict (id) do nothing;

-- Paths start with the org id: {org_id}/{client_id}/{document_id}/{filename},
-- or {org_id}/templates/... Every policy checks that first segment.

create policy "org files are readable by the org" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('client-files', 'exports', 'templates')
    and (storage.foldername(name))[1] = (select public.current_org_id())
  );

create policy "members upload client files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = (select public.current_org_id())
  );

create policy "admins delete client files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-files'
    and (storage.foldername(name))[1] = (select public.current_org_id())
    and (select public.is_org_admin())
  );

-- Templates and example decks: admins only. Exports are written by the worker.
create policy "admins upload templates" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] = (select public.current_org_id())
    and (select public.is_org_admin())
  );

create policy "admins update templates" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] = (select public.current_org_id())
    and (select public.is_org_admin())
  );

create policy "admins delete templates" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] = (select public.current_org_id())
    and (select public.is_org_admin())
  );

-- Realtime respects RLS, so subscribers only see their org's rows.
alter publication supabase_realtime add table
  public.jobs, public.artifacts, public.artifact_versions, public.emails, public.documents;
