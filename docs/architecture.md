# ACCESS PR Bot — Technical Architecture

Oct 13, 2026 · @Anilov Villanueva

> This is the original architecture doc. Several open choices were settled after it was written (Supabase Queues + a Node worker instead of Trigger.dev, Microsoft Graph, Slack, `pptxgenjs`, a hosted-only Supabase project). Where the two differ, `AGENTS.md` is current.

## Overview

The ACCESS PR bot is a Next.js app with four supporting pieces: Supabase (Postgres, pgvector, Storage, Realtime) holds the data, Clerk handles sign-in and roles, the Claude API generates content, and a background worker runs long jobs and email processing.

Principles that shape every decision below:

- **One database.** Supabase holds every record. Each row carries an `org_id`, and row-level security (RLS) checks it against the Clerk session.
- **Claude stays server-side.** The browser never calls Claude. Generation runs in the worker.
- **Long work runs in the background.** Research, strategy, and inbox processing run as jobs. The UI shows live progress through Realtime.
- **Approval is a data rule.** Later stages can only read approved versions, enforced in the database, not just hidden in the UI.
- **Nothing sends.** No mail-send permission, no automated ACCESS upload. The system drafts and exports; people send.

## System diagram

*[Embedded diagram: system architecture · app, worker, Supabase, external services]*

The app and the worker both read and write Supabase, and Clerk tokens carry the org into every RLS check. The bot's commands go to the app; its alerts come from the worker.

## Stack decisions

Supabase and Clerk are fixed. The rest are recommendations; the ones still open are listed under Open decisions.

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | Next.js (App Router, TypeScript) on Vercel | First-class Clerk and Supabase support; server actions for writes; preview deploy per PR |
| Auth | Clerk with Organizations | Team invites and roles out of the box; native Supabase integration |
| Database | Supabase Postgres | The data is relational (client → release → list → pitch → coverage); RLS for access control |
| Vector search | pgvector in the same database | No second datastore needed at \~50 clients |
| Files | Supabase Storage | Private buckets under the same RLS rules |
| Live updates | Supabase Realtime | Job progress and new inbox items push to the UI |
| Background jobs | Trigger.dev | Long runs, retries, and step-by-step durability; Supabase Edge Functions are too short-lived for strategy generation |
| LLM | Claude API, routed by task (see AI layer) | Cheaper model for high-volume triage, strongest model for strategy |
| Embeddings | Voyage AI | Claude has no embeddings endpoint; Voyage is the provider Anthropic recommends |
| Email | Gmail API or Microsoft Graph, read-only | Depends on where the shared inbox lives |
| Chat bot | Slack (Bolt) or Teams (Bot Framework) | Depends on the team's platform |
| Exports | `docx`, pptx library, CSV | Word, PowerPoint, and ACCESS upload formats |
| Monitoring | Sentry plus a `generations` log table | Errors, plus cost and latency per Claude call |

## Auth and access control

Clerk issues the session, and Supabase trusts it through its native third-party auth integration, so RLS policies read Clerk's claims directly ([Supabase docs](https://supabase.com/docs/guides/auth/third-party/clerk)).

**Setup**

1. Turn on the Supabase integration in the Clerk dashboard. This adds the `role: authenticated` claim to session tokens.
2. Add Clerk as a third-party auth provider in Supabase (dashboard, or `[auth.third_party.clerk]` in `config.toml`).
3. Create the Supabase client with `accessToken` set to Clerk's `getToken()`. Once Clerk supplies the token, `supabase.auth.*` calls no longer work, which is expected ([Clerk guide](https://clerk.com/articles/nextjs-authentication-guide-2026-2)).

Ignore older tutorials that use a Clerk JWT template named `supabase`. Supabase deprecated that approach on April 1, 2025.

**Tenancy and roles**

- One Clerk Organization = the ACCESS PR team. Every table has an `org_id` column, so a second team could be added later without a schema change.
- Two roles: `org:admin` manages team members, tiers, frameworks, and deletions; `org:member` does everything else.
- Client ownership is a filter, not a security boundary. Anyone on the team can see every client (the "All" view); "My clients" just filters by `owner_id`.

