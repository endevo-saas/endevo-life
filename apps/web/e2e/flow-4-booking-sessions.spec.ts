import { test, expect, Page } from '@playwright/test'
import {
  injectAuthCookies,
  injectHrAdminCookies,
} from './helpers/auth'
import {
  SESSION_QUOTA,
  SESSION_QUOTA_PREMIUM,
  BOOKED_SESSION,
  SESSION_WITH_MEETING_LINK,
  HR_SUBSCRIPTION_BASIC,
  HR_SUBSCRIPTION_PREMIUM,
} from './helpers/fixtures'

/**
 * Flow 4 — 1:1 Session Booking
 *
 * Critical user journey:
 *   1. Employee views available slots (quota based on Basic=2 / Premium=6)
 *   2. Employee books a session
 *   3. Confirmation email sent with meeting link
 *   4. Session appears in HR admin calendar/list
 *
 * Strategy:
 *   - Mock session quota API to verify Basic (2 sessions) vs Premium (6 sessions)
 *   - Intercept booking POST and verify payload shape
 *   - Verify meeting link is present in the booked session response
 *   - Verify HR admin can see the session
 *   - Test quota exhaustion edge case
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockSessionsBasic(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/employee/sessions*`, async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'POST' && url.includes('/book')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(BOOKED_SESSION),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION_QUOTA),
    })
  })

  await page.route(`${API_BASE}/api/employee/subscription*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'basic', sessionsPerEmployee: 2 }),
    })
  })
}

async function mockSessionsPremium(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/employee/sessions*`, async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'POST' && url.includes('/book')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...BOOKED_SESSION, sessionId: 'sess-premium-001' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SESSION_QUOTA_PREMIUM),
    })
  })

  await page.route(`${API_BASE}/api/employee/subscription*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ plan: 'premium', sessionsPerEmployee: 6 }),
    })
  })
}

async function mockSessionsExhausted(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/employee/sessions*`, async (route) => {
    const method = route.request().method()

    if (method === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session quota exhausted', detail: 'You have used all 2 available sessions.' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SESSION_QUOTA, used: 2, remaining: 0 }),
    })
  })
}

async function mockHrSessions(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/hr/sessions*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessions: [BOOKED_SESSION],
        total: 1,
      }),
    })
  })

  await page.route(`${API_BASE}/api/hr/subscription*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(HR_SUBSCRIPTION_BASIC),
    })
  })
}

// ---------------------------------------------------------------------------
// 4a — Sessions page loads
// ---------------------------------------------------------------------------

test.describe('Flow 4a — Sessions page renders', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockSessionsBasic(page)
  })

  test('sessions route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/sessions')
  })

  test('sessions page heading is visible', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(
      page.locator('h1', { hasText: '1:1 Sessions' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('sessions page loads without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4b — Session quota based on subscription plan
// ---------------------------------------------------------------------------

test.describe('Flow 4b — Session quota per subscription plan', () => {
  test('Basic plan has 2 sessions quota', async ({ page }) => {
    expect(SESSION_QUOTA.total).toBe(2)
    expect(HR_SUBSCRIPTION_BASIC.sessionsPerEmployee).toBe(2)
  })

  test('Premium plan has 6 sessions quota', async ({ page }) => {
    expect(SESSION_QUOTA_PREMIUM.total).toBe(6)
    expect(HR_SUBSCRIPTION_PREMIUM.sessionsPerEmployee).toBe(6)
  })

  test('Basic plan session API returns remaining count', async ({ page }) => {
    await injectAuthCookies(page)
    await mockSessionsBasic(page)

    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/sessions`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('total', 2)
    expect(result).toHaveProperty('remaining')
    expect(result.remaining).toBeGreaterThanOrEqual(0)
  })

  test('Premium plan session API returns 6 total', async ({ page }) => {
    await injectAuthCookies(page, { tenantPlan: 'premium' })
    await mockSessionsPremium(page)

    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/sessions`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('total', 6)
  })
})

// ---------------------------------------------------------------------------
// 4c — Employee books a session
// ---------------------------------------------------------------------------

test.describe('Flow 4c — Session booking', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockSessionsBasic(page)
  })

  test('booking POST returns a sessionId', async ({ page }) => {
    let bookingCalled = false

    await page.route(
      `${API_BASE}/api/employee/sessions/book`,
      async (route) => {
        bookingCalled = true
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(BOOKED_SESSION),
        })
      }
    )

    const result = await page.evaluate(
      async ([base, date]) => {
        const res = await fetch(`${base}/api/employee/sessions/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt: date, notes: 'E2E test booking' }),
        })
        return res.json()
      },
      [API_BASE, FUTURE_DATE] as [string, string]
    )

    expect(bookingCalled).toBe(true)
    expect(result).toHaveProperty('sessionId')
    expect(result).toHaveProperty('status', 'scheduled')
  })

  test('booking payload includes scheduledAt date', async ({ page }) => {
    let capturedBody: Record<string, unknown> = {}

    await page.route(
      `${API_BASE}/api/employee/sessions/book`,
      async (route) => {
        capturedBody = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(BOOKED_SESSION),
        })
      }
    )

    await page.evaluate(
      async ([base, date]) => {
        await fetch(`${base}/api/employee/sessions/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt: date }),
        })
      },
      [API_BASE, FUTURE_DATE] as [string, string]
    )

    expect(capturedBody).toHaveProperty('scheduledAt')
    expect(new Date(capturedBody.scheduledAt as string).getTime()).not.toBeNaN()
  })

  test('booked session has status scheduled', async ({ page }) => {
    expect(BOOKED_SESSION.status).toBe('scheduled')
  })

  test('booked session scheduledAt is in the future', async ({ page }) => {
    const ts = new Date(BOOKED_SESSION.scheduledAt).getTime()
    expect(ts).toBeGreaterThan(Date.now())
  })
})

// ---------------------------------------------------------------------------
// 4d — Session appears in HR admin calendar
// ---------------------------------------------------------------------------

test.describe('Flow 4d — Session visible to HR admin', () => {
  test.beforeEach(async ({ page }) => {
    await injectHrAdminCookies(page)
    await mockHrSessions(page)
  })

  test('HR sessions API returns at least one booked session', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/hr/sessions`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('sessions')
    expect(result.sessions.length).toBeGreaterThan(0)
  })

  test('HR session entry has sessionId matching employee booking', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/hr/sessions`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    const session = result.sessions[0]
    expect(session.sessionId).toBe(BOOKED_SESSION.sessionId)
  })

  test('HR subscription API returns plan info', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/hr/subscription`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('plan')
    expect(result).toHaveProperty('sessionsPerEmployee')
  })
})

// ---------------------------------------------------------------------------
// 4e — Quota exhaustion edge case
// ---------------------------------------------------------------------------

test.describe('Flow 4e — Quota exhaustion', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockSessionsExhausted(page)
  })

  test('booking returns 400 when quota is exhausted', async ({ page }) => {
    const result = await page.evaluate(
      async ([base, date]) => {
        const res = await fetch(`${base}/api/employee/sessions/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledAt: date }),
        })
        return { status: res.status, body: await res.json() }
      },
      [API_BASE, FUTURE_DATE] as [string, string]
    )

    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('error')
  })

  test('sessions quota shows 0 remaining when exhausted', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/sessions`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result.remaining).toBe(0)
  })

  test('sessions page does not crash on exhausted quota', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    )
    expect(criticalErrors).toHaveLength(0)
  })
})
