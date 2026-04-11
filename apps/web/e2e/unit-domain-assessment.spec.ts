/**
 * Unit tests — domain-assessment.ts pure functions (Phase D).
 *
 * These tests run in Playwright's test runner but do NOT launch a browser.
 * They test pure TypeScript logic in isolation with no network calls.
 *
 * TDD: Written BEFORE the implementation to define expected behaviour.
 */
import { test, expect } from '@playwright/test'
import {
  DOMAIN_ORDER,
  groupQuestionsByDomain,
  calculateDomainProgress,
  getActiveDomain,
  isDomainAccessible,
  findResumeIndex,
  calculateOverallProgress,
  type AssessmentQuestion,
  type Domain,
} from '../lib/domain-assessment'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeQuestion(domain: string, number: number, id?: string): AssessmentQuestion {
  return {
    questionId: id ?? `${domain}-q${number}`,
    text: `${domain} question ${number}`,
    domain,
    number,
    displayIndex: number,
    answers: [
      { label: 'A', text: 'Not Started' },
      { label: 'B', text: 'In Progress' },
      { label: 'C', text: 'Almost Done' },
      { label: 'D', text: 'Fully Complete' },
    ],
  }
}

function make40Questions(): AssessmentQuestion[] {
  const domains = ['legal', 'financial', 'physical', 'digital'] as const
  return domains.flatMap((domain, dIdx) =>
    Array.from({ length: 10 }, (_, i) => makeQuestion(domain, dIdx * 10 + i + 1))
  )
}

// ---------------------------------------------------------------------------
// DOMAIN_ORDER constant
// ---------------------------------------------------------------------------

test('DOMAIN_ORDER has exactly 4 domains', () => {
  expect(DOMAIN_ORDER).toHaveLength(4)
})

test('DOMAIN_ORDER sequence is legal → financial → physical → digital', () => {
  expect(Array.from(DOMAIN_ORDER)).toEqual(['legal', 'financial', 'physical', 'digital'])
})

// ---------------------------------------------------------------------------
// groupQuestionsByDomain
// ---------------------------------------------------------------------------

