/**
 * Shared test fixtures for E2E integration flows.
 *
 * Every mock is defined once here so all spec files stay in sync when
 * the API contract changes.  Import what you need — tree-shaking keeps
 * test bundles small.
 */

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

export const DOMAINS = ['legal', 'financial', 'physical', 'digital'] as const
export type Domain = (typeof DOMAINS)[number]

export const DOMAIN_LABELS: Record<Domain, string> = {
  legal: 'Legal',
  financial: 'Financial',
  physical: 'Physical',
  digital: 'Digital',
}

// ---------------------------------------------------------------------------
// Assessment — 40 questions, 10 per domain
// ---------------------------------------------------------------------------

export interface AssessmentQuestion {
  questionId: string
  number: number
  text: string
  domain: Domain
  options: string[]
}

export function buildAssessmentQuestions(): AssessmentQuestion[] {
  return DOMAINS.flatMap((domain, dIdx) =>
    Array.from({ length: 10 }, (_, i) => ({
      questionId: `${domain}-q${i + 1}`,
      number: dIdx * 10 + i + 1,
      text: `${DOMAIN_LABELS[domain]} question ${i + 1}`,
      domain,
      options: ['Not at all', 'Somewhat', 'Mostly', 'Fully'],
    }))
  )
}

export const ASSESSMENT_QUESTIONS = buildAssessmentQuestions()

/** One answer per question (all "Mostly" = score ~75) */
export function buildAnswers(): Record<string, string> {
  return Object.fromEntries(
    ASSESSMENT_QUESTIONS.map((q) => [q.questionId, 'Mostly'])
  )
}

// ---------------------------------------------------------------------------
// Assessment submit response
// ---------------------------------------------------------------------------

