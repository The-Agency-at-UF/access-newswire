import { ensureTeamMember, requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { BrowserCheck } from './BrowserCheck'
import { ClientForm } from './ClientForm'
import { DeleteClientButton } from './DeleteClientButton'
import styles from './dev.module.css'

export const metadata = { title: 'Backend console — ACCESS PR' }

/**
 * Barebone console for the Phase 1 backend: shows what Clerk and Postgres each
 * think the session is, and exercises team_members and clients through RLS.
 * Not part of the product UI.
 */
export default async function DevPage() {
  const session = await requireOrgSession()
  const supabase = await supabaseServer()

  // Register first so the member list and owner picker include the caller.
  let registerError: string | null = null
  try {
    await ensureTeamMember(supabase, session)
  } catch (error) {
    registerError = error instanceof Error ? error.message : String(error)
  }

  const [who, team, clients] = await Promise.all([
    supabase.rpc('whoami'),
    supabase.from('team_members').select('id, name, email, role, clerk_user_id').order('name'),
    supabase
      .from('clients')
      .select('id, name, website, industry, tier, release_cadence, created_at, owner:team_members(name)')
      .order('created_at', { ascending: false }),
  ])

  const dbSees = who.data as { role?: string; org_id?: string | null } | null
  const integrationOk = !who.error && dbSees?.role === 'authenticated' && dbSees.org_id === session.orgId

  return (
    <>
      <section className={styles.card}>
        <h2>
          Session{' '}
          <span className={integrationOk ? styles.ok : styles.err}>
            {integrationOk ? '✓ Postgres sees your Clerk session' : '✗ Postgres does not see your Clerk session'}
          </span>
        </h2>
        <div className={styles.grid2}>
          <div>
            <h3>Clerk</h3>
            <pre className={styles.pre}>{JSON.stringify(session, null, 2)}</pre>
          </div>
          <div>
            <h3>Postgres (`whoami()`)</h3>
            <pre className={styles.pre}>
              {who.error ? `Error: ${who.error.message}` : JSON.stringify(who.data, null, 2)}
            </pre>
          </div>
        </div>
        {!integrationOk && (
          <p className={styles.err}>
            Check that the Supabase integration is on in the Clerk dashboard, that Clerk is added as a
            third-party auth provider in Supabase (`[auth.third_party.clerk]` locally), and that the
            org_id matches.
          </p>
        )}
      </section>

      <section className={styles.card}>
        <h2>Browser client</h2>
        <BrowserCheck />
      </section>

      <section className={styles.card}>
        <h2>Team members</h2>
        {registerError && <p className={styles.err}>{registerError}</p>}
        {team.error ? (
          <p className={styles.err}>{team.error.message}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Clerk user</th>
              </tr>
            </thead>
            <tbody>
              {team.data.map((member) => (
                <tr key={member.id}>
                  <td>
                    {member.name}
                    {member.clerk_user_id === session.userId && <span className={styles.muted}> (you)</span>}
                  </td>
                  <td>{member.email ?? '—'}</td>
                  <td>{member.role}</td>
                  <td className={styles.mono}>{member.clerk_user_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.card}>
        <h2>Clients</h2>
        <ClientForm owners={team.data?.map(({ id, name }) => ({ id, name })) ?? []} />
        {clients.error ? (
          <p className={styles.err}>{clients.error.message}</p>
        ) : clients.data.length === 0 ? (
          <p className={styles.muted}>No clients in this organization yet.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Tier</th>
                <th>Industry</th>
                <th>Cadence</th>
                <th>Owner</th>
                <th>Website</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.data.map((client) => (
                <tr key={client.id}>
                  <td>{client.name}</td>
                  <td>{client.tier}</td>
                  <td>{client.industry ?? '—'}</td>
                  <td>{client.release_cadence ?? '—'}</td>
                  <td>{client.owner?.name ?? '—'}</td>
                  <td>{client.website ?? '—'}</td>
                  <td>
                    <DeleteClientButton id={client.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
