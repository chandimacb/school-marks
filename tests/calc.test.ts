import { describe, expect, it } from 'vitest'
import {
  choicesComplete,
  parseMarkInput,
  rankByTotal,
  studentTotals,
  subjectStats,
  subjectsForStudent,
} from '../src/lib/calc'
import { DEFAULT_GRADE_CONFIGS } from '../src/lib/schoolDefaults'

const grade6 = DEFAULT_GRADE_CONFIGS.find((g) => g.grade === 6)!
const grade10 = DEFAULT_GRADE_CONFIGS.find((g) => g.grade === 10)!

describe('subjects per student', () => {
  it('grade 6 to 9 students take 12 common subjects plus one aesthetic subject', () => {
    const subjects = subjectsForStudent(grade6, { aesthetic: 'MUS' })
    expect(subjects).toHaveLength(13)
    expect(subjects).toContain('MUS')
    expect(subjects).not.toContain('ART')
  })

  it('grade 10 to 11 students take 6 core subjects plus one from each of 3 baskets', () => {
    const subjects = subjectsForStudent(grade10, { basket1: 'GEO', basket2: 'ART', basket3: 'ICT' })
    expect(subjects).toEqual(['SIN', 'BUD', 'MAT', 'SCI', 'ENG', 'HIS', 'GEO', 'ART', 'ICT'])
  })

  it('knows when choices are incomplete or invalid', () => {
    expect(choicesComplete(grade10, { basket1: 'GEO', basket2: 'ART' })).toBe(false)
    expect(choicesComplete(grade10, { basket1: 'ART', basket2: 'ART', basket3: 'ICT' })).toBe(false)
    expect(choicesComplete(grade10, { basket1: 'GEO', basket2: 'ART', basket3: 'ICT' })).toBe(true)
  })
})

describe('mark input', () => {
  it.each([
    ['85', 85],
    ['0', 0],
    ['100', 100],
    [' ab ', 'AB'],
    ['a', 'AB'],
    ['med', 'MED'],
    ['ex', 'EX'],
    ['', null],
  ])('accepts %j', (raw, expected) => {
    expect(parseMarkInput(raw)).toBe(expected)
  })

  it.each(['101', '-1', '45.5', 'abc', '1000'])('rejects %j', (raw) => {
    expect(parseMarkInput(raw)).toBeUndefined()
  })
})

describe('totals and averages', () => {
  const subjects = ['SIN', 'MAT', 'SCI', 'ENG']

  it('adds marks and divides by subjects taken', () => {
    const t = studentTotals(subjects, { SIN: 80, MAT: 70, SCI: 60, ENG: 50 })
    expect(t.total).toBe(260)
    expect(t.average).toBe(65)
    expect(t.sat).toBe(4)
  })

  it('absent papers add nothing but still count in the average', () => {
    const t = studentTotals(subjects, { SIN: 80, MAT: 'AB', SCI: 60, ENG: 'MED' })
    expect(t.total).toBe(140)
    expect(t.absent).toBe(2)
    expect(t.average).toBe(35)
  })

  it('exempt subjects are left out of the average', () => {
    const t = studentTotals(subjects, { SIN: 80, MAT: 70, SCI: 60, ENG: 'EX' })
    expect(t.counted).toBe(3)
    expect(t.average).toBe(70)
  })

  it('counts missing marks', () => {
    const t = studentTotals(subjects, { SIN: 80 })
    expect(t.missing).toBe(3)
  })

  it('rounds the average to 2 decimals', () => {
    expect(studentTotals(['A', 'B', 'C'], { A: 50, B: 50, C: 51 }).average).toBe(50.33)
  })
})

describe('rank by total', () => {
  it('gives tied totals the same rank and skips the next (1, 2, 2, 4)', () => {
    const ranks = rankByTotal([
      { id: 'fathima', total: 776 },
      { id: 'kasun', total: 790 },
      { id: 'nimal', total: 812 },
      { id: 'ayesha', total: 790 },
    ])
    expect(ranks.get('nimal')).toBe(1)
    expect(ranks.get('ayesha')).toBe(2)
    expect(ranks.get('kasun')).toBe(2)
    expect(ranks.get('fathima')).toBe(4)
  })

  it('handles a three-way tie at the top', () => {
    const ranks = rankByTotal([
      { id: 'a', total: 500 },
      { id: 'b', total: 500 },
      { id: 'c', total: 500 },
      { id: 'd', total: 400 },
    ])
    expect([...ranks.values()]).toEqual([1, 1, 1, 4])
  })
})

describe('subject statistics', () => {
  it('ignores absences in the average and pass rate', () => {
    const s = subjectStats([80, 30, 'AB', 35, null], 35)
    expect(s.sat).toBe(3)
    expect(s.absent).toBe(1)
    expect(s.average).toBe(48.33)
    expect(s.highest).toBe(80)
    expect(s.lowest).toBe(30)
    expect(s.passCount).toBe(2)
    expect(s.passRate).toBe(66.7)
  })
})
