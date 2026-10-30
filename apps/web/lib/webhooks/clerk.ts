/**
 * Clerk webhook payloads → `team_members` rows. Pure, so it can be tested
 * without a signed request; the route handler verifies the signature first.
 */

import { z } from 'zod'
import type { TablesInsert } from '@access/db'

const membershipSchema = z.object({
  role: z.string().min(1),
  organization: z.object({ id: z.string().min(1) }),
  public_user_data: z.object({
    user_id: z.string().min(1),
    identifier: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
  }),
})

export type TeamMemberRow = TablesInsert<'team_members'> & { org_id: string }

/** "First Last", or the fallback when Clerk has no name for the user. */
export function displayName(first: string | null, last: string | null, fallback: string): string {
  return [first, last].filter(Boolean).join(' ').trim() || fallback
}

/** The membership's org and user, enough to find or delete the row. */
export function membershipKey(data: unknown): { org_id: string; clerk_user_id: string } {
  const membership = membershipSchema.parse(data)
  return {
    org_id: membership.organization.id,
    clerk_user_id: membership.public_user_data.user_id,
  }
}

export function teamMemberFromMembership(data: unknown): TeamMemberRow {
  const membership = membershipSchema.parse(data)
  const user = membership.public_user_data
  // The identifier is the user's email when they signed up with one, but can
  // also be a username or phone number.
  const email = z.email().safeParse(user.identifier).success ? user.identifier : null

  return {
    org_id: membership.organization.id,
    clerk_user_id: user.user_id,
    name: displayName(user.first_name, user.last_name, user.identifier),
    email,
    role: membership.role,
  }
}
