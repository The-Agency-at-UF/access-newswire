# AGENTS.md — ACCESS PR Bot

Instructions for AI coding agents (and humans) working in this repo. Read this before writing code.
Keep it current: when a decision in **Open decisions** is made, move it into the relevant section.

- Architecture doc: `docs/architecture.md` (Oct 13 original; this file wins where they differ)
- Wireframes: `docs/wireframes.md` (copy of `access-pr-bot-wireframes.md`, v0.2; not added yet)

---

## 1. What we're building

An **internal** AI workflow assistant for the ACCESS PR team (ACCESS Newswire), built by The Agency.
It takes a client from intake to recurring press releases without the team re-entering context:

```
Inbox → New client (sales handoff) → Research → Onboarding deck → Meeting 1 → Strategy → Meeting 2
      → Press release → Media list → Upload to ACCESS → Outreach → ACCESS stats → next release
```

It is **not** client-facing and **not** autonomous. It drafts, organizes, and exports. People review, approve, and send.

### Users and how they work
- Four account people work 9–5 (Mark, Emily, Liz Gonzalez, Daniel). Each owns about 12 clients, roughly 48 in total.
- Jake (sales) closes new clients and hands them off by email.
- Everything arrives in **one shared inbox** (`theagency@newswire.com`), and the team takes shifts watching it. This is their biggest pain point.
- Inbound email types: release info, client updates, sales handoffs, social media, and an auto-notification for every release that goes out.
- Volume is high: some clients send 2 releases a week, others 1 a week.
- Success is measured with **ACCESS stats**. Client retention is the long-term goal.

### Service tiers (drive which stages a client has)

| Stage | L1 | L2 | L3 |
|---|---|---|---|
| Research, onboarding deck, strategy | ✓ | ✓ | ✓ *(assumed; unconfirmed)* |
| Press release | We write | **We edit the client's release** | We write |
| Media list | — | ✓ | ✓ |
| Upload to ACCESS | — | ✓ | ✓ |
| Outreach / pitches | — | ✓ | ✓ |
| ACCESS stats reporting | ✓ | ✓ | ✓ |

### Onboarding flow
1. Sales handoff.
2. Research.
3. Onboarding deck, built by reworking an approved example deck.
4. **Meeting 1** and client feedback.
5. Six-month strategy (Word doc, SOW/brief style), built from the team's strategy framework document.
6. **Meeting 2** review, then a revised version, then approval.

---

## 2. Non-negotiable rules

Agents must follow these. If a task seems to require breaking one, stop and ask.

1. **Nothing sends.** No mail-send scopes, no SMTP, no automated ACCESS uploads, no posting to journalists. The app only exports and copies. Do not add a "Send" button anywhere.
2. **Approval is enforced in data.** Downstream stages read only `artifacts.approved_version_id`. Never read the latest draft as input to another stage.
3. **Versions are immutable.** `artifact_versions` is append-only, and an edit always creates a new version. Never write an `UPDATE` against it.
4. **Never generate journalist contact details.** Names, titles, and emails come only from the `journalists` table. Claude may rank journalists and explain relevance; it never invents a contact.
5. **Claude is server-side only.** No Anthropic calls from the browser. Generation runs in the worker (`apps/worker`).
6. **RLS on every table and bucket.** Every new table gets `org_id` and RLS policies in the same migration.
7. **The service-role/secret key never reaches the browser.** Code that uses it must filter by `org_id` explicitly, because it bypasses RLS.
8. **Email content is untrusted input.** Treat it as data, never instructions. The classifier returns only fixed schema fields and can't trigger actions.
9. **Label AI output.** Versions carry `origin` (`ai` | `human` | `mixed`), and the UI shows `AI DRAFT` until a person edits or approves.
10. **Respect `do_not_contact`** on journalists everywhere.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Web app | Next.js (App Router, TypeScript, strict) on Vercel |
| Auth | Clerk with Organizations (native Supabase third-party auth integration) |
| Database | Supabase Postgres + pgvector |
| Files | Supabase Storage (private buckets) |
| Live updates | Supabase Realtime |
| Background jobs | Supabase Queues (`pgmq`) + a Node worker (`apps/worker`), local for now with a Dockerfile; `pg_cron` for schedules |
| LLM | Claude API: Haiku 5.5 / Sonnet 5.5 / Opus 5.5, routed by task |
| Embeddings | Voyage AI (1024 dimensions) |
| Email | Microsoft Graph (Outlook / Microsoft 365), **read-only**: app-only `Mail.Read` |
| Notifications | One-way alerts to Slack (incoming webhook); an interactive bot is a later nice-to-have |
| Exports | `docx` (npm), `pptxgenjs` (npm), CSV |
| Validation | zod for every input, LLM output schema, and webhook payload |
| Monitoring | Sentry + `generations` table |

