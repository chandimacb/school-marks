// Shared data shapes. Each type matches one Firestore collection.

export type Role = 'admin' | 'principal' | 'sectionHead' | 'teacher'

/** A mark is a number from 0 to 100, a status, or null when it has been cleared. */
export type MarkStatus = 'AB' | 'MED' | 'EX'
export type MarkValue = number | MarkStatus | null

export interface SchoolSettings {
  name: string
  adminUid: string
  currentYear: number
  passMark: number
}

export interface Staff {
  uid: string
  name: string
  email: string
  role: Role
  /** Grades a Section Head can see, for example [6, 7, 8]. */
  sectionGrades: number[]
  active: boolean
}

export interface Subject {
  code: string
  name: string
  order: number
}

export interface ChoiceGroup {
  id: string
  name: string
  options: string[]
}

/** Which subjects a grade takes: core subjects for everyone plus one subject from each choice group. */
export interface GradeConfig {
  grade: number
  core: string[]
  groups: ChoiceGroup[]
}

export type TermStatus = 'open' | 'locked'

export interface Term {
  id: string // "2026-1"
  year: number
  term: 1 | 2 | 3
  status: TermStatus
}

export interface SchoolClass {
  id: string // "2026-6"
  year: number
  grade: number
  name: string
  classTeacherUid: string | null
  /** Subject code to teacher uid. */
  subjectTeachers: Record<string, string>
}

export interface Student {
  id: string
  admissionNo: string
  name: string
  gender: 'M' | 'F' | ''
  nationalId: string
  status: 'active' | 'left'
}

export interface Enrolment {
  id: string // "2026_<studentId>"
  year: number
  grade: number
  classId: string
  studentId: string
  studentName: string
  indexNo: number
  /** Choice group id to chosen subject code. */
  choices: Record<string, string>
  /** Every subject the student takes this year: core plus choices. Kept in sync by the app and used by security rules. */
  subjects: string[]
}

export interface TermResult {
  id: string // "<termId>_<studentId>"
  termId: string
  classId: string
  studentId: string
  marks: Record<string, MarkValue>
  lastAuditId: string
}

export type EntrySource = 'typed' | 'excel' | 'scan'

export interface AuditEntry {
  id: string
  resultId: string
  termId: string
  classId: string
  studentId: string
  subject: string
  old: MarkValue
  new: MarkValue
  by: string
  byName: string
  at: unknown
  source: EntrySource
  reason: string
}
