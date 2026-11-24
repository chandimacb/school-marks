import { useState } from 'react'
import { collection, doc } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { choicesComplete } from '../lib/calc'
import { classEnrolmentsQuery, setChoice, setSubjectTeacher } from '../lib/data'
import { useDoc, useQuery } from '../lib/hooks'
import type { Enrolment, GradeConfig, SchoolClass, Staff, Subject } from '../lib/types'

export default function ClassManage() {
  const { classId = '' } = useParams()
  const { staff: me } = useAuth()
  const cls = useDoc<SchoolClass>(doc(db, 'classes', classId), [classId])
  const grade = cls.data?.grade
  const config = useDoc<GradeConfig>(grade ? doc(db, 'gradeConfigs', String(grade)) : null, [grade])
  const subjects = useQuery<Subject>(collection(db, 'subjects'), [])
  const staff = useQuery<Staff>(collection(db, 'staff'), [])
  const enrolments = useQuery<Enrolment>(classEnrolmentsQuery(classId), [classId])
  const [error, setError] = useState<string | null>(null)

  if (cls.loading || config.loading) return <p className="muted">Loading…</p>
  if (!cls.data) return <p>Class not found.</p>
  const c = cls.data
  const g = config.data
  const canEdit = me?.role === 'admin' || c.classTeacherUid === me?.uid
  if (!g) return <p>Subjects for grade {c.grade} have not been set up yet. The Admin loads them on the School setup page.</p>

  const name = (code: string) => subjects.data.find((s) => s.code === code)?.name ?? code
  const allSubjects = [...g.core, ...g.groups.flatMap((grp) => grp.options)]
  const uniqueSubjects = [...new Set(allSubjects)].sort(
    (a, b) => (subjects.data.find((s) => s.code === a)?.order ?? 99) - (subjects.data.find((s) => s.code === b)?.order ?? 99),
  )
  const teachers = staff.data.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name))
  const students = [...enrolments.data].sort((a, b) => a.indexNo - b.indexNo)
  const incomplete = students.filter((e) => !choicesComplete(g, e.choices)).length

  const guard = (p: Promise<unknown>) => p.catch((e: Error) => setError(`Could not save: ${e.message}`))

  return (
    <div className="stack">
      <div className="row spread">
        <h1>{c.name}</h1>
        <Link to={`/class/${c.id}/sheet`}>Open mark sheet</Link>
      </div>
      {!canEdit && <p className="notice">Only this class's Class Teacher or the Admin can make changes here.</p>}
      {error && <p className="notice error">{error}</p>}

      <section className="card">
        <h2>Subject teachers</h2>
        <table className="grid">
          <thead><tr><th>Subject</th><th>Teacher</th><th className="num">Students</th></tr></thead>
          <tbody>
            {uniqueSubjects.map((code) => (
              <tr key={code}>
                <td>{name(code)}</td>
                <td>
                  <select
                    disabled={!canEdit}
                    value={c.subjectTeachers[code] ?? ''}
                    onChange={(e) => guard(setSubjectTeacher(c, code, e.target.value))}
                  >
                    <option value="">Not assigned</option>
                    {teachers.map((t) => <option key={t.uid} value={t.uid}>{t.name}</option>)}
                  </select>
                </td>
                <td className="num">{students.filter((s) => s.subjects.includes(code)).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {g.groups.length > 0 && (
        <section className="card">
          <h2>Subject choices</h2>
          <p className="small muted">
            {incomplete === 0
              ? 'Every student has their choices set.'
              : `${incomplete} of ${students.length} students still need a choice. They only appear on the mark sheets of subjects they take.`}
          </p>
          <div className="scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th className="num">No.</th>
                  <th>Student</th>
                  {g.groups.map((grp) => <th key={grp.id}>{grp.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{e.indexNo}</td>
                    <td>{e.studentName}</td>
                    {g.groups.map((grp) => (
                      <td key={grp.id}>
                        <select
                          disabled={!canEdit}
                          className={e.choices[grp.id] ? '' : 'missing'}
                          value={e.choices[grp.id] ?? ''}
                          onChange={(ev) => guard(setChoice(e, g, grp.id, ev.target.value))}
                        >
                          <option value="">Choose…</option>
                          {grp.options.map((o) => <option key={o} value={o}>{name(o)}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
