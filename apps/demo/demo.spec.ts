import { mkdirSync } from 'node:fs'
import { setupClerkTestingToken } from '@clerk/testing/playwright'
import { expect, test } from '@playwright/test'
import { caption, click, glide, installOverlay, type } from './overlay'

const VIDEO = 'out/access-pr-demo.webm'

/**
 * The demo walkthrough, recorded to out/access-pr-demo.webm:
 * inbox triage → Start release → edit → review and approve → onboarding
 * progress → an L2 edit → document search. Runs against freshly seeded demo
 * data.
 */
test('ACCESS PR Bot walkthrough', async ({ page }) => {
  await setupClerkTestingToken({ page })
  await installOverlay(page)

  // Inbox
  await page.goto('/inbox')
  const folders = page.getByRole('navigation', { name: 'Folders' })
  await expect(folders).toBeVisible()
  await caption(page, 'Everything arrives in one shared inbox. The app labels each email and routes it to the client’s owner.', 5000)
  await caption(page, 'Whoever is on inbox duty starts in Unmatched: the mail the app wasn’t sure about.', 4000)

  await click(page, page.getByRole('link', { name: /Partnership announcement draft/ }))
  await expect(page.getByRole('heading', { name: 'Partnership announcement draft' })).toBeVisible()
  await caption(page, 'A new address that looks like Lumen Solar. The app’s guess was below the confidence bar, so a person decides.', 5000)
  const client = page.getByRole('combobox', { name: 'Client' })
  await glide(page, client)
  await client.selectOption({ label: 'Lumen Solar' })
  await click(page, page.getByRole('button', { name: 'Save', exact: true }))
  await expect(page.getByRole('status')).toContainText('route this way next time')
  await caption(page, 'Fixed once. Next time this sender goes straight to Lumen’s owner.', 4000)

  // Start release
  await click(page, folders.getByRole('link', { name: /^Release info/ }))
  await click(page, page.getByRole('link', { name: /New product line/ }))
  const start = page.getByRole('button', { name: 'Start release' })
  await expect(start).toBeVisible()
  await caption(page, 'A release request from Tidewater Foods. The title and due date are filled in from the email.', 5000)
  await click(page, start)
  await page.waitForURL(/\/releases$/)
  await caption(page, 'The release is created and a first draft is queued. Progress shows live on the right.', 4000)

  const headline = page.getByRole('heading', { name: /Tidewater Foods Brings/ })
  try {
    await expect(headline).toBeVisible({ timeout: 75_000 })
  } catch {
    await page.reload()
    await expect(headline).toBeVisible({ timeout: 30_000 })
  }
  await glide(page, headline)
  await caption(page, 'The draft is labelled AI DRAFT until a person edits or approves it.', 4500)

  // Edit
  await click(page, page.getByRole('button', { name: 'Edit draft' }))
  const availability = page.getByRole('textbox', { name: 'Availability text' })
  await click(page, availability)
  await availability.press('ControlOrMeta+End')
  await availability.pressSequentially(' Online orders open December 1.', { delay: 35 })
  await click(page, page.getByRole('button', { name: 'Save version' }))
  await expect(page.getByText('v2 · Edited')).toBeVisible()
  const title = page.getByRole('heading', { name: 'Tidewater Foods launches three plant-based seafood products' })
  await glide(page, title)
  await caption(page, 'Every save is a new version. Nothing is overwritten, and the AI label comes off.', 4500)

  // Review and approve
  await type(page, page.getByRole('textbox', { name: 'Note for the reviewer' }), 'Ready for Hannah to sign off.')
  await click(page, page.getByRole('button', { name: 'Send for review' }))
  const approve = page.getByRole('button', { name: 'Approve' })
  await expect(approve).toBeVisible()
  await caption(page, 'Sent for review. Any team member can approve it or ask for changes.', 4000)
  await type(page, page.getByRole('textbox', { name: 'Comment' }), 'Client approved by email.')
  await click(page, approve)
  await expect(page.getByText(/is approved\. Media lists read this version/)).toBeVisible()
  await glide(page, title)
  await caption(page, 'Approved. Media lists and exports only ever read the approved version.', 5000)

  // An L2 client's own draft
  await click(page, page.getByRole('link', { name: 'Clients', exact: true }).first())
  await click(page, page.getByRole('button', { name: 'All', exact: true }))
  await expect(page.getByRole('link', { name: /Northwind Analytics/ })).toBeVisible()
  await caption(page, 'Every client, with its tier, owner and where it is in the pipeline.', 4500)

  // A client mid-onboarding
  await click(page, page.getByRole('link', { name: /Oakridge Dental Group/ }))
  const onboarding = page.getByRole('list', { name: 'Onboarding stages' })
  await expect(onboarding).toBeVisible()
  await glide(page, onboarding)
  await caption(page, 'Oakridge Dental is mid-onboarding: research is approved, the deck is waiting for review, and Meeting 1 is booked.', 5500)
  await caption(page, 'Each stage opens only once the one before it is approved, and the database enforces it.', 4500)
  await glide(page, page.getByText('Client profile'))
  await caption(page, 'The overview keeps the profile, the latest mail and background work on one page.', 4500)

  await click(page, page.getByRole('link', { name: 'Clients', exact: true }).first())
  await click(page, page.getByRole('link', { name: /Northwind Analytics/ }))
  await click(page, page.getByRole('link', { name: 'Press Releases' }))
  await expect(page.getByRole('button', { name: 'Review suggestions' })).toBeVisible()
  await caption(page, 'Level 2 clients write their own release. The app suggests edits, each with a reason.', 5000)
  await click(page, page.getByRole('button', { name: 'Review suggestions' }))
  await click(page, page.getByRole('checkbox', { name: 'Keep this suggestion' }).nth(2))
  await caption(page, 'Keep the suggestions you agree with, reword them, or drop them.', 4000)
  await click(page, page.getByRole('button', { name: 'Save version' }))
  await expect(page.getByText('v2 · Edited')).toBeVisible()
  await caption(page, 'The kept suggestions export to Word as tracked changes for the client.', 4500)

  // Documents
  await click(page, page.getByRole('link', { name: 'Docs', exact: true }))
  await type(page, page.getByPlaceholder(/Series B/), 'pilot')
  await click(page, page.getByRole('button', { name: 'Search' }))
  await expect(page.getByText(/Median time to detect/)).toBeVisible()
  await caption(page, 'Each client’s documents are indexed, so the facts are a search away.', 5000)
  await caption(page, 'The app drafts, organizes and exports. People review, approve and send.', 5500)

  mkdirSync('out', { recursive: true })
  await page.close()
  await page.video()?.saveAs(VIDEO)
})
