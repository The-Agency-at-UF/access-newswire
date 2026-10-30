import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { EMPTY_CLIENT_STATE } from '@/lib/clientState'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * The client a workspace route belongs to, read under RLS. Cached per request
 * so the layout and the page share one query. Unknown ids — or another org's,
 * which RLS hides — 404 rather than render empty.
 */
export const getWorkspace = cache(async (clientId: string) => {
  if (!z.uuid().safeParse(clientId).success) notFound()

  const supabase = await supabaseServer()
  const { data: client, error } = await supabase
    .from('clients')
    .select('id, name, website, industry, tier, release_cadence, created_at, owner:team_members(name)')
    .eq('id', clientId)
    .maybeSingle()

  if (error) throw new Error(`Could not load client: ${error.message}`)
  if (!client) notFound()

  // No artifacts table yet, so every client is at the start of the pipeline.
  return { client, cs: EMPTY_CLIENT_STATE }
})
