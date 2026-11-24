import type { GradeConfig, Subject } from './types'

// The school's subject list, as given by the school (24 November 2026).
export const DEFAULT_SUBJECTS: Subject[] = [
  { code: 'SIN', name: 'Sinhala', order: 1 },
  { code: 'BUD', name: 'Buddhism', order: 2 },
  { code: 'MAT', name: 'Mathematics', order: 3 },
  { code: 'SCI', name: 'Science', order: 4 },
  { code: 'ENG', name: 'English', order: 5 },
  { code: 'HIS', name: 'History', order: 6 },
  { code: 'GEO', name: 'Geography', order: 7 },
  { code: 'CIV', name: 'Citizenship Education', order: 8 },
  { code: 'TAM', name: 'Tamil', order: 9 },
  { code: 'HPE', name: 'Health and Physical Education', order: 10 },
  { code: 'ICT', name: 'Information Technology', order: 11 },
  { code: 'PTS', name: 'P.T.S.', order: 12 },
  { code: 'AFT', name: 'Agriculture and Food Technology', order: 13 },
  { code: 'DAN', name: 'Dancing', order: 14 },
  { code: 'MUS', name: 'Music', order: 15 },
  { code: 'ART', name: 'Art', order: 16 },
]

const juniorConfig = (grade: number): GradeConfig => ({
  grade,
  core: ['SIN', 'BUD', 'MAT', 'SCI', 'ENG', 'HIS', 'HPE', 'TAM', 'GEO', 'CIV', 'ICT', 'PTS'],
  groups: [{ id: 'aesthetic', name: 'Aesthetic subject', options: ['DAN', 'MUS', 'ART'] }],
})

const olConfig = (grade: number): GradeConfig => ({
  grade,
  core: ['SIN', 'BUD', 'MAT', 'SCI', 'ENG', 'HIS'],
  groups: [
    { id: 'basket1', name: 'Basket 1', options: ['GEO', 'CIV'] },
    { id: 'basket2', name: 'Basket 2', options: ['DAN', 'MUS', 'ART'] },
    { id: 'basket3', name: 'Basket 3', options: ['AFT', 'HPE', 'ICT'] },
  ],
})

export const DEFAULT_GRADE_CONFIGS: GradeConfig[] = [
  juniorConfig(6),
  juniorConfig(7),
  juniorConfig(8),
  juniorConfig(9),
  olConfig(10),
  olConfig(11),
]

export const GRADES = [6, 7, 8, 9, 10, 11]
