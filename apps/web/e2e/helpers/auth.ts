import { Page } from '@playwright/test'

/**
 * Auth helper — injects session cookies and mocks API responses so tests
 * pass without a real backend. The app uses js-cookie for auth state and
 * makes fetch calls to the AWS API Gateway. Without mocking, the API
 * returns 401 which triggers a client-side redirect to /login.
 *
 * This helper:
 * 1. Navigates to root to establish the domain
 * 2. Injects auth cookies (access_token, user_role, user_email, tenant_plan)
 * 3. Intercepts all AWS API calls and returns minimal valid mock responses
 *    so the components render their full UI without being redirected to /login
 */

export interface AuthOptions {
  role?: 'EMPLOYEE' | 'HR_ADMIN' | 'GLOBAL_ADMIN'
  email?: string
  accessToken?: string
  tenantPlan?: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

/** Minimal mock responses per API path pattern.
 *
 * NOTE: All api.ts calls use the pattern apiFetch('/api/<service>/...'), which
 * results in URLs like https://aws-gateway.../api/employee/dashboard.
 * The patterns below MUST include the /api/ prefix segment to match correctly.
 */
const API_MOCKS: Array<{ pattern: RegExp; response: unknown }> = [
  // Employee endpoints
  {
    pattern: /\/api\/employee\/dashboard/,
    response: { total_courses: 2, completed_courses: 0, certificates: 0, progress_pct: 0 },
  },
  {
    pattern: /\/api\/employee\/training/,
    response: { courses: [] },
  },
  {
    pattern: /\/api\/employee\/sessions/,
    response: { sessions: [], total: 2, used: 0, remaining: 2 },
  },
  {
    pattern: /\/api\/employee\/playbook/,
    response: null, // 404-like → triggers empty state
  },
  {
    pattern: /\/api\/employee\/checklist/,
    response: { tasks: [], domainProgress: {}, overallProgress: 0 },
  },
  {
    pattern: /\/api\/employee\/master-classes\/recommendations/,
    response: { classes: [] },
  },
  {
    pattern: /\/api\/employee\/master-classes\/registrations/,
    response: { registrations: [] },
  },
  {
    pattern: /\/api\/employee\/master-classes/,
    response: { classes: [] },
  },
  // LMS endpoints
  {
    pattern: /\/api\/lms\/assessment\/status/,
    response: { attempted: false },
  },
  {
    pattern: /\/api\/lms\/course\/lessons/,
    response: { lessons: [], total: 15, completed: 0, totalRequired: 10, completedRequired: 0 },
  },
  {
    pattern: /\/api\/lms\/lessons/,
    response: { lessons: [], total: 15, completed: 0, totalRequired: 10, completedRequired: 0 },
  },
  {
    pattern: /\/api\/lms\/assessment\/questions/,
    response: { questions: [], totalQuestions: 40 },
  },
  {
    pattern: /\/api\/lms\/assessment/,
    response: { questions: [], totalQuestions: 40 },
  },
  {
    pattern: /\/api\/lms\//,
    response: { lessons: [], modules: [], total: 0 },
  },
  // Auth endpoints
  {
    pattern: /\/api\/auth\/me/,
    response: { email: 'test@endevo.com', role: 'EMPLOYEE', plan: 'basic', tenant_plan: 'basic' },
  },
  {
    pattern: /\/api\/auth\//,
    response: { success: true },
  },
  // Admin endpoints
  {
    pattern: /\/api\/admin\/dashboard/,
    response: {
      total_tenants: 5, active_tenants: 4, total_users: 120, active_users: 100,
      total_certificates: 15, system_status: 'operational',
      lms_assessments_taken: 10, lms_modules_completed: 8, lms_certificates_issued: 5,
      subscription_basic: 80, subscription_premium: 40,
    },
  },
  {
    pattern: /\/api\/admin\//,
    response: { items: [], total: 0 },
  },
  // HR endpoints
  {
    pattern: /\/api\/hr\/dashboard/,
    response: {
      activationRate: 75, completionRate: 60, overallProgress: 45,
      totalUsers: 50, activeUsers: 38, pendingUsers: 12,
    },
  },
  {
    pattern: /\/api\/hr\/subscription/,
    response: {
      tenantId: 'test-tenant', plan: 'basic', seats: 50, usedSeats: 38,
      pricePerEmployee: 299, sessionsPerEmployee: 2, totalSessions: 76,
      usedSessions: 10, billingHistory: [],
    },
  },
  {
    pattern: /\/api\/hr\//,
    response: { items: [], users: [], total: 0 },
  },
]

/**
 * Set up route interception for all AWS API calls.
 * Must be called before navigating to any page that makes API calls.
 */
export async function mockApiCalls(page: Page): Promise<void> {
  await page.route(`${API_BASE}/**`, async (route) => {
    const url = route.request().url()
    const path = url.replace(API_BASE, '')

    // Find matching mock
    for (const mock of API_MOCKS) {
      if (mock.pattern.test(path)) {
        if (mock.response === null) {
          // Return 404 — components handle empty state
          await route.fulfill({
            status: 404,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Not found', detail: 'No data available' }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mock.response),
          })
        }
        return
      }
    }

    // Default: return empty success for unmatched paths
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

export async function injectAuthCookies(
  page: Page,
  options: AuthOptions = {}
): Promise<void> {
  const {
    role = 'EMPLOYEE',
    email = process.env.E2E_EMPLOYEE_EMAIL || 'test.employee@endevo.com',
    accessToken = process.env.E2E_ACCESS_TOKEN || 'e2e-test-token',
    tenantPlan = 'basic',
  } = options

  // Set up API mocking BEFORE any navigation
  await mockApiCalls(page)

  // Navigate to root first to establish the localhost domain
  await page.goto('/', { waitUntil: 'commit' })

  await page.context().addCookies([
    {
      name: 'access_token',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
    {
      name: 'user_role',
      value: role,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
    {
      name: 'user_email',
      value: email,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
    {
      name: 'tenant_plan',
      value: tenantPlan,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
  ])
}

export async function injectHrAdminCookies(page: Page): Promise<void> {
  await injectAuthCookies(page, {
    role: 'HR_ADMIN',
    email: process.env.E2E_HR_EMAIL || 'test.hr@endevo.com',
    accessToken: process.env.E2E_HR_ACCESS_TOKEN || 'e2e-hr-test-token',
  })
}

export async function injectGlobalAdminCookies(page: Page): Promise<void> {
  await injectAuthCookies(page, {
    role: 'GLOBAL_ADMIN',
    email: process.env.E2E_ADMIN_EMAIL || 'test.admin@endevo.com',
    accessToken: process.env.E2E_ADMIN_ACCESS_TOKEN || 'e2e-admin-test-token',
  })
}
