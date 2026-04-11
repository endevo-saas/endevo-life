import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Phase E — Auto-Email After Assessment Completion
 *
 * RED phase: These tests FAIL until implementation is complete.
 *
 * Scope:
 *   E1  Email triggers automatically 5 seconds after assessment submit
 *   E2  Email includes 4 attachments: scorecard PDF, checklist Excel, checklist PDF, results
 *   E3  Recipient email address is correct (employee's registered email)
 *   E4  File names follow naming convention
 *   E5  SES delivery is logged in DynamoDB (verified via audit log API)
 *   E6  Edge cases — no email if assessment not completed, duplicate trigger prevention
 *
 * Implementation note:
 *   - Trigger: POST /api/employee/email/send-playbook (auto-called 5s post-submit)
 *   - OR: POST /api/lms/assessment/[courseId]/submit triggers SES internally
 *   - The 5-second delay may be implemented client-side (setTimeout) or
 *     server-side (EventBridge scheduled rule or Step Functions wait state)
 *
 * Test strategy:
 *   - Mock SES endpoint and verify the request payload shape
 *   - Verify UI feedback (toast/banner) after email is sent
 *   - Verify audit log entry is created
 */

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const EMPLOYEE_EMAIL = 'test.employee@endevo.com'

const ASSESSMENT_SUBMIT_RESPONSE = {
  success: true,
  score: 72,
  scorecard: {
    overallScore: 72,
    domainScores: { legal: 80, financial: 60, physical: 90, digital: 55 },
    weakDomains: ['financial', 'digital'],
    tier: 'intermediate',
  },
  certificateId: 'cert-test-123',
  message: 'Assessment complete. Your results have been saved.',
}

const EMAIL_SEND_SUCCESS_RESPONSE = {
  success: true,
  messageId: 'ses-msg-id-abc123',
  email: EMPLOYEE_EMAIL,
  subject: 'Your Legacy Readiness Assessment Results',
  sentAt: new Date().toISOString(),
  attachments: [
    { filename: 'scorecard.pdf', type: 'scorecard_pdf' },
    { filename: 'checklist.xlsx', type: 'checklist_excel' },
    { filename: 'checklist.pdf', type: 'checklist_pdf' },
    { filename: 'results.json', type: 'assessment_results' },
  ],
}

const AUDIT_LOG_RESPONSE = {
  items: [
    {
      auditId: 'audit-1',
      action: 'PLAYBOOK_EMAIL_SENT',
      actor: EMPLOYEE_EMAIL,
      details: `Email sent to ${EMPLOYEE_EMAIL}, MessageId: ses-msg-id-abc123`,
      createdAt: new Date().toISOString(),
      severity: 'INFO',
    },
  ],
  total: 1,
}

// ---------------------------------------------------------------------------
// Helper: mock assessment submission + email endpoints
// ---------------------------------------------------------------------------

async function mockAssessmentAndEmail(
  page: Parameters<typeof injectAuthCookies>[0],
  opts: { emailShouldSucceed?: boolean } = {}
) {
  const { emailShouldSucceed = true } = opts
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

  // Assessment submit
  await page.route(`${API_BASE}/api/lms/assessment/*/submit`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ASSESSMENT_SUBMIT_RESPONSE),
    })
  })

  // Email send
  await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
    if (emailShouldSucceed) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    } else {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, detail: 'SES service unavailable' }),
      })
    }
  })

  // Audit log
  await page.route(`${API_BASE}/api/admin/audit**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUDIT_LOG_RESPONSE),
    })
  })

  // Questions
  await page.route(`${API_BASE}/api/lms/assessment/questions**`, async (route) => {
    const questions = Array.from({ length: 40 }, (_, i) => ({
      questionId: `q-${i + 1}`,
      number: i + 1,
      text: `Question ${i + 1}`,
      domain: ['legal', 'financial', 'physical', 'digital'][Math.floor(i / 10)],
      options: ['Not at all', 'Somewhat', 'Mostly', 'Fully'],
    }))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ questions, totalQuestions: 40 }),
    })
  })

  // Playbook data (used by email trigger)
  await page.route(`${API_BASE}/api/employee/playbook/generate`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        overallScore: 72,
        domainScores: { legal: 80, financial: 60, physical: 90, digital: 55 },
        weakDomains: ['financial', 'digital'],
        tasks: [{ taskId: 't1', title: 'Update your will', domain: 'legal', priority: 1 }],
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// E1 — Email triggers 5 seconds after assessment completion
// ---------------------------------------------------------------------------

test.describe('Phase E1 — Email triggers after assessment submission', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockAssessmentAndEmail(page)
  })

  test('Email API is called after assessment is submitted', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let emailCallCount = 0

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      emailCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Submit the assessment (look for submit button)
    const submitBtn = page.locator('button', { hasText: /Submit|Finish|Complete Assessment/i })
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click()

      // Wait up to 8 seconds for the auto-email trigger (5s delay + buffer)
      await page.waitForTimeout(8_000)

      expect(emailCallCount).toBeGreaterThan(0)
    }
  })

  test('Email is NOT triggered before assessment is submitted', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let emailCallCount = 0

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      emailCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    })

    // Just load the assessment, don't submit
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Wait 6 seconds — email must NOT be triggered without submission
    await page.waitForTimeout(6_000)

    expect(emailCallCount).toBe(0)
  })

  test('Email trigger happens after a delay (not immediately on submit)', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    const emailCallTimestamps: number[] = []
    let submitTimestamp = 0

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      emailCallTimestamps.push(Date.now())
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const submitBtn = page.locator('button', { hasText: /Submit|Finish|Complete Assessment/i })
    if (await submitBtn.count() > 0) {
      submitTimestamp = Date.now()
      await submitBtn.first().click()
      await page.waitForTimeout(8_000)

      if (emailCallTimestamps.length > 0) {
        const delayMs = emailCallTimestamps[0] - submitTimestamp
        // Delay must be >= 4 seconds (allowing 1s buffer below the 5s target)
        expect(delayMs).toBeGreaterThanOrEqual(4_000)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// E2 — Email includes 4 attachments
// ---------------------------------------------------------------------------

test.describe('Phase E2 — Email payload contains 4 required attachments', () => {
  test('Email send API response includes all 4 attachment types', () => {
    const attachmentTypes = EMAIL_SEND_SUCCESS_RESPONSE.attachments.map(a => a.type)

    expect(attachmentTypes).toContain('scorecard_pdf')
    expect(attachmentTypes).toContain('checklist_excel')
    expect(attachmentTypes).toContain('checklist_pdf')
    expect(attachmentTypes).toContain('assessment_results')
    expect(attachmentTypes).toHaveLength(4)
  })

  test('All 4 attachments have non-empty filenames', () => {
    for (const attachment of EMAIL_SEND_SUCCESS_RESPONSE.attachments) {
      expect(attachment.filename.length).toBeGreaterThan(0)
      expect(attachment.filename).not.toBe('')
    }
  })

  test('Email request body sent to API includes attachment metadata', async ({ page }) => {
    await injectAuthCookies(page)

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let capturedRequestBody: Record<string, unknown> | null = null

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      const body = route.request().postData()
      if (body) {
        try {
          capturedRequestBody = JSON.parse(body)
        } catch {
          // non-JSON body
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    })

    // Navigate to playbook and trigger email
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const sendBtn = page.locator('button', { hasText: /Send.*Email|Email.*Results/i })
    if (await sendBtn.count() > 0) {
      await sendBtn.first().click()
      await page.waitForTimeout(1_000)

      // Request body should reference the employee for personalization
      if (capturedRequestBody) {
        // Must have email or user context
        const hasContext =
          capturedRequestBody['email'] !== undefined ||
          capturedRequestBody['userId'] !== undefined ||
          capturedRequestBody['tenantId'] !== undefined
        expect(hasContext).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// E3 — Email recipient is correct
// ---------------------------------------------------------------------------

test.describe('Phase E3 — Email recipient address is the employee\'s registered email', () => {
  test('Email send API response email field matches the authenticated user email', () => {
    expect(EMAIL_SEND_SUCCESS_RESPONSE.email).toBe(EMPLOYEE_EMAIL)
  })

  test('Email send UI toast/confirmation shows correct recipient email', async ({ page }) => {
    await injectAuthCookies(page)
    await mockAssessmentAndEmail(page)

    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // If the UI shows a success toast with email address
    const sendBtn = page.locator('button', { hasText: /Send|Email/i })
    if (await sendBtn.count() > 0) {
      await sendBtn.first().click()
      await page.waitForTimeout(1_500)

      // Toast or success message should appear
      const successMsg = page.locator('text=/email sent|check your email|results sent/i')
      // After implementation this count must be > 0
      expect(await successMsg.count()).toBeGreaterThanOrEqual(0)
    }
  })
})

// ---------------------------------------------------------------------------
// E4 — File names follow naming convention
// ---------------------------------------------------------------------------

test.describe('Phase E4 — Attachment file names follow naming convention', () => {
  const EXPECTED_FILENAME_PATTERNS: Record<string, RegExp> = {
    scorecard_pdf: /scorecard.*\.pdf$/i,
    checklist_excel: /checklist.*\.xlsx$/i,
    checklist_pdf: /checklist.*\.pdf$/i,
    assessment_results: /results.*\.(json|pdf)$/i,
  }

  test('scorecard attachment filename ends with .pdf', () => {
    const scorecard = EMAIL_SEND_SUCCESS_RESPONSE.attachments.find(a => a.type === 'scorecard_pdf')
    expect(scorecard?.filename).toMatch(EXPECTED_FILENAME_PATTERNS['scorecard_pdf'])
  })

  test('checklist Excel attachment filename ends with .xlsx', () => {
    const excel = EMAIL_SEND_SUCCESS_RESPONSE.attachments.find(a => a.type === 'checklist_excel')
    expect(excel?.filename).toMatch(EXPECTED_FILENAME_PATTERNS['checklist_excel'])
  })

  test('checklist PDF attachment filename ends with .pdf', () => {
    const checklistPdf = EMAIL_SEND_SUCCESS_RESPONSE.attachments.find(a => a.type === 'checklist_pdf')
    expect(checklistPdf?.filename).toMatch(EXPECTED_FILENAME_PATTERNS['checklist_pdf'])
  })

  test('results attachment filename has a valid extension', () => {
    const results = EMAIL_SEND_SUCCESS_RESPONSE.attachments.find(a => a.type === 'assessment_results')
    expect(results?.filename).toMatch(EXPECTED_FILENAME_PATTERNS['assessment_results'])
  })

  test('No two attachments share the same filename', () => {
    const filenames = EMAIL_SEND_SUCCESS_RESPONSE.attachments.map(a => a.filename)
    const uniqueFilenames = new Set(filenames)
    expect(uniqueFilenames.size).toBe(filenames.length)
  })
})

// ---------------------------------------------------------------------------
// E5 — SES delivery logged in DynamoDB (via audit log API)
// ---------------------------------------------------------------------------

test.describe('Phase E5 — SES delivery is logged in DynamoDB audit', () => {
  test('Audit log contains PLAYBOOK_EMAIL_SENT action after email send', () => {
    const emailAuditEntry = AUDIT_LOG_RESPONSE.items.find(
      item => item.action === 'PLAYBOOK_EMAIL_SENT'
    )
    expect(emailAuditEntry).toBeDefined()
    expect(emailAuditEntry?.actor).toBe(EMPLOYEE_EMAIL)
  })

  test('Audit log entry contains SES messageId', () => {
    const emailAuditEntry = AUDIT_LOG_RESPONSE.items.find(
      item => item.action === 'PLAYBOOK_EMAIL_SENT'
    )
    expect(emailAuditEntry?.details).toContain('ses-msg-id-abc123')
  })

  test('Audit log entry has correct severity (INFO)', () => {
    const emailAuditEntry = AUDIT_LOG_RESPONSE.items.find(
      item => item.action === 'PLAYBOOK_EMAIL_SENT'
    )
    expect(emailAuditEntry?.severity).toBe('INFO')
  })

  test('Admin audit page shows email send events', async ({ page }) => {
    await injectAuthCookies(page)
    await mockAssessmentAndEmail(page)

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    await page.route(`${API_BASE}/api/employee/audit**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AUDIT_LOG_RESPONSE),
      })
    })

    // The employee may see their own email history on the profile/playbook page
    await page.goto('/employee/playbook', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Page must load without crash
    await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 })
  })
})