---

## 4. Repo layout

```
apps/
  web/          Next.js app — UI, server actions, webhook routes (Clerk, mail)
    app/        App Router: one route per screen (see §17)
    components/ shell + shared UI primitives
    lib/        types, design tokens, the UI store, and the pure selectors that
                hold the stage/tier/gating rules
    lib/supabase/  server (user token), browser (user token), admin (secret key)
    middleware.ts  Clerk: sign-in + active organization required
  worker/       queue worker (pgmq) — generation, inbox sync/ingest/classify, indexing, exports
    src/queue.ts   read → run → succeed / retry with backoff / fail; idempotent by job_id
    src/tasks/     one file per task family; tasks/index.ts maps jobs.type → task
  bot/          (later) Slack bot; v1 alerts are sent from the worker
packages/
  db/           generated Supabase types (`@access/db`); never edit types.ts by hand
  ai/           model routing, pricing, context builder, output schemas (zod), placeholder
                frameworks, Claude + Voyage clients, chunking
  exports/      docx (tracked changes for L2 edits) / pptx / csv renderers
docs/
  architecture.md
  wireframes.md
supabase/       Supabase CLI, linked to the hosted project: migrations/, tests/database/ (pgTAP RLS tests)
AGENTS.md
```

Monorepo tooling: **pnpm** workspaces + **Turborepo**.

---

## 5. Commands

These exist today (pnpm workspaces + Turborepo; run from the repo root):

```bash
pnpm install                 # install all workspaces
pnpm dev                     # next dev + the worker (the worker idles with a note until apps/worker/.env is set)
pnpm build                   # next build
pnpm lint                    # eslint, flat config via eslint-config-next
pnpm typecheck               # tsc --noEmit, strict
pnpm test                    # vitest (web, ai, exports, worker)
pnpm --filter @access/worker dev   # the worker alone; needs apps/worker/.env

pnpm db:migration <name>     # new migration (supabase migration new)
pnpm db:push                 # apply new migrations to the linked hosted project
pnpm db:test                 # pgTAP tests in supabase/tests (RLS), against the hosted project
pnpm db:types                # supabase gen types typescript --linked → packages/db/types.ts
```

There is no local Supabase stack: the app and the CLI both use the hosted project (`supabase link --project-ref <ref>` once per machine). `pnpm db:test` wraps each file in a transaction and rolls back, but it needs Docker for `pg_prove`. The CLI logs in as a temporary role that can't see the `extensions` schema (pgTAP), so every test file starts with `set local role postgres; set local search_path = public, extensions;`, and switches back with `set local role postgres`, not `reset role`.

Before you call a task done, run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. If you touched the schema, also run `pnpm db:push`, `pnpm db:test` and `pnpm db:types`.

**Grants.** The hosted project's default privileges give new tables to `anon`. So every migration that creates a table states its grants explicitly, next to its RLS policies: `select, insert, update, delete` to `authenticated`, `all` to `service_role`, and `revoke all ... from anon` plus `revoke truncate, references, trigger ... from authenticated` (TRUNCATE ignores RLS).

**Hosted project.** The repo is linked to the "Access Newswire" Supabase project (`supabase link --project-ref uquzpczvzihxfrgadcjc`). Ship migrations with `supabase db push --dry-run`, then `supabase db push`; never edit the hosted schema in the dashboard. Tables that were hand-built there before the migrations existed were parked in a `legacy` schema (`…000050`), reviewed against §8, found empty and unsuited, and dropped (`…000500`).

