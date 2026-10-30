/**
 * The inbox pipeline (AGENTS.md §12) on Microsoft Graph, read-only:
 *
 *   mail.renew_subscription  keep Graph notifying /api/webhooks/mail
 *   email.sync               pull new Inbox messages (delta), queue each one
 *   email.ingest             store one message + attachments (dedupe on id)
 *   email.classify           rules first, then Haiku; route; alert on Slack
 *
 * Email content is untrusted: it only ever becomes data in a prompt, and the
 * classifier returns fixed fields that can't trigger anything (§2.8).
 */

import {
  buildPrompt,
  createClaude,
  emailClassificationSchema,
  generateStructured,
  sanitizeClassification,
  type EmailClassification,
} from '@access/ai'
import type { Tables } from '@access/db'
import { z } from 'zod'
import type { Task, TaskContext } from '../context'
import { PermanentError } from '../lib/errors'
import { safeFilename, upload } from '../lib/files'
import { activeFramework } from '../lib/frameworks'
import { logGeneration } from '../lib/generations'
import { GraphClient, GraphNotFound } from '../lib/graph'
import { mention, postAlert, slackEscape } from '../lib/slack'

type MailAccount = Tables<'mail_accounts'>
type Email = Tables<'emails'>

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
const DEFAULT_THRESHOLD = 0.75

async function account(ctx: TaskContext): Promise<MailAccount> {
  const id = z.object({ mail_account_id: z.guid() }).parse(ctx.job.input).mail_account_id
  const [row] = await ctx.sql<MailAccount[]>`
    select * from public.mail_accounts where id = ${id} and org_id = ${ctx.job.org_id}`
  if (!row) throw new PermanentError('mail account not found')
  return row
}

// ---------------------------------------------------------------- subscription

export const renewSubscription: Task = async (ctx) => {
  const acct = await account(ctx)
  const graph = new GraphClient(ctx.env)
  if (!ctx.env.MAIL_WEBHOOK_URL?.startsWith('https://')) {
    throw new PermanentError('MAIL_WEBHOOK_URL must be the public https URL of /api/webhooks/mail.')
  }

  let subscription: { id: string; expirationDateTime: string }
  try {
    subscription = acct.subscription_id
      ? await graph.renewSubscription(acct.subscription_id)
      : await graph.createSubscription(acct.mailbox, ctx.env.MAIL_WEBHOOK_URL, acct.client_state)
  } catch (error) {
    if (!(error instanceof GraphNotFound)) throw error
    // The subscription lapsed; start a new one.
    subscription = await graph.createSubscription(acct.mailbox, ctx.env.MAIL_WEBHOOK_URL, acct.client_state)
  }

  await ctx.sql`
    update public.mail_accounts
    set subscription_id = ${subscription.id}, subscription_expires_at = ${subscription.expirationDateTime}, last_error = null
    where id = ${acct.id}`
  return { subscription_id: subscription.id, expires_at: subscription.expirationDateTime }
}

// ---------------------------------------------------------------- sync

export const syncMailbox: Task = async (ctx) => {
  const acct = await account(ctx)
  const graph = new GraphClient(ctx.env)
  const since = new Date(Date.now() - ctx.env.MAIL_INITIAL_SYNC_DAYS * 86_400_000)

  let link: string | null = acct.delta_link
  let queued = 0
  try {
    for (let page = 0; page < 200; page++) {
      const result = await graph.delta(acct.mailbox, link, since)
      for (const item of result.value) {
        if (item['@removed']) continue
        await ctx.sql`
          select private.enqueue(${ctx.job.org_id}, 'email.ingest',
            ${ctx.sql.json({ mail_account_id: acct.id, message_id: item.id })}, null, null, null, null, ${item.id})`
        queued++
      }
      if (result['@odata.deltaLink']) {
        link = result['@odata.deltaLink']
        break
      }
      link = result['@odata.nextLink'] ?? null
      if (!link) break
    }
  } catch (error) {
    await ctx.sql`update public.mail_accounts set last_error = ${String((error as Error).message).slice(0, 500)} where id = ${acct.id}`
    throw error
  }

  await ctx.sql`
    update public.mail_accounts set delta_link = ${link}, last_synced_at = now(), last_error = null where id = ${acct.id}`
  return { queued }
}

// ---------------------------------------------------------------- ingest

