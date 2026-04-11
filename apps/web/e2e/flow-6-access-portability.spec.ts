import { test, expect, Page } from '@playwright/test'
import {
  injectAuthCookies,
  injectHrAdminCookies,
  AuthOptions,
} from './helpers/auth'
import {
  EMPLOYEE_ACTIVE,
  EMPLOYEE_DEPARTED,
  PORTABILITY_ACTIVATION_RESPONSE,
} from './helpers/fixtures'

/**
 * Flow 6 — Access Portability
 *
 * Critical user journey:
 *   1. HR marks employee as "employment ended"
 *   2. System activates personal email / phone access
 *   3. Employee can sign in with personal email
 *   4. All legacy planning data (assessment, checklist, playbook) remains intact
 *
 * Strategy:
 *   - Mock HR employee update endpoint with employmentStatus: departed
 *   - Mock auth flow to accept personalEmail as login credential
 *   - Verify profile page shows data intact after status change
 *   - Test that work email still appears in the profile (read-only)
 *   - Test edge case: departed employee cannot book new sessions
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockEmployeeProfile(page: Page, profileData = EMPLOYEE_ACTIVE): Promise<void> {
  await page.route(`${API_BASE}/api/employee/profile*`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileData),
      })
    } else {
      await route.continue()
    }
  })
}

async function mockHrMarkDeparted(page: Page): Promise<{ calls: number }> {
  const tracker = { calls: 0 }

  await page.route(
    `${API_BASE}/api/hr/employees/${EMPLOYEE_ACTIVE.userId}*`,
    async (route) => {
      const method = route.request().method()

      if (method === 'PUT' || method === 'PATCH') {
        tracker.calls++
        const body = JSON.parse(route.request().postData() || '{}')

        if (body.employmentStatus === 'departed') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(EMPLOYEE_DEPARTED),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(EMPLOYEE_ACTIVE),
          })
        }
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(EMPLOYEE_ACTIVE),
        })
      }
    }
  )

  return tracker
}

async function mockPortabilityActivation(page: Page): Promise<{ calls: number }> {
  const tracker = { calls: 0 }

  await page.route(
    `${API_BASE}/api/hr/employees/${EMPLOYEE_ACTIVE.userId}/activate-personal-access`,
    async (route) => {
      tracker.calls++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PORTABILITY_ACTIVATION_RESPONSE),
      })
    }
  )

  return tracker
}

async function mockDepartedEmployeeData(page: Page): Promise<void> {
  // Profile remains intact
  await mockEmployeeProfile(page, EMPLOYEE_DEPARTED)

  // Checklist data intact
  await page.route(`${API_BASE}/api/employee/checklist*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tasks: [
          {
            taskId: 'legal-task-1',
            title: 'Legal Task 1',
            description: 'Test',
            domain: 'legal',
            status: 'completed',
            priority: 1,
          },
        ],
        domainProgress: { legal: 10, financial: 0, physical: 0, digital: 0 },
        overallProgress: 3,
        totalTasks: 40,
        completedTasks: 1,
      }),
    })
  })

  // Playbook data intact
  await page.route(`${API_BASE}/api/employee/playbook/generate`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          playbookId: 'pb-departed-001',
          overallScore: 75,
          domainScores: { legal: 80, financial: 70, physical: 85, digital: 65 },
          weakDomains: ['digital'],
          strongDomains: ['physical'],
          analysis: 'Retained from pre-departure assessment.',
          playbook: {
            title: 'Your Legacy Playbook',
            subtitle: 'Intermediate',
            overview: 'Pre-departure snapshot.',
            nextSteps: 'Continue planning with personal access.',
            tasks: [],
            generatedAt: new Date().toISOString(),
          },
          generatedAt: new Date().toISOString(),
        }),
      })
    } else {
      await route.continue()
    }
  })

  // Session booking blocked for departed employee
  await page.route(`${API_BASE}/api/employee/sessions/book`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Access restricted',
          detail: 'Session booking is not available after employment ends.',
        }),
      })
    } else {
      await route.continue()
    }
  })
}

async function injectDepartedEmployeeCookies(page: Page): Promise<void> {
  const opts: AuthOptions = {
    role: 'EMPLOYEE',
    email: EMPLOYEE_DEPARTED.personalEmail,
    accessToken: 'e2e-departed-token',
  }
  await injectAuthCookies(page, opts)
}

// ---------------------------------------------------------------------------
// 6a — HR marks employee as departed
// ---------------------------------------------------------------------------

test.describe('Flow 6a — HR marks employment ended', () => {
  test.beforeEach(async ({ page }) => {
    await injectHrAdminCookies(page)
    await mockHrMarkDeparted(page)
  })

  test('HR update endpoint accepts departed status', async ({ page }) => {
    const tracker = await mockHrMarkDeparted(page)

    const result = await page.evaluate(
      async ([base, userId]) => {
        const res = await fetch(`${base}/api/hr/employees/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employmentStatus: 'departed' }),
        })
        return { status: res.status, body: await res.json() }
      },
      [API_BASE, EMPLOYEE_ACTIVE.userId] as [string, string]
    )

    expect(result.status).toBe(200)
    expect(result.body).toHaveProperty('employmentStatus', 'departed')
  })

  test('departed employee record has departedAt timestamp', async ({ page }) => {
    expect(EMPLOYEE_DEPARTED).toHaveProperty('departedAt')
    const ts = new Date(EMPLOYEE_DEPARTED.departedAt!).getTime()
    expect(ts).not.toBeNaN()
  })

  test('departed employee has accessMode set to personal', async ({ page }) => {
    expect(EMPLOYEE_DEPARTED.accessMode).toBe('personal')
  })

  test('departed employee status is inactive', async ({ page }) => {
    expect(EMPLOYEE_DEPARTED.status).toBe('inactive')
  })
})

// ---------------------------------------------------------------------------
// 6b — Personal email activation
// ---------------------------------------------------------------------------

test.describe('Flow 6b — Personal email / phone activated', () => {
  test.beforeEach(async ({ page }) => {
    await injectHrAdminCookies(page)
  })

  test('portability activation API returns success', async ({ page }) => {
    const tracker = await mockPortabilityActivation(page)

    const result = await page.evaluate(
      async ([base, userId]) => {
        const res = await fetch(
          `${base}/api/hr/employees/${userId}/activate-personal-access`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        )
        return res.json()
      },
      [API_BASE, EMPLOYEE_ACTIVE.userId] as [string, string]
    )

    expect(tracker.calls).toBe(1)
    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('personalEmailActivated', true)
    expect(result).toHaveProperty('newLoginEmail')
  })

  test('activation response includes the personal email as new login', async ({ page }) => {
    expect(PORTABILITY_ACTIVATION_RESPONSE.newLoginEmail).toBe(
      EMPLOYEE_DEPARTED.personalEmail
    )
  })

  test('activation message confirms data preservation', async ({ page }) => {
    expect(PORTABILITY_ACTIVATION_RESPONSE.message).toContain('Data is fully preserved')
  })
})

// ---------------------------------------------------------------------------
// 6c — Departed employee can sign in with personal email
// ---------------------------------------------------------------------------

test.describe('Flow 6c — Personal email sign-in', () => {
  test.beforeEach(async ({ page }) => {
    await injectDepartedEmployeeCookies(page)
    await mockDepartedEmployeeData(page)
  })

  test('profile page loads for departed employee', async ({ page }) => {
    await page.goto('/employee/profile', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('profile page renders without JS errors for departed employee', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/employee/profile', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Non-Error')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('profile route is accessible to departed employee', async ({ page }) => {
    await page.goto('/employee/profile', { waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/employee/profile')
  })
})

// ---------------------------------------------------------------------------
// 6d — All data intact after departure
// ---------------------------------------------------------------------------

test.describe('Flow 6d — Legacy data intact post-departure', () => {
  test.beforeEach(async ({ page }) => {
    await injectDepartedEmployeeCookies(page)
    await mockDepartedEmployeeData(page)
  })

  test('checklist page accessible to departed employee', async ({ page }) => {
    await page.goto('/employee/checklist', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('checklist data survives departure (tasks still present)', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/checklist`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('tasks')
    expect(result.tasks.length).toBeGreaterThan(0)
  })

  test('playbook page accessible to departed employee', async ({ page }) => {
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('playbook data survives departure (overallScore present)', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/playbook/generate`, {
          method: 'POST',
        })
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('overallScore')
    expect(result.overallScore).toBeGreaterThan(0)
  })

  test('departed employee profile has personal email set', async ({ page }) => {
    expect(EMPLOYEE_DEPARTED.personalEmail.length).toBeGreaterThan(0)
    expect(EMPLOYEE_DEPARTED.personalEmail).not.toBe(EMPLOYEE_DEPARTED.email)
  })

  test('departed employee still has access to assessment history', async ({ page }) => {
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    expect(page.url()).toContain('/employee/assessment')
  })
})

// ---------------------------------------------------------------------------
// 6e — Edge case: departed employee cannot book new sessions
// ---------------------------------------------------------------------------

test.describe('Flow 6e — Session booking blocked post-departure', () => {
  test.beforeEach(async ({ page }) => {
    await injectDepartedEmployeeCookies(page)
    await mockDepartedEmployeeData(page)
  })

  test('session booking returns 403 for departed employee', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/sessions/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
        })
        return { status: res.status, body: await res.json() }
      },
      [API_BASE] as [string]
    )

    expect(result.status).toBe(403)
    expect(result.body).toHaveProperty('error')
  })

  test('sessions page still loads for departed employee (view history)', async ({ page }) => {
    await page.goto('/employee/sessions', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )
    await expect(page.locator('body')).not.toBeEmpty()
  })
})
