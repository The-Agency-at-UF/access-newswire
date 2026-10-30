import { supabaseServer } from '@/lib/supabase/server'
import { IntakeForm } from './IntakeForm'

/** New-client intake. The team list feeds the owner picker. */
export default async function IntakePage() {
  const supabase = await supabaseServer()
  const { data, error } = await supabase.from('team_members').select('id, name').order('name')
  if (error) throw new Error(`Could not load the team: ${error.message}`)

  return <IntakeForm owners={data} />
}
