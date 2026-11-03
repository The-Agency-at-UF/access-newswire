/**
 * Seed or wipe the demo team on the linked Supabase project.
 *
 *   pnpm demo:seed [org_…]    replace the demo team's data with fresh demo data
 *   pnpm demo:reset [org_…]   delete the demo team's data
 *   pnpm demo:drafter [org_…] stand in for the worker: answer Start release with pre-written drafts
 *
 * The seed makes DEMO_PRESENTER_EMAIL the presenter when it's set and that
 * person has signed in to the demo team; otherwise its first real member.
 * The org id defaults to DEMO_ORG_ID (apps/web/.env or .env.local, which also turns on the
 * app's "Demo data" pill). SQL runs through `supabase db query --linked`, so
 * it needs the Supabase CLI logged in and linked, and no database password.
 * The drafter uses the web app's Supabase URL and secret key.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runDrafter } from './drafter'
import { assertOrgId, resetSql, seedSql } from './sql'

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

async function main() {
  const [command, orgArg] = process.argv.slice(2)
  if (command !== 'seed' && command !== 'reset' && command !== 'drafter') {
    console.error('Usage: demo <seed|reset|drafter> [org_…]')
    process.exit(1)
  }
  const orgId = orgArg ?? process.env.DEMO_ORG_ID
  if (!orgId) {
    console.error('Set DEMO_ORG_ID in apps/web/.env or pass the demo team’s org id.')
    process.exit(1)
  }
  assertOrgId(orgId)
  if (command === 'drafter') return runDrafter(orgId)

  const dir = mkdtempSync(join(tmpdir(), 'access-demo-'))
  try {
    const file = join(dir, `${command}.sql`)
    writeFileSync(file, command === 'seed' ? seedSql(orgId, process.env.DEMO_PRESENTER_EMAIL) : resetSql(orgId))
    console.log(`${command === 'seed' ? 'Seeding' : 'Resetting'} the demo team ${orgId}…`)
    execFileSync('supabase', ['db', 'query', '--linked', '--workdir', repoRoot, '-f', file], { stdio: 'inherit' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

await main()
