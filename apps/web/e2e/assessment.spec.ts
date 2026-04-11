import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Assessment feature tests
 *
 * Route: /employee/assessment
 * The assessment list page renders courses from the API. Each course card
 * has a "Start Assessment" or "Retake" link routing to
 * /employee/assessment/[courseId] which hosts the 40-question diagnostic.
 *
 * Tests are resilient to API 401 responses (test token) — they validate
 * page structure and routing rather than API-dependent data values.
 */

test.describe('Assessment feature', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('assessment route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/assessment')
  })

  test('assessment list page heading is visible', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1', { hasText: 'Assessments' })).toBeVisible({ timeout: 15_000 })
  })

  test('assessment list subtitle is visible', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('p', { hasText: 'Select a course' })).toBeVisible({ timeout: 15_000 })
  })

  test('assessment list shows loading state then resolves', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })

    // After navigation the page must settle — no perpetual spinner
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // h1 must be present regardless of API response
    await expect(page.locator('h1')).toBeVisible()
  })

  test('assessment list page renders outer wrapper', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // The outer wrapper must always be present (rendered before API call)
    await expect(page.locator('h1', { hasText: 'Assessments' })).toBeVisible({ timeout: 10_000 })

    // When courses are present each card includes a link to the assessment route
    const courseLinks = page.locator('a[href*="/employee/assessment/"]')
    const count = await courseLinks.count()

    if (count > 0) {
      await expect(courseLinks.first()).toBeVisible()
      const linkText = await courseLinks.first().textContent()
      expect(['Start Assessment', 'Retake'].some(t => linkText?.includes(t))).toBe(true)
    } else {
      // Empty state or error is shown — just verify the page didn't crash
      await expect(page.locator('div.max-w-4xl')).toBeVisible()
    }
  })

  test('assessment course detail route accepts courseId param', async ({ page }) => {
    await page.goto('/employee/assessment/test-course-1', { waitUntil: 'domcontentloaded' })

    // Page must respond — not blank
    await page.waitForFunction(
      () => document.body.textContent !== '',
      { timeout: 10_000 }
    )

    // URL should be the assessment detail or redirected to login (if expired session)
    const url = page.url()
    const isExpectedRoute = url.includes('/employee/assessment') || url.includes('/login')
    expect(isExpectedRoute).toBe(true)
  })

  test('retake link format is correct when present', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const retakeLinks = page.locator('a', { hasText: 'Retake' })
    const retakeCount = await retakeLinks.count()

    if (retakeCount > 0) {
      const href = await retakeLinks.first().getAttribute('href')
      expect(href).toMatch(/\/employee\/assessment\/.+/)
    }
  })
})
