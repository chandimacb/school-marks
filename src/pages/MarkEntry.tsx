import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { collection, doc, query, where } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { formatMark, parseMarkInput, subjectStats } from '../lib/calc'
import { classEnrolmentsQuery, classResultsQuery } from '../lib/data'
import { useDoc, useQuery } from '../lib/hooks'
import { saveMark } from '../lib/marks'
import type { Enrolment, MarkValue, SchoolClass, Subject, Term, TermResult } from '../lib/types'

type RowState = 'idle' | 'saving' | 'saved' | 'error' | 'invalid'

export default function MarkEntry() {
  const { classId = '', subject = '' } = useParams()
  const { staff, settings } = useAuth()
  const cls = useDoc<SchoolClass>(doc(db, 'classes', classId), [classId])
  const subj = useDoc<Subject>(doc(db, 'subjects', subject), [subject])
  const year = cls.data?.year
  const terms = useQuery<Term>(year ? query(collection(db, 'terms'), where('year', '==', year)) : null, [year])
  const enrolments = useQuery<Enrolment>(classEnrolmentsQuery(classId), [classId])

  const sortedTerms = [...terms.data].sort((a, b) => a.term - b.term)
  const [pickedTermId, setTermId] = useState('')
  // Until someone picks a term, show the open one (or Term 1).
  const termId = pickedTermId || (sortedTerms.find((t) => t.status === 'open') ?? sortedTerms[0])?.id || ''
  const term = sortedTerms.find((t) => t.id === termId)

  const results = useQuery<TermResult>(termId ? classResultsQuery(classId, termId) : null, [classId, termId])
  const students = useMemo(
    () => enrolments.data.filter((e) => e.subjects.includes(subject)).sort((a, b) => a.indexNo - b.indexNo),
    [enrolments.data, subject],
  )
  if (results.error) console.error('Results not readable', results.error)
  const resultFor = (studentId: string) => results.data.find((r) => r.studentId === studentId)

  const [drafts, setDraftsState] = useState<Record<string, string>>({})
  // Mirror of drafts that updates immediately, so Enter and leaving the box never save the same mark twice.
  const draftsRef = useRef<Record<string, string>>({})
  const setDrafts = (fn: (d: Record<string, string>) => Record<string, string>) => {
    draftsRef.current = fn(draftsRef.current)
    setDraftsState(draftsRef.current)
  }
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  if (cls.loading) return <p className="muted">Loading…</p>
  if (!cls.data || !staff) return <p>Class not found.</p>
  const isMine = cls.data.subjectTeachers[subject] === staff.uid
  const open = term?.status === 'open'
  // Wait until the latest marks have come from the server, so a save never works from an out-of-date copy.
  const ready = results.synced && enrolments.synced
  const editable = isMine && open && ready

  async function commit(e: Enrolment) {
    const raw = draftsRef.current[e.studentId]
    if (raw === undefined) return
    const existing = resultFor(e.studentId)
    const oldValue: MarkValue = existing?.marks[subject] ?? null
    const parsed = parseMarkInput(raw)
    if (parsed === undefined) {
      setRowState((s) => ({ ...s, [e.studentId]: 'invalid' }))
      return
    }
    setDrafts((d) => {
      const next = { ...d }
      delete next[e.studentId]
      return next
    })
    if (parsed === oldValue) return
    setRowState((s) => ({ ...s, [e.studentId]: 'saving' }))
    try {
      await saveMark(db, {
        termId,
        year: cls.data!.year,
        classId,
        studentId: e.studentId,
        subject,
        oldValue,
        newValue: parsed,
        resultExists: Boolean(existing),
        by: { uid: staff!.uid, name: staff!.name },
      })
      setRowState((s) => ({ ...s, [e.studentId]: 'saved' }))
    } catch (err) {
      console.error('Mark not saved', e.studentId, subject, err)
      // Put the typed value back so the teacher can see it and try again.
      setDrafts((d) => ({ ...d, [e.studentId]: raw }))
      setRowState((s) => ({ ...s, [e.studentId]: 'error' }))
    }
  }

  function onKey(ev: KeyboardEvent<HTMLInputElement>, i: number, e: Enrolment) {
    if (ev.key === 'Enter' || ev.key === 'ArrowDown') {
      ev.preventDefault()
      void commit(e)
      inputs.current[i + 1]?.focus()
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      inputs.current[i - 1]?.focus()
    }
  }

  const values = students.map((e) => resultFor(e.studentId)?.marks[subject])
  const entered = values.filter((v) => v !== undefined && v !== null).length
  const stats = subjectStats(values, settings?.passMark ?? 35)

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <h1>{subj.data?.name ?? subject}</h1>
          <p className="muted">{cls.data.name}</p>
        </div>
        <label className="inline">
          Term
          <select value={termId} onChange={(e) => { setTermId(e.target.value); setDrafts(() => ({})); setRowState({}) }}>
            {sortedTerms.map((t) => <option key={t.id} value={t.id}>Term {t.term}{t.status === 'open' ? '' : ' (locked)'}</option>)}
          </select>
        </label>
      </div>

      {(results.error || enrolments.error) && (
        <p className="notice error">Could not load this class's marks. Check your connection, or ask the Admin to check your access.</p>
      )}
      {isMine && open && !ready && !results.error && (
        <p className="notice">Loading the latest marks… If this does not finish, check your internet connection.</p>
      )}
      {!isMine && <p className="notice">You are not this subject's teacher for {cls.data.name}, so you can only view.</p>}
      {isMine && !open && <p className="notice">This term is locked. Marks can no longer be changed.</p>}

      <div className="progress">
        <div className="bar"><span style={{ width: `${students.length ? (entered / students.length) * 100 : 0}%` }} /></div>
        <span><strong>{entered}</strong> of {students.length} entered</span>
      </div>

      <section className="card tight">
        <p className="small muted">
          Type a mark from 0 to 100 and press Enter to move down. Type <b>AB</b> for absent, <b>MED</b> for medical, <b>EX</b> for exempt.
          Each mark saves on its own and every change is logged.
        </p>
        <table className="grid entry">
          <thead><tr><th className="num">No.</th><th>Student</th><th className="num">Mark</th><th /></tr></thead>
          <tbody>
            {students.map((e, i) => {
              const saved = resultFor(e.studentId)?.marks[subject]
              const value = drafts[e.studentId] ?? formatMark(saved)
              const st = rowState[e.studentId] ?? 'idle'
              return (
                <tr key={e.id} className={st === 'invalid' || st === 'error' ? 'bad' : ''}>
                  <td className="num">{e.indexNo}</td>
                  <td>{e.studentName}</td>
                  <td className="num">
                    <input
                      ref={(el) => { inputs.current[i] = el }}
                      className="mark"
                      inputMode="text"
                      autoComplete="off"
                      aria-label={`Mark for ${e.studentName}`}
                      disabled={!editable}
                      value={value}
                      onChange={(ev) => {
                        const v = ev.target.value
                        setDrafts((d) => ({ ...d, [e.studentId]: v }))
                        setRowState((s) => ({ ...s, [e.studentId]: parseMarkInput(v) === undefined ? 'invalid' : 'idle' }))
                      }}
                      onBlur={() => commit(e)}
                      onKeyDown={(ev) => onKey(ev, i, e)}
                    />
                  </td>
                  <td className="state small">
                    {st === 'saving' && <span className="muted">Saving…</span>}
                    {st === 'saved' && <span className="good">Saved</span>}
                    {st === 'invalid' && <span className="error">0–100, AB, MED or EX</span>}
                    {st === 'error' && <span className="error">Not saved. Try again.</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {students.length === 0 && !enrolments.loading && (
          <p className="muted">No students take this subject yet. The Class Teacher sets subject choices.</p>
        )}
      </section>

      <section className="card">
        <h2>This subject so far</h2>
        <div className="row wrap">
          <div className="stat"><span className="muted small">Average</span><strong>{stats.sat ? stats.average : '–'}</strong></div>
          <div className="stat"><span className="muted small">Highest</span><strong>{stats.highest ?? '–'}</strong></div>
          <div className="stat"><span className="muted small">Lowest</span><strong>{stats.lowest ?? '–'}</strong></div>
          <div className="stat"><span className="muted small">Pass rate</span><strong>{stats.sat ? `${stats.passRate}%` : '–'}</strong></div>
          <div className="stat"><span className="muted small">Absent</span><strong>{stats.absent}</strong></div>
        </div>
      </section>
      <Link to="/">Back to home</Link>
    </div>
  )
}
