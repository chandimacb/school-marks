import { useState } from 'react'
import { collection, query, where } from 'firebase/firestore'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { addStudents, parseStudentLines } from '../lib/data'
import { useQuery } from '../lib/hooks'
import type { Enrolment, GradeConfig } from '../lib/types'

const SAMPLE = `Admission No,Name,Gender,Grade,Index No
1001,K. Nimal Perera,M,6,1
1002,A. Ayesha Fernando,F,6,2`

export default function AdminStudents() {
  const { settings } = useAuth()
  const year = settings?.currentYear ?? 0
  const configs = useQuery<GradeConfig>(collection(db, 'gradeConfigs'), [])
  const enrolments = useQuery<Enrolment>(year ? query(collection(db, 'enrolments'), where('year', '==', year)) : null, [year])
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const parsed = parseStudentLines(text)

  async function add() {
    setBusy(true)
    try {
      const r = await addStudents(parsed.students, year, configs.data)
      setMessage(`Added ${r.added} students.${r.skipped ? ` Skipped ${r.skipped} whose admission number already exists.` : ''}`)
      setText('')
    } catch (e) {
      setMessage(`Could not add students: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const byGrade = new Map<number, number>()
  enrolments.data.forEach((e) => byGrade.set(e.grade, (byGrade.get(e.grade) ?? 0) + 1))

  return (
    <div className="stack">
      <section className="card">
        <h2>Students in {year}</h2>
        <div className="row wrap">
          {[6, 7, 8, 9, 10, 11].map((g) => (
            <div key={g} className="stat"><span className="muted small">Grade {g}</span><strong>{byGrade.get(g) ?? 0}</strong></div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Add students</h2>
        <p>
          Paste one student per line: admission number, name, gender (M or F), grade, index number. You can copy the columns
          straight from Excel.
        </p>
        <textarea rows={10} value={text} placeholder={SAMPLE} onChange={(e) => setText(e.target.value)} />
        {text && (
          <p className="small">
            Ready to add {parsed.students.length} students.
            {parsed.errors.length > 0 && <span className="error"> {parsed.errors.length} lines need fixing: {parsed.errors.slice(0, 3).join('; ')}</span>}
          </p>
        )}
        {message && <p className="notice">{message}</p>}
        <button className="primary" disabled={busy || parsed.students.length === 0 || parsed.errors.length > 0} onClick={add}>
          {busy ? 'Adding…' : `Add ${parsed.students.length || ''} students`}
        </button>
        <p className="small muted">
          Students are placed in their grade's class for {year}. Class Teachers then set each student's aesthetic or basket subjects.
        </p>
      </section>
    </div>
  )
}