---

## 6. Environment variables

```
# Supabase (legacy anon / service_role keys also work)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=                 # server + worker ONLY

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=

# AI
ANTHROPIC_API_KEY=                   # worker ONLY
VOYAGE_API_KEY=                      # worker ONLY

# Worker
DATABASE_URL=                        # worker ONLY; direct Postgres, bypasses RLS
WORKER_CONCURRENCY=2

# Mail (Microsoft Graph, app-only Mail.Read)
MS_GRAPH_TENANT_ID= / MS_GRAPH_CLIENT_ID= / MS_GRAPH_CLIENT_SECRET=   # worker ONLY
MAIL_WEBHOOK_URL=                    # public https URL of /api/webhooks/mail

# Notifications
SLACK_WEBHOOK_URL=                   # worker ONLY
APP_URL=                             # links in alerts

SENTRY_DSN=
```

Never commit `.env*` files. Each app keeps an `.env.example` with the variables it reads (`apps/web/.env.example` → `apps/web/.env.local`; `apps/worker/.env.example` → `apps/worker/.env`); keep it updated with every variable name.

---

## 7. Auth and RLS

Clerk issues the session, and Supabase trusts it through **native third-party auth**. Do **not** use the deprecated Clerk "supabase" JWT template.

Setup (once per environment):
1. Turn on the Supabase integration in the Clerk dashboard. This adds the `role: authenticated` claim.
2. Add Clerk as a third-party provider in the Supabase dashboard. Don't run `supabase config push`: `config.toml` holds no auth settings and would reset them.
3. Turn on Organizations in Clerk and create the team's organization.
4. Add a webhook endpoint for `/api/webhooks/clerk` with `organizationMembership.created`, `.updated` and `.deleted`.

`/dev` (the backend console) shows what Clerk and Postgres each think the session is. If `whoami()` doesn't return your org id, one of steps 1–2 is missing.

Server client:

```ts
// apps/web/lib/supabase/server.ts
import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function supabaseServer() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { accessToken: async () => (await auth()).getToken() },
  )
}
```

The browser client works the same way, with `useSession().session?.getToken()`. `supabase.auth.*` calls do not work once Clerk is the token source, and that is expected.

RLS template (every table):

```sql
-- once, in the first migration
create or replace function public.current_org_id() returns text
language sql stable as $$
  select coalesce(auth.jwt()->>'org_id', auth.jwt()->'o'->>'id')
$$;

-- per table
alter table <table> enable row level security;
create policy "<table>_select" on <table> for select to authenticated
  using (org_id = (select public.current_org_id()));
create policy "<table>_insert" on <table> for insert to authenticated
  with check (org_id = (select public.current_org_id()));
create policy "<table>_update" on <table> for update to authenticated
  using (org_id = (select public.current_org_id()));
```

- **Admin-only actions** (team, tiers, frameworks, deletes) also check `auth.jwt()->>'org_role' = 'org:admin'`, or `auth.jwt()->'o'->>'rol' = 'admin'` on newer tokens.
- **Tenancy:** one Clerk Organization is the ACCESS PR team. `org_id` is Clerk's org id, stored as `text`.
- **Client ownership** (`clients.owner_id`) is a UI filter ("My clients"), **not** a security boundary. All team members can see all clients.
- **Helpers:** `current_org_id()`, `current_user_id()` and `is_org_admin()` read both claim shapes; use them in policies instead of `auth.jwt()` directly. Deletes are admin-only.
- **Same-org foreign keys:** a reference to another org-scoped row is a composite key on `(org_id, <fk>)` against a `unique (org_id, id)`, so a row can't point into another org (see `clients.owner_id`).
- **`org_id` default:** columns default to `current_org_id()`, so user-token inserts can omit it. Secret-key inserts have no token and must set it.
- **Org required:** `middleware.ts` sends a session without an active organization to `/select-org`. Server code calls `requireOrgSession()` (`lib/auth.ts`).
- **User sync:** a Clerk webhook (`apps/web/app/api/webhooks/clerk`) verifies the signature and upserts into `team_members`. `ensureTeamMember()` also registers the signed-in user under RLS (members may write only their own row), so local dev works without a webhook tunnel. `team_members.role` is display-only; authorization reads the token.

