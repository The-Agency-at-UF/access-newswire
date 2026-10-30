import { PLACEHOLDER_FRAMEWORKS, type FrameworkKind } from '@access/ai'
import type { Tables } from '@access/db'
import type { Sql } from './db'

export type Framework = Tables<'frameworks'>

/**
 * The org's active framework for a kind. If the org has none yet, the marked
 * placeholder is saved as version 1 and activated, so generation can run and
 * the generations log still names the exact text that was used.
 */
export async function activeFramework(sql: Sql, orgId: string, kind: FrameworkKind): Promise<Framework> {
  const [active] = await sql<Framework[]>`
    select * from public.frameworks where org_id = ${orgId} and kind = ${kind} and is_active`
  if (active) return active

  const placeholder = PLACEHOLDER_FRAMEWORKS[kind]
  await sql`
    insert into public.frameworks (org_id, kind, version, title, body, is_active, is_placeholder)
    select ${orgId}, ${kind}, coalesce(max(version), 0) + 1, ${placeholder.title}, ${placeholder.body},
           not exists (select 1 from public.frameworks where org_id = ${orgId} and kind = ${kind} and is_active),
           true
    from public.frameworks where org_id = ${orgId} and kind = ${kind}
    on conflict do nothing`

  const [created] = await sql<Framework[]>`
    select * from public.frameworks where org_id = ${orgId} and kind = ${kind} and is_active`
  if (!created) throw new Error(`no active ${kind} framework`)
  return created
}
