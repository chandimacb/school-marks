import { deleteApp, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth'
import { collection, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db, firebaseConfig, useEmulator } from '../firebase'
import { subjectsForStudent } from './calc'
import { DEFAULT_GRADE_CONFIGS, DEFAULT_SUBJECTS, GRADES } from './schoolDefaults'
import type { Enrolment, GradeConfig, Role, SchoolClass, Staff, Student, TermStatus } from './types'

export const termIdFor = (year: number, term: number) => `${year}-${term}`
export const classIdFor = (year: number, grade: number) => `${year}-${grade}`
export const enrolmentIdFor = (year: number, studentId: string) => `${year}_${studentId}`

/** First run: the signed-in user creates the school and becomes its Admin. */
export async function createSchool(uid: string, name: string, email: string, schoolName: string, year: number) {
  const batch = writeBatch(db)
  batch.set(doc(db, 'staff', uid), { uid, name, email, role: 'admin', sectionGrades: [], active: true })
  batch.set(doc(db, 'settings', 'school'), { name: schoolName, adminUid: uid, currentYear: year, passMark: 35 })
  batch.set(doc(db, 'public', 'school'), { name: schoolName, setupDone: true })
  await batch.commit()
}

/** Marks the school as set up for the sign-in page (also repairs schools created before this existed). */
export async function ensurePublicSchoolInfo(name: string) {
  const ref = doc(db, 'public', 'school')
  const snap = await getDoc(ref)
  if (!snap.exists() || snap.data().name !== name) await setDoc(ref, { name, setupDone: true })
}

/** Load the school's standard subjects and grade structure (safe to run again). */
export async function loadStandardSubjects() {
  const batch = writeBatch(db)
  for (const s of DEFAULT_SUBJECTS) batch.set(doc(db, 'subjects', s.code), s)
  for (const g of DEFAULT_GRADE_CONFIGS) batch.set(doc(db, 'gradeConfigs', String(g.grade)), g)
  await batch.commit()
}

/** Create the three terms and one class per grade for a year. Existing class teacher choices are kept. */
export async function setUpYear(year: number, existing: SchoolClass[]) {
  const batch = writeBatch(db)
  for (const t of [1, 2, 3]) {
    batch.set(doc(db, 'terms', termIdFor(year, t)), { year, term: t, status: t === 1 ? 'open' : 'locked' }, { merge: true })
  }
  for (const grade of GRADES) {
    const id = classIdFor(year, grade)
    if (existing.some((c) => c.id === id)) continue
    batch.set(doc(db, 'classes', id), {
      year,
      grade,
      name: `Grade ${grade}`,
      classTeacherUid: null,
      subjectTeachers: {},
    })
  }
  batch.update(doc(db, 'settings', 'school'), { currentYear: year })
  await batch.commit()
}

export const setTermStatus = (termId: string, status: TermStatus) => updateDoc(doc(db, 'terms', termId), { status })

export const setClassTeacher = (classId: string, uid: string | null) =>
  updateDoc(doc(db, 'classes', classId), { classTeacherUid: uid })

// Update one subject at a time so quick changes to different subjects never overwrite each other.
export const setSubjectTeacher = (cls: SchoolClass, subject: string, uid: string) =>
  updateDoc(doc(db, 'classes', cls.id), { [`subjectTeachers.${subject}`]: uid ? uid : deleteField() })

/**
 * Create a staff login. Uses a second, temporary Firebase app so the Admin stays signed in.
 * The new person gets an email with a link to set their own password.
 */
export async function addStaff(input: { name: string; email: string; role: Role; sectionGrades: number[] }) {
  const temp = initializeApp(firebaseConfig, `staff-${Date.now()}`)
  const tempAuth = getAuth(temp)
  if (useEmulator) connectAuthEmulator(tempAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  try {
    const password = crypto.randomUUID() + 'Aa1!'
    const cred = await createUserWithEmailAndPassword(tempAuth, input.email.trim(), password)
    const staff: Staff = {
      uid: cred.user.uid,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      sectionGrades: input.role === 'sectionHead' ? input.sectionGrades : [],
      active: true,
    }
    await setDoc(doc(db, 'staff', staff.uid), staff)
    await sendPasswordResetEmail(tempAuth, staff.email)
    await signOut(tempAuth)
    return staff
  } finally {
    await deleteApp(temp)
  }
}

export const updateStaff = (uid: string, changes: Partial<Pick<Staff, 'role' | 'sectionGrades' | 'active' | 'name'>>) =>
  updateDoc(doc(db, 'staff', uid), changes)

export interface NewStudent {
  admissionNo: string
  name: string
  gender: 'M' | 'F' | ''
  grade: number
  indexNo: number
}

/** Parse pasted lines: admission number, name, gender (M/F), grade, index number. Separated by commas or tabs. */
export function parseStudentLines(text: string): { students: NewStudent[]; errors: string[] } {
  const students: NewStudent[] = []
  const errors: string[] = []
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(/\t|,/).map((p) => p.trim())
      if (i === 0 && /admission/i.test(parts[0] ?? '')) return // header row
      const [admissionNo, name, genderRaw, gradeRaw, indexRaw] = parts
      const grade = Number(gradeRaw)
      const indexNo = Number(indexRaw)
      const gender = (genderRaw ?? '').toUpperCase().startsWith('F') ? 'F' : (genderRaw ?? '').toUpperCase().startsWith('M') ? 'M' : ''
      if (!admissionNo || !name) errors.push(`Line ${i + 1}: admission number and name are needed`)
      else if (!GRADES.includes(grade)) errors.push(`Line ${i + 1}: grade must be 6 to 11`)
      else if (!Number.isInteger(indexNo) || indexNo < 1) errors.push(`Line ${i + 1}: index number must be 1 or more`)
      else students.push({ admissionNo, name, gender, grade, indexNo })
    })
  return { students, errors }
}