---

## 8. Data model

Every table has `id uuid default gen_random_uuid()`, `org_id text not null`, and `created_at timestamptz default now()`.

| Table | Purpose | Key columns |
|---|---|---|
| `team_members` | Staff | `clerk_user_id`, `name`, `email`, `role`, `slack_user_id`, `teams_user_id`, `deactivated_at` |
| `frameworks` | The team's prompts/templates | `kind`, `version`, `body`, `example_artifact_id`, `is_active`, `is_placeholder` |
| `inbox_duty` | Inbox shift schedule | `member_id`, `starts_at`, `ends_at` |
| `clients` | Clients | `name`, `website`, `industry`, `tier`, `release_cadence`, `owner_id`, `profile jsonb`, `onboarded_externally` |
| `client_contacts` | Client people and domains | `client_id`, `name`, `email`, `is_spokesperson` |
| `meetings` | Meeting 1/2, check-ins | `client_id`, `kind`, `held_on`, `notes`, `document_id` |
| `emails` | Shared inbox messages | `provider_message_id unique`, `thread_id`, `from_address`, `subject`, `body_text`, `label`, `confidence`, `client_id`, `owner_id`, `suggested_action`, `extracted jsonb`, `status` |
| `sender_rules` | Learned sender → client/label matches | `pattern` (address or `@domain`), `client_id`, `label`, `created_by` |
| `mail_accounts` | The connected mailbox + Graph subscription | `mailbox`, `subscription_id`, `subscription_expires_at`, `client_state`, `delta_link` |
| `documents` | Uploads, attachments, generated files, notes | `client_id`, `source`, `storage_path`, `mime`, `title`, `index_status` |
| `document_chunks` | Retrieval | `document_id`, `client_id`, `content`, `embedding vector`, `tokens` |
| `releases` | One announcement | `client_id`, `title`, `mode`, `due_on`, `roadmap_item`, `source_email_id`, `access_uploaded_at`, `access_uploaded_by` |
| `artifacts` | Research, deck, strategy, release, media list, pitch set, report | `client_id`, `release_id`, `type`, `title`, `status`, `approved_version_id` |
| `artifact_versions` | Immutable drafts | `artifact_id`, `version`, `content jsonb`, `origin`, `generation_id`, `parent_version_id`, `created_by` |
| `approvals` | Review history | `artifact_version_id`, `action`, `actor_id`, `comment` |
| `outlets` | Publications | `name`, `type`, `region`, `url` |
| `journalists` | Contact directory | `name`, `outlet_id`, `title`, `beats text[]`, `email`, `source`, `verified_at`, `do_not_contact` |
| `media_list_entries` | Journalists on a list version | `artifact_version_id`, `journalist_id`, `relevance_reason`, `included`, `position` |
| `core_lists` | Reusable base list per client | `client_id`, `journalist_id` |
| `outreach` | Pitch log | `client_id`, `release_id`, `journalist_id`, `pitch_version_id`, `pitched_at`, `outcome` |
| `coverage` | Earned placements | `client_id`, `release_id`, `journalist_id`, `url`, `published_on`, `type` |
| `access_stats` | Imported ACCESS metrics | `client_id`, `release_id`, `period_start`, `period_end`, `metrics jsonb`, `source_document_id` |
| `jobs` | Background work tracked by the UI | `type`, `status`, `progress`, `input jsonb`, `error`, `attempts`, `dedupe_key`, `artifact_id`, `msg_id` |
| `generations` | Every Claude call | `job_id`, `model`, `task`, `framework_id`, `inputs jsonb`, `input_tokens`, `output_tokens`, cache tokens, `cost_usd`, `latency_ms`, `request_id` |
| `org_settings` | Per-org settings (admin) | `classify_threshold`, `access_csv_columns` |

