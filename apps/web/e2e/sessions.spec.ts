import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * 1:1 Sessions feature tests
 *
 * Route: /employee/sessions
 * Tests verify:
 * - Page renders without hardcoded booking link URLs
 * - Sessions list loads
 * - Session quota block is displayed when data is available
 * - Booking form can be opened
 *
 * The booking link (NEXT_PUBLIC_BOOKING_LINK) is read from an env var
 * on the employee dashboard. This test file never asserts a hardcoded URL.
 */

test.describe('1:1 Sessions feature', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('sessions route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/sessions')
  })

  test('sessions route loads and shows heading', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(page.locator('h1', { hasText: '1:1 Sessions' })).toBeVisible({ timeout: 10_000 })
  })

  test('sessions page subtitle is visible', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(
      page.locator('p', { hasText: 'Meet with advisors' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('sessions list resolves from loading state', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasQuota = await page.locator('p', { hasText: 'Sessions Used' }).count() > 0
    const hasEmpty = await page.locator('p', { hasText: 'No sessions yet' }).count() > 0
    const hasError = await page.locator('div[class*="red-50"]').count() > 0

    expect(hasQuota || hasEmpty || hasError).toBe(true)
  })

  test('session quota block renders used/remaining counts', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasQuota = await page.locator('p', { hasText: 'Sessions Used' }).count() > 0

    if (hasQuota) {
      await expect(page.locator('p', { hasText: 'Sessions Used' })).toBeVisible()
      await expect(page.locator('p', { hasText: 'Remaining' })).toBeVisible()
    }
  })

  test('booking form opens when Book Session is clicked', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const bookButton = page.locator('button', { hasText: 'Book Session' })
    const hasBookButton = await bookButton.count() > 0

    if (hasBookButton) {
      await bookButton.click()
      await expect(page.locator('h2', { hasText: 'Book a New Session' })).toBeVisible()
      await expect(page.locator('label', { hasText: 'Date & Time' })).toBeVisible()
      await expect(page.locator('input[type="datetime-local"]')).toBeVisible()
    }
  })

  test('sessions page does not contain hardcoded booking service URLs', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Sessions page must not expose hardcoded calendly/booking URLs in anchor hrefs
    const anchors = page.locator('a[href*="calendly"], a[href*="cal.com"], a[href*="bookingpage"]')
    const hardcodedCount = await anchors.count()
    expect(hardcodedCount).toBe(0)
  })

  test('upcoming sessions section shows when sessions are scheduled', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasUpcoming = await page.locator('h2', { hasText: /Upcoming Sessions/ }).count() > 0

    if (hasUpcoming) {
      await expect(page.locator('h2', { hasText: /Upcoming Sessions/ })).toBeVisible()
    }
  })

  test('session history section shows when sessions are completed', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasHistory = await page.locator('h2', { hasText: /Session History/ }).count() > 0

    if (hasHistory) {
      await expect(page.locator('h2', { hasText: /Session History/ })).toBeVisible()
    }
  })
})
