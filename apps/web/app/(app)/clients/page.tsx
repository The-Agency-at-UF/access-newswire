import { clientStateFrom, meetingDatesFrom } from '@/lib/clientState'
import { supabaseServer } from '@/lib/supabase/server'
import { ClientTable } from './ClientTable'

/** The client list, read under RLS: everyone in the org sees every client. */
export default async function ClientsPage() {
  const supabase = await supabaseServer()
  const [clients, releases, artifacts, meetings] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, industry, tier, release_cadence, owner_id, created_at, owner:team_members(name)')
      .order('name'),
    supabase.from('releases').select('id, client_id, access_uploaded_at').order('created_at', { ascending: false }),
    supabase.from('artifacts').select('client_id, release_id, type, status, approved_version_id').neq('status', 'archived'),
    supabase.from('meetings').select('client_id, kind, held_on, scheduled_for'),
  ])

  for (const { error } of [clients, releases, artifacts, meetings]) {
    if (error) throw new Error(`Could not load clients: ${error.message}`)
  }

  // Newest first, so the first release seen per client is its current one.
  const currentRelease = new Map<string, { id: string; access_uploaded_at: string | null }>()
  for (const release of releases.data ?? []) {
    if (!currentRelease.has(release.client_id)) currentRelease.set(release.client_id, release)
  }

  const rows = (clients.data ?? []).map((client) => {
    const release = currentRelease.get(client.id) ?? null
    const clientMeetings = (meetings.data ?? []).filter((m) => m.client_id === client.id)
    const clientArtifacts = (artifacts.data ?? []).filter(
      (a) => a.client_id === client.id && (a.release_id === null || a.release_id === release?.id),
    )
    return {
      ...client,
      cs: clientStateFrom({ artifacts: clientArtifacts, meetings: clientMeetings, release }),
      meetingDates: meetingDatesFrom(clientMeetings),
    }
  })

  return <ClientTable clients={rows} />
}
