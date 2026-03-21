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
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.error || `API error ${res.status}`)
  return data as T
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => apiFetch('/api/auth/me'),

  // Admin
  adminDashboard: () => apiFetch('/api/admin/dashboard'),
  adminTenants: () => apiFetch<{ tenants: Tenant[]; count: number }>('/api/admin/tenants'),
  adminCreateTenant: (body: { name: string; plan?: string }) =>
    apiFetch('/api/admin/tenants', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateTenant: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/admin/tenants/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminUsers: () => apiFetch<{ users: User[]; count: number }>('/api/admin/users'),
  adminAudit: () => apiFetch<{ logs: AuditLog[] }>('/api/admin/audit'),
  adminHealth: () => apiFetch('/api/admin/health'),

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
  employee_count?: number
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
