// Security rule tests. Run with: npm run test:rules (starts the Firestore emulator).
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc,
  updateDoc, where, writeBatch, type Firestore,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { saveMark } from '../src/lib/marks'

let env: RulesTestEnvironment

const TERM = '2026-1'
const CLASS6 = '2026-6'
const CLASS10 = '2026-10'

const staff = {
  admin: { name: 'Admin', email: 'admin@x', role: 'admin', sectionGrades: [], active: true },
  principal: { name: 'Principal', email: 'p@x', role: 'principal', sectionGrades: [], active: true },
  head: { name: 'Head 6-9', email: 'h@x', role: 'sectionHead', sectionGrades: [6, 7, 8, 9], active: true },
  ct6: { name: 'Class teacher 6', email: 'ct@x', role: 'teacher', sectionGrades: [], active: true },
  maths: { name: 'Maths teacher', email: 'm@x', role: 'teacher', sectionGrades: [], active: true },
  music: { name: 'Music teacher', email: 'mu@x', role: 'teacher', sectionGrades: [], active: true },
  left: { name: 'Former teacher', email: 'l@x', role: 'teacher', sectionGrades: [], active: false },
}

// One Firebase app per signed-in user, talking to the emulator. 'owner' bypasses the rules (used for test setup).
const apps = new Map<string, Firestore>()
const openApps: FirebaseApp[] = []
function firestoreAs(token: string | { sub: string; user_id: string } | null, key: string): Firestore {
  let f = apps.get(key)
  if (!f) {
    const app = initializeApp({ projectId: 'demo-school-marks', apiKey: 'demo' }, key)
    openApps.push(app)
    f = getFirestore(app)
    if (token === null) connectFirestoreEmulator(f, '127.0.0.1', 8080)
    else connectFirestoreEmulator(f, '127.0.0.1', 8080, { mockUserToken: token as never })
    apps.set(key, f)
  }
  return f
}
const db = (who: string) => firestoreAs({ sub: who, user_id: who }, 'user-' + who)
const ownerDb = () => firestoreAs('owner', 'owner')
const anonDb = () => firestoreAs(null, 'anon')

const mark = (who: string, over: Partial<Parameters<typeof saveMark>[1]> = {}) =>
  saveMark(db(who) , {
    termId: TERM,
    year: 2026,
    classId: CLASS6,
    studentId: 's1',
    subject: 'MAT',
    oldValue: null,
    newValue: 75,
    resultExists: false,
    by: { uid: who, name: who },
    ...over,
  })

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-school-marks',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})

afterAll(async () => {
  await Promise.all(openApps.map((a) => deleteApp(a)))
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  {
    const f = ownerDb()
    await setDoc(doc(f, 'settings/school'), { name: 'Test School', adminUid: 'admin', currentYear: 2026, passMark: 35 })
    for (const [uid, data] of Object.entries(staff)) await setDoc(doc(f, 'staff', uid), { uid, ...data })
    await setDoc(doc(f, 'terms', TERM), { year: 2026, term: 1, status: 'open' })
    await setDoc(doc(f, 'classes', CLASS6), {
      year: 2026, grade: 6, name: 'Grade 6', classTeacherUid: 'ct6',
      subjectTeachers: { MAT: 'maths', MUS: 'music' },
    })
    await setDoc(doc(f, 'classes', CLASS10), {
      year: 2026, grade: 10, name: 'Grade 10', classTeacherUid: null, subjectTeachers: { MAT: 'maths' },
    })
    await setDoc(doc(f, 'enrolments', '2026_s1'), {
      year: 2026, grade: 6, classId: CLASS6, studentId: 's1', studentName: 'Nimal', indexNo: 1,
      choices: { aesthetic: 'ART' }, subjects: ['SIN', 'MAT', 'ART'],
    })
  }
})

