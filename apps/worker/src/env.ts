/**
 * Worker configuration, validated once at start. Secrets here never reach a
 * browser (AGENTS.md §2.5, §2.7).
 */

import { z } from 'zod'

const optional = z
  .string()
  .optional()
  .transform((value) => value || undefined)

const schema = z.object({
  // Direct Postgres connection (Supabase → Connect → Session pooler). Bypasses
  // RLS: every query filters by the job's org_id.
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // AI. Tasks that need a missing key fail with a clear message instead of
  // stopping the whole worker.
  ANTHROPIC_API_KEY: optional,
  VOYAGE_API_KEY: optional,

  // Microsoft Graph (app-only, Mail.Read on the shared mailbox).
  MS_GRAPH_TENANT_ID: optional,
  MS_GRAPH_CLIENT_ID: optional,
  MS_GRAPH_CLIENT_SECRET: optional,
  // Public https URL of apps/web's /api/webhooks/mail; Graph posts here.
  MAIL_WEBHOOK_URL: optional,
  MAIL_INITIAL_SYNC_DAYS: z.coerce.number().int().positive().default(7),

  SLACK_WEBHOOK_URL: optional,
  // Base URL of the web app, for links in alerts.
  APP_URL: z.url().default('http://localhost:3000'),

  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
})

export type Env = z.output<typeof schema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse({
    ...source,
    SUPABASE_URL: source.SUPABASE_URL ?? source.NEXT_PUBLIC_SUPABASE_URL,
  })
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Missing or invalid env: ${fields}. See apps/worker/.env.example.`)
  }
  return parsed.data
}
