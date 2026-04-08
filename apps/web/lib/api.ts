import Cookies from 'js-cookie'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'https://4jms6sdzk9.execute-api.us-east-1.amazonaws.com'

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

  // File Upload — Admin
  adminGetUploadUrl: (type: string, filename: string, tenantId?: string) =>
    apiFetch<{ uploadUrl: string; key: string; expiresIn: number }>('/api/admin/upload-url', {
      method: 'POST', body: JSON.stringify({ type, filename, tenantId })
    }),
  adminUpdateBranding: (tenantId: string, branding: { logoUrl?: string; primaryColor?: string; companyName?: string }) =>
    apiFetch(`/api/admin/tenants/${tenantId}/branding`, { method: 'POST', body: JSON.stringify(branding) }),

  // File Upload — HR
  hrGetUploadUrl: (type: string, filename: string) =>
    apiFetch<{ uploadUrl: string; key: string; expiresIn: number }>('/api/hr/upload-url', {
      method: 'POST', body: JSON.stringify({ type, filename })
    }),
  hrUpdateBranding: (branding: { logoUrl?: string; primaryColor?: string; companyName?: string }) =>
    apiFetch('/api/hr/branding', { method: 'POST', body: JSON.stringify(branding) }),

  // File Upload — Employee
  employeeGetUploadUrl: (filename: string) =>
    apiFetch<{ uploadUrl: string; key: string; expiresIn: number }>('/api/employee/upload-url', {
      method: 'POST', body: JSON.stringify({ type: 'photo', filename })
    }),
  employeeUpdateAvatar: (avatarKey: string) =>
    apiFetch<{ message: string; avatarKey: string; avatarUrl: string }>('/api/employee/avatar', {
      method: 'PUT', body: JSON.stringify({ avatarKey })
    }),

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
  employeeCertificateCheck: () => apiFetch<CertificateCheckResult>('/api/employee/certificate/check', { method: 'POST' }),

  // LMS — Assessment
  lmsGetAssessmentQuestions: () => apiFetch('/api/lms/assessment/questions'),
  lmsSubmitAssessment: (answers: AssessmentAnswer[]) =>
    apiFetch('/api/lms/assessment/submit', { method: 'POST', body: JSON.stringify({ answers }) }),
  lmsGetAssessmentStatus: () => apiFetch('/api/lms/assessment/status'),

  // LMS — Course
  lmsGetModules: () => apiFetch('/api/lms/course/modules'),
  lmsGetModule: (moduleNum: string) => apiFetch(`/api/lms/course/modules/${moduleNum}`),
  lmsGetVideoUrl: (videoId: string) => apiFetch(`/api/lms/course/video/${videoId}/url`),
  lmsGetAssetUrl: (key: string) => apiFetch(`/api/lms/course/asset/${encodeURIComponent(key)}/url`),

  // LMS — Progress
  lmsUpdateVideoProgress: (body: { videoId: string; percent: number; completed: boolean; lastPosition?: number }) =>
    apiFetch('/api/lms/progress/video', { method: 'POST', body: JSON.stringify(body) }),
  lmsGetVideoProgress: (videoId: string) =>
    apiFetch<{ videoId: string; percent: number; percentComplete: number; completed: boolean; lastPosition: number; lastWatched?: string; updatedAt?: string }>(`/api/lms/progress/video/${videoId}`),
  lmsCompleteModule: (moduleNum: string) =>
    apiFetch('/api/lms/progress/module/complete', { method: 'POST', body: JSON.stringify({ moduleNum }) }),

  // LMS — Quiz
  lmsGetQuizQuestions: (videoId: string) => apiFetch(`/api/lms/quiz/video/${videoId}`),
  lmsSubmitQuizAnswer: (body: { videoId: string; questionId: string; selectedLabel: string }) =>
    apiFetch('/api/lms/quiz/answer', { method: 'POST', body: JSON.stringify(body) }),

  // LMS — Assessment history
  lmsGetAssessmentHistory: () => apiFetch('/api/lms/assessment/history'),

  // LMS — Admin
  lmsAdminGetQuestions: (type?: string) => apiFetch(`/api/lms/admin/questions${type ? `?type=${type}` : ''}`),
  lmsAdminCreateQuestion: (body: Record<string, unknown>) =>
    apiFetch('/api/lms/admin/questions', { method: 'POST', body: JSON.stringify(body) }),
  lmsAdminUpdateQuestion: (id: string, body: Record<string, unknown>) =>
    apiFetch(`/api/lms/admin/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  lmsAdminDeleteQuestion: (id: string) =>
    apiFetch(`/api/lms/admin/questions/${id}`, { method: 'DELETE' }),
  lmsAdminGetModules: () => apiFetch('/api/lms/admin/modules'),
  lmsAdminUpsertModule: (body: Record<string, unknown>) =>
    apiFetch('/api/lms/admin/modules', { method: 'POST', body: JSON.stringify(body) }),
  lmsAdminGetUsersProgress: () => apiFetch('/api/lms/admin/users/progress'),
  lmsAdminGetUserProgress: (userId: string) => apiFetch(`/api/lms/admin/users/${userId}/progress`),
  lmsAdminUnlockModule: (userId: string, moduleNum: string) =>
    apiFetch(`/api/lms/admin/users/${userId}/unlock`, { method: 'POST', body: JSON.stringify({ moduleNum }) }),
  lmsAdminGetModuleVideos: (moduleNum: string) => apiFetch(`/api/lms/admin/modules/${moduleNum}/videos`),
  lmsAdminAddVideo: (moduleNum: string, body: Record<string, unknown>) =>
    apiFetch(`/api/lms/admin/modules/${moduleNum}/videos`, { method: 'POST', body: JSON.stringify(body) }),
  lmsAdminDeleteVideo: (moduleNum: string, videoId: string) =>
    apiFetch(`/api/lms/admin/modules/${moduleNum}/videos/${videoId}`, { method: 'DELETE' }),
  lmsAdminGetUploadUrl: (moduleNum: string, body: { fileName: string; fileType: string; contentType: string }) =>
    apiFetch(`/api/lms/admin/modules/${moduleNum}/upload-url`, { method: 'POST', body: JSON.stringify(body) }),
  lmsAdminUpdateModulePdf: (moduleNum: string, body: { pdfKey: string; pdfName: string }) =>
    apiFetch(`/api/lms/admin/modules/${moduleNum}/pdf`, { method: 'POST', body: JSON.stringify(body) }),

  // LMS — Lessons (v2 lesson engine)
  lmsGetLessons: (moduleNum: string) =>
    apiFetch(`/api/lms/lessons/module/${moduleNum}`),
  lmsGetLesson: (lessonId: string) =>
    apiFetch(`/api/lms/lessons/${lessonId}`),
  lmsStartLesson: (lessonId: string) =>
    apiFetch(`/api/lms/lessons/${lessonId}/start`, { method: 'POST' }),
  lmsUpdateLessonProgress: (lessonId: string, body: { lastPosition: number; percentWatched: number }) =>
    apiFetch(`/api/lms/lessons/${lessonId}/progress`, { method: 'POST', body: JSON.stringify(body) }),
  lmsCompleteLesson: (lessonId: string) =>
    apiFetch(`/api/lms/lessons/${lessonId}/complete`, { method: 'POST' }),

  // LMS — Lesson Quizzes
  lmsGetQuiz: (lessonId: string) =>
    apiFetch(`/api/lms/lessons/${lessonId}/quiz`),
  lmsSubmitQuiz: (lessonId: string, answers: { questionId: string; selectedLabel: string }[]) =>
    apiFetch(`/api/lms/lessons/${lessonId}/quiz/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  lmsGetQuizResults: (lessonId: string) =>
    apiFetch(`/api/lms/lessons/${lessonId}/quiz/results`),

  // Admin — Subscriptions
  adminSubscriptions: () => apiFetch<SubscriptionOverview>('/api/admin/subscriptions'),
  adminTenantSubscription: (tenantId: string) => apiFetch<TenantSubscription>(`/api/admin/subscriptions/${tenantId}`),
  adminCreateInvoice: (tenantId: string, body: { amount: number; description: string; dueDate: string }) =>
    apiFetch<{ invoiceId: string }>(`/api/admin/subscriptions/${tenantId}/invoice`, { method: 'POST', body: JSON.stringify(body) }),
  adminChangePlan: (tenantId: string, body: { plan: string; seats?: number }) =>
    apiFetch(`/api/admin/subscriptions/${tenantId}/plan`, { method: 'PUT', body: JSON.stringify(body) }),
  adminMetricsOverview: () => apiFetch<PlatformMetrics>('/api/admin/metrics/overview'),
  adminReEngage: () => apiFetch<ReEngageResult>('/api/admin/re-engage', { method: 'POST' }),

  // Admin — Plan Config
  adminGetPlanConfig: () => apiFetch<PlanConfigResponse>('/api/admin/plan-config'),
  adminUpdatePlanConfig: (config: PlanConfig) =>
    apiFetch('/api/admin/plan-config', { method: 'PUT', body: JSON.stringify(config) }),

  // HR — Metrics & Subscriptions
  hrMetrics: () => apiFetch<HrMetrics>('/api/hr/metrics'),
  hrSubscription: () => apiFetch<HrSubscription>('/api/hr/subscription'),
  hrSessions: () => apiFetch<SessionOverview>('/api/hr/sessions'),
  hrBookSession: (body: { userId: string; scheduledAt: string; coachId?: string }) =>
    apiFetch<{ sessionId: string }>('/api/hr/sessions/book', { method: 'POST', body: JSON.stringify(body) }),

  // Employee — Subscription & Sessions
  employeeSubscription: () => apiFetch<EmployeeSubscription>('/api/employee/subscription'),
  employeeSessions: () => apiFetch<EmployeeSessionOverview>('/api/employee/sessions'),
  employeeProgressSummary: () => apiFetch<ProgressSummary>('/api/employee/progress-summary'),

  // Bulk Import/Export
  adminImportTenants: (tenants: ImportTenant[]) =>
    apiFetch<BulkImportResult>('/api/admin/tenants/import', { method: 'POST', body: JSON.stringify({ tenants }) }),
  adminExportTenants: () =>
    apiFetch<{ tenants: Tenant[]; count: number; exportedAt: string }>('/api/admin/tenants/export'),
  adminImportEmployees: (tenantId: string, employees: ImportEmployee[]) =>
    apiFetch<BulkImportResult>('/api/admin/employees/import', { method: 'POST', body: JSON.stringify({ tenantId, employees }) }),
  adminExportEmployees: (tenantId?: string) =>
    apiFetch<{ employees: User[]; count: number; exportedAt: string }>(`/api/admin/employees/export${tenantId ? `?tenantId=${tenantId}` : ''}`),

  // Archive / Recycle Bin
  adminArchivedUsers: () =>
    apiFetch<{ users: User[] }>('/api/admin/archive/users'),
  adminArchivedTenants: () =>
    apiFetch<{ tenants: Tenant[] }>('/api/admin/archive/tenants'),
  adminRestoreUser: (userId: string) =>
    apiFetch(`/api/admin/archive/users/${userId}/restore`, { method: 'POST' }),
  adminRestoreTenant: (tenantId: string) =>
    apiFetch(`/api/admin/archive/tenants/${tenantId}/restore`, { method: 'POST' }),
  hrArchivedEmployees: () =>
    apiFetch<{ employees: User[] }>('/api/hr/archive/employees'),
  hrRestoreEmployee: (userId: string) =>
    apiFetch(`/api/hr/archive/employees/${userId}/restore`, { method: 'POST' }),

  // Feature Flags
  adminGetFeatures: () =>
    apiFetch<{ flags: Record<string, boolean>; source: string }>('/api/admin/features'),
  adminUpdateFeatures: (flags: Record<string, boolean>) =>
    apiFetch<{ message: string; flags: Record<string, boolean> }>('/api/admin/features', { method: 'PUT', body: JSON.stringify(flags) }),

  // System Status
  adminSystemStatus: () =>
    apiFetch<SystemStatus>('/api/admin/system/status'),

  // MFA Management
  adminSetTenantMfa: (tenantId: string, config: { mfaRequired: boolean; allowedMethods: string[] }) =>
    apiFetch<{ message: string; tenantId: string; mfaRequired: boolean; allowedMethods: string[] }>(
      `/api/admin/tenants/${tenantId}/mfa`, { method: 'POST', body: JSON.stringify(config) }),

  // Copilot AI
  copilotChat: (message: string, context: { role: string; page: string; tenantId?: string }) =>
    apiFetch<CopilotChatResponse>('/api/jesse/copilot', {
      method: 'POST', body: JSON.stringify({ message, context })
    }),

  // Jesse AI
  jesseSpeakText: (text: string, voice?: 'female' | 'male') =>
    apiFetch<{ audioUrl: string | null; voice: string }>('/api/jesse/speak', {
      method: 'POST', body: JSON.stringify({ text, voice: voice || 'female' })
    }),
  jesseChat: (message: string) =>
    apiFetch<JesseChatResponse>('/api/jesse/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  jesseChatHistory: () => apiFetch<JesseChatHistory>('/api/jesse/chat/history'),
  jesseHealth: () => apiFetch('/api/jesse/health'),
  jesseAccess: () => apiFetch<{ hasAccess: boolean; plan: string }>('/api/jesse/access'),
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
  certificateId?: string
  courseId?: string
  title?: string
  type?: string
  score?: number
  issuedAt: string
  status?: string
  completedModules?: number
}

export interface CertificateCheckResult {
  eligible: boolean
  certificate?: Certificate
  message: string
  modulesCompleted?: number
  modulesTotal?: number
}

export interface ReEngageResult {
  attempted: number
  sent: number
  failed: number
  inactiveDays: number
}

export interface AssessmentAnswer {
  questionId: string
  selectedLabel: string
}

export interface SubscriptionOverview {
  totalTenants: number
  activeSubscriptions: number
  mrr: number
  arr: number
  planDistribution: { basic: number; premium: number }
  recentChanges: SubscriptionChange[]
}

export interface TenantSubscription {
  tenantId: string
  tenantName: string
  plan: string
  seats: number
  usedSeats: number
  mrr: number
  invoices: Invoice[]
  changes: SubscriptionChange[]
}

export interface Invoice {
  invoiceId: string
  tenantId: string
  amount: number
  description: string
  status: 'draft' | 'sent' | 'paid'
  dueDate: string
  createdAt: string
}

export interface SubscriptionChange {
  changeId: string
  tenantId: string
  fromPlan: string
  toPlan: string
  changedBy: string
  reason?: string
  createdAt: string
}

export interface PlatformMetrics {
  totalUsers: number
  activeUsers: number
  pendingUsers: number
  usersByPlan: { basic: number; premium: number }
  activationRate: number
  completionRate: number
  sessionUtilization: number
}

export interface HrMetrics {
  activationRate: number
  completionRate: number
  overallProgress: number
  totalUsers: number
  activeUsers: number
  pendingUsers: number
}

export interface HrSubscription {
  tenantId: string
  plan: string
  seats: number
  usedSeats: number
  pricePerEmployee: number
  sessionsPerEmployee: number
  totalSessions: number
  usedSessions: number
  billingHistory: Invoice[]
}

export interface SessionOverview {
  sessions: SessionRecord[]
  totalAllocated: number
  used: number
  remaining: number
}

export interface SessionRecord {
  sessionId: string
  userId: string
  userName?: string
  scheduledAt: string
  completedAt?: string
  status: 'booked' | 'completed' | 'cancelled' | 'no-show'
  coachName?: string
  duration: number
}

export interface EmployeeSubscription {
  plan: string
  planLabel: string
  priceMonthly: number
  priceYearly: number
  sessionsTotal: number
  sessionsUsed: number
  sessionsRemaining: number
  features: string[]
  premiumFeatures: string[]
  managedBy: string
}

export interface PlanConfigEntry {
  planLabel: string
  priceYearly: number
  priceMonthly: number
  sessionsTotal: number
  features: string[]
}

export interface PlanConfig {
  basic: PlanConfigEntry
  premium: PlanConfigEntry
  premiumFeatures: string[]
}

export interface PlanConfigResponse {
  config: PlanConfig
  source: 'dynamodb' | 'defaults'
}

export interface EmployeeSessionOverview {
  sessions: SessionRecord[]
  total: number
  used: number
  remaining: number
}

export interface ProgressSummary {
  readinessScore: number
  readinessTier: string
  modulesCompleted: number
  modulesTotal: number
  overallProgress: number
  lastActivity?: string
}

export interface CopilotActionResult {
  action: string
  result: {
    success: boolean
    message?: string
    error?: string
    [key: string]: unknown
  }
}

export interface CopilotChatResponse {
  reply: string
  role: string
  actions?: CopilotActionResult[]
}

export interface JesseChatResponse {
  reply: string
  history: JesseChatMessage[]
}

export interface JesseChatHistory {
  history: JesseChatMessage[]
}

export interface JesseChatMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

// Bulk Import/Export Types
export interface ImportTenant {
  name: string
  plan?: 'basic' | 'premium'
  maxSeats?: number
  hrEmail?: string
}

export interface ImportEmployee {
  email: string
  name?: string
  firstName?: string
  lastName?: string
  role?: 'EMPLOYEE' | 'HR_ADMIN'
  department?: string
  jobTitle?: string
}

export interface BulkImportResult {
  imported: number
  failed: number
  errors: string[]
}

// System Status Types
export interface SystemStatus {
  checkedAt: string
  overall: 'healthy' | 'degraded'
  dynamodb: {
    tables: TableStatus[]
    totalTables: number
    activeTables: number
  }
  lambda: {
    functions: LambdaStatus[]
    totalFunctions: number
  }
  ses: {
    status: string
  }
}

export interface TableStatus {
  name: string
  status: string
  itemCount: number
  sizeBytes: number
}

export interface LambdaStatus {
  name: string
  status: string
  runtime?: string
  memoryMB?: number
  timeoutSec?: number
  lastModified?: string
}