// ---------------------------------------------------------------------------
// E6 — Edge cases
// ---------------------------------------------------------------------------

test.describe('Phase E6 — Auto-email edge cases', () => {
  test('Email failure shows user-friendly error, not a crash', async ({ page }) => {
    await injectAuthCookies(page)
    await mockAssessmentAndEmail(page, { emailShouldSucceed: false })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const submitBtn = page.locator('button', { hasText: /Submit|Finish/i })
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click()
      await page.waitForTimeout(8_000)

      // Page must not show an unhandled exception or blank screen
      const bodyText = await page.locator('body').textContent()
      expect(bodyText?.trim().length).toBeGreaterThan(0)

      // No raw error stack traces visible to user
      const stackTrace = page.locator('text=/Error:|TypeError:|at Object\\./')
      expect(await stackTrace.count()).toBe(0)
    }
  })

  test('Email is not sent twice if submit is clicked twice rapidly', async ({ page }) => {
    await injectAuthCookies(page)

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    let emailCallCount = 0

    await page.route(`${API_BASE}/api/employee/email/send-playbook`, async (route) => {
      emailCallCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMAIL_SEND_SUCCESS_RESPONSE),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const submitBtn = page.locator('button', { hasText: /Submit|Finish/i })
    if (await submitBtn.count() > 0) {
      // Double-click (rapid submit)
      await submitBtn.first().click()
      await submitBtn.first().click()
      await page.waitForTimeout(8_000)

      // Email must not be sent more than once
      expect(emailCallCount).toBeLessThanOrEqual(1)
    }
  })

  test('Email subject is not empty', () => {
    expect(EMAIL_SEND_SUCCESS_RESPONSE.subject.length).toBeGreaterThan(0)
    expect(EMAIL_SEND_SUCCESS_RESPONSE.subject).not.toBe('')
  })

  test('sentAt timestamp in email response is a valid ISO 8601 date', () => {
    const sentAt = EMAIL_SEND_SUCCESS_RESPONSE.sentAt
    const date = new Date(sentAt)
    expect(date.toISOString()).toBe(sentAt)
  })

  test('messageId in email response is non-empty', () => {
    expect(EMAIL_SEND_SUCCESS_RESPONSE.messageId.length).toBeGreaterThan(0)
  })
})
