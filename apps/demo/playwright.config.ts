import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

/**
 * Records the demo video: `pnpm demo:video` from the repo root.
 *
 * Reads apps/web/.env (or .env.local): the Clerk keys, DEMO_ORG_ID (the demo
 * team) and DEMO_USER_EMAIL (who to sign in as, a member of that team). The
 * app is served from a production build on port 3100.
 */
for (const file of ['../web/.env', '../web/.env.local']) if (existsSync(file)) process.loadEnvFile(file)
process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

export const AUTH_FILE = '.auth/session.json'
const SIZE = { width: 1440, height: 900 }

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  timeout: 6 * 60_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3100', viewport: SIZE },
  projects: [
    { name: 'sign-in', testMatch: /auth\.setup\.ts/ },
    {
      name: 'demo',
      testMatch: /demo\.spec\.ts/,
      dependencies: ['sign-in'],
      use: { storageState: AUTH_FILE, video: { mode: 'on', size: SIZE } },
    },
  ],
  webServer: {
    command: 'pnpm --filter @access/web exec next start -p 3100',
    cwd: '../..',
    url: 'http://localhost:3100/sign-in',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