export const ingestEmail: Task = async (ctx) => {
  const { message_id } = z.object({ message_id: z.string().min(1) }).parse(ctx.job.input)
  const acct = await account(ctx)
  const org = ctx.job.org_id

  const [existing] = await ctx.sql<Email[]>`
    select * from public.emails where org_id = ${org} and provider_message_id = ${message_id}`
  if (existing) {
    if (existing.status === 'new') await queueClassify(ctx, existing.id)
    return { email_id: existing.id, duplicate: true }
  }

  const graph = new GraphClient(ctx.env)
  const msg = await graph.message(acct.mailbox, message_id)
  const address = (value?: string) => value?.trim().toLowerCase() ?? null

  const [email] = await ctx.sql<Email[]>`
    insert into public.emails (
      org_id, mail_account_id, provider_message_id, internet_message_id, thread_id,
      from_address, from_name, to_addresses, cc_addresses, subject, body_text, received_at, has_attachments
    ) values (
      ${org}, ${acct.id}, ${message_id}, ${msg.internetMessageId ?? null}, ${msg.conversationId ?? null},
      ${address(msg.from?.emailAddress?.address)}, ${msg.from?.emailAddress?.name ?? null},
      ${(msg.toRecipients ?? []).map((r) => address(r.emailAddress?.address)).filter(Boolean) as string[]},
      ${(msg.ccRecipients ?? []).map((r) => address(r.emailAddress?.address)).filter(Boolean) as string[]},
      ${msg.subject ?? null}, ${msg.body?.content ?? null}, ${msg.receivedDateTime ?? null}, ${msg.hasAttachments ?? false}
    )
    on conflict (org_id, provider_message_id) do nothing
    returning *`
  if (!email) return { duplicate: true }

  let attachments = 0
  if (msg.hasAttachments) {
    for (const meta of await graph.attachments(acct.mailbox, message_id)) {
      if (meta.isInline || meta['@odata.type'] !== '#microsoft.graph.fileAttachment' || meta.size > MAX_ATTACHMENT_BYTES) continue
      const bytes = await graph.attachmentBytes(acct.mailbox, message_id, meta.id)
      const [doc] = await ctx.sql<{ id: string }[]>`select gen_random_uuid() as id`
      // The client isn't known yet; routing moves the document to the client.
      const path = `${org}/inbox/${doc!.id}/${safeFilename(meta.name)}`
      await upload(ctx, 'client-files', path, bytes, meta.contentType ?? 'application/octet-stream')
      // Inserting with index_status 'pending' queues document.index.
      await ctx.sql`
        insert into public.documents (id, org_id, source, bucket, storage_path, mime, title, size_bytes, email_id)
        values (${doc!.id}, ${org}, 'email_attachment', 'client-files', ${path}, ${meta.contentType}, ${meta.name},
                ${bytes.byteLength}, ${email.id})`
      attachments++
    }
  }

  await queueClassify(ctx, email.id)
  return { email_id: email.id, attachments }
}

async function queueClassify(ctx: TaskContext, emailId: string) {
  await ctx.sql`
    select private.enqueue(${ctx.job.org_id}, 'email.classify', ${ctx.sql.json({ email_id: emailId })},
                           null, null, null, null, ${emailId})`
}

// ---------------------------------------------------------------- classify + route

interface RuleMatch {
  client_id: string | null
  label: Email['label']
}

/** Sender rules (exact address, then @domain), then client contacts. No LLM. */
export async function matchRules(ctx: TaskContext, from: string | null): Promise<RuleMatch | null> {
  if (!from) return null
  const domain = from.includes('@') ? `@${from.split('@')[1]}` : null
  const [rule] = await ctx.sql<RuleMatch[]>`
    select client_id, label from public.sender_rules
    where org_id = ${ctx.job.org_id} and pattern in (${from}, ${domain ?? from})
    order by (pattern = ${from}) desc limit 1`
  if (rule) return rule
  const [contact] = await ctx.sql<{ client_id: string }[]>`
    select client_id from public.client_contacts where org_id = ${ctx.job.org_id} and email = ${from}`
  return contact ? { client_id: contact.client_id, label: null } : null
}