**Enums**
- `tier`: `L1`, `L2`, `L3`
- `artifact_status`: `draft`, `in_review`, `approved`, `archived`
- `artifact_type`: `research`, `onboarding_deck`, `strategy`, `press_release`, `media_list`, `pitch_set`, `report`
- `email_label`: `release_info`, `client_update`, `sales_handoff`, `social`, `auto_notification`, `other`
- `release_mode`: `write`, `edit`
- `version_origin`: `ai`, `human`, `mixed`
- also: `email_status`, `approval_action`, `meeting_kind`, `document_source`, `index_status`, `job_status`, `outreach_outcome`, `coverage_type`, `framework_kind` (see `…000100_foundations.sql`)

**Database-enforced rules** (each has a pgTAP test in `supabase/tests/database/`)
- `artifact_versions`, `approvals` and `media_list_entries` are append-only: triggers reject `UPDATE`/`DELETE`. The one exception is `delete_client()` (admins), which purges a client with its history.
- Versions number themselves; a person can't save an `ai` version (only the worker can, and an `ai` version must name its `generations` row). A new version makes the artifact a draft; `approved_version_id` keeps pointing at the approved one.
- Status and `approved_version_id` change only through `submit_for_review()`, `approve_version()` (any member, latest version only, logged), `request_changes()` and `archive_artifact()`.
- Every UI gate (`gates()` in `lib/selectors/stages.ts`) is enforced on insert: deck ← approved research; strategy ← approved deck + Meeting 1 held; releases ← approved strategy + Meeting 2 held; media list ← approved release; pitches ← approved media list; outreach ← approved pitches. Clients with `onboarded_externally` skip the onboarding gates.
- Tier: L1 has no media list, pitches, core list, outreach or ACCESS upload; L2 releases default to `mode = 'edit'`. `create_release()` and `mark_access_uploaded()` apply these.
- `do_not_contact` journalists can't be included on a media list, added to a core list, pitched, or approved on a list.
- Same-org composite foreign keys everywhere; release children also key on `(client_id, release_id)`.
- Inserting a pending `documents` row queues `document.index`; a new `mail_accounts` row queues its subscription and first sync.

**Migrations:** Supabase CLI only, never dashboard edits. One concern per migration. Regenerate types after every migration.

---

## 9. Storage

| Bucket | Holds |
|---|---|
| `client-files` | Uploads and inbox attachments |
| `exports` | Generated .docx / .pptx / .csv |
| `templates` | Team deck/doc templates and example decks |

- **Paths:** `{org_id}/{client_id}/{document_id}/{filename}`. Templates use `{org_id}/templates/...`.
- **Policy:** the policy on `storage.objects` requires that `(storage.foldername(name))[1] = current_org_id()`.
- **Downloads:** short-lived signed URLs only.
- **Linking:** every file has a `documents` row.

---

## 10. AI layer (`packages/ai`)

Every generation follows one path: **framework → context → Claude (structured output) → new `artifact_versions` row → `generations` log**.

**Model routing.** Model ids live in `packages/ai/models.ts`; never hardcode them elsewhere.

| Task | Model |
|---|---|
| Inbox labeling and extraction | `claude-haiku-5-5` |
| Release drafts, L2 edits, pitches, media list ranking | `claude-sonnet-5-5` |
| Research, onboarding deck, six-month strategy | `claude-opus-5-5` |

**Context order** (always in this order, so the stable prefix stays cacheable):
1. The stage's framework, as the system prompt (prompt-cached).
2. Client profile + tier (prompt-cached).
3. **Approved** upstream artifacts only.
4. Top-k chunks from `match_chunks(client_id, embedding, k)` (pgvector + full-text, `security invoker`).
5. The trigger input: email, client's new info, and user instructions.

**Output.** Every artifact type has a zod schema: `{ sections: [{ id, heading, body }] , ...typeSpecific }`. Section-level regenerate sends the full artifact plus the target section id.

**Web research.** The research stage uses Claude's server-side web search, in two calls: a web-search pass that collects findings and every source URL, then a structured pass that writes the research schema citing only those URLs (structured output and search citations can't share a request). Sources are stored on the version.