export const ASSESSMENT_SUBMIT_RESPONSE = {
  success: true,
  score: 75,
  scorecard: {
    overallScore: 75,
    domainScores: { legal: 80, financial: 70, physical: 85, digital: 65 },
    weakDomains: ['digital', 'financial'],
    strongDomains: ['physical', 'legal'],
    tier: 'intermediate',
  },
  certificateId: 'cert-e2e-001',
  message: 'Assessment complete. Your results have been saved.',
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export interface ChecklistTask {
  taskId: string
  title: string
  description: string
  domain: Domain
  status: 'pending' | 'in_progress' | 'completed'
  priority: number
}

export function buildChecklist(opts: { completedPerDomain?: number } = {}): {
  tasks: ChecklistTask[]
  domainProgress: Record<Domain, number>
  overallProgress: number
  totalTasks: number
  completedTasks: number
} {
  const completed = opts.completedPerDomain ?? 0
  const tasks: ChecklistTask[] = DOMAINS.flatMap((domain) =>
    Array.from({ length: 10 }, (_, i) => ({
      taskId: `${domain}-task-${i + 1}`,
      title: `${DOMAIN_LABELS[domain]} Task ${i + 1}`,
      description: `Description for ${domain} task ${i + 1}`,
      domain,
      status: i < completed ? 'completed' : 'pending',
      priority: i + 1,
    }))
  )

  const domainProgress = Object.fromEntries(
    DOMAINS.map((d) => [d, completed * 10])
  ) as Record<Domain, number>

  const completedTasks = completed * DOMAINS.length
  const totalTasks = 10 * DOMAINS.length

  return {
    tasks,
    domainProgress,
    overallProgress: Math.round((completedTasks / totalTasks) * 100),
    totalTasks,
    completedTasks,
  }
}

export const CHECKLIST_EMPTY = buildChecklist({ completedPerDomain: 0 })
export const CHECKLIST_PARTIAL = buildChecklist({ completedPerDomain: 3 })
export const CHECKLIST_COMPLETE = buildChecklist({ completedPerDomain: 10 })

// ---------------------------------------------------------------------------
// Playbook
// ---------------------------------------------------------------------------

export const PLAYBOOK_RESPONSE = {
  playbookId: 'pb-e2e-001',
  overallScore: 75,
  domainScores: { legal: 80, financial: 70, physical: 85, digital: 65 },
  weakDomains: ['digital', 'financial'],
  strongDomains: ['physical', 'legal'],
  analysis: 'Your digital and financial preparedness needs attention.',
  playbook: {
    title: 'Your Legacy Planning Playbook',
    subtitle: 'Intermediate Level',
    overview: 'Focus on digital asset management and financial planning.',
    nextSteps: 'Start with digital domain tasks this week.',
    tasks: [
      {
        rank: 1,
        domain: 'digital',
        domainLabel: 'Digital',
        title: 'Create password manager account',
        description: 'Use a reputable password manager to store all credentials.',
        priority: 'high' as const,
        estimatedHours: 2,
        status: 'pending' as const,
      },
      {
        rank: 2,
        domain: 'financial',
        domainLabel: 'Financial',
        title: 'Review beneficiary designations',
        description: 'Ensure all financial accounts have updated beneficiaries.',
        priority: 'high' as const,
        estimatedHours: 3,
        status: 'pending' as const,
      },
    ],
    generatedAt: new Date().toISOString(),
  },
  generatedAt: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Email delivery
// ---------------------------------------------------------------------------

export const EMAIL_SEND_RESPONSE = {
  success: true,
  messageId: 'ses-e2e-abc123',
  email: 'test.employee@endevo.com',
  subject: 'Your Legacy Planning Results',
  sentAt: new Date().toISOString(),
}

export const AUDIT_LOG_EMAIL_ENTRY = {
  logId: 'audit-e2e-001',
  action: 'EMAIL_SENT',
  userId: 'user-e2e-001',
  details: {
    messageId: 'ses-e2e-abc123',
    recipient: 'test.employee@endevo.com',
    attachments: ['scorecard.pdf', 'checklist.xlsx', 'checklist.pdf', 'results.json'],
  },
  timestamp: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Sessions / 1:1 Booking
// ---------------------------------------------------------------------------

export const SESSION_QUOTA = {
  sessions: [],
  total: 2,
  used: 0,
  remaining: 2,
}

export const SESSION_QUOTA_PREMIUM = {
  sessions: [],
  total: 6,
  used: 0,
  remaining: 6,
}

export const BOOKED_SESSION = {
  sessionId: 'sess-e2e-001',
  userId: 'user-e2e-001',
  userName: 'Test Employee',
  scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'scheduled' as const,
  notes: 'First session',
  createdAt: new Date().toISOString(),
}

export const SESSION_WITH_MEETING_LINK = {
  ...BOOKED_SESSION,
  meetingLink: 'https://meet.google.com/abc-defg-hij',
  confirmationSent: true,
}

// ---------------------------------------------------------------------------
// Master Classes
// ---------------------------------------------------------------------------

export const MASTER_CLASS_UPCOMING = {
  classId: 'mc-e2e-001',
  title: 'Estate Planning Fundamentals',
  description: 'Learn the core principles of estate planning.',
  domain: 'legal',
  instructor: 'Jane Smith, Esq.',
  durationMinutes: 60,
  maxAttendees: 50,
  scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'upcoming',
  registrationOpen: true,
  currentAttendees: 12,
}

export const MASTER_CLASS_PAST = {
  classId: 'mc-e2e-002',
  title: 'Digital Asset Security',
  description: 'How to protect and transfer digital assets.',
  domain: 'digital',
  instructor: 'Bob Chen',
  durationMinutes: 45,
  maxAttendees: 30,
  scheduledAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'completed',
  registrationOpen: false,
  recordingUrl: 'https://storage.endevo.com/recordings/mc-e2e-002.mp4',
  currentAttendees: 28,
}

export const MASTER_CLASS_FULL = {
  classId: 'mc-e2e-003',
  title: 'Financial Beneficiaries Workshop',
  description: 'Step-by-step guide to updating beneficiaries.',
  domain: 'financial',
  instructor: 'Alice Kim, CFP',
  durationMinutes: 90,
  maxAttendees: 20,
  scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'upcoming',
  registrationOpen: true,
  currentAttendees: 20,
}

export const REGISTRATION_RESPONSE = {
  registrationId: 'reg-e2e-001',
  classId: 'mc-e2e-001',
  userId: 'user-e2e-001',
  registeredAt: new Date().toISOString(),
  status: 'registered' as const,
}

// ---------------------------------------------------------------------------
// Access Portability
// ---------------------------------------------------------------------------

export const EMPLOYEE_ACTIVE = {
  userId: 'user-e2e-001',
  email: 'employee@company.com',
  personalEmail: 'employee@personal.com',
  firstName: 'Test',
  lastName: 'Employee',
  status: 'active',
  role: 'EMPLOYEE',
  employmentStatus: 'employed',
  tenantId: 'tenant-e2e-001',
}

export const EMPLOYEE_DEPARTED = {
  ...EMPLOYEE_ACTIVE,
  status: 'inactive',
  employmentStatus: 'departed',
  departedAt: new Date().toISOString(),
  accessMode: 'personal',
}

export const PORTABILITY_ACTIVATION_RESPONSE = {
  success: true,
  userId: 'user-e2e-001',
  personalEmailActivated: true,
  newLoginEmail: 'employee@personal.com',
  message: 'Personal email access has been activated. Data is fully preserved.',
}

// ---------------------------------------------------------------------------
// HR Subscription
// ---------------------------------------------------------------------------

export const HR_SUBSCRIPTION_BASIC = {
  tenantId: 'tenant-e2e-001',
  plan: 'basic',
  seats: 50,
  usedSeats: 38,
  pricePerEmployee: 299,
  sessionsPerEmployee: 2,
  totalSessions: 76,
  usedSessions: 10,
  billingHistory: [],
}

export const HR_SUBSCRIPTION_PREMIUM = {
  ...HR_SUBSCRIPTION_BASIC,
  plan: 'premium',
  pricePerEmployee: 499,
  sessionsPerEmployee: 6,
  totalSessions: 228,
}
