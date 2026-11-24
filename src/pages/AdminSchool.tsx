import { useState } from 'react'
import { collection, doc, query, updateDoc, where } from 'firebase/firestore'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { loadStandardSubjects, setClassTeacher, setTermStatus, setUpYear } from '../lib/data'
import { useQuery } from '../lib/hooks'
import type { GradeConfig, SchoolClass, Staff, Subject, Term } from '../lib/types'

export default function AdminSchool() {
  const { settings } = useAuth()
  const year = settings?.currentYear ?? new Date().getFullYear()
  const subjects = useQuery<Subject>(collection(db, 'subjects'), [])
  const configs = useQuery<GradeConfig>(collection(db, 'gradeConfigs'), [])
  const classes = useQuery<SchoolClass>(query(collection(db, 'classes'), where('year', '==', year)), [year])
  const terms = useQuery<Term>(query(collection(db, 'terms'), where('year', '==', year)), [year])
  const staff = useQuery<Staff>(collection(db, 'staff'), [])
  const [newYear, setNewYear] = useState(year + 1)
  const [status, setStatus] = useState<string | null>(null)
  const [passMark, setPassMark] = useState(settings?.passMark ?? 35)

  const name = (code: string) => subjects.data.find((s) => s.code === code)?.name ?? code
  const activeStaff = staff.data.filter((s) => s.active).sort((a, b) => a.name.localeCompare(b.name))

  async function run(label: string, fn: () => Promise<unknown>) {
    setStatus(`${label}…`)
    try {
      await fn()
      setStatus(`${label}: done.`)
    } catch (e) {
      setStatus(`${label} failed: ${(e as Error).message}`)
    }
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Academic year {year}</h2>
        <div className="row wrap">
          <label className="inline">
            Pass mark for analysis
            <input type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(Number(e.target.value))} />
          </label>
          <button onClick={() => run('Save pass mark', () => updateDoc(doc(db, 'settings', 'school'), { passMark }))}>Save</button>
        </div>
        <h3>Terms</h3>
        <table className="grid compact">
          <thead>
            <tr><th>Term</th><th>Mark entry</th><th /></tr>
          </thead>
          <tbody>
            {[...terms.data].sort((a, b) => a.term - b.term).map((t) => (
              <tr key={t.id}>
                <td>Term {t.term}</td>
                <td>{t.status === 'open' ? <span className="pill good">Open</span> : <span className="pill">Locked</span>}</td>
                <td>
                  <button onClick={() => run(`Term ${t.term}`, () => setTermStatus(t.id, t.status === 'open' ? 'locked' : 'open'))}>
                    {t.status === 'open' ? 'Lock' : 'Open for entry'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {terms.data.length === 0 && (
          <button className="primary" onClick={() => run('Set up year', () => setUpYear(year, classes.data))}>
            Create terms and classes for {year}
          </button>
        )}
        <details>
          <summary>Start a new academic year</summary>
          <p className="small muted">
            Creates three terms and grades 6 to 11 for the new year and makes it the current year. Last year's marks are kept.
            Moving students up a grade comes in a later phase.
          </p>
          <div className="row">
            <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} />
            <button onClick={() => run(`Start ${newYear}`, () => setUpYear(newYear, []))}>Start {newYear}</button>
          </div>
        </details>
        {status && <p className="notice">{status}</p>}
      </section>

      <section className="card">
        <h2>Classes and Class Teachers</h2>
        <table className="grid">
          <thead>
            <tr><th>Class</th><th>Class Teacher</th><th /></tr>
          </thead>
          <tbody>
            {[...classes.data].sort((a, b) => a.grade - b.grade).map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <select value={c.classTeacherUid ?? ''} onChange={(e) => run('Set Class Teacher', () => setClassTeacher(c.id, e.target.value || null))}>
                    <option value="">Not assigned</option>
                    {activeStaff.map((s) => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                  </select>
                </td>
                <td className="row">
                  <Link to={`/class/${c.id}/manage`}>Teachers and choices</Link>
                  <Link to={`/class/${c.id}/sheet`}>Mark sheet</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeStaff.length <= 1 && <p className="small muted">Add staff first on the Staff page, then pick Class Teachers here.</p>}
      </section>

      <section className="card">
        <h2>Subjects by grade</h2>
        <button onClick={() => run('Load standard subjects', loadStandardSubjects)}>Load standard subjects</button>
        {[...configs.data].sort((a, b) => a.grade - b.grade).map((g) => (
          <div key={g.grade} className="subject-config">
            <h3>Grade {g.grade} <span className="muted small">{g.core.length + g.groups.length} papers, out of {(g.core.length + g.groups.length) * 100}</span></h3>
            <p><strong>Everyone:</strong> {g.core.map(name).join(', ')}</p>
            {g.groups.map((grp) => (
              <p key={grp.id}><strong>{grp.name} (choose one):</strong> {grp.options.map(name).join(', ')}</p>
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
