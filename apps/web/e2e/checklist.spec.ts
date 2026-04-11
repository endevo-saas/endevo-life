import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Checklist feature tests
 *
 * Route: /employee/checklist
 * The page calls api.employeeGetChecklist() on mount and renders tasks
 * grouped by domain with per-domain and overall progress bars.
 */

test.describe('Checklist feature', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('checklist route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/checklist')
  })

  test('checklist route loads and shows heading', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(page.locator('h1', { hasText: 'Legacy Planning Checklist' })).toBeVisible({ timeout: 10_000 })
  })

  test('checklist page subtitle is visible', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(
      page.locator('p', { hasText: 'Track your progress' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('checklist page resolves after loading', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasTasks = await page.locator('text=Tasks to Complete').count() > 0
    const hasEmpty = await page.locator('text=No tasks in your checklist yet').count() > 0
    const hasError = await page.locator('div[class*="red-50"]').count() > 0

    // Page must show one of the three valid resolved states
    expect(hasTasks || hasEmpty || hasError).toBe(true)
  })

  test('progress section renders when tasks exist', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasTasks = await page.locator('text=Tasks to Complete').count() > 0

    if (hasTasks) {
      await expect(page.locator('h3', { hasText: 'Overall' })).toBeVisible()
      await expect(page.locator('text=/\\d+%/').first()).toBeVisible()
    }
  })

  test('pending tasks section renders task cards with complete button', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasPendingSection = await page.locator('h2', { hasText: 'Tasks to Complete' }).count() > 0

    if (hasPendingSection) {
      const completeButtons = page.locator('button', { hasText: 'Complete' })
      const count = await completeButtons.count()
      expect(count).toBeGreaterThan(0)
    }
  })

  test('completed tasks section shows when tasks exist', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasCompleted = await page.locator('h2', { hasText: 'Completed Tasks' }).count() > 0

    if (hasCompleted) {
      const completedItems = page.locator('div[class*="green-50"]')
      expect(await completedItems.count()).toBeGreaterThan(0)
    }
  })

  test('domain progress bars are visible when tasks exist', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasTasks = await page.locator('text=Tasks to Complete').count() > 0

    if (hasTasks) {
      const progressBars = page.locator('div.rounded-full')
      expect(await progressBars.count()).toBeGreaterThan(0)
    }
  })
})
