import { AppShell } from '@/components/AppShell'
import { ensureTeamMember, requireOrgSession } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase/server'
import { StoreProvider } from '@/lib/store'

/**
 * The product screens. They share one shell and one UI store so the "My
 * clients" filter and toasts survive navigation; the route group keeps them
 * apart from the auth pages and the /dev console.
 *
 * Registering the signed-in member here means the owner picker and the "My
 * clients" filter work even when the Clerk webhook can't reach this machine.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOrgSession()

  let memberId: string | null = null
  try {
    memberId = (await ensureTeamMember(await supabaseServer(), session)).id
  } catch (error) {
    // Don't take every screen down with it; /dev shows the underlying error.
    console.error(error)
  }

  return (
    <StoreProvider memberId={memberId}>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  )
}