export const classifyEmail: Task = async (ctx) => {
  const { email_id } = z.object({ email_id: z.guid() }).parse(ctx.job.input)
  const org = ctx.job.org_id
  const [email] = await ctx.sql<Email[]>`select * from public.emails where id = ${email_id} and org_id = ${org}`
  if (!email) throw new PermanentError('email not found')
  if (email.classified_by === 'person' || email.status === 'handled') return { skipped: 'already handled by a person' }

  const rule = await matchRules(ctx, email.from_address)

  let label: Email['label'] = rule?.label ?? null
  let clientId: string | null = rule?.client_id ?? null
  let confidence: number | null = rule ? 1 : null
  let suggestedAction: string | null = null
  let extracted: EmailClassification['extracted'] | Record<string, never> = {}
  let classifiedBy: 'rule' | 'model' = 'rule'

  // Known automated senders are muted without a model call.
  if (label !== 'auto_notification' && !(label && clientId)) {
    if (!ctx.env.ANTHROPIC_API_KEY) throw new PermanentError('ANTHROPIC_API_KEY is not set on the worker.')
    const framework = await activeFramework(ctx.sql, org, 'email_classify')
    const clients = await ctx.sql<{ id: string; name: string; website: string | null; contacts: string[] }[]>`
      select c.id, c.name, c.website,
             coalesce(array_agg(cc.email) filter (where cc.email is not null), '{}') as contacts
      from public.clients c left join public.client_contacts cc on cc.client_id = c.id
      where c.org_id = ${org} group by c.id order by c.name`

    const prompt = buildPrompt({
      framework: { id: framework.id, title: framework.title, body: framework.body },
      // The inbox isn't about one client; the cached second block is the roster.
      client: { name: 'Shared inbox', tier: 'L3', industry: null, website: null, release_cadence: null, profile: {} },
      upstream: [],
      chunks: [],
      trigger: {
        email: { from: email.from_address, subject: email.subject, body: email.body_text?.slice(0, 20_000) ?? null, received_at: email.received_at },
        data: { clients },
        instructions: 'Classify this email.',
      },
    })
    const result = await generateStructured(createClaude(ctx.env.ANTHROPIC_API_KEY), 'email.classify', prompt, emailClassificationSchema)
    await logGeneration(ctx, 'email.classify', result, framework.id, { email_id: email.id, framework_id: framework.id })

    const output = sanitizeClassification(result.output, clients.map((c) => c.id))
    label = label ?? output.label
    // A rule's client match beats the model's guess.
    clientId = clientId ?? output.client_id
    confidence = rule?.client_id ? 1 : output.confidence
    suggestedAction = output.suggested_action
    extracted = output.extracted
    classifiedBy = rule ? 'rule' : 'model'
  }

  const [settings] = await ctx.sql<{ classify_threshold: string }[]>`
    select classify_threshold from public.org_settings where org_id = ${org}`
  const threshold = settings ? Number(settings.classify_threshold) : DEFAULT_THRESHOLD

  const status: Email['status'] =
    label === 'auto_notification' ? 'muted' : clientId && (confidence ?? 0) >= threshold ? 'routed' : 'unmatched'
  const [client] = clientId
    ? await ctx.sql<{ name: string; owner_id: string | null }[]>`
        select name, owner_id from public.clients where id = ${clientId} and org_id = ${org}`
    : []
  const ownerId = status === 'routed' ? (client?.owner_id ?? null) : null

  await ctx.sql`
    update public.emails set
      label = ${label}, client_id = ${status === 'routed' ? clientId : null}, owner_id = ${ownerId},
      confidence = ${confidence}, suggested_action = ${suggestedAction}, extracted = ${ctx.sql.json(extracted as never)},
      status = ${status}, classified_by = ${classifiedBy}, classified_at = now()
    where id = ${email.id} and classified_by is distinct from 'person'`

  if (status === 'routed' && clientId) {
    // Attachments belong to the client's knowledge base now.
    await ctx.sql`update public.documents set client_id = ${clientId} where email_id = ${email.id} and org_id = ${org}`
    await ctx.sql`
      update public.document_chunks set client_id = ${clientId}
      where org_id = ${org} and document_id in (select id from public.documents where email_id = ${email.id})`
  }

  if (status !== 'muted') await alert(ctx, email, status, client?.name ?? null, ownerId, suggestedAction)
  return { label, status, client_id: clientId, confidence, classified_by: classifiedBy }
}

async function alert(
  ctx: TaskContext,
  email: Email,
  status: Email['status'],
  clientName: string | null,
  ownerId: string | null,
  suggestedAction: string | null,
) {
  const link = `${ctx.env.APP_URL}/inbox?email=${email.id}`
  const subject = slackEscape(email.subject ?? '(no subject)')
  const from = slackEscape(email.from_address ?? 'unknown sender')

  let who: string
  if (status === 'routed' && ownerId) {
    const [owner] = await ctx.sql<{ name: string; slack_user_id: string | null }[]>`
      select name, slack_user_id from public.team_members where id = ${ownerId} and org_id = ${ctx.job.org_id}`
    who = owner ? mention(owner.slack_user_id, owner.name) : 'the owner'
  } else {
    const duty = await ctx.sql<{ name: string; slack_user_id: string | null }[]>`
      select tm.name, tm.slack_user_id from public.inbox_duty_at(${ctx.job.org_id}) d
      join public.team_members tm on tm.id = d`
    who = duty.length ? duty.map((m) => mention(m.slack_user_id, m.name)).join(', ') : 'inbox duty'
  }

  const headline =
    status === 'routed'
      ? `${who}: new email for *${slackEscape(clientName ?? 'a client')}*`
      : `${who}: an email needs matching to a client`
  const action = suggestedAction ? `\n> ${slackEscape(suggestedAction)}` : ''
  await postAlert(ctx.env.SLACK_WEBHOOK_URL, `${headline}\n*${subject}* — from ${from}${action}\n<${link}|Open in the inbox>`, ctx.log)
}