**RLS pattern** (repeated for each table)

```sql
-- Works with both Clerk session token versions
create or replace function public.current_org_id() returns text
language sql stable as $$
  select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')
$$;

alter table clients enable row level security;

create policy "org members read clients" on clients
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "org members write clients" on clients
  for insert to authenticated
  with check (org_id = (select public.current_org_id()));
```

Admin-only actions add a role check on `auth.jwt()->>'org_role'` (or `auth.jwt()->'o'->>'rol'` on newer tokens).

**User sync.** The integration does not copy users into Supabase. A Clerk webhook (user and membership events, verified by signature) upserts rows into `team_members`.

**Service role.** The worker uses Supabase's service-role key, which bypasses RLS. Worker code must always filter by `org_id` explicitly, and the key never reaches the browser.

## Data model

The core idea is immutable versions: every draft is a new `artifact_versions` row, and approving one sets the artifact's `approved_version_id`. Every table also has `id` (uuid), `org_id`, and `created_at`.

| Table | Holds | Key columns |
| --- | --- | --- |
| `team_members` | Mark, Emily, Liz, Daniel, and future staff | `clerk_user_id`, `name`, `email`, `role`, `slack_user_id` / `teams_user_id` |
| `frameworks` | The team's prompts and templates (onboarding, strategy, release, pitch) | `kind`, `version`, `body`, `example_artifact_id`, `is_active` |
| `inbox_duty` | Who is watching the inbox when | `member_id`, `starts_at`, `ends_at` |
| `clients` | One row per client | `name`, `website`, `industry`, `tier` (L1/L2/L3), `release_cadence`, `owner_id`, `profile` (jsonb) |
| `client_contacts` | Client-side people and email domains | `client_id`, `name`, `email`, `is_spokesperson` |
| `meetings` | Meeting 1, Meeting 2, check-ins | `client_id`, `kind`, `held_on`, `notes`, `document_id` |
| `emails` | Every message from the shared inbox | `provider_message_id` (unique), `thread_id`, `from_address`, `subject`, `body_text`, `label`, `confidence`, `client_id`, `owner_id`, `suggested_action`, `extracted` (jsonb), `status` |
| `sender_rules` | Learned sender-to-client matches from corrections | `pattern` (address or domain), `client_id`, `created_by` |
| `documents` | Uploads, email attachments, generated files, meeting notes | `client_id`, `source`, `storage_path`, `mime`, `title`, `index_status` |
| `document_chunks` | Searchable text for retrieval | `document_id`, `client_id`, `content`, `embedding` (vector), `tokens` |
| `releases` | One announcement and everything built for it | `client_id`, `title`, `mode` (write/edit), `due_on`, `roadmap_item`, `access_uploaded_at`, `access_uploaded_by` |
| `artifacts` | Research, deck, strategy, release, media list, pitch set, report | `client_id`, `release_id`, `type`, `title`, `status`, `approved_version_id` |
| `artifact_versions` | Immutable drafts | `artifact_id`, `version`, `content` (jsonb sections), `origin` (ai/human/mixed), `generation_id`, `created_by` |
| `approvals` | Review history | `artifact_version_id`, `action` (requested/approved/changes\_requested), `actor_id`, `comment` |
| `outlets` | Publications | `name`, `type`, `region`, `url` |
| `journalists` | Shared contact directory | `name`, `outlet_id`, `title`, `beats` (text\[\]), `email`, `source`, `verified_at`, `do_not_contact` |
| `media_list_entries` | The journalists on one media list version | `artifact_version_id`, `journalist_id`, `relevance_reason`, `included`, `position` |
| `core_lists` | Each client's reusable base list | `client_id`, `journalist_id` |
| `outreach` | Who was pitched, when, and what happened | `client_id`, `release_id`, `journalist_id`, `pitch_version_id`, `pitched_at`, `outcome` |
| `coverage` | Earned placements | `client_id`, `release_id`, `journalist_id`, `url`, `published_on`, `type` |
| `access_stats` | Imported ACCESS performance numbers | `release_id`, `period`, `metrics` (jsonb), `source_file` |
| `jobs` | Background work the UI tracks | `type`, `status`, `progress`, `input` (jsonb), `error`, `artifact_id` |
| `generations` | Log of every Claude call | `job_id`, `model`, `framework_id`, `inputs` (jsonb refs), `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms` |