describe('first-run setup', () => {
  it('the first user can make themselves Admin when no school exists', async () => {
    await env.clearFirestore()
    const f = db('founder')
    const batch = writeBatch(f)
    batch.set(doc(f , 'staff/founder'), { uid: 'founder', name: 'F', email: 'f@x', role: 'admin', sectionGrades: [], active: true })
    batch.set(doc(f , 'settings/school'), { name: 'S', adminUid: 'founder', currentYear: 2026, passMark: 35 })
    await assertSucceeds(batch.commit())
  })

  it('nobody else can become Admin once the school exists', async () => {
    const f = db('intruder')
    const batch = writeBatch(f)
    batch.set(doc(f , 'staff/intruder'), { uid: 'intruder', name: 'I', email: 'i@x', role: 'admin', sectionGrades: [], active: true })
    batch.set(doc(f , 'settings/school'), { name: 'S', adminUid: 'intruder', currentYear: 2026, passMark: 35 })
    await assertFails(batch.commit())
    await assertFails(setDoc(doc(f , 'staff/intruder'), { role: 'admin', active: true }))
  })
})

describe('staff and structure', () => {
  it('only the Admin can add staff', async () => {
    await assertSucceeds(setDoc(doc(db('admin') , 'staff/new1'), { role: 'teacher', active: true }))
    await assertFails(setDoc(doc(db('principal') , 'staff/new2'), { role: 'teacher', active: true }))
    await assertFails(setDoc(doc(db('maths') , 'staff/new3'), { role: 'admin', active: true }))
  })

  it('a teacher cannot promote themselves', async () => {
    await assertFails(updateDoc(doc(db('maths') , 'staff/maths'), { role: 'admin' }))
  })

  it('the Class Teacher can assign subject teachers for their own class only', async () => {
    await assertSucceeds(updateDoc(doc(db('ct6') , 'classes', CLASS6), { 'subjectTeachers.SIN': 'maths' }))
    await assertFails(updateDoc(doc(db('ct6') , 'classes', CLASS6), { classTeacherUid: 'maths' }))
    await assertFails(updateDoc(doc(db('ct6') , 'classes', CLASS10), { 'subjectTeachers.SIN': 'maths' }))
    await assertFails(updateDoc(doc(db('maths') , 'classes', CLASS6), { 'subjectTeachers.SIN': 'maths' }))
  })

  it('the Class Teacher can set subject choices for their own students', async () => {
    await assertSucceeds(updateDoc(doc(db('ct6') , 'enrolments/2026_s1'), {
      choices: { aesthetic: 'MUS' }, subjects: ['SIN', 'MAT', 'MUS'],
    }))
    await assertFails(updateDoc(doc(db('ct6') , 'enrolments/2026_s1'), { classId: CLASS10 }))
    await assertFails(updateDoc(doc(db('maths') , 'enrolments/2026_s1'), { choices: {} }))
  })

  it('a deactivated teacher can read nothing', async () => {
    await assertFails(getDoc(doc(db('left') , 'classes', CLASS6)))
  })
})

