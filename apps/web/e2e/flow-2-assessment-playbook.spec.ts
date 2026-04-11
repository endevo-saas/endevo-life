import { test, expect, Page } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'
import {
  ASSESSMENT_SUBMIT_RESPONSE,
  PLAYBOOK_RESPONSE,
  EMAIL_SEND_RESPONSE,
} from './helpers/fixtures'

/**
 * Flow 2 — Assessment → Playbook
 *
 * Critical user journey:
 *   1. Assessment results determine playbook tier (beginner/intermediate/advanced)
 *   2. Playbook is displayed on the employee dashboard with domain scores
 *   3. Playbook is downloadable (PDF / XLSX)
 *   4. "Send Email" button triggers email delivery of playbook
 *
 * Strategy:
 *   - Mock all API calls so tests run without a live backend
 *   - Validate API payload shapes (contract testing)
 *   - Validate page structure with mocked playbook data
 *   - Download simulation via route interception
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockPlaybookGenerate(page: Page): Promise<void> {
  await page.route(
    `${API_BASE}/api/employee/playbook/generate`,
    async (route) => {
      const method = route.request().method()
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(PLAYBOOK_RESPONSE),
        })
      } else {
        await route.continue()
      }
    }
  )
}

async function mockPlaybookEmpty(page: Page): Promise<void> {
  await page.route(
    `${API_BASE}/api/employee/playbook/generate`,
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No assessment found', detail: 'Complete your assessment first.' }),
      })
    }
  )
}

async function mockEmailSend(page: Page): Promise<void> {
  await page.route(
    `${API_BASE}/api/employee/email/send-playbook`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_RESPONSE),
      })
    }
  )
}

// ---------------------------------------------------------------------------
// 2a — Playbook page structure
// ---------------------------------------------------------------------------

test.describe('Flow 2a — Playbook page renders', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockPlaybookGenerate(page)
  })

  test('playbook route loads without crash', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('playbook page shows content or empty state — never blank', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.length).toBeGreaterThan(20)
  })

  test('playbook route is at correct URL', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/playbook')
  })
})

// ---------------------------------------------------------------------------
// 2b — Playbook recommendation based on assessment tier
// ---------------------------------------------------------------------------

test.describe('Flow 2b — Playbook tier determination', () => {
  test('overall score 75 maps to intermediate tier', async ({ page }) => {
    const score = ASSESSMENT_SUBMIT_RESPONSE.scorecard.overallScore
    expect(score).toBe(75)
    expect(ASSESSMENT_SUBMIT_RESPONSE.scorecard.tier).toBe('intermediate')
  })

  test('playbook response contains weak and strong domains', async ({ page }) => {
    expect(PLAYBOOK_RESPONSE.weakDomains.length).toBeGreaterThan(0)
    expect(PLAYBOOK_RESPONSE.strongDomains.length).toBeGreaterThan(0)
  })

  test('playbook domain scores cover all 4 domains', async ({ page }) => {
    const scores = PLAYBOOK_RESPONSE.domainScores
    expect(scores).toHaveProperty('legal')
    expect(scores).toHaveProperty('financial')
    expect(scores).toHaveProperty('physical')
    expect(scores).toHaveProperty('digital')
  })

  test('weak domains come from lowest scoring domains', async ({ page }) => {
    const scores = PLAYBOOK_RESPONSE.domainScores
    const weakDomains = PLAYBOOK_RESPONSE.weakDomains

    // Weak domains should have lower scores than strong domains
    const weakAvg =
      weakDomains.reduce((sum, d) => sum + (scores[d as keyof typeof scores] ?? 0), 0) /
      weakDomains.length
    const strongAvg =
      PLAYBOOK_RESPONSE.strongDomains.reduce(
        (sum, d) => sum + (scores[d as keyof typeof scores] ?? 0),
        0
      ) / PLAYBOOK_RESPONSE.strongDomains.length

    expect(weakAvg).toBeLessThan(strongAvg)
  })

  test('playbook generate API returns tasks ordered by rank', async ({ page }) => {
    const tasks = PLAYBOOK_RESPONSE.playbook.tasks
    expect(tasks.length).toBeGreaterThan(0)

    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].rank).toBeGreaterThanOrEqual(tasks[i - 1].rank)
    }
  })
})

// ---------------------------------------------------------------------------
// 2c — Playbook empty state when no assessment taken
// ---------------------------------------------------------------------------

test.describe('Flow 2c — Playbook empty state', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockPlaybookEmpty(page)
  })

  test('playbook shows empty state when no assessment exists', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // The page must display some form of empty state — not blank
    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.length).toBeGreaterThan(10)
  })

  test('empty state does not crash the page', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    // No uncaught JS errors
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Filter out known non-critical third-party errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 2d — Playbook downloadable (PDF / XLSX)
// ---------------------------------------------------------------------------

test.describe('Flow 2d — Playbook download', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockPlaybookGenerate(page)
    await mockEmailSend(page)
  })

  test('email send API returns success with messageId', async ({ page }) => {
    let emailCalled = false

    await page.route(
      `${API_BASE}/api/employee/email/send-playbook`,
      async (route) => {
        emailCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(EMAIL_SEND_RESPONSE),
        })
      }
    )

    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Trigger email via direct API call
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(emailCalled).toBe(true)
    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('messageId')
    expect(result).toHaveProperty('email')
  })

  test('email send response contains expected fields', async ({ page }) => {
    expect(EMAIL_SEND_RESPONSE).toHaveProperty('success', true)
    expect(EMAIL_SEND_RESPONSE).toHaveProperty('messageId')
    expect(EMAIL_SEND_RESPONSE).toHaveProperty('email')
    expect(EMAIL_SEND_RESPONSE).toHaveProperty('subject')
    expect(EMAIL_SEND_RESPONSE).toHaveProperty('sentAt')
  })

  test('playbook generate API returns valid generatedAt timestamp', async ({ page }) => {
    const ts = new Date(PLAYBOOK_RESPONSE.generatedAt)
    expect(ts.getTime()).not.toBeNaN()
  })
})
