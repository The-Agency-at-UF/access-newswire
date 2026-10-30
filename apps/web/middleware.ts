import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/** Reachable signed out. Webhooks authenticate by signature instead. */
const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/webhooks(.*)'])

/** Reachable signed in but before an organization is chosen. */
const isOrgSelectionRoute = createRouteMatcher(['/select-org(.*)'])

/**
 * Everything else needs a signed-in user with an active organization: the org
 * id in the token is what RLS scopes every row to (AGENTS.md §7).
 *
 * `treatPendingAsSignedOut: false` lets a session that still has the
 * choose-organization task through here, so it can be sent to /select-org
 * rather than bounced back to sign-in.
 */
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { userId, orgId, redirectToSignIn } = await auth({ treatPendingAsSignedOut: false })
  if (!userId) return redirectToSignIn({ returnBackUrl: req.url })

  if (!orgId && !isOrgSelectionRoute(req)) {
    return NextResponse.redirect(new URL('/select-org', req.url))
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
}