**Enums:** `tier` (L1, L2, L3) · `artifact_status` (draft, in\_review, approved, archived) · `artifact_type` · `email_label` (release\_info, client\_update, sales\_handoff, social, auto\_notification, other) · `release_mode` (write, edit).

**Rules the database enforces**

- A trigger rejects any `UPDATE` on `artifact_versions`. Edits always create a new version.
- Approving writes an `approvals` row and sets `approved_version_id` in one transaction.
- A media list can only be generated for a release whose press release artifact is approved.
- The release workflow follows `clients.tier`: L1 has no media list or outreach, and L2 releases default to `mode = edit`.

## File storage

Three private Supabase Storage buckets, all keyed by org and client so the same RLS rule covers every file.

| Bucket | Holds |
| --- | --- |
| `client-files` | Uploads and inbox attachments |
| `exports` | Generated .docx, .pptx, and .csv files |
| `templates` | The team's deck and document templates, plus example decks |

- **Path convention:** `{org_id}/{client_id}/{document_id}/{filename}`. Templates use `{org_id}/templates/...`.
- **Policy:** a policy on `storage.objects` checks that the first folder of the path equals `current_org_id()`.
- **Downloads:** short-lived signed URLs, never public links.
- **Linking:** every file has a matching `documents` row, which is what the app and retrieval use.

## AI layer

Every generation goes through one pipeline in `packages/ai`: pick the framework, assemble context, call Claude with a JSON schema, and save the result as a new artifact version.

**Model routing** (model names live in config, not code)

| Task | Model | Why |
| --- | --- | --- |
| Inbox labeling and extraction | Claude Haiku 5.5 | High volume, short inputs, needs to be cheap and fast |
| Release drafts, L2 edits, pitches, media list ranking | Claude Sonnet 5.5 | Strong writing at weekly volume |
| Research, onboarding deck, six-month strategy | Claude Opus 5.5 | Infrequent, highest stakes, longest context |

**Context assembly** (the same order for every call)

1. The framework for this stage, as the system prompt.
2. The client profile and tier.
3. Approved upstream artifacts only (for a release, that means the approved strategy).
4. The most relevant chunks from the client's documents (pgvector search, filtered by `client_id`).
5. The trigger: the email, the client's new info, and any instructions the user typed.

Items 1 and 2 change rarely, so they go first and use prompt caching.

**Structured output.** Each artifact type has a schema: an array of sections, each with an id, heading, and body. That makes per-section regenerate possible. The call gets the full artifact plus the section id to rewrite.

**Retrieval.** New documents and emails are chunked and embedded with Voyage. A `match_chunks(client_id, embedding, k)` SQL function combines vector similarity with Postgres full-text search, and runs as `security invoker` so RLS still applies.

**Web research.** The research stage and media list relevance checks use Claude's server-side web search tool. Sources are saved alongside each claim so the team can check them.

**Journalist contacts are never generated.** Names, titles, and emails come only from the `journalists` table, whether imported or entered by hand. Claude ranks those journalists and explains why each fits; it never invents contact details.

## Background jobs and realtime

Anything that takes more than a few seconds runs as a Trigger.dev task, not inside a web request. The UI watches progress live through Supabase Realtime.

1. The user clicks Generate. A server action inserts a `jobs` row and triggers the task with that job id.
2. The task assembles context, calls Claude, and writes progress (`progress`, `status`) to the `jobs` row as it goes.
3. On success it writes the new `artifact_versions` row and marks the job done. On failure it records the `error`.
4. The open page is subscribed to `jobs` and `artifact_versions` for that artifact, so the draft appears without a refresh. RLS applies to these subscriptions too.

