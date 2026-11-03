import { spawnSync } from 'node:child_process'
import { clerk } from '@clerk/testing/playwright'
import { expect, test as setup } from '@playwright/test'
import { AUTH_FILE } from './playwright.config'

/**
 * Sign in as the demo user with the demo team active, outside the recording,
 * then reset the demo team to fresh data with that user as the presenter. The
 * first page load registers them as a member, so the seed can find them.
 */
setup('sign in to the demo team', async ({ page }) => {
  setup.setTimeout(3 * 60_000)
  const email = process.env.DEMO_USER_EMAIL!
  await page.goto('/sign-in')
  await clerk.signIn({ page, emailAddress: email })
  await page.evaluate((organization) => window.Clerk.setActive({ organization }), process.env.DEMO_ORG_ID!)
  await page.goto('/inbox')
  await expect(page.getByText('Demo data')).toBeVisible()

  const seed = spawnSync('pnpm', ['demo:seed'], {
    cwd: '../..',
    stdio: 'inherit',
    env: { ...process.env, DEMO_PRESENTER_EMAIL: email },
  })
  expect(seed.status, 'pnpm demo:seed').toBe(0)

  await page.context().storageState({ path: AUTH_FILE })
})