describe('mark entry', () => {
  it('the subject teacher can enter a mark, with its log entry', async () => {
    await assertSucceeds(mark('maths'))
  })

  it('a mark can be AB, MED, EX or cleared', async () => {
    await mark('maths', { newValue: 'AB' })
    await assertSucceeds(mark('maths', { resultExists: true, oldValue: 'AB', newValue: 'MED' }))
    await assertSucceeds(mark('maths', { resultExists: true, oldValue: 'MED', newValue: null }))
  })

  it('a second subject teacher can add their mark to the same student', async () => {
    {
      await updateDoc(doc(ownerDb(), 'classes', CLASS6), { 'subjectTeachers.SIN': 'ct6' })
    }
    await mark('ct6', { subject: 'SIN', newValue: 'AB' })
    await assertSucceeds(mark('maths', { resultExists: true, oldValue: null, newValue: 70 }))
  })

  it('refuses marks outside 0 to 100 or not whole numbers', async () => {
    await assertFails(mark('maths', { newValue: 101 }))
    await assertFails(mark('maths', { newValue: -1 }))
    await assertFails(mark('maths', { newValue: 45.5 }))
    await assertFails(mark('maths', { newValue: 'X' as never }))
  })

  it('refuses a teacher who is not assigned to that subject and class', async () => {
    await assertFails(mark('music'))
    await assertFails(mark('ct6'))
    await assertFails(mark('admin'))
  })

  it('refuses a subject the student does not take', async () => {
    // Student s1 chose Art, so the Music teacher cannot enter a Music mark for them.
    await assertFails(mark('music', { subject: 'MUS' }))
  })

  it('refuses entry when the term is locked', async () => {
    {
      await updateDoc(doc(ownerDb(), 'terms', TERM), { status: 'locked' })
    }
    await assertFails(mark('maths'))
  })

  it('refuses a mark change without a log entry', async () => {
    await mark('maths')
    const f = db('maths')
    await assertFails(updateDoc(doc(f , 'results', `${TERM}_s1`), { 'marks.MAT': 90 }))
    await assertFails(updateDoc(doc(f , 'results', `${TERM}_s1`), { 'marks.MAT': 90, lastAuditId: 'fake' }))
  })

  it('refuses a log entry that misstates the old value', async () => {
    await mark('maths', { newValue: 40 })
    await assertFails(mark('maths', { resultExists: true, oldValue: 90, newValue: 95 }))
    await assertSucceeds(mark('maths', { resultExists: true, oldValue: 40, newValue: 95 }))
  })

  it('refuses changing two subjects at once', async () => {
    {
      await updateDoc(doc(ownerDb(), 'classes', CLASS6), { 'subjectTeachers.SIN': 'maths' })
    }
    await mark('maths')
    const f = db('maths')
    const batch = writeBatch(f)
    const audit = doc(collection(f , 'auditLog'))
    batch.update(doc(f , 'results', `${TERM}_s1`), { 'marks.MAT': 10, 'marks.SIN': 10, lastAuditId: audit.id })
    batch.set(audit, { resultId: `${TERM}_s1`, termId: TERM, classId: CLASS6, studentId: 's1', subject: 'MAT', old: 75, new: 10, by: 'maths', byName: 'm', at: null, source: 'typed', reason: '' })
    await assertFails(batch.commit())
  })

  it('nobody can delete marks or edit or delete the change log', async () => {
    const auditId = await mark('maths')
    await assertFails(deleteDoc(doc(db('admin') , 'results', `${TERM}_s1`)))
    await assertFails(updateDoc(doc(db('admin') , 'auditLog', auditId), { new: 1 }))
    await assertFails(deleteDoc(doc(db('admin') , 'auditLog', auditId)))
    await assertFails(updateDoc(doc(db('maths') , 'auditLog', auditId), { new: 1 }))
  })
})

describe('who can see marks', () => {
  beforeEach(async () => {
    await mark('maths')
  })

  const classQuery = (who: string, classId = CLASS6) =>
    getDocs(query(collection(db(who) , 'results'), where('classId', '==', classId)))

  it('admin, principal, section head, class teacher and subject teachers of the class can read', async () => {
    for (const who of ['admin', 'principal', 'head', 'ct6', 'maths', 'music']) await assertSucceeds(classQuery(who))
  })

  it('a section head cannot read grades outside their section', async () => {
    await assertFails(classQuery('head', CLASS10))
  })

  it('a teacher with no link to the class cannot read it', async () => {
    {
      await setDoc(doc(ownerDb(), 'staff/other'), { uid: 'other', role: 'teacher', sectionGrades: [], active: true })
    }
    await assertFails(classQuery('other'))
  })

  it('people outside the school can read nothing', async () => {
    await assertFails(getDoc(doc(anonDb() , 'results', `${TERM}_s1`)))
    await assertFails(getDoc(doc(db('stranger') , 'results', `${TERM}_s1`)))
  })
})
