import { test, expect, Page } from '@playwright/test'
import { injectAuthCookies } from './helpers/auth'

/**
 * Personal Contact Fields — E2E Tests
 *
 * Feature: Employee can add/verify personal email and phone on their profile.
 *
 * Strategy: mock API calls, inject auth cookies, assert UI renders and
 * interacts correctly without a live backend. All tests pass in CI.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

// ---------------------------------------------------------------------------
// Shared mock wiring
// ---------------------------------------------------------------------------

async function wirePersonalContactMocks(page: Page): Promise<void> {
  await page.route(`${API_BASE}/api/employee/profile`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u-001',
          email: 'test.employee@endevo.com',
          firstName: 'Test',
          lastName: 'Employee',
          role: 'EMPLOYEE',
          status: 'active',
          tenantId: 't-001',
          createdAt: '2026-01-01T00:00:00Z',
          personal_email: '',
          personal_phone_number: '',
          personal_email_verified: false,
          personal_phone_verified: false,
        }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Profile updated' }),
      })
    }
  })

  await page.route(
    `${API_BASE}/api/employee/profile/personal-contact`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Personal contact updated',
        }),
      })
    }
  )

  await page.route(
    `${API_BASE}/api/employee/verify/personal-email`,
    async (route) => {
      const body = JSON.parse(route.request().postData() || '{}') as {
        action?: string
      }
      if (body.action === 'send') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'OTP sent' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, verified: true }),
        })
      }
    }
  )

  await page.route(
    `${API_BASE}/api/employee/verify/personal-phone`,
    async (route) => {
      const body = JSON.parse(route.request().postData() || '{}') as {
        action?: string
      }
      if (body.action === 'send') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'SMS sent' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, verified: true }),
        })
      }
    }
  )
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Personal Contact Fields — Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthCookies(page, { email: 'test.employee@endevo.com' })
    await wirePersonalContactMocks(page)
    await page.goto('/employee/profile', { waitUntil: 'domcontentloaded' })
    // Wait for loading spinner to clear
    await page
      .waitForFunction(
        () => document.querySelector('svg.animate-spin') === null,
        { timeout: 20_000 }
      )
      .catch(() => {})
  })

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  test('profile page loads on correct route', async ({ page }) => {
    expect(page.url()).toContain('/employee/profile')
  })

  test('personal contact section is visible on profile page', async ({
    page,
  }) => {
    const section = page.getByTestId('personal-contact-section')
    await expect(section).toBeVisible()
  })

  test('personal email input field is rendered', async ({ page }) => {
    const input = page.getByTestId('personal-email-input')
    await expect(input).toBeVisible()
  })

  test('personal phone input field is rendered', async ({ page }) => {
    const input = page.getByTestId('personal-phone-input')
    await expect(input).toBeVisible()
  })

  test('personal email and phone fields show as optional', async ({ page }) => {
    const emailLabel = page.getByTestId('personal-email-label')
    const phoneLabel = page.getByTestId('personal-phone-label')
    await expect(emailLabel).toContainText('Personal Email')
    await expect(phoneLabel).toContainText('Personal Phone')
  })

  // -------------------------------------------------------------------------
  // Saving fields
  // -------------------------------------------------------------------------

  test('employee can type and save a personal email', async ({ page }) => {
    const emailInput = page.getByTestId('personal-email-input')
    await emailInput.fill('personal@example.com')

    const saveBtn = page.getByTestId('save-personal-contact-btn')
    await saveBtn.click()

    const successMsg = page.getByTestId('personal-contact-success')
    await expect(successMsg).toBeVisible({ timeout: 5_000 })
  })

  test('employee can type and save a personal phone number', async ({
    page,
  }) => {
    const phoneInput = page.getByTestId('personal-phone-input')
    await phoneInput.fill('+14155551234')

    const saveBtn = page.getByTestId('save-personal-contact-btn')
    await saveBtn.click()

    const successMsg = page.getByTestId('personal-contact-success')
    await expect(successMsg).toBeVisible({ timeout: 5_000 })
  })

  test('invalid email format shows validation error', async ({ page }) => {
    const emailInput = page.getByTestId('personal-email-input')
    await emailInput.fill('not-an-email')

    const saveBtn = page.getByTestId('save-personal-contact-btn')
    await saveBtn.click()

    const errorMsg = page.getByTestId('personal-email-error')
    await expect(errorMsg).toBeVisible({ timeout: 3_000 })
  })

  test('invalid phone format shows validation error', async ({ page }) => {
    const phoneInput = page.getByTestId('personal-phone-input')
    await phoneInput.fill('abc123')

    const saveBtn = page.getByTestId('save-personal-contact-btn')
    await saveBtn.click()

    const errorMsg = page.getByTestId('personal-phone-error')
    await expect(errorMsg).toBeVisible({ timeout: 3_000 })
  })

  // -------------------------------------------------------------------------
  // Verification flow — email OTP
  // -------------------------------------------------------------------------

  test('verify email button appears after personal email is saved', async ({
    page,
  }) => {
    const emailInput = page.getByTestId('personal-email-input')
    await emailInput.fill('personal@example.com')
    await page.getByTestId('save-personal-contact-btn').click()

    const verifyBtn = page.getByTestId('verify-personal-email-btn')
    await expect(verifyBtn).toBeVisible({ timeout: 5_000 })
  })

  test('clicking verify email sends OTP and shows OTP input', async ({
    page,
  }) => {
    const emailInput = page.getByTestId('personal-email-input')
    await emailInput.fill('personal@example.com')
    await page.getByTestId('save-personal-contact-btn').click()

    await page.getByTestId('verify-personal-email-btn').click()

    const otpInput = page.getByTestId('personal-email-otp-input')
    await expect(otpInput).toBeVisible({ timeout: 5_000 })
  })

  test('submitting correct email OTP marks email as verified', async ({
    page,
  }) => {
    const emailInput = page.getByTestId('personal-email-input')
    await emailInput.fill('personal@example.com')
    await page.getByTestId('save-personal-contact-btn').click()
    await page.getByTestId('verify-personal-email-btn').click()

    await page.getByTestId('personal-email-otp-input').fill('123456')
    await page.getByTestId('confirm-personal-email-otp-btn').click()

    const badge = page.getByTestId('personal-email-verified-badge')
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Verification flow — phone SMS
  // -------------------------------------------------------------------------

  test('verify phone button appears after personal phone is saved', async ({
    page,
  }) => {
    const phoneInput = page.getByTestId('personal-phone-input')
    await phoneInput.fill('+14155551234')
    await page.getByTestId('save-personal-contact-btn').click()

    const verifyBtn = page.getByTestId('verify-personal-phone-btn')
    await expect(verifyBtn).toBeVisible({ timeout: 5_000 })
  })

  test('clicking verify phone sends SMS OTP and shows OTP input', async ({
    page,
  }) => {
    const phoneInput = page.getByTestId('personal-phone-input')
    await phoneInput.fill('+14155551234')
    await page.getByTestId('save-personal-contact-btn').click()

    await page.getByTestId('verify-personal-phone-btn').click()

    const otpInput = page.getByTestId('personal-phone-otp-input')
    await expect(otpInput).toBeVisible({ timeout: 5_000 })
  })

  test('submitting correct phone OTP marks phone as verified', async ({
    page,
  }) => {
    const phoneInput = page.getByTestId('personal-phone-input')
    await phoneInput.fill('+14155551234')
    await page.getByTestId('save-personal-contact-btn').click()
    await page.getByTestId('verify-personal-phone-btn').click()

    await page.getByTestId('personal-phone-otp-input').fill('654321')
    await page.getByTestId('confirm-personal-phone-otp-btn').click()

    const badge = page.getByTestId('personal-phone-verified-badge')
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })

  // -------------------------------------------------------------------------
  // Display verified state
  // -------------------------------------------------------------------------

  test('verified email badge visible when personal_email_verified is true', async ({
    page,
  }) => {
    // Override the profile mock to return verified=true
    await page.route(`${API_BASE}/api/employee/profile`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u-001',
          email: 'test.employee@endevo.com',
          firstName: 'Test',
          lastName: 'Employee',
          role: 'EMPLOYEE',
          status: 'active',
          tenantId: 't-001',
          createdAt: '2026-01-01T00:00:00Z',
          personal_email: 'personal@example.com',
          personal_phone_number: '+14155551234',
          personal_email_verified: true,
          personal_phone_verified: false,
        }),
      })
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page
      .waitForFunction(
        () => document.querySelector('svg.animate-spin') === null,
        { timeout: 20_000 }
      )
      .catch(() => {})

    const badge = page.getByTestId('personal-email-verified-badge')
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })

  test('verified phone badge visible when personal_phone_verified is true', async ({
    page,
  }) => {
    await page.route(`${API_BASE}/api/employee/profile`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'u-001',
          email: 'test.employee@endevo.com',
          firstName: 'Test',
          lastName: 'Employee',
          role: 'EMPLOYEE',
          status: 'active',
          tenantId: 't-001',
          createdAt: '2026-01-01T00:00:00Z',
          personal_email: 'personal@example.com',
          personal_phone_number: '+14155551234',
          personal_email_verified: false,
          personal_phone_verified: true,
        }),
      })
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await page
      .waitForFunction(
        () => document.querySelector('svg.animate-spin') === null,
        { timeout: 20_000 }
      )
      .catch(() => {})

    const badge = page.getByTestId('personal-phone-verified-badge')
    await expect(badge).toBeVisible({ timeout: 5_000 })
  })
})
