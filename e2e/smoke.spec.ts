import { test, expect } from '@playwright/test'

/**
 * Sprint 5 smoke: five chromium tests covering the exact bug classes
 * that generated hotfix rounds in Sprints 3-4 — bell nav-distortion,
 * z-index stacking, /me page load, cancel two-click confirm, FM
 * activity page render. Auth is minted via Supabase service role in
 * e2e/global-setup.ts, so tests run against an onboarded test FM
 * (`test-fm@dopl.test`) without any manual credential plumbing.
 */

// 1. FM bell renders without shifting nav layout.
// The bell is mounted twice in the chrome — desktop top-right + mobile
// bottom-nav 5th slot — so both elements live in the DOM at all viewports
// (CSS gates visibility via `md:` classes, not conditional render).
// `.first()` pins the test to the desktop instance, matching the 1280×720
// default Playwright viewport where only that one is visible.
test('FM bell click opens dropdown without shifting nav', async ({ page }) => {
  await page.goto('/dashboard')
  const nav = page.locator('nav').first()
  await expect(nav).toBeVisible()
  const navBefore = await nav.boundingBox()

  await page.locator('[data-testid="fm-bell"]').first().click()
  await expect(
    page.locator('[data-testid="fm-bell-dropdown"]').first()
  ).toBeVisible()

  const navAfter = await nav.boundingBox()
  expect(navAfter!.width).toBeCloseTo(navBefore!.width, 0)
  expect(navAfter!.height).toBeCloseTo(navBefore!.height, 0)
})

// 2. Bell dropdown z-index sits below popup overlay (z-80)
test('bell dropdown z-index stays below popup overlay', async ({ page }) => {
  await page.goto('/dashboard')
  await page.locator('[data-testid="fm-bell"]').first().click()
  const dropdown = page
    .locator('[data-testid="fm-bell-dropdown"]')
    .first()
  await expect(dropdown).toBeVisible()
  const dropdownZ = await dropdown.evaluate((el) =>
    parseInt(getComputedStyle(el).zIndex || '0', 10)
  )
  expect(dropdownZ).toBeLessThanOrEqual(70)
})

// 3. /me loads for authed user (not a blank page or redirect loop)
test('/me loads subscription list or empty state', async ({ page }) => {
  await page.goto('/me')
  await expect(
    page.locator('text=/subscriptions|not dopling anyone/i').first()
  ).toBeVisible({ timeout: 10_000 })
})

// 4. Cancel button two-click confirm pattern works when a sub is visible
test('cancel button requires confirmation click', async ({ page }) => {
  await page.goto('/me')
  const cancelBtn = page.locator('[data-testid="cancel-subscription"]').first()
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click()
    await expect(cancelBtn).toContainText(/confirm/i)
    // Do NOT actually confirm — verifying the 2-step pattern is enough.
  }
})

// 5. /fund-manager/activity loads without error
test('FM activity page renders', async ({ page }) => {
  await page.goto('/fund-manager/activity')
  await expect(
    page.locator('text=/activity|nothing yet/i').first()
  ).toBeVisible({ timeout: 10_000 })
})