/** Add students and enrol them in their grade's class for the year. Skips admission numbers that already exist. */
export async function addStudents(list: NewStudent[], year: number, configs: GradeConfig[]) {
  const existing = await getDocs(collection(db, 'students'))
  const known = new Set(existing.docs.map((d) => (d.data() as Student).admissionNo))
  const fresh = list.filter((s) => !known.has(s.admissionNo))
  // Firestore batches hold up to 500 writes; 2 writes per student.
  for (let i = 0; i < fresh.length; i += 200) {
    const batch = writeBatch(db)
    for (const s of fresh.slice(i, i + 200)) {
      const ref = doc(collection(db, 'students'))
      const config = configs.find((c) => c.grade === s.grade)
      batch.set(ref, { admissionNo: s.admissionNo, name: s.name, gender: s.gender, nationalId: '', status: 'active' })
      const enrolment: Omit<Enrolment, 'id'> = {
        year,
        grade: s.grade,
        classId: classIdFor(year, s.grade),
        studentId: ref.id,
        studentName: s.name,
        indexNo: s.indexNo,
        choices: {},
        subjects: config ? subjectsForStudent(config, {}) : [],
      }
      batch.set(doc(db, 'enrolments', enrolmentIdFor(year, ref.id)), enrolment)
    }
    await batch.commit()
  }
  return { added: fresh.length, skipped: list.length - fresh.length }
}

/** Class Teacher sets one student's choice in a group; the subject list is kept in step. */
export function setChoice(enrolment: Enrolment, config: GradeConfig, groupId: string, code: string) {
  const choices = { ...enrolment.choices }
  if (code) choices[groupId] = code
  else delete choices[groupId]
  return updateDoc(doc(db, 'enrolments', enrolment.id), {
    [`choices.${groupId}`]: code ? code : deleteField(),
    subjects: subjectsForStudent(config, choices),
  })
}

export const classEnrolmentsQuery = (classId: string) =>
  query(collection(db, 'enrolments'), where('classId', '==', classId))

export const classResultsQuery = (classId: string, termId: string) =>
  query(collection(db, 'results'), where('classId', '==', classId), where('termId', '==', termId))
