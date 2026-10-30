-- Supabase's default privileges hand new public tables to `anon` (and extra
-- privileges such as TRUNCATE, which RLS does not cover, to `authenticated`).
-- Only signed-in members use these tables, through the four DML verbs.

revoke all on public.team_members, public.clients from anon;
revoke truncate, references, trigger on public.team_members, public.clients from authenticated;
