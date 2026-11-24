import type { ChoiceGroup, GradeConfig, MarkValue } from './types'

/** Every subject a student takes: the grade's core subjects plus their choice from each group. */
export function subjectsForStudent(config: GradeConfig, choices: Record<string, string>): string[] {
  const chosen = config.groups
    .map((g: ChoiceGroup) => choices[g.id])
    .filter((code): code is string => Boolean(code))
  return [...config.core, ...chosen]
}

/** True when every choice group has a valid pick. */
export function choicesComplete(config: GradeConfig, choices: Record<string, string>): boolean {
  return config.groups.every((g) => g.options.includes(choices[g.id]))
}

export function isValidMark(value: unknown): value is MarkValue {
  if (value === null || value === 'AB' || value === 'MED' || value === 'EX') return true
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
}

/**
 * Parse what a teacher typed. Accepts 0 to 100, AB (absent), MED (medical), EX (exempt), or an empty box.
 * Returns undefined when the input is not allowed.
 */
export function parseMarkInput(raw: string): MarkValue | undefined {
  const text = raw.trim().toUpperCase()
  if (text === '') return null
  if (text === 'AB' || text === 'A') return 'AB'
  if (text === 'MED' || text === 'M') return 'MED'
  if (text === 'EX' || text === 'E') return 'EX'
  if (!/^\d{1,3}$/.test(text)) return undefined
  const n = Number(text)
  return n >= 0 && n <= 100 ? n : undefined
}

export function formatMark(value: MarkValue | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export interface StudentTotals {
  total: number
  /** Papers with a numeric mark. */
  sat: number
  /** Papers marked AB or MED. */
  absent: number
  /** Subjects counted in the average: all enrolled subjects except Exempt ones. */
  counted: number
  /** Subjects with no mark entered yet. */
  missing: number
  average: number
}

/**
 * Total and average for one student in one term.
 * Average = total / subjects the student takes (Exempt subjects left out), as agreed in the plan.
 * Absent and Medical papers add nothing to the total but still count in the average.
 */
export function studentTotals(subjects: string[], marks: Record<string, MarkValue | undefined>): StudentTotals {
  let total = 0
  let sat = 0
  let absent = 0
  let exempt = 0
  let missing = 0
  for (const code of subjects) {
    const m = marks[code]
    if (typeof m === 'number') {
      total += m
      sat += 1
    } else if (m === 'AB' || m === 'MED') absent += 1
    else if (m === 'EX') exempt += 1
    else missing += 1
  }
  const counted = subjects.length - exempt
  const average = counted > 0 ? Math.round((total / counted) * 100) / 100 : 0
  return { total, sat, absent, counted, missing, average }
}

/**
 * Standard competition ranking by total, highest first: equal totals share a rank and the next rank is skipped (1, 2, 2, 4).
 * Returns a map from id to rank.
 */
export function rankByTotal<T extends { id: string; total: number }>(rows: T[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => b.total - a.total)
  const ranks = new Map<string, number>()
  sorted.forEach((row, i) => {
    const prev = sorted[i - 1]
    const rank = prev && prev.total === row.total ? ranks.get(prev.id)! : i + 1
    ranks.set(row.id, rank)
  })
  return ranks
}

export interface SubjectStats {
  sat: number
  absent: number
  average: number
  highest: number | null
  lowest: number | null
  passCount: number
  passRate: number
}

export function subjectStats(values: (MarkValue | undefined)[], passMark: number): SubjectStats {
  const nums = values.filter((v): v is number => typeof v === 'number')
  const absent = values.filter((v) => v === 'AB' || v === 'MED').length
  const sum = nums.reduce((a, b) => a + b, 0)
  const passCount = nums.filter((n) => n >= passMark).length
  return {
    sat: nums.length,
    absent,
    average: nums.length ? Math.round((sum / nums.length) * 100) / 100 : 0,
    highest: nums.length ? Math.max(...nums) : null,
    lowest: nums.length ? Math.min(...nums) : null,
    passCount,
    passRate: nums.length ? Math.round((passCount / nums.length) * 1000) / 10 : 0,
  }
}
