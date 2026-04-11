import { test, expect, type Page } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Employee Dashboard tests
 *
 * Route: /employee/dashboard
 * Validates the "Learning Tools" section containing all 5 feature links,
 * welcome header, progress section, quick actions, and achievement badges.
 *
 * Strategy: inject cookies via auth helper (which navigates to root first),
 * then navigate to the dashboard route and wait for the spinner to clear.
 * All assertions are guarded against API-failure states so tests pass in
 * CI with a sentinel token (API returns 401 but UI still renders).
 */

const LEARNING_TOOLS = [
  { label: 'Assessment', href: '/employee/lms/assessment' },
  { label: 'Playbook', href: '/employee/playbook' },
  { label: 'Checklist', href: '/employee/checklist' },
  { label: 'Master Classes', href: '/employee/master-classes' },
  { label: '1:1 Sessions', href: '/employee/sessions' },
]

async function waitForDashboardLoad(page: Page) {
  // Wait for the loading spinner to disappear (max 20s)
  await page.waitForFunction(
    () => document.querySelector('svg.animate-spin') === null,
    { timeout: 20_000 }
  )
}

test.describe('Employee Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page, { email: 'shahzad@endevo.com' })
    await page.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })
    // Wait for loading spinner to clear — handles both fast (cached) and slow (API) responses
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    ).catch(() => { /* if spinner persists past 20s, continue with current state */ })
  })

  test('dashboard page loads on correct route', async ({ page }) => {
    expect(page.url()).toContain('/employee/dashboard')
  })

  test('dashboard renders welcome header with user name', async ({ page }) => {
    // The welcome h1 is always in the DOM once dashboard is not loading
    // Try with a generous timeout since it depends on the entered animation state
    await expect(page.locator('h1', { hasText: 'Welcome back' })).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard renders todays date', async ({ page }) => {
    // Date string is shown in the header subtitle once component mounts
    const dateEl = page.locator('p').filter({ hasText: /\d{4}/ })
    await expect(dateEl.first()).toBeVisible({ timeout: 10_000 })
  })

  test('Learning Tools section heading is visible', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
  })

  test('all 5 Learning Tools feature cards are rendered', async ({ page }) => {
    // The Learning Tools grid renders regardless of API state
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })

    for (const tool of LEARNING_TOOLS) {
      const card = page.locator(`a[href="${tool.href}"]`)
      await expect(card).toBeVisible({ timeout: 8_000 })
    }
  })

  test('Assessment learning tool card links to correct route', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
    const card = page.locator('a[href="/employee/lms/assessment"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Assessment')
  })

  test('Playbook learning tool card links to correct route', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
    const card = page.locator('a[href="/employee/playbook"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Playbook')
  })

  test('Checklist learning tool card links to correct route', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
    const card = page.locator('a[href="/employee/checklist"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Checklist')
  })

  test('Master Classes learning tool card links to correct route', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
    const card = page.locator('a[href="/employee/master-classes"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Master Classes')
  })

  test('1:1 Sessions learning tool card links to correct route', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })
    const card = page.locator('a[href="/employee/sessions"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('1:1 Sessions')
  })

  test('quick actions section shows Continue Learning, Certificates, Profile links', async ({ page }) => {
    await expect(page.locator('a', { hasText: 'Continue Learning' })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('a', { hasText: 'My Certificates' })).toBeVisible()
    await expect(page.locator('a', { hasText: 'My Profile' })).toBeVisible()
  })

  test('learning progress section with module info is visible', async ({ page }) => {
    await expect(page.locator('text=Current Module')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('text=Module 1')).toBeVisible()
  })

  test('achievements section is visible', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Achievements' })).toBeVisible({ timeout: 15_000 })
  })

  test('motivational quote footer renders', async ({ page }) => {
    const quoteContainer = page.locator('text=Protecting the people you love most')
    await expect(quoteContainer).toBeVisible({ timeout: 15_000 })
  })

  test('premium booking card does not expose hardcoded booking service URLs', async ({ page }) => {
    // The booking link uses process.env.NEXT_PUBLIC_BOOKING_LINK || '#'
    // In test env (no env var), href must be '#' not a literal calendly URL
    await page.waitForSelector('[href="/employee/sessions"]', { timeout: 15_000 })

    const hardcodedLinks = page.locator('a[href*="calendly"], a[href*="cal.com"]')
    const count = await hardcodedLinks.count()
    expect(count).toBe(0)
  })

  test('refresh button is present and enabled', async ({ page }) => {
    // Wait for any content to render
    await expect(page.locator('h2', { hasText: 'Learning Tools' })).toBeVisible({ timeout: 15_000 })

    const refreshButton = page.locator('button').filter({ has: page.locator('svg') }).first()
    await expect(refreshButton).toBeVisible()
    await expect(refreshButton).not.toBeDisabled()
  })

  test('assessment area link exists on dashboard', async ({ page }) => {
    // Assessment link in Learning Tools must exist
    await expect(page.locator('a[href="/employee/lms/assessment"]')).toBeVisible({ timeout: 15_000 })
  })
})
