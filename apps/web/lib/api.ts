import Cookies from 'js-cookie'

const BASE = process.env.NEXT_PUBLIC_API_URL || ''

function authHeaders(): HeadersInit {
  const token = Cookies.get('access_token') || ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    })
  } catch {
    throw new Error('Network error — check your connection or try again')
  }
  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new Error(`Server error ${res.status} — invalid response`)
  }
  if (!res.ok) {
    const d = data as Record<string, string>
    throw new Error(d?.detail || d?.error || d?.message || `API error ${res.status}`)
  }
  return data as T
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyOtp: (email: string, otp_ref: string, code: string) =>
    apiFetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp_ref, code }) }),
  signup: (body: { email: string; password: string; first_name: string; last_name: string; company?: string }) =>
    apiFetch('/api/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  me: () => apiFetch('/api/auth/me'),

  // Admin — Tenants
  adminDashboard: () => apiFetch('/api/admin/dashboard'),
  adminTenants: () => apiFetch<{ tenants: Tenant[]; count: number }>('/api/admin/tenants'),
  adminGetTenant: (id: string) => apiFetch<TenantDetail>(`/api/admin/tenants/${id}`),
  adminCreateTenant: (body: Record<string, unknown>) =>
    apiFetch('/api/admin/tenants', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateTenant: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDisableTenant: (id: string) =>
    apiFetch(`/api/admin/tenants/${id}/disable`, { method: 'POST' }),
  adminEnableTenant: (id: string) =>
    apiFetch(`/api/admin/tenants/${id}/enable`, { method: 'POST' }),
  adminInvite: (body: Record<string, unknown>) =>
    apiFetch<{ email_sent: boolean; temp_password: string; user_id: string; invite_url: string }>('/api/admin/invite', { method: 'POST', body: JSON.stringify(body) }),
  changePassword: (oldPassword: string, newPassword: string) =>
    apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }) }),

  // Admin — Users
  adminUsers: (tenantId?: string) =>
    apiFetch<{ users: User[]; count: number }>(`/api/admin/users${tenantId ? `?tenantId=${tenantId}` : ''}`),
  adminGetUser: (id: string) => apiFetch<User>(`/api/admin/users/${id}`),
  adminCreateUser: (body: Record<string, unknown>) =>
    apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateUser: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeactivateUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}/deactivate`, { method: 'POST' }),
  adminReactivateUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}/reactivate`, { method: 'POST' }),
  adminLockUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}/lock`, { method: 'POST' }),
  adminUnlockUser: (id: string) =>
    apiFetch(`/api/admin/users/${id}/unlock`, { method: 'POST' }),
  adminResetPassword: (id: string) =>
    apiFetch<{ temporary_password: string }>(`/api/admin/users/${id}/reset-password`, { method: 'POST' }),

  // Admin — Other
  adminAudit: () => apiFetch<{ logs: AuditLog[] }>('/api/admin/audit'),
  adminHealth: () => apiFetch('/api/admin/health'),
  adminGetConfig: () => apiFetch('/api/admin/config'),
  adminUpdateConfig: (section: string, values: Record<string, unknown>) =>
    apiFetch('/api/admin/config', { method: 'PUT', body: JSON.stringify({ section, values }) }),
  adminCertificates: (tenantId?: string) =>
    apiFetch(`/api/admin/certificates${tenantId ? `?tenantId=${tenantId}` : ''}`),
  adminTrainingEnrollment: (tenantId?: string) =>
    apiFetch(`/api/admin/training-enrollment${tenantId ? `?tenantId=${tenantId}` : ''}`),

  // HR
  hrDashboard: () => apiFetch('/api/hr/dashboard'),
  hrEmployees: () => apiFetch<{ employees: User[]; count: number }>('/api/hr/employees'),
  hrInvite: (body: Record<string, string>) =>
    apiFetch('/api/hr/invite', { method: 'POST', body: JSON.stringify(body) }),
  hrUpdateEmployee: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/hr/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  hrDeactivateEmployee: (id: string) =>
    apiFetch(`/api/hr/employees/${id}`, { method: 'DELETE' }),
  hrAudit: () => apiFetch<{ logs: AuditLog[] }>('/api/hr/audit'),
  hrTenant: () => apiFetch('/api/hr/tenant'),
  hrTraining: () => apiFetch<{ courses: Course[]; count: number }>('/api/hr/training'),
  hrCertificates: () => apiFetch<{ certificates: Certificate[]; count: number }>('/api/hr/certificates'),
  hrReactivateEmployee: (id: string) =>
    apiFetch(`/api/hr/employees/${id}/reactivate`, { method: 'POST' }),

  // Employee
  employeeDashboard: () => apiFetch('/api/employee/dashboard'),
  employeeProfile: () => apiFetch('/api/employee/profile'),
  employeeUpdateProfile: (body: Record<string, string>) =>
    apiFetch('/api/employee/profile', { method: 'PUT', body: JSON.stringify(body) }),
  employeeTraining: () => apiFetch<{ courses: Course[]; count: number }>('/api/employee/training'),
  employeeProgress: (course_id: string, progress_pct: number, completed: boolean) =>
    apiFetch('/api/employee/progress', { method: 'POST', body: JSON.stringify({ course_id, progress_pct, completed }) }),
  employeeAssessment: (courseId: string) =>
    apiFetch<{ questions: Question[]; count: number }>(`/api/employee/assessment/${courseId}`),
  employeeSubmitAssessment: (courseId: string, answers: Record<string, string>) =>
    apiFetch(`/api/employee/assessment/${courseId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  employeeCertificates: () => apiFetch<{ certificates: Certificate[]; count: number }>('/api/employee/certificates'),
}

// Types
export interface Tenant {
  tenantId: string
  name: string
  plan: string
  status: string
  createdAt: string
  maxSeats: number
  user_count?: number
  hr_count?: number
  active_count?: number
}

export interface TenantDetail extends Tenant {
  hr_admins: User[]
  employees: User[]
  stats: {
    total_users: number
    active_users: number
    hr_admins: number
    employees: number
  }
}

export interface User {
  userId: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  department?: string
  jobTitle?: string
  tenantId: string
  createdAt: string
}

export interface AuditLog {
  auditId: string
  actor: string
  action: string
  details: string
  createdAt: string
  tenantId?: string
  ip_address?: string
  user_agent?: string
  severity?: string
}

export interface Course {
  courseId: string
  title: string
  description?: string
  tenantId: string
  progress_pct?: number
  completed?: boolean
}

export interface Question {
  questionId: string
  courseId: string
  question: string
  options: string[]
}

export interface Certificate {
  certId: string
  courseId: string
  score: number
  issuedAt: string
}
