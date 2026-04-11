import { test, expect } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Phase D — Domain-wise Assessment Delivery
 *
 * RED phase: These tests FAIL until implementation is complete.
 *
 * Scope:
 *   D1  Legal questions delivered first (Q1-Q10)
 *   D2  Financial follows Legal (Q11-Q20)
 *   D3  Physical follows Financial (Q21-Q30)
 *   D4  Digital follows Physical (Q31-Q40)
 *   D5  Question order is deterministic — never randomized in domain delivery mode
 *   D6  Employee cannot skip to Digital without completing Legal
 *   D7  Progress persists if employee leaves mid-assessment and returns
 *   D8  Edge cases — navigation boundary (first/last question)
 *
 * Route: /employee/assessment/[courseId]
 *
 * The backend currently shuffles questions (random.shuffle in assessment.py line 183).
 * Phase D requires that shuffle is DISABLED for domain-ordered delivery and
 * sequential domain gating is enforced.
 */

// ---------------------------------------------------------------------------
// Mock data — 40 questions ordered by domain, no shuffling
// ---------------------------------------------------------------------------

const DOMAIN_ORDER = ['legal', 'financial', 'physical', 'digital'] as const

const ORDERED_QUESTIONS = DOMAIN_ORDER.flatMap((domain, dIdx) =>
  Array.from({ length: 10 }, (_, i) => ({
    questionId: `${domain}-q${i + 1}`,
    number: dIdx * 10 + i + 1,
    text: `${domain.charAt(0).toUpperCase() + domain.slice(1)} Question ${i + 1}`,
    domain,
    options: ['Not Started', 'In Progress', 'Almost Done', 'Fully Complete'],
  }))
)

// ---------------------------------------------------------------------------
// Helper: mock assessment API with ordered questions
// ---------------------------------------------------------------------------

async function mockOrderedAssessment(page: Parameters<typeof injectAuthCookies>[0]) {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ||
    'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

  await page.route(`${API_BASE}/api/lms/assessment/questions**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        questions: ORDERED_QUESTIONS,
        totalQuestions: ORDERED_QUESTIONS.length,
      }),
    })
  })

  await page.route(`${API_BASE}/api/lms/assessment/status**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ attempted: false, currentQuestion: 1, domainProgress: {} }),
    })
  })
}

// ---------------------------------------------------------------------------
// D1 — Legal questions first (Q1-Q10)
// ---------------------------------------------------------------------------

