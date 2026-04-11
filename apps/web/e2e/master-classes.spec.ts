import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Master Classes feature tests
 *
 * Route: /employee/master-classes
 * The page loads classes from three API calls in parallel (all, recommended,
 * registrations). It renders a tab bar ("For You" / "All Classes") and class
 * cards with Register buttons.
 */

test.describe('Master Classes feature', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('master classes route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/master-classes')
  })

  test('master classes route loads and shows heading', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(page.locator('h1', { hasText: 'Master Classes' })).toBeVisible({ timeout: 10_000 })
  })

  test('master classes page subtitle is visible', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(
      page.locator('p', { hasText: 'Learn from industry experts' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('tab bar renders with For You and All Classes tabs', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(page.locator('button', { hasText: /For You/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('button', { hasText: /All Classes/ })).toBeVisible()
  })

  test('switching to All Classes tab stays on same route', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await page.locator('button', { hasText: /All Classes/ }).click()

    expect(page.url()).toContain('/employee/master-classes')
    await expect(page.locator('div[class*="max-w"]')).toBeVisible()
  })

  test('class cards render with domain badges when classes exist', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasClasses = await page.locator('button', { hasText: 'Register' }).count() > 0
    const hasRegistered = await page.locator('text=Registered').count() > 0

    if (hasClasses || hasRegistered) {
      const domainBadges = page.locator('span[class*="rounded-full"][class*="text-xs"]')
      expect(await domainBadges.count()).toBeGreaterThan(0)
    }
  })

  test('empty state is shown when no classes are available', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasClasses = await page.locator('button', { hasText: 'Register' }).count() > 0
    const hasRegistered = await page.locator('text=Registered').count() > 0

    if (!hasClasses && !hasRegistered) {
      const emptyText = page.locator('p', { hasText: /No.*classes/ })
      await expect(emptyText).toBeVisible()
    }
  })
})