| Task | Started by |
| --- | --- |
| `research.run` | New client created |
| `onboarding.generate`, `strategy.phase` | User, per stage or phase |
| `release.draft`, `release.edit` | User, or the Start release button on an email |
| `medialist.build`, `pitches.generate` | User |
| `email.ingest`, `email.classify` | Mail webhook |
| `document.index` | Any upload or attachment |
| `export.render` | Export button |
| `stats.import` | ACCESS stats file upload |
| `mail.renew_subscription` | Schedule (mail push subscriptions expire and must be renewed) |

**Retries:** tasks are idempotent by job id, and Claude rate-limit or overload errors retry with backoff.

**Staying on AWS instead:** Supabase Queues (pgmq) plus a long-running worker on ECS Fargate would replace Trigger.dev. That means more to operate, but everything stays on infrastructure the team already knows.

## Inbox ingestion and triage

The shared inbox is read with read-only access and push notifications. Every message is labeled, matched to a client, and routed to that client's owner within a minute or so.

1. **Subscribe.** Gmail uses a mailbox watch that publishes to Pub/Sub, which calls the webhook. Outlook uses a Microsoft Graph change-notification subscription. Both expire within days, so a scheduled task renews them.
2. **Receive.** A webhook route verifies the request, enqueues `email.ingest` with the message id, and returns right away.
3. **Ingest.** Fetch the full message, skip duplicates by `provider_message_id`, save attachments to Storage, and create `documents` rows.
4. **Rules first, no LLM.** Known auto-notification senders are labeled `auto_notification` and muted. Matches in `sender_rules` or `client_contacts` set the client.
5. **Classify.** Haiku returns JSON: label, client (picked from the candidates), confidence, suggested action, and extracted fields such as the announcement, dates, and spokesperson.
6. **Route.** Above the confidence threshold, the client and owner are set and the owner gets a Slack or Teams alert. Below it, the email lands in Unmatched for whoever is on inbox duty.
7. **Learn from corrections.** When someone reassigns or relabels an email, a `sender_rules` row is written and the email is kept as an example for future classification.
8. **Index.** The body and attachments are chunked and embedded into that client's knowledge base.

**Permissions:** `gmail.readonly` or Graph `Mail.Read` only. The app has no ability to send mail. Handled status lives in our database, not in the mailbox.

**Untrusted input:** email content is data, never instructions. The classifier can only return the fixed fields above; it cannot trigger actions, and every follow-up action needs a human click.

## Integrations

**Slack or Teams bot.** Built with Slack Bolt or the Teams Bot Framework, depending on the team's choice. Alerts come from the worker. Commands ("what's due today", "status of Acme") go to the app's API, which maps the chat user to a `team_members` row and applies that person's access. Every button deep-links into the web app; heavy editing never happens in chat.

**Exports**

| Output | Built with | Notes |
| --- | --- | --- |
| Strategy doc, release, client report (.docx) | `docx` (npm) | L2 edits export with tracked changes (insertion and deletion runs) |
| Onboarding deck (.pptx) | `python-pptx` in a Python worker step | Fills the team's real .pptx template; JavaScript libraries mostly build decks from scratch |
| Media list (.csv) | Plain CSV writer | Column mapping stored in Settings to match the ACCESS upload format |
| Canva | Copy-ready text per slide | No Canva API work in v1 |

**ACCESS stats.** Version 1 imports a CSV export into `access_stats`. If ACCESS offers an API, a scheduled `stats.import` replaces the manual upload.

**ACCESS upload.** Stays manual. The app produces the CSV and records who uploaded it and when.

## Human review and security

Human review is enforced by the data model and by missing permissions, not by UI convention.

| Guarantee | How it's enforced |
| --- | --- |
| Later stages use only approved work | The context builder reads `approved_version_id` only; the media list gate is checked in SQL |
| Drafts can't be silently changed | `artifact_versions` is append-only (UPDATE trigger) |
| AI output is visibly AI | `origin = ai` until a person edits, shown as the AI DRAFT label |
| Nothing goes out automatically | No mail-send scope, no SMTP, no ACCESS automation; exports only |
| Every action is traceable | `approvals`, `generations`, and `outreach` logs |
| Data is scoped to the team | RLS on every table and bucket, keyed on `org_id` |

