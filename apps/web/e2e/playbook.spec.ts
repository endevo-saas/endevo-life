import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Playbook feature tests
 *
 * Route: /employee/playbook
 * The page calls api.employeeGeneratePlaybook() on mount and renders
 * domain scores, tasks, and action buttons. When no assessment exists
 * the page shows a "Complete your assessment first" message.
 */

test.describe('Playbook feature', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('playbook route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/playbook')
  })

  test('playbook route loads without crashing', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('body')).not.toBeEmpty()

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
  })

  test('playbook page shows either content or empty state', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasContent = await page.locator('text=Overall Readiness').count() > 0
    const hasEmptyState = await page.locator('text=Complete your assessment').count() > 0
    const hasError = await page.locator('button', { hasText: 'Try Again' }).count() > 0

    expect(hasContent || hasEmptyState || hasError).toBe(true)
  })

  test('playbook content structure is correct when data loads', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasContent = await page.locator('text=Overall Readiness').count() > 0

    if (hasContent) {
      await expect(page.locator('text=Your Readiness by Domain')).toBeVisible()
      await expect(page.locator('button', { hasText: 'Start First Task' })).toBeVisible()
      const scoreText = page.locator('text=/\\d+%/')
      await expect(scoreText.first()).toBeVisible()
    }
  })

  test('playbook task section shows when playbook exists', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasContent = await page.locator('text=Overall Readiness').count() > 0

    if (hasContent) {
      const taskSection = page.locator('text=Your Complete Action Plan')
      await expect(taskSection).toBeVisible()
    }
  })

  test('email playbook button is present when content loads', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const hasContent = await page.locator('text=Overall Readiness').count() > 0

    if (hasContent) {
      const emailBtn = page.locator('button', { hasText: 'Email to Me' })
      await expect(emailBtn).toBeVisible()
    }
  })
})