**Contacts.** Ranking and pitch outputs name journalists by id only; ids not in the candidate list are dropped (`onlyKnownJournalists`).

**Fallbacks.** Opus and Sonnet calls send `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`), so a safety decline is retried on a fallback model in the same call. Haiku has none; a refusal fails the job without retries.

**Limits.** Structured calls stay under 20K output tokens (the SDK refuses non-streaming calls that could run past 10 minutes).

**Logging.** Every call writes a `generations` row with model, tokens (incl. cache), list-price cost (`packages/ai/pricing.ts`, dated; confirm before budgeting), latency and request id.

**Frameworks.** The team's existing prompts and templates (onboarding deck framework, strategy framework, media list and pitching prompts) are loaded into `frameworks`. Don't paraphrase or "improve" them without asking. Until they're loaded, the first use of a kind saves a marked placeholder (`is_placeholder`) as v1; an admin replaces it in Settings. Bodies are immutable; edits are new versions.

---

## 11. Background jobs (`apps/worker`)

Anything that takes more than a few seconds runs in the worker, never inside a request.

1. A server action calls `enqueue_job()`, which inserts the `jobs` row and sends `{job_id}` to the `jobs` pgmq queue in one transaction. System jobs (inbox, schedules) use `private.enqueue()`; a `dedupe_key` collapses repeats while one is pending.
2. The worker reads a message (hidden for 10 minutes, so a crashed worker's job comes back), marks the job `running`, and updates `progress` as it goes.
3. On success it writes its rows (e.g. `artifact_versions`) and deletes the message. On a transient error it requeues with backoff (30s, 2m, 8m…) up to `max_attempts`; refusals, bad output, gate violations and bad input fail at once. `cancel_job()` stops it at the next checkpoint.
4. The UI subscribes to `jobs` and `artifact_versions` via Supabase Realtime.
5. `pg_cron` runs `mail-maintenance` every 15 minutes: renew the Graph subscription when it's within a day of expiry, and a fallback `email.sync`.

| Task | Started by |
|---|---|
| `research.run` | New client |
| `onboarding.generate`, `strategy.phase` | User |
| `release.draft`, `release.edit` | User, or Start release on an email |
| `medialist.build`, `pitches.generate` | User |
| `email.sync` | Mail webhook, cron fallback, new mailbox |
| `email.ingest`, `email.classify` | `email.sync`, then `email.ingest` |
| `document.index` | Upload / attachment |
| `export.render` | Export button |
| `stats.import` | ACCESS stats upload |
| `mail.renew_subscription` | New mailbox, cron |

Tasks must be **idempotent by `job_id`** (generation checks for a version this job already wrote). The Anthropic SDK retries 429/overload itself (`maxRetries: 4`). The worker connects as a role that bypasses RLS: every query filters by the job's `org_id`.

---

## 12. Inbox pipeline

1. **Subscribe:** a Graph change-notification subscription on the mailbox's Inbox (`mail.renew_subscription`), renewed by cron before it lapses.
2. **Webhook** (`/api/webhooks/mail`): echo Graph's `validationToken`; for notifications, `enqueue_mail_sync()` checks the subscription's `client_state` and queues one deduplicated `email.sync`. Return 202 immediately.
3. **Sync + ingest:** `email.sync` follows the Graph delta link and queues `email.ingest` per message; ingest dedupes on `provider_message_id`, stores the text body and file attachments (≤ 25 MB) under `{org}/inbox/{document_id}/`, and creates `documents` rows (which queue indexing).
4. **Rules first (no LLM):** known auto-notification senders become `auto_notification` (muted). A `sender_rules` or `client_contacts` match sets the client.
5. **Classify (Haiku):** returns label, client, confidence, suggested action, and extracted fields as JSON.
6. **Route:** above the threshold, set the client and owner and alert the owner. Below it, the email goes to Unmatched for whoever is on inbox duty.
7. **Corrections:** relabeling or reassigning writes a `sender_rules` row.
8. **Index:** the body and attachments go into the client's knowledge base.

Scopes: Graph `Mail.Read` (application permission) **only**, restricted to the shared mailbox with an application access policy. Handled status lives in our DB (`set_email_handled()`). Routed emails move their attachments to the client's knowledge base. Alerts go to Slack; mentions use `team_members.slack_user_id` when set, and email text is escaped so it can't inject links or mentions.

---

## 13. Exports

| Output | Library | Notes |
|---|---|---|
| Strategy, release, report (.docx) | `docx` | L2 edits export with tracked changes |
| Onboarding deck (.pptx) | `pptxgenjs` (in the worker) | Plain layout until the team's template is in `templates`, then fill that |
| Media list (.csv) | `packages/exports/csv.ts` | Column map in `org_settings.access_csv_columns`; spreadsheet formulas are defused |
| Canva | Copy text per slide | No Canva API in v1 |

Exports read the **approved** version only, land in the `exports` bucket with a `documents` row, and are downloaded via signed URL. ACCESS upload stays manual; `mark_access_uploaded()` records who and when.

---

## 14. Code conventions

- TypeScript `strict`. No `any` without a comment explaining why.
- Validate every external input (forms, webhooks, LLM output) with zod at the boundary.
- Mutations go through **server actions**. Route handlers are for webhooks only.
- Mark server-only modules with `import 'server-only'`. Secrets never live in files the client can import.
- Use the generated Supabase types from `packages/db`. Don't hand-write table types.
- UI follows `docs/wireframes.md`: a client workspace, the shared stage layout (context | draft | status/actions), status badges, and tier badges.
- Tests:
  - Unit tests for the context builder, tier gating, and schema validation.
  - SQL tests for RLS (a user from another org must see nothing).
  - Tests that version immutability and approval gates hold.
- Keep PRs small and scoped to one phase item. Update this file when a convention changes.

---

## 15. Build phases

No hard dates; this project ranks below other client work.

1. **Foundation** *(current — backend for phases 1–5 is in place; screens are being wired to it)*
   - **Scope:** Clerk + Supabase auth, RLS, `clients` and `team_members`, intake, document upload and indexing, job runner with Realtime progress.
   - **Done when:** a team member can sign in, create a client, upload files, and search them.
2. **Inbox triage**
   - **Scope:** mail connection, labeling and matching, owner routing, one-way Teams/Slack alerts, Inbox screen.
   - **Done when:** a week of real mail is routed correctly.
3. **Release loop**
   - **Scope:** write and edit modes, journalist directory, media lists and core lists, pitches, ACCESS CSV, outreach log. Upload existing clients' strategy docs as context.
   - **Done when:** one client's weekly release goes from email to exported list inside the app.
4. **Onboarding and strategy**
   - **Scope:** research, decks from example decks, Meeting 1 and 2, strategy phases, .docx/.pptx exports.
   - **Done when:** the next new client is onboarded in the app.
5. **Reporting and extras**
   - **Scope:** ACCESS stats import, coverage, client reports, cost dashboard, optional interactive bot.

---

## 16. Open decisions

Don't build anything that locks in an answer to these; ask first.

- Who is the Microsoft 365 tenant admin who grants `Mail.Read` and sets the mailbox access policy?
- Where does the web app (Vercel or AWS) and the worker container run in production?
- Where does journalist contact data come from: an ACCESS database/API, manual entry, or a paid database?
- What columns does the ACCESS media list upload expect, and can ACCESS stats be exported or pulled via API? (Both are configurable meanwhile.)
- Do all tiers get onboarding and strategy? Does L3 include anything beyond L2 plus writing (e.g. social)?
- Should Handled status sync back to the mailbox? That would need a read-write mail scope.
- How long should emails and attachments be retained?
- Who are the Clerk admins?
- The team's real frameworks (deck framework + example deck, strategy framework, media list and pitching prompts) — placeholders run until they're loaded.

**Decided 2026-10-20:** Outlook / Microsoft Graph; Slack alerts; Supabase Queues + a Node worker; any team member may approve; the database enforces every stage gate, with `onboarded_externally` for clients onboarded before the app; decks render with `pptxgenjs`; ACCESS formats configurable.

---

## 17. UI routes

The screens are a port of the `ACCESS PR Bot v2` Claude Design project
(`ACCESS PR Bot v2.dc.html`, plus `access-data.js`). The design keeps navigation
in component state; here every screen is a route, so links, the back button and
deep links from the companion bot all work.

| Route | Screen |
|---|---|
| `/` | redirects to `/inbox` |
| `/inbox` | shared-inbox triage, folders + preview pane |
| `/clients` | client list (sorted by name until releases exist) |
| `/clients/new` | intake (pre-filling from a sales handoff comes with the inbox) |
| `/clients/[clientId]/overview` | pipelines, profile, open asks, latest mail, stats |
| `/clients/[clientId]/research` | preliminary research with sources |
| `/clients/[clientId]/onboarding` | deck slides + Meeting 1 |
| `/clients/[clientId]/strategy` | phases, roadmap, angle bank + Meeting 2 |
| `/clients/[clientId]/releases` | release draft (we write) or suggested edits (we edit) |
| `/clients/[clientId]/media` | media list, flags, ACCESS export (L2/L3 only) |
| `/clients/[clientId]/pitches` | per-journalist pitches (L2/L3 only) |
| `/clients/[clientId]/reporting` | ACCESS stats + earned coverage |
| `/clients/[clientId]/docs` | indexed documents |
| `/approvals` | everything waiting on a person |
| `/journalists` | shared contact directory |
| `/settings` | tier matrix, team, frameworks, export formats |
| `/companion` | Teams/Slack bot preview |
| `/sign-in`, `/sign-up` | Clerk |
| `/select-org` | join or pick the team's organization |
| `/dev` | backend console: session check, team members, clients (real data, RLS) |
| `/dev/work`, `/dev/docs`, `/dev/inbox`, `/dev/directory`, `/dev/settings` | console pages that exercise every table, rule and job by hand |

The product screens live in the `app/(app)` route group, which mounts the
store and `AppShell` and registers the signed-in member (`ensureTeamMember`). Sign-in, sign-up and `/select-org` live in `app/(auth)`,
styled after The Agency brand book ("Nerve": black ground, purple/red/yellow
forms, Franklin Gothic as the web stand-in for Gentona); `clerkAppearance.ts`
there themes the Clerk components. The wordmark is set in a stand-in serif
until the official internal logo file is added. `/dev` sits outside both groups.
Route groups don't change any URL.

**Where the rules live.** `lib/selectors/stages.ts` holds the stage sequence per
tier, the approval gates and the pipeline rails — it is pure, and
`lib/selectors/stages.test.ts` covers it. `lib/clientState.ts` holds
`isStageDone`, the single place that decides an artifact only counts when
**approved**. Put new workflow rules there rather than in a component.

**Data.** Screens are server components that read Supabase under RLS; there is
no mock data. A screen whose table doesn't exist yet renders an `EmptyState`
saying what will appear there. `lib/workspace.ts` loads the client for every
workspace route (cached per request). Until `artifacts` exists every client's
stage state is `EMPTY_CLIENT_STATE`, so gated stages show their approval gate.

**State.** `lib/store.tsx` holds UI-only state that must survive navigation:
the "My clients" filter, the signed-in member's id, the open workspace's
client (for the sidebar and breadcrumb) and the toast. Don't put data in it.

**Tokens.** `lib/tokens.ts` holds the value-driven colours (status pills, tier
badges, label chips, pillar colours, journalist flags) and the stage lists per
tier; everything static is a custom property in `app/globals.css`. Keep the
two in step.

**Built so far (Phase 1).** Clerk auth with a required organization,
`team_members` and `clients` in Supabase with RLS, the Clerk membership
webhook, the client list, intake and workspace header on real data, the team
in Settings, and `/dev`, a barebone page that exercises all of it.

**Backend complete, screens next.** All §8 tables, rules, the worker and every
§11 task exist and are reachable from `/dev`; the product screens still need
wiring to them (most show an `EmptyState`).