- **Secrets:** the service-role key and the Anthropic, Voyage, and mail credentials live only in server and worker environments. Mail OAuth refresh tokens are encrypted with Supabase Vault.
- **Journalist data:** contact details are personal data. `do_not_contact` is honored everywhere, and a journalist can be deleted on request.
- **Backups:** turn on point-in-time recovery for production.

## Repo, environments, and deployment

One monorepo (pnpm and Turborepo) so the app, worker, and bot share types and prompts.

| Path | Contains |
| --- | --- |
| `apps/web` | Next.js app: UI, server actions, webhook routes |
| `apps/worker` | Trigger.dev tasks: generation, ingest, indexing, exports |
| `apps/bot` | Slack or Teams bot |
| `packages/db` | Supabase migrations, RLS policies, generated TypeScript types |
| `packages/ai` | Framework loader, context builder, output schemas, model config |
| `packages/exports` | docx, pptx, and CSV renderers |

| Environment | Supabase | Clerk | Deploys from |
| --- | --- | --- | --- |
| Local | `supabase start` (Docker) | Development instance | Your machine |
| Staging | Separate project | Development instance | `main` branch |
| Production | Separate project, point-in-time recovery on | Production instance | Tagged releases |

- Schema changes go only through Supabase CLI migrations, never through dashboard edits.
- `supabase gen types typescript` runs in CI so the app's types always match the schema.
- GitHub Actions runs lint, typecheck, tests, and a migration dry run on every PR, and Vercel builds a preview of each one.

## Build phases

Inbox triage comes right after the foundation because it is the team's biggest daily pain. The release loop comes before onboarding because releases happen every week, while onboarding happens a few times a semester. No dates are set, since this work doesn't take priority over other client work.

1. **Foundation.** Clerk and Supabase auth, RLS, `clients` and `team_members`, client intake, document upload and indexing, the job runner with live progress.
   - Done when a team member can sign in, create a client, upload files, and search them.
2. **Inbox triage.** Mail connection, labeling and matching, owner routing, Slack or Teams alerts, the Inbox screen.
   - Done when a week of real mail is routed correctly with only light correction.
3. **Release loop.** Releases in write and edit mode, the journalist directory, media lists with core lists, pitches, ACCESS CSV export, outreach log.
   - Existing clients' current strategy docs are uploaded so releases have strategy context before Phase 4 exists.
   - Done when one client's weekly release goes from email to exported list inside the app.
4. **Onboarding and strategy.** Research, deck generation from example decks, Meeting 1 and Meeting 2, strategy phases, .docx and .pptx exports.
   - Done when the next new client is onboarded through the app.
5. **Reporting.** ACCESS stats import, coverage log, client reports, cost dashboard from `generations`.

## Open decisions

- [ ] Is the shared inbox (theagency@newswire.com) on Gmail or Outlook, and who can grant OAuth consent?
- [ ] Slack or Teams for the bot?
- [ ] Host on Vercel, or keep everything on AWS (Amplify or ECS) where the team already works?
- [ ] Trigger.dev, or Supabase Queues plus an AWS worker?
- [ ] Where does journalist contact data come from: an ACCESS database or API, manual entry, or a paid media database?
- [ ] What columns does the ACCESS media list upload expect, and can ACCESS stats be exported or pulled by API?
- [ ] Should Handled status sync back to the mailbox? That would need a read-write mail scope instead of read-only.
- [ ] How long should email bodies and attachments be kept?
- [ ] Who are the Clerk admins?

## Sources

- [Supabase: Use Clerk with your Supabase project](https://supabase.com/docs/guides/auth/third-party/clerk)
- [Clerk: Next.js authentication guide 2026, part 2](https://clerk.com/articles/nextjs-authentication-guide-2026-2)
