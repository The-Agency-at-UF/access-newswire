import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { clientStateFrom, meetingDatesFrom } from '@/lib/clientState'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * The client a workspace route belongs to, with its current release and stage
 * state, read under RLS. Cached per request so the layout and the page share
 * one load. Unknown ids — or another org's, which RLS hides — 404 rather than
 * render empty.
 */
export const getWorkspace = cache(async (clientId: string) => {
  if (!z.uuid().safeParse(clientId).success) notFound()

  const supabase = await supabaseServer()
  const [clientRes, releaseRes, artifactsRes, meetingsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, website, industry, tier, release_cadence, created_at, owner:team_members(name)')
      .eq('id', clientId)
      .maybeSingle(),
    // The current release is the newest one; release stages show its work.
    supabase
      .from('releases')
      .select('id, title, mode, due_on, access_uploaded_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('artifacts')
      .select('id, type, status, approved_version_id, release_id')
      .eq('client_id', clientId)
      .neq('status', 'archived'),
    supabase.from('meetings').select('kind, held_on, scheduled_for').eq('client_id', clientId),
  ])

  for (const { error } of [clientRes, releaseRes, artifactsRes, meetingsRes]) {
    if (error) throw new Error(`Could not load client: ${error.message}`)
  }
  const client = clientRes.data
  if (!client) notFound()

  const release = releaseRes.data
  const artifacts = (artifactsRes.data ?? []).filter((a) => a.release_id === null || a.release_id === release?.id)
  const meetings = meetingsRes.data ?? []

  return {
    client,
    release,
    artifacts,
    cs: clientStateFrom({ artifacts, meetings, release }),
    meetingDates: meetingDatesFrom(meetings),
  }
})
