import type { NextRequest } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { membershipKey, teamMemberFromMembership } from '@/lib/webhooks/clerk'

/**
 * Clerk → `team_members`. Verifies the Svix signature
 * (CLERK_WEBHOOK_SIGNING_SECRET), then mirrors organization memberships.
 *
 * Subscribe to: organizationMembership.created, .updated, .deleted.
 * Uses the secret key, so every write is keyed by the event's org id.
 */
export async function POST(req: NextRequest) {
  let event
  try {
    event = await verifyWebhook(req)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const db = supabaseAdmin()

  switch (event.type) {
    case 'organizationMembership.created':
    case 'organizationMembership.updated': {
      const row = teamMemberFromMembership(event.data)
      const { error } = await db
        .from('team_members')
        .upsert({ ...row, deactivated_at: null }, { onConflict: 'org_id,clerk_user_id' })
      if (error) return new Response(error.message, { status: 500 })
      break
    }
    case 'organizationMembership.deleted': {
      // Deactivate rather than delete: versions and approvals keep their authors.
      const { org_id, clerk_user_id } = membershipKey(event.data)
      const { error } = await db
        .from('team_members')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('org_id', org_id)
        .eq('clerk_user_id', clerk_user_id)
      if (error) return new Response(error.message, { status: 500 })
      break
    }
    default:
      // Not subscribed to anything else; acknowledge so Clerk doesn't retry.
      break
  }

  return new Response('ok')
}
