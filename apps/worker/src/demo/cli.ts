/**
 * Seed or wipe the demo team on the linked Supabase project.
 *
 *   pnpm demo:seed [org_…]    replace the demo team's data with fresh demo data
 *   pnpm demo:reset [org_…]   delete the demo team's data
 *
 * The org id defaults to DEMO_ORG_ID (apps/web/.env or .env.local, which also turns on the
 * app's "Demo data" pill). SQL runs through `supabase db query --linked`, so
 * it needs the Supabase CLI logged in and linked, and no database password.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertOrgId, resetSql, seedSql } from './sql'

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))

function main() {
  const [command, orgArg] = process.argv.slice(2)
  if (command !== 'seed' && command !== 'reset') {
    console.error('Usage: demo <seed|reset> [org_…]')
    process.exit(1)
  }
  const orgId = orgArg ?? process.env.DEMO_ORG_ID
  if (!orgId) {
    console.error('Set DEMO_ORG_ID in apps/web/.env or pass the demo team’s org id.')
    process.exit(1)
  }
  assertOrgId(orgId)

  const dir = mkdtempSync(join(tmpdir(), 'access-demo-'))
  try {
    const file = join(dir, `${command}.sql`)
    writeFileSync(file, command === 'seed' ? seedSql(orgId) : resetSql(orgId))
    console.log(`${command === 'seed' ? 'Seeding' : 'Resetting'} the demo team ${orgId}…`)
    execFileSync('supabase', ['db', 'query', '--linked', '--workdir', repoRoot, '-f', file], { stdio: 'inherit' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

main()