test.describe('groupQuestionsByDomain', () => {
  test('returns object with all four domain keys', () => {
    const grouped = groupQuestionsByDomain(make40Questions())
    expect(Object.keys(grouped).sort()).toEqual(['digital', 'financial', 'legal', 'physical'])
  })

  test('each domain has 10 questions from the 40-question set', () => {
    const grouped = groupQuestionsByDomain(make40Questions())
    for (const domain of DOMAIN_ORDER) {
      expect(grouped[domain]).toHaveLength(10)
    }
  })

  test('legal domain questions all have domain=legal', () => {
    const grouped = groupQuestionsByDomain(make40Questions())
    for (const q of grouped.legal) {
      expect(q.domain).toBe('legal')
    }
  })

  test('empty input returns empty arrays per domain', () => {
    const grouped = groupQuestionsByDomain([])
    for (const domain of DOMAIN_ORDER) {
      expect(grouped[domain]).toHaveLength(0)
    }
  })

  test('questions with unknown domain are excluded from the four canonical groups', () => {
    const questions = [
      makeQuestion('unknown', 99),
      makeQuestion('legal', 1),
    ]
    const grouped = groupQuestionsByDomain(questions)
    expect(grouped.legal).toHaveLength(1)
    // unknown domain should not appear in the returned grouped object
    expect('unknown' in grouped).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// calculateDomainProgress
// ---------------------------------------------------------------------------

test.describe('calculateDomainProgress', () => {
  test('returns progress array with length 4', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    expect(progress).toHaveLength(4)
  })

  test('all percentages are 0 with no answers', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    for (const p of progress) {
      expect(p.percentage).toBe(0)
    }
  })

  test('answering all legal questions gives legal percentage=100', () => {
    const questions = make40Questions()
    const legalAnswers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').forEach(q => {
      legalAnswers[q.questionId] = 'A'
    })
    const progress = calculateDomainProgress(questions, legalAnswers)
    const legal = progress.find(p => p.domain === 'legal')!
    expect(legal.percentage).toBe(100)
    expect(legal.isComplete).toBe(true)
  })

  test('answering no questions marks legal as active (first domain)', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    const legal = progress.find(p => p.domain === 'legal')!
    expect(legal.isActive).toBe(true)
    expect(legal.isLocked).toBe(false)
  })

  test('financial is locked when legal is not complete', () => {
    const questions = make40Questions()
    // Answer only 5 of 10 legal questions
    const partialAnswers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').slice(0, 5).forEach(q => {
      partialAnswers[q.questionId] = 'B'
    })
    const progress = calculateDomainProgress(questions, partialAnswers)
    const financial = progress.find(p => p.domain === 'financial')!
    expect(financial.isLocked).toBe(true)
  })

  test('financial is not locked once legal is 100%', () => {
    const questions = make40Questions()
    const allLegalAnswers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').forEach(q => {
      allLegalAnswers[q.questionId] = 'A'
    })
    const progress = calculateDomainProgress(questions, allLegalAnswers)
    const financial = progress.find(p => p.domain === 'financial')!
    expect(financial.isLocked).toBe(false)
  })

  test('half of financial answered gives percentage=50', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    // Complete legal first
    questions.filter(q => q.domain === 'legal').forEach(q => { answers[q.questionId] = 'A' })
    // Answer 5 of 10 financial
    questions.filter(q => q.domain === 'financial').slice(0, 5).forEach(q => { answers[q.questionId] = 'B' })
    const progress = calculateDomainProgress(questions, answers)
    const financial = progress.find(p => p.domain === 'financial')!
    expect(financial.percentage).toBe(50)
    expect(financial.answered).toBe(5)
    expect(financial.total).toBe(10)
  })

  test('domain progress order matches DOMAIN_ORDER', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    const progressDomains = progress.map(p => p.domain)
    expect(progressDomains).toEqual(Array.from(DOMAIN_ORDER))
  })

  test('all answered gives isComplete=true for all domains', () => {
    const questions = make40Questions()
    const allAnswers: Record<string, string> = {}
    questions.forEach(q => { allAnswers[q.questionId] = 'D' })
    const progress = calculateDomainProgress(questions, allAnswers)
    for (const p of progress) {
      expect(p.isComplete).toBe(true)
    }
  })

  test('percentage values are integers not decimals', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').slice(0, 3).forEach(q => { answers[q.questionId] = 'A' })
    const progress = calculateDomainProgress(questions, answers)
    for (const p of progress) {
      expect(Number.isInteger(p.percentage)).toBe(true)
    }
  })

  test('stale answer IDs not matching any question are ignored', () => {
    const questions = make40Questions()
    const answers = { 'ghost-question-id': 'A' }
    const progress = calculateDomainProgress(questions, answers)
    expect(progress.every(p => p.answered === 0)).toBe(true)
  })

  test('empty questions list returns zero-progress for all four domains', () => {
    const progress = calculateDomainProgress([], {})
    expect(progress).toHaveLength(4)
    expect(progress.every(p => p.percentage === 0 && p.total === 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getActiveDomain
// ---------------------------------------------------------------------------

test.describe('getActiveDomain', () => {
  test('returns legal when nothing is answered', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    expect(getActiveDomain(progress)).toBe('legal')
  })

  test('returns financial once legal is complete', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').forEach(q => { answers[q.questionId] = 'A' })
    const progress = calculateDomainProgress(questions, answers)
    expect(getActiveDomain(progress)).toBe('financial')
  })

  test('returns null when all questions are answered', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.forEach(q => { answers[q.questionId] = 'D' })
    const progress = calculateDomainProgress(questions, answers)
    expect(getActiveDomain(progress)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isDomainAccessible
// ---------------------------------------------------------------------------

test.describe('isDomainAccessible', () => {
  test('legal is always accessible (first domain)', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    expect(isDomainAccessible('legal', progress)).toBe(true)
  })

  test('financial is not accessible when legal is incomplete', () => {
    const progress = calculateDomainProgress(make40Questions(), {})
    expect(isDomainAccessible('financial', progress)).toBe(false)
  })

  test('digital is not accessible when only legal is complete', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.filter(q => q.domain === 'legal').forEach(q => { answers[q.questionId] = 'A' })
    const progress = calculateDomainProgress(questions, answers)
    expect(isDomainAccessible('digital', progress)).toBe(false)
  })

  test('digital is accessible when legal, financial, physical are all complete', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions
      .filter(q => ['legal', 'financial', 'physical'].includes(q.domain))
      .forEach(q => { answers[q.questionId] = 'A' })
    const progress = calculateDomainProgress(questions, answers)
    expect(isDomainAccessible('digital', progress)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// findResumeIndex
// ---------------------------------------------------------------------------

test.describe('findResumeIndex', () => {
  test('returns 0 when no answers exist', () => {
    expect(findResumeIndex(make40Questions(), {})).toBe(0)
  })

  test('returns index of first unanswered question', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    // Answer first 5 questions
    questions.slice(0, 5).forEach(q => { answers[q.questionId] = 'A' })
    expect(findResumeIndex(questions, answers)).toBe(5)
  })

  test('returns last index when all are answered', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.forEach(q => { answers[q.questionId] = 'D' })
    expect(findResumeIndex(questions, answers)).toBe(39)
  })

  test('returns 0 for empty question list', () => {
    expect(findResumeIndex([], {})).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// calculateOverallProgress
// ---------------------------------------------------------------------------

test.describe('calculateOverallProgress', () => {
  test('returns 0 with no answers', () => {
    expect(calculateOverallProgress(make40Questions(), {})).toBe(0)
  })

  test('returns 100 when all answered', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.forEach(q => { answers[q.questionId] = 'A' })
    expect(calculateOverallProgress(questions, answers)).toBe(100)
  })

  test('returns 25 when 10 of 40 answered', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.slice(0, 10).forEach(q => { answers[q.questionId] = 'A' })
    expect(calculateOverallProgress(questions, answers)).toBe(25)
  })

  test('returns 0 for empty question list', () => {
    expect(calculateOverallProgress([], {})).toBe(0)
  })

  test('result is always an integer', () => {
    const questions = make40Questions()
    const answers: Record<string, string> = {}
    questions.slice(0, 7).forEach(q => { answers[q.questionId] = 'A' })
    const result = calculateOverallProgress(questions, answers)
    expect(Number.isInteger(result)).toBe(true)
  })
})
