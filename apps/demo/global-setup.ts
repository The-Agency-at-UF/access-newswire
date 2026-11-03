import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Before recording: start the stand-in drafter, so Start release finishes on
 * screen (the sign-in step seeds the data). Returns the teardown, which stops
 * the drafter and deletes the saved sign-in.
 */
export default async function globalSetup() {
  for (const name of ['DEMO_ORG_ID', 'DEMO_USER_EMAIL', 'CLERK_SECRET_KEY']) {
    if (!process.env[name]) throw new Error(`Set ${name} in apps/web/.env`)
  }
  await clerkSetup()

  // --silent: stopping it at teardown is expected, not a failure worth printing.
  const drafter = spawn('pnpm', ['--silent', 'demo:drafter'], { cwd: '../..', stdio: 'inherit', detached: true })
  return () => {
    // The drafter runs under pnpm; stop the whole process group.
    if (drafter.pid) process.kill(-drafter.pid, 'SIGTERM')
    // The saved session is a live sign-in; don't leave it on disk.
    rmSync('.auth', { recursive: true, force: true })
  }
}
