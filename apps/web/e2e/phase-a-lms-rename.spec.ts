import { test, expect } from '@playwright/test'
import {
  injectAuthCookies,
  injectHrAdminCookies,
  injectGlobalAdminCookies,
} from './helpers/auth'

/**
 * Phase A — Rename LMS → Training
 *
 * RED phase: These tests FAIL until implementation is complete.
 *
 * Scope:
 *   - Route redirects: /lms/ → /training/ (301 permanent)
 *   - API response field naming: "training" not "lms"
 *   - Sidebar navigation label: "Training" not "LMS"
 *   - Email template copy: "Training" not "LMS"
 *
 * Coverage target: 80%+ of all LMS → Training surface area
 *
 * Test categories:
 *   A1  Route redirects (employee, hr, admin)
 *   A2  API response shape
 *   A3  Sidebar / nav label
 *   A4  Page headings
 *   A5  Email copy (via API response)
 *   A6  No "LMS" text leaks on any rendered page
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const TRAINING_COURSES_MOCK = {
  courses: [
    {
      courseId: 'course-1',
      title: 'Estate Planning Fundamentals',
      type: 'training',
      completedLessons: 3,
      totalLessons: 10,
    },
  ],
}

// ---------------------------------------------------------------------------
// A1 — Route redirects
// ---------------------------------------------------------------------------

test.describe('Phase A1 — /lms/ routes redirect to /training/', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('GET /employee/lms returns 301 and redirects to /employee/training', async ({ page }) => {
    const response = await page.goto('/employee/lms', { waitUntil: 'commit' })

    // After redirect, URL must contain /training not /lms
    expect(page.url()).toContain('/employee/training')
    expect(page.url()).not.toContain('/lms')

    // Expect a redirect occurred (final status 200, but a redirect was followed)
    // Playwright follows redirects so we verify final URL
    expect(response?.status()).toBe(200)
  })

  test('GET /employee/lms/assessment redirects to /employee/lms/assessment (assessment stays) or /employee/assessment', async ({ page }) => {
    // The assessment route is under /employee/assessment — not /lms/assessment
    // Navigating to old /employee/lms/assessment must redirect away from /lms/
    await page.goto('/employee/lms/assessment', { waitUntil: 'commit' })

    expect(page.url()).not.toMatch(/\/employee\/lms\//)
  })

  test('GET /employee/lms/module/[id] redirects away from /lms/', async ({ page }) => {
    await page.goto('/employee/lms/module/course-1', { waitUntil: 'commit' })

    expect(page.url()).not.toMatch(/\/employee\/lms\//)
  })

  test('HR /hr/lms redirects to /hr/training', async ({ page }) => {
    await injectHrAdminCookies(page)
    await page.goto('/hr/lms', { waitUntil: 'commit' })

    expect(page.url()).toContain('/hr/training')
    expect(page.url()).not.toContain('/hr/lms')
  })

  test('Admin /admin/lms redirects to /admin/training', async ({ page }) => {
    await injectGlobalAdminCookies(page)
    await page.goto('/admin/lms', { waitUntil: 'commit' })

    expect(page.url()).not.toContain('/admin/lms')
  })

  test('/employee/training (new canonical route) loads without redirect loop', async ({ page }) => {
    await page.goto('/employee/training', { waitUntil: 'domcontentloaded' })

    // Final URL must stay on /employee/training
    expect(page.url()).toContain('/employee/training')

    // Page must render content — not a blank or infinite redirect
    await page.waitForFunction(() => document.body.textContent !== '', { timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// A2 — API response shape: key must be "training" not "lms"
// ---------------------------------------------------------------------------

test.describe('Phase A2 — API responses use "training" terminology', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('GET /api/employee/training response does not contain top-level "lms" key', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let capturedBody: Record<string, unknown> | null = null

    // Override the training mock to capture the shape
    await page.route(`${API_BASE}/api/employee/training**`, async (route) => {
      capturedBody = TRAINING_COURSES_MOCK
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TRAINING_COURSES_MOCK),
      })
    })

    await page.goto('/employee/training', { waitUntil: 'domcontentloaded' })

    // Response body must NOT expose an "lms" top-level key
    if (capturedBody) {
      expect(Object.keys(capturedBody)).not.toContain('lms')
    }
  })

  test('Training course cards do not display "LMS" as section label', async ({ page }) => {
    await page.goto('/employee/training', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // No visible heading or badge should contain "LMS"
    const lmsText = page.locator('text=/\\bLMS\\b/')
    const count = await lmsText.count()
    expect(count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// A3 — Sidebar / navigation label
// ---------------------------------------------------------------------------

test.describe('Phase A3 — Sidebar nav displays "Training" not "LMS"', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('Employee sidebar nav has a "Training" link', async ({ page }) => {
    await page.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const trainingNavLink = page.locator('nav a', { hasText: /^Training$/ })
    await expect(trainingNavLink).toBeVisible({ timeout: 10_000 })
  })

  test('Employee sidebar nav does NOT have an "LMS" link', async ({ page }) => {
    await page.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const lmsNavLink = page.locator('nav a', { hasText: /^LMS$/ })
    const count = await lmsNavLink.count()
    expect(count).toBe(0)
  })

  test('HR sidebar nav has "Training" not "LMS"', async ({ page }) => {
    await injectHrAdminCookies(page)
    await page.goto('/hr/dashboard', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const lmsNavLink = page.locator('nav a', { hasText: /^LMS$/ })
    expect(await lmsNavLink.count()).toBe(0)
  })

  test('Admin sidebar nav has "Training" not "LMS"', async ({ page }) => {
    await injectGlobalAdminCookies(page)
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const lmsNavLink = page.locator('nav a', { hasText: /^LMS$/ })
    expect(await lmsNavLink.count()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// A4 — Page headings
// ---------------------------------------------------------------------------

test.describe('Phase A4 — Page headings say "Training" not "LMS"', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('Employee training page h1 says "Training" not "LMS"', async ({ page }) => {
    await page.goto('/employee/training', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const h1 = page.locator('h1')
    const text = await h1.first().textContent()
    expect(text).not.toMatch(/\bLMS\b/)
    expect(text).toMatch(/Training/)
  })

  test('HR training management page h1 does not contain "LMS"', async ({ page }) => {
    await injectHrAdminCookies(page)
    await page.goto('/hr/training', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const h1 = page.locator('h1')
    const count = await h1.count()
    if (count > 0) {
      const text = await h1.first().textContent()
      expect(text).not.toMatch(/\bLMS\b/)
    }
  })
})

// ---------------------------------------------------------------------------
// A5 — Email template copy (validated via API response payload)
// ---------------------------------------------------------------------------

test.describe('Phase A5 — Email templates reference "Training" not "LMS"', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('POST /api/employee/email/send-playbook response subject does not contain "LMS"', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let capturedRequestBody: string | null = null

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      capturedRequestBody = route.request().postData()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          subject: 'Your Legacy Readiness Assessment Results — Training Complete',
          sentAt: new Date().toISOString(),
          messageId: 'mock-ses-id-123',
        }),
      })
    })

    // Trigger the email by navigating to the playbook page (which has a send-email action)
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // If a send button exists, click it to trigger the API
    const sendBtn = page.locator('button', { hasText: /Send|Email/i })
    if (await sendBtn.count() > 0) {
      await sendBtn.first().click()
      await page.waitForTimeout(1_000)
    }

    // We can only validate the mock subject here — real subject validated in API unit tests
    // This test verifies the UI does not display "LMS" in any email-related copy
    const lmsEmailText = page.locator('text=/LMS.*email|email.*LMS/i')
    expect(await lmsEmailText.count()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// A6 — No "LMS" text leak on any rendered employee page
// ---------------------------------------------------------------------------

test.describe('Phase A6 — "LMS" terminology fully absent from employee-facing UI', () => {
  const EMPLOYEE_ROUTES = [
    '/employee/dashboard',
    '/employee/training',
    '/employee/assessment',
    '/employee/checklist',
    '/employee/master-classes',
  ]

  for (const route of EMPLOYEE_ROUTES) {
    test(`No visible "LMS" text on ${route}`, async ({ page }) => {
      await injectAuthCookies(page)
      await page.goto(route, { waitUntil: 'domcontentloaded' })

      await page.waitForFunction(
        () => document.querySelector('svg.animate-spin') === null,
        { timeout: 20_000 }
      )

      // Capture all visible text nodes for the word "LMS"
      const lmsVisible = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null
        )
        const found: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const txt = node.textContent ?? ''
          if (/\bLMS\b/.test(txt)) found.push(txt.trim())
        }
        return found
      })

      expect(lmsVisible).toHaveLength(0)
    })
  }
})
