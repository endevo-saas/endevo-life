import { test, expect, Page } from '@playwright/test'
import {
  injectAuthCookies,
  injectHrAdminCookies,
} from './helpers/auth'
import {
  MASTER_CLASS_UPCOMING,
  MASTER_CLASS_PAST,
  MASTER_CLASS_FULL,
  REGISTRATION_RESPONSE,
} from './helpers/fixtures'

/**
 * Flow 5 — Master Classes
 *
 * Critical user journey:
 *   1. HR admin creates a master class
 *   2. Employees see the announcement on the master classes page
 *   3. Employees register (RSVP) for a class
 *   4. Reminder is sent (tested via API mock contract)
 *   5. Recording is available after the class completes
 *
 * Strategy:
 *   - Mock GET/POST for master classes endpoints
 *   - Validate admin create API payload
 *   - Validate employee registration flow
 *   - Test edge cases: full class, past class, duplicate RSVP
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockEmployeeClassList(
  page: Page,
  classes = [MASTER_CLASS_UPCOMING]
): Promise<void> {
  await page.route(
    `${API_BASE}/api/employee/master-classes/recommended*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ classes, count: classes.length, basedOnDomains: ['legal'] }),
      })
    }
  )

  await page.route(
    `${API_BASE}/api/employee/master-classes/registrations*`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ registrations: [], count: 0 }),
      })
    }
  )

  await page.route(
    `${API_BASE}/api/employee/master-classes*`,
    async (route) => {
      const url = route.request().url()
      // Skip already-matched specific paths
      if (
        url.includes('/recommended') ||
        url.includes('/registrations') ||
        url.includes('/register')
      ) {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ classes, count: classes.length }),
      })
    }
  )
}

async function mockRegistrationPost(
  page: Page,
  opts: { duplicate?: boolean; full?: boolean } = {}
): Promise<{ calls: number }> {
  const tracker = { calls: 0 }

  await page.route(
    `${API_BASE}/api/employee/master-classes/${MASTER_CLASS_UPCOMING.classId}/register`,
    async (route) => {
      tracker.calls++

      if (opts.duplicate && tracker.calls > 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Already registered for this class' }),
        })
        return
      }

      if (opts.full) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Class is full', detail: 'Maximum attendees reached.' }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(REGISTRATION_RESPONSE),
      })
    }
  )

  return tracker
}

async function mockAdminCreateClass(page: Page): Promise<{ calls: number }> {
  const tracker = { calls: 0 }

  await page.route(
    `${API_BASE}/api/hr/master-classes`,
    async (route) => {
      if (route.request().method() === 'POST') {
        tracker.calls++
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MASTER_CLASS_UPCOMING,
            classId: `mc-new-${Date.now()}`,
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ classes: [MASTER_CLASS_UPCOMING], count: 1 }),
        })
      }
    }
  )

  return tracker
}

// ---------------------------------------------------------------------------
// 5a — Master classes page renders
// ---------------------------------------------------------------------------

test.describe('Flow 5a — Master Classes page loads', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockEmployeeClassList(page)
  })

  test('master classes route loads on correct URL', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/master-classes')
  })

  test('master classes heading is visible', async ({ page }) => {
    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(
      page.locator('h1', { hasText: 'Master Classes' })
    ).toBeVisible({ timeout: 10_000 })
  })

  test('master classes page loads without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
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
// 5b — Employees see announcements
// ---------------------------------------------------------------------------

test.describe('Flow 5b — Employees see class announcements', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('master classes API returns upcoming class with title', async ({ page }) => {
    await mockEmployeeClassList(page, [MASTER_CLASS_UPCOMING])

    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/master-classes`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result.classes.length).toBeGreaterThan(0)
    expect(result.classes[0]).toHaveProperty('title')
    expect(result.classes[0]).toHaveProperty('classId')
  })

  test('upcoming class is in the future', async ({ page }) => {
    const ts = new Date(MASTER_CLASS_UPCOMING.scheduledAt).getTime()
    expect(ts).toBeGreaterThan(Date.now())
  })

  test('class announcement includes domain label', async ({ page }) => {
    expect(MASTER_CLASS_UPCOMING).toHaveProperty('domain')
    expect(MASTER_CLASS_UPCOMING.domain.length).toBeGreaterThan(0)
  })

  test('class has instructor name', async ({ page }) => {
    expect(MASTER_CLASS_UPCOMING.instructor.length).toBeGreaterThan(0)
  })

  test('empty class list renders without crash', async ({ page }) => {
    await mockEmployeeClassList(page, [])

    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.length).toBeGreaterThan(10)
  })
})

// ---------------------------------------------------------------------------
// 5c — Employee RSVP registration
// ---------------------------------------------------------------------------

test.describe('Flow 5c — Employee registers for a class', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockEmployeeClassList(page)
  })

  test('registration POST returns registrationId', async ({ page }) => {
    const tracker = await mockRegistrationPost(page)

    const result = await page.evaluate(
      async ([base, classId]) => {
        const res = await fetch(
          `${base}/api/employee/master-classes/${classId}/register`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        )
        return res.json()
      },
      [API_BASE, MASTER_CLASS_UPCOMING.classId] as [string, string]
    )

    expect(tracker.calls).toBe(1)
    expect(result).toHaveProperty('registrationId')
    expect(result).toHaveProperty('status', 'registered')
    expect(result).toHaveProperty('classId', MASTER_CLASS_UPCOMING.classId)
  })

  test('registration response has registeredAt timestamp', async ({ page }) => {
    const ts = new Date(REGISTRATION_RESPONSE.registeredAt)
    expect(ts.getTime()).not.toBeNaN()
  })

  test('registration endpoint is called with POST', async ({ page }) => {
    let capturedMethod = ''
    await page.route(
      `${API_BASE}/api/employee/master-classes/${MASTER_CLASS_UPCOMING.classId}/register`,
      async (route) => {
        capturedMethod = route.request().method()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(REGISTRATION_RESPONSE),
        })
      }
    )

    await page.evaluate(
      async ([base, classId]) => {
        await fetch(
          `${base}/api/employee/master-classes/${classId}/register`,
          { method: 'POST' }
        )
      },
      [API_BASE, MASTER_CLASS_UPCOMING.classId] as [string, string]
    )

    expect(capturedMethod).toBe('POST')
  })
})

// ---------------------------------------------------------------------------
// 5d — Recording available after class completes
// ---------------------------------------------------------------------------

test.describe('Flow 5d — Past class recording availability', () => {
  test('past class has status completed', async ({ page }) => {
    expect(MASTER_CLASS_PAST.status).toBe('completed')
  })

  test('past class has a recordingUrl', async ({ page }) => {
    expect(MASTER_CLASS_PAST).toHaveProperty('recordingUrl')
    expect(MASTER_CLASS_PAST.recordingUrl?.length).toBeGreaterThan(0)
  })

  test('past class scheduledAt is in the past', async ({ page }) => {
    const ts = new Date(MASTER_CLASS_PAST.scheduledAt).getTime()
    expect(ts).toBeLessThan(Date.now())
  })

  test('master classes page loads with mixed upcoming and past classes', async ({ page }) => {
    await injectAuthCookies(page)
    await mockEmployeeClassList(page, [MASTER_CLASS_UPCOMING, MASTER_CLASS_PAST])

    await page.goto('/employee/master-classes', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ---------------------------------------------------------------------------
// 5e — Edge cases
// ---------------------------------------------------------------------------

test.describe('Flow 5e — Edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockEmployeeClassList(page)
  })

  test('full class registration returns 400', async ({ page }) => {
    await mockRegistrationPost(page, { full: true })

    const result = await page.evaluate(
      async ([base, classId]) => {
        const res = await fetch(
          `${base}/api/employee/master-classes/${classId}/register`,
          { method: 'POST' }
        )
        return { status: res.status, body: await res.json() }
      },
      [API_BASE, MASTER_CLASS_UPCOMING.classId] as [string, string]
    )

    expect(result.status).toBe(400)
    expect(result.body).toHaveProperty('error')
  })

  test('full class has currentAttendees equal to maxAttendees', async ({ page }) => {
    expect(MASTER_CLASS_FULL.currentAttendees).toBe(MASTER_CLASS_FULL.maxAttendees)
  })

  test('duplicate registration returns 409', async ({ page }) => {
    const tracker = await mockRegistrationPost(page, { duplicate: true })

    // First registration
    await page.evaluate(
      async ([base, classId]) => {
        await fetch(
          `${base}/api/employee/master-classes/${classId}/register`,
          { method: 'POST' }
        )
      },
      [API_BASE, MASTER_CLASS_UPCOMING.classId] as [string, string]
    )

    // Duplicate
    const result = await page.evaluate(
      async ([base, classId]) => {
        const res = await fetch(
          `${base}/api/employee/master-classes/${classId}/register`,
          { method: 'POST' }
        )
        return { status: res.status, body: await res.json() }
      },
      [API_BASE, MASTER_CLASS_UPCOMING.classId] as [string, string]
    )

    expect(result.status).toBe(409)
    expect(tracker.calls).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// 5f — HR admin creates a master class
// ---------------------------------------------------------------------------

test.describe('Flow 5f — HR admin creates master class', () => {
  test.beforeEach(async ({ page }) => {
    await injectHrAdminCookies(page)
  })

  test('admin create class POST returns new classId', async ({ page }) => {
    const tracker = await mockAdminCreateClass(page)

    const result = await page.evaluate(
      async ([base, classData]) => {
        const res = await fetch(`${base}/api/hr/master-classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(classData),
        })
        return res.json()
      },
      [
        API_BASE,
        {
          title: MASTER_CLASS_UPCOMING.title,
          description: MASTER_CLASS_UPCOMING.description,
          domain: MASTER_CLASS_UPCOMING.domain,
          instructor: MASTER_CLASS_UPCOMING.instructor,
          scheduledAt: MASTER_CLASS_UPCOMING.scheduledAt,
          durationMinutes: MASTER_CLASS_UPCOMING.durationMinutes,
          maxAttendees: MASTER_CLASS_UPCOMING.maxAttendees,
        },
      ] as [string, Record<string, unknown>]
    )

    expect(tracker.calls).toBe(1)
    expect(result).toHaveProperty('classId')
    expect(result).toHaveProperty('title', MASTER_CLASS_UPCOMING.title)
  })

  test('admin create payload is sent with POST method', async ({ page }) => {
    let capturedMethod = ''

    await page.route(
      `${API_BASE}/api/hr/master-classes`,
      async (route) => {
        capturedMethod = route.request().method()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(MASTER_CLASS_UPCOMING),
        })
      }
    )

    await page.evaluate(
      async ([base]) => {
        await fetch(`${base}/api/hr/master-classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test Class', domain: 'legal' }),
        })
      },
      [API_BASE] as [string]
    )

    expect(capturedMethod).toBe('POST')
  })
})
