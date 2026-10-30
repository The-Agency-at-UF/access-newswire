import { supabaseServer } from '@/lib/supabase/server'
import { ClientTable } from './ClientTable'

/** The client list, read under RLS: everyone in the org sees every client. */
export default async function ClientsPage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, industry, tier, release_cadence, owner_id, created_at, owner:team_members(name)')
    .order('name')

  if (error) throw new Error(`Could not load clients: ${error.message}`)

  return <ClientTable clients={data} />
}
