import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@access/db'
import { displayName } from '@/lib/webhooks/clerk'

export interface OrgSession {
  userId: string
  orgId: string
  orgRole: string | null
  isAdmin: boolean
}

/**
 * The signed-in user and their active organization. Middleware already
 * enforces both; this narrows the types for server code and is a second line
 * of defence for server actions.
 */
export async function requireOrgSession(): Promise<OrgSession> {
  const session = await auth()
  if (!session.userId) return session.redirectToSignIn()
  if (!session.orgId) redirect('/select-org')

  return {
    userId: session.userId,
    orgId: session.orgId,
    orgRole: session.orgRole ?? null,
    isAdmin: session.orgRole === 'org:admin',
  }
}

/**
 * Make sure the signed-in user has a `team_members` row in their org.
 *
 * The Clerk webhook is the source of truth, but it can't reach a laptop
 * without a tunnel — this keeps local dev working, and repairs a missed event.
 * Runs under RLS: members may only write their own row.
 */
export async function ensureTeamMember(supabase: SupabaseClient<Database>, session: OrgSession) {
  const user = await currentUser()
  const email = user?.primaryEmailAddress?.emailAddress ?? null

  const { data, error } = await supabase
    .from('team_members')
    .upsert(
      {
        org_id: session.orgId,
        clerk_user_id: session.userId,
        name: displayName(user?.firstName ?? null, user?.lastName ?? null, email ?? session.userId),
        email,
        role: session.orgRole ?? 'org:member',
      },
      { onConflict: 'org_id,clerk_user_id' },
    )
    .select()
    .single()

  if (error) throw new Error(`Could not register team member: ${error.message}`)
  return data
}
