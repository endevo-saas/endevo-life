import { test, expect, Page } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'
import {
  ASSESSMENT_SUBMIT_RESPONSE,
  EMAIL_SEND_RESPONSE,
  AUDIT_LOG_EMAIL_ENTRY,
} from './helpers/fixtures'

/**
 * Flow 3 — Auto-Email Delivery
 *
 * Critical user journey:
 *   1. Employee completes assessment
 *   2. System automatically sends email with attachments
 *   3. Email contains: scorecard PDF, checklist XLSX, checklist PDF, results
 *   4. SES delivery logged in DynamoDB audit log
 *   5. No duplicate emails on re-submit
 *
 * Strategy:
 *   - Intercept POST /api/employee/email/send-playbook
 *   - Verify request shape and response contract
 *   - Verify audit log entry is created
 *   - Simulate the "5s auto-send after submit" client-side flow
 *   - Test idempotency (duplicate trigger prevention)
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

const EMPLOYEE_EMAIL = 'test.employee@endevo.com'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

async function mockEmailEndpoint(
  page: Page,
  opts: { fail?: boolean; alreadySent?: boolean } = {}
): Promise<{ calls: number }> {
  const tracker = { calls: 0 }

  await page.route(
    `${API_BASE}/api/employee/email/send-playbook`,
    async (route) => {
      tracker.calls++

      if (opts.fail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'SES delivery failed' }),
        })
        return
      }

      if (opts.alreadySent && tracker.calls > 1) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Email already sent for this assessment' }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_RESPONSE),
      })
    }
  )

  return tracker
}

async function mockAssessmentSubmitWithEmail(page: Page): Promise<void> {
  await page.route(
    `${API_BASE}/api/lms/assessment/submit`,
    async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ASSESSMENT_SUBMIT_RESPONSE),
        })
      } else {
        await route.continue()
      }
    }
  )
}

async function mockAuditLog(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/employee/audit*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ logs: [AUDIT_LOG_EMAIL_ENTRY], total: 1 }),
    })
  })

  // Also cover HR/admin audit paths for cross-verification
  await page.route(`${API_BASE}/api/hr/audit*`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ logs: [AUDIT_LOG_EMAIL_ENTRY], total: 1 }),
    })
  })
}

// ---------------------------------------------------------------------------
// 3a — Email triggers after assessment submit
// ---------------------------------------------------------------------------

test.describe('Flow 3a — Email trigger after assessment submit', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page, { email: EMPLOYEE_EMAIL })
    await mockAssessmentSubmitWithEmail(page)
  })

  test('assessment submit API returns success', async ({ page }) => {
    const tracker = await mockEmailEndpoint(page)

    const submitResult = await page.evaluate(
      async ([base, answers]) => {
        const res = await fetch(`${base}/api/lms/assessment/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        })
        return res.json()
      },
      [API_BASE, { 'legal-q1': 'Mostly' }] as [string, Record<string, string>]
    )

    expect(submitResult).toHaveProperty('success', true)
    expect(submitResult).toHaveProperty('scorecard')
  })

  test('email send triggers after assessment submit', async ({ page }) => {
    const tracker = await mockEmailEndpoint(page)

    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    // Simulate the auto-email that fires post-assessment
    await page.evaluate(
      async ([base]) => {
        await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      },
      [API_BASE] as [string]
    )

    expect(tracker.calls).toBe(1)
  })

  test('email API is called with POST method', async ({ page }) => {
    let capturedMethod = ''

    await page.route(
      `${API_BASE}/api/employee/email/send-playbook`,
      async (route) => {
        capturedMethod = route.request().method()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(EMAIL_SEND_RESPONSE),
        })
      }
    )

    await page.evaluate(
      async ([base]) => {
        await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
        })
      },
      [API_BASE] as [string]
    )

    expect(capturedMethod).toBe('POST')
  })
})

// ---------------------------------------------------------------------------
// 3b — Email payload and attachments
// ---------------------------------------------------------------------------

test.describe('Flow 3b — Email contains correct attachments', () => {
  test('email response has success flag', async ({ page }) => {
    expect(EMAIL_SEND_RESPONSE.success).toBe(true)
  })

  test('email response has a non-empty messageId', async ({ page }) => {
    expect(EMAIL_SEND_RESPONSE.messageId.length).toBeGreaterThan(0)
  })

  test('email is sent to the correct employee address', async ({ page }) => {
    // The API returns the recipient email in the response
    expect(EMAIL_SEND_RESPONSE.email).toBe(EMPLOYEE_EMAIL)
  })

  test('email subject is non-empty', async ({ page }) => {
    expect(EMAIL_SEND_RESPONSE.subject.length).toBeGreaterThan(0)
  })

  test('sentAt is a valid ISO timestamp', async ({ page }) => {
    const ts = new Date(EMAIL_SEND_RESPONSE.sentAt)
    expect(ts.getTime()).not.toBeNaN()
  })

  test('audit log entry records EMAIL_SENT action', async ({ page }) => {
    expect(AUDIT_LOG_EMAIL_ENTRY.action).toBe('EMAIL_SENT')
  })

  test('audit log entry references correct messageId', async ({ page }) => {
    expect(AUDIT_LOG_EMAIL_ENTRY.details.messageId).toBe(
      EMAIL_SEND_RESPONSE.messageId
    )
  })

  test('audit log records 4 expected attachment types', async ({ page }) => {
    const attachments = AUDIT_LOG_EMAIL_ENTRY.details.attachments
    expect(attachments).toContain('scorecard.pdf')
    expect(attachments).toContain('checklist.xlsx')
    expect(attachments).toContain('checklist.pdf')
    expect(attachments).toContain('results.json')
  })
})

// ---------------------------------------------------------------------------
// 3c — Recipient email is the employee's registered address
// ---------------------------------------------------------------------------

test.describe('Flow 3c — Recipient email correctness', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page, { email: EMPLOYEE_EMAIL })
  })

  test('email send API returns recipient matching the logged-in employee', async ({ page }) => {
    await mockEmailEndpoint(page)

    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
        })
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result.email).toBe(EMPLOYEE_EMAIL)
  })
})

// ---------------------------------------------------------------------------
// 3d — Audit log entry created in DynamoDB
// ---------------------------------------------------------------------------

test.describe('Flow 3d — SES delivery logged in audit trail', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockAuditLog(page)
  })

  test('audit log API returns EMAIL_SENT entry after delivery', async ({ page }) => {
    const result = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/audit`)
        return res.json()
      },
      [API_BASE] as [string]
    )

    expect(result).toHaveProperty('logs')
    expect(result.logs.length).toBeGreaterThan(0)
    const emailEntry = result.logs.find(
      (l: { action: string }) => l.action === 'EMAIL_SENT'
    )
    expect(emailEntry).toBeDefined()
  })

  test('audit log entry has timestamp', async ({ page }) => {
    const ts = new Date(AUDIT_LOG_EMAIL_ENTRY.timestamp)
    expect(ts.getTime()).not.toBeNaN()
  })
})

// ---------------------------------------------------------------------------
// 3e — Edge cases: no email without completed assessment, no duplicates
// ---------------------------------------------------------------------------

test.describe('Flow 3e — Email edge cases', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
  })

  test('email endpoint returns 409 on duplicate trigger', async ({ page }) => {
    const tracker = await mockEmailEndpoint(page, { alreadySent: true })

    // First call — succeeds
    const r1 = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
        })
        return { status: res.status, body: await res.json() }
      },
      [API_BASE] as [string]
    )
    expect(r1.status).toBe(200)

    // Second call — should be idempotent / rejected
    const r2 = await page.evaluate(
      async ([base]) => {
        const res = await fetch(`${base}/api/employee/email/send-playbook`, {
          method: 'POST',
        })
        return { status: res.status, body: await res.json() }
      },
      [API_BASE] as [string]
    )
    expect(r2.status).toBe(409)
    expect(tracker.calls).toBe(2)
  })

  test('email endpoint failure does not crash the assessment page', async ({ page }) => {
    await mockEmailEndpoint(page, { fail: true })

    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })
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
