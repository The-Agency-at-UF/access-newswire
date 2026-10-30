import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Microsoft Graph change notifications for the shared inbox (AGENTS.md §12.2).
 *
 * Graph first validates the endpoint by POSTing ?validationToken=…, which must
 * be echoed back as text within 10 seconds. After that each notification is
 * checked against the subscription's client_state (in enqueue_mail_sync) and
 * turned into one deduplicated email.sync job; the worker does the reading.
 * Return quickly: Graph expects a 202 within a few seconds.
 */
const notificationSchema = z.object({
  value: z.array(
    z.object({
      subscriptionId: z.string().min(1),
      clientState: z.string().nullable().optional(),
    }),
  ),
})

export async function POST(req: NextRequest) {
  const validationToken = req.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new Response(validationToken, { status: 200, headers: { 'content-type': 'text/plain' } })
  }

  const parsed = notificationSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return new Response('Bad notification', { status: 400 })

  const db = supabaseAdmin()
  // Collapse duplicates within one delivery; the job's dedupe key covers the rest.
  const seen = new Set<string>()
  for (const note of parsed.data.value) {
    const key = `${note.subscriptionId}:${note.clientState ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const { error } = await db.rpc('enqueue_mail_sync', {
      p_subscription_id: note.subscriptionId,
      p_client_state: note.clientState ?? '',
    })
    if (error) return new Response(error.message, { status: 500 })
  }

  return new Response(null, { status: 202 })
}
