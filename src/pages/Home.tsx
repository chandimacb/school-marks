import { collection, query, where } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { useQuery } from '../lib/hooks'
import type { SchoolClass, Subject, Term } from '../lib/types'

export default function Home() {
  const { staff, settings } = useAuth()
  const year = settings?.currentYear ?? 0
  const classes = useQuery<SchoolClass>(year ? query(collection(db, 'classes'), where('year', '==', year)) : null, [year])
  const terms = useQuery<Term>(year ? query(collection(db, 'terms'), where('year', '==', year)) : null, [year])
  const subjects = useQuery<Subject>(collection(db, 'subjects'), [])
  if (!staff) return null

  const subjectName = (code: string) => subjects.data.find((s) => s.code === code)?.name ?? code
  const sorted = [...classes.data].sort((a, b) => a.grade - b.grade)
  const myClasses = sorted.filter((c) => c.classTeacherUid === staff.uid)
  const myTeaching = sorted.flatMap((c) =>
    Object.entries(c.subjectTeachers)
      .filter(([, uid]) => uid === staff.uid)
      .map(([code]) => ({ cls: c, code })),
  )
  const canSeeSheet = (c: SchoolClass) =>
    staff.role === 'admin' ||
    staff.role === 'principal' ||
    (staff.role === 'sectionHead' && staff.sectionGrades.includes(c.grade))
  const sheetClasses = sorted.filter(canSeeSheet)
  const openTerms = [...terms.data].filter((t) => t.status === 'open').sort((a, b) => a.term - b.term)

  return (
    <div className="stack">
      <section className="card">
        <h2>Academic year {year}</h2>
        <p>
          {openTerms.length
            ? `Mark entry is open for ${openTerms.map((t) => `Term ${t.term}`).join(', ')}.`
            : 'Mark entry is closed for every term right now.'}
        </p>
      </section>

      {myTeaching.length > 0 && (
        <section className="card">
          <h2>Enter marks</h2>
          <ul className="tiles">
            {myTeaching.map(({ cls, code }) => (
              <li key={cls.id + code}>
                <Link to={`/entry/${cls.id}/${code}`}>
                  <strong>{subjectName(code)}</strong>
                  <span className="muted">{cls.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myClasses.length > 0 && (
        <section className="card">
          <h2>My class</h2>
          <ul className="tiles">
            {myClasses.map((c) => (
              <li key={c.id}>
                <Link to={`/class/${c.id}/manage`}>
                  <strong>{c.name}</strong>
                  <span className="muted">Teachers and subject choices</span>
                </Link>
              </li>
            ))}
            {myClasses.map((c) => (
              <li key={c.id + 'sheet'}>
                <Link to={`/class/${c.id}/sheet`}>
                  <strong>{c.name} mark sheet</strong>
                  <span className="muted">Totals, averages and ranks</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheetClasses.length > 0 && (
        <section className="card">
          <h2>Class mark sheets</h2>
          <ul className="tiles">
            {sheetClasses.map((c) => (
              <li key={c.id}>
                <Link to={`/class/${c.id}/sheet`}>
                  <strong>{c.name}</strong>
                  <span className="muted">{Object.keys(c.subjectTeachers).length} subject teachers assigned</span>
                </Link>
              </li>
            ))}
          </ul>
          {staff.role === 'admin' && (
            <p className="small muted">As Admin you can also open any class's teacher and subject-choice page from School setup.</p>
          )}
        </section>
      )}

      {myTeaching.length === 0 && myClasses.length === 0 && sheetClasses.length === 0 && (
        <section className="card">
          <p>You have no classes yet. Your Class Teacher assigns subject teachers; check back once that is done.</p>
        </section>
      )}
    </div>
  )
}
