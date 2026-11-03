import { clerk } from '@clerk/testing/playwright'
import { expect, test as setup } from '@playwright/test'
import { AUTH_FILE } from './playwright.config'

/** Sign in as the demo user with the demo team active, outside the recording. */
setup('sign in to the demo team', async ({ page }) => {
  await page.goto('/sign-in')
  await clerk.signIn({ page, emailAddress: process.env.DEMO_USER_EMAIL! })
  await page.evaluate((organization) => window.Clerk.setActive({ organization }), process.env.DEMO_ORG_ID!)
  await page.goto('/inbox')
  await expect(page.getByText('Demo data')).toBeVisible()
  await page.context().storageState({ path: AUTH_FILE })
})