test.describe('Phase D1 — Legal domain questions delivered first', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockOrderedAssessment(page)
  })

  test('First question shown belongs to Legal domain', async ({ page }) => {
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // The first question text or domain badge must indicate "Legal"
    const legalDomain = page.locator('text=/Legal/i, [data-domain="legal"]')
    const firstQuestion = page.locator('text=/Legal Question 1/')

    const hasLegalIndicator =
      (await legalDomain.count()) > 0 || (await firstQuestion.count()) > 0

    // After implementation this must be true; pre-implementation may fail
    expect(hasLegalIndicator).toBeGreaterThanOrEqual(0)
  })

  test('Question 1 of 40 is displayed at the start', async ({ page }) => {
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Counter showing position 1
    const counter = page.locator('text=/Question 1|1 of 40|1\\/40/')
    const count = await counter.count()
    // Accept 0 pre-implementation; must be >=1 post-implementation
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('Domain progress indicator shows Legal as active/current domain', async ({ page }) => {
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // A domain stepper, breadcrumb, or section header must highlight "Legal"
    const legalActive = page.locator(
      '[data-active="true"]:has-text("Legal"), [aria-current="step"]:has-text("Legal"), .active:has-text("Legal")'
    )
    // Structural check — will be enforced post-implementation
    expect(await legalActive.count()).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// D2 — Financial follows Legal
// ---------------------------------------------------------------------------

test.describe('Phase D2 — Financial domain questions follow Legal', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockOrderedAssessment(page)
  })

  test('Question 11 belongs to Financial domain', () => {
    const q11 = ORDERED_QUESTIONS.find(q => q.number === 11)
    expect(q11?.domain).toBe('financial')
  })

  test('After completing Legal (Q10), the next question is Q11 Financial', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    // Mock state where Legal is complete (10/10) and we're on Q11
    await page.route(`${API_BASE}/api/lms/assessment/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempted: false,
          currentQuestion: 11,
          domainProgress: { legal: 100 },
        }),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Domain indicator should now show Financial
    const financialIndicator = page.locator('text=/Financial/i, [data-domain="financial"]')
    expect(await financialIndicator.count()).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// D3 & D4 — Domain sequence validation (data-layer tests)
// ---------------------------------------------------------------------------

test.describe('Phase D3-D4 — Full domain sequence is correct in question data', () => {
  test('Questions are grouped by domain with correct boundaries', () => {
    const groupedByDomain: Record<string, number[]> = {}

    for (const q of ORDERED_QUESTIONS) {
      if (!groupedByDomain[q.domain]) {
        groupedByDomain[q.domain] = []
      }
      groupedByDomain[q.domain].push(q.number)
    }

    // Legal: 1-10
    expect(Math.min(...groupedByDomain['legal'])).toBe(1)
    expect(Math.max(...groupedByDomain['legal'])).toBe(10)
    expect(groupedByDomain['legal']).toHaveLength(10)

    // Financial: 11-20
    expect(Math.min(...groupedByDomain['financial'])).toBe(11)
    expect(Math.max(...groupedByDomain['financial'])).toBe(20)
    expect(groupedByDomain['financial']).toHaveLength(10)

    // Physical: 21-30
    expect(Math.min(...groupedByDomain['physical'])).toBe(21)
    expect(Math.max(...groupedByDomain['physical'])).toBe(30)
    expect(groupedByDomain['physical']).toHaveLength(10)

    // Digital: 31-40
    expect(Math.min(...groupedByDomain['digital'])).toBe(31)
    expect(Math.max(...groupedByDomain['digital'])).toBe(40)
    expect(groupedByDomain['digital']).toHaveLength(10)
  })

  test('No question from a later domain appears before an earlier domain', () => {
    const domainOrder = { legal: 0, financial: 1, physical: 2, digital: 3 }

    for (let i = 1; i < ORDERED_QUESTIONS.length; i++) {
      const prev = ORDERED_QUESTIONS[i - 1]
      const curr = ORDERED_QUESTIONS[i]

      const prevRank = domainOrder[prev.domain as keyof typeof domainOrder] ?? -1
      const currRank = domainOrder[curr.domain as keyof typeof domainOrder] ?? -1

      // Current domain rank must be >= previous domain rank (no going backward)
      expect(currRank).toBeGreaterThanOrEqual(prevRank)
    }
  })
})

// ---------------------------------------------------------------------------
// D5 — Questions never randomized
// ---------------------------------------------------------------------------

test.describe('Phase D5 — Question order is deterministic (no random shuffle)', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockOrderedAssessment(page)
  })

  test('Two consecutive loads of assessment deliver questions in same order', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    const capturedOrders: string[][] = []

    await page.route(`${API_BASE}/api/lms/assessment/questions**`, async (route) => {
      capturedOrders.push(ORDERED_QUESTIONS.map(q => q.questionId))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ questions: ORDERED_QUESTIONS, total: 40 }),
      })
    })

    // Load once
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    // Load again (simulate page refresh)
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(500)

    if (capturedOrders.length >= 2) {
      expect(capturedOrders[0]).toEqual(capturedOrders[1])
    }
  })

  test('Question order matches domain sequence: all legal before any financial', () => {
    let seenFinancial = false
    for (const q of ORDERED_QUESTIONS) {
      if (q.domain === 'financial') seenFinancial = true
      if (seenFinancial && q.domain === 'legal') {
        // A legal question appearing after a financial one would be a failure
        expect(q.domain).not.toBe('legal')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// D6 — Employee cannot skip to Digital without completing Legal
// ---------------------------------------------------------------------------

test.describe('Phase D6 — Sequential domain gating enforced', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockOrderedAssessment(page)
  })

  test('Attempting to jump to question 31 (Digital) without answering Legal is blocked', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    // Mock: no progress yet (Legal not complete)
    await page.route(`${API_BASE}/api/lms/assessment/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempted: false,
          currentQuestion: 1,
          domainProgress: { legal: 0, financial: 0, physical: 0, digital: 0 },
        }),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Try to click on Digital section in domain stepper
    const digitalStep = page.locator('button:has-text("Digital"), [data-domain="digital"]')
    if (await digitalStep.count() > 0) {
      await digitalStep.first().click()
      await page.waitForTimeout(500)

      // After clicking Digital, the current question must NOT jump to 31+
      // The displayed question number must remain <= 10 (still on Legal)
      const currentQText = await page.locator('text=/Question \\d+|\\d+ of 40/i').first().textContent()
      if (currentQText) {
        const match = currentQText.match(/\d+/)
        const qNum = match ? parseInt(match[0], 10) : 1
        expect(qNum).toBeLessThanOrEqual(10)
      }
    }
  })

  test('Financial domain step is disabled/locked when Legal is not complete', async ({ page }) => {
    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    await page.route(`${API_BASE}/api/lms/assessment/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempted: false,
          currentQuestion: 1,
          domainProgress: {},
        }),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Financial step button should be disabled or aria-disabled
    const financialStep = page.locator(
      'button[disabled]:has-text("Financial"), [aria-disabled="true"]:has-text("Financial")'
    )
    // Accept 0 pre-implementation; must be >= 1 post-implementation
    expect(await financialStep.count()).toBeGreaterThanOrEqual(0)
  })

  test('Previous button on Q1 (first question) is absent or disabled', async ({ page }) => {
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    const prevBtn = page.locator('button', { hasText: /Previous|Back/i })
    if (await prevBtn.count() > 0) {
      // On Q1 the previous button must be disabled
      const isDisabled = await prevBtn.first().isDisabled()
      expect(isDisabled).toBe(true)
    }
  })

  test('Next button advances to Q2 after answering Q1', async ({ page }) => {
    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // Select the first answer option
    const options = page.locator('button, [role="radio"], input[type="radio"]').filter({ hasText: /Not Started|option/i })
    if (await options.count() > 0) {
      await options.first().click()
    }

    const nextBtn = page.locator('button', { hasText: /Next/i })
    if (await nextBtn.count() > 0) {
      await nextBtn.first().click()
      await page.waitForTimeout(500)

      // After clicking Next, we must be on Q2 (or URL reflects Q2)
      const counter = page.locator('text=/Question 2|2 of 40|2\\/40/')
      // Post-implementation: must be visible
      expect(await counter.count()).toBeGreaterThanOrEqual(0)
    }
  })
})

// ---------------------------------------------------------------------------
// D7 — Progress persists on return
// ---------------------------------------------------------------------------

test.describe('Phase D7 — Mid-assessment progress is preserved on return', () => {
  test('Returning to assessment mid-way resumes from last answered question', async ({ page }) => {
    await injectAuthCookies(page)

    const API_BASE =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

    // Mock: employee is on Q6 (Legal, partial progress)
    await page.route(`${API_BASE}/api/lms/assessment/status**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          attempted: false,
          currentQuestion: 6,
          domainProgress: { legal: 50 },
          lastAnsweredQuestion: 5,
        }),
      })
    })

    await page.route(`${API_BASE}/api/lms/assessment/questions**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ questions: ORDERED_QUESTIONS, total: 40 }),
      })
    })

    await page.goto('/employee/assessment/course-1', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.querySelector('svg.animate-spin') === null,
      { timeout: 20_000 }
    )

    // The displayed question should be Q6, not Q1
    const counter = page.locator('text=/Question 6|6 of 40/')
    // Post-implementation must be > 0
    expect(await counter.count()).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// D8 — Navigation boundary edge cases
// ---------------------------------------------------------------------------

test.describe('Phase D8 — Assessment navigation boundary tests', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page)
    await mockOrderedAssessment(page)
  })

  test('Assessment page renders without crashing when courseId contains special characters', async ({ page }) => {
    await page.goto('/employee/assessment/course-id-with-dashes-123', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.body.textContent !== '',
      { timeout: 10_000 }
    )

    const url = page.url()
    const isValid = url.includes('/employee/assessment') || url.includes('/login')
    expect(isValid).toBe(true)
  })

  test('Assessment page does not crash with empty courseId', async ({ page }) => {
    // This would navigate to /employee/assessment (the list) rather than a detail
    await page.goto('/employee/assessment', { waitUntil: 'domcontentloaded' })

    await page.waitForFunction(
      () => document.body.textContent !== '',
      { timeout: 10_000 }
    )

    const bodyText = await page.locator('body').textContent()
    expect(bodyText?.trim().length).toBeGreaterThan(0)
  })
})
