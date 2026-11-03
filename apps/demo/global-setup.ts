import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Before recording: reset the demo team to fresh data and start the stand-in
 * drafter, so Start release finishes on screen. Returns the teardown, which
 * stops the drafter and deletes the saved sign-in.
 */
export default async function globalSetup() {
  for (const name of ['DEMO_ORG_ID', 'DEMO_USER_EMAIL', 'CLERK_SECRET_KEY']) {
    if (!process.env[name]) throw new Error(`Set ${name} in apps/web/.env`)
  }
  await clerkSetup()

  const seed = spawnSync('pnpm', ['demo:seed'], { cwd: '../..', stdio: 'inherit' })
  if (seed.status !== 0) throw new Error('pnpm demo:seed failed')

  const drafter = spawn('pnpm', ['demo:drafter'], { cwd: '../..', stdio: 'inherit', detached: true })
  return () => {
    // The drafter runs under pnpm; stop the whole process group.
    if (drafter.pid) process.kill(-drafter.pid, 'SIGTERM')
    // The saved session is a live sign-in; don't leave it on disk.
    rmSync('.auth', { recursive: true, force: true })
  }
}
