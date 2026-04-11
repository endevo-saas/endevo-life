/**
 * Domain-wise assessment utilities — Phase D.
 *
 * Pure functions with no side effects.
 * All logic here is covered by unit-level Playwright tests
 * in e2e/unit-domain-assessment.spec.ts.
 */

export const DOMAIN_ORDER = ['legal', 'financial', 'physical', 'digital'] as const
export type Domain = (typeof DOMAIN_ORDER)[number]

export interface AssessmentQuestion {
  questionId: string
  text: string
  domain: string
  number?: number
  displayIndex?: number
  answers: Array<{ label: string; text: string }>
}

export interface DomainProgress {
  domain: Domain
  label: string
  total: number
  answered: number
  percentage: number
  isComplete: boolean
  isActive: boolean
  isLocked: boolean
}

const DOMAIN_LABELS: Record<Domain, string> = {
  legal: 'Legal',
  financial: 'Financial',
  physical: 'Physical',
  digital: 'Digital',
}

/**
 * Group an ordered flat question list into domain sections.
 * Returns only the four canonical domains in the required order.
 */
export function groupQuestionsByDomain(
  questions: AssessmentQuestion[]
): Record<Domain, AssessmentQuestion[]> {
  const grouped: Record<Domain, AssessmentQuestion[]> = {
    legal: [],
    financial: [],
    physical: [],
    digital: [],
  }

  for (const q of questions) {
    const domain = q.domain as Domain
    if (domain in grouped) {
      grouped[domain].push(q)
    }
  }

  return grouped
}

/**
 * Calculate per-domain progress given the current answers map.
 */
export function calculateDomainProgress(
  questions: AssessmentQuestion[],
  answers: Record<string, string>
): DomainProgress[] {
  const grouped = groupQuestionsByDomain(questions)
  const result: DomainProgress[] = []
  let previousComplete = true

  for (const domain of DOMAIN_ORDER) {
    const domainQuestions = grouped[domain]
    const total = domainQuestions.length
    const answered = domainQuestions.filter(q => q.questionId in answers).length
    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0
    const isComplete = total > 0 && answered === total
    const isActive = previousComplete && !isComplete && answered < total
    const isLocked = !previousComplete

    result.push({
      domain,
      label: DOMAIN_LABELS[domain],
      total,
      answered,
      percentage,
      isComplete,
      isActive,
      isLocked,
    })

    previousComplete = isComplete
  }

  return result
}

/**
 * Determine which domain is currently active (employee is working on it).
 * Returns the first incomplete domain that is not locked.
 */
export function getActiveDomain(progress: DomainProgress[]): Domain | null {
  const active = progress.find(p => p.isActive)
  return active ? active.domain : null
}

/**
 * Check if a domain is accessible (all preceding domains complete).
 * Used to enforce sequential domain gating.
 */
export function isDomainAccessible(
  targetDomain: Domain,
  progress: DomainProgress[]
): boolean {
  const domainIndex = DOMAIN_ORDER.indexOf(targetDomain)
  if (domainIndex === 0) return true

  const preceding = progress.slice(0, domainIndex)
  return preceding.every(p => p.isComplete)
}

/**
 * Find the next unanswered question index in the ordered question list.
 * Returns 0 if no answers exist, or the index of the first unanswered question.
 * Returns questions.length - 1 if all are answered (stays on last).
 */
export function findResumeIndex(
  questions: AssessmentQuestion[],
  answers: Record<string, string>
): number {
  const firstUnanswered = questions.findIndex(q => !(q.questionId in answers))
  if (firstUnanswered === -1) return Math.max(0, questions.length - 1)
  return firstUnanswered
}

/**
 * Calculate overall completion percentage across all domains.
 */
export function calculateOverallProgress(
  questions: AssessmentQuestion[],
  answers: Record<string, string>
): number {
  if (questions.length === 0) return 0
  const answered = questions.filter(q => q.questionId in answers).length
  return Math.round((answered / questions.length) * 100)
}
