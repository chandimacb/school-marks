import { useState } from 'react'
import { collection, doc, query, where } from 'firebase/firestore'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { db } from '../firebase'
import { formatMark, rankByTotal, studentTotals, subjectStats } from '../lib/calc'
import { classEnrolmentsQuery, classResultsQuery } from '../lib/data'
import { useDoc, useQuery } from '../lib/hooks'
import type { Enrolment, GradeConfig, SchoolClass, Subject, Term, TermResult } from '../lib/types'

export default function ClassSheet() {
  const { classId = '' } = useParams()
  const { settings } = useAuth()
  const cls = useDoc<SchoolClass>(doc(db, 'classes', classId), [classId])
  const grade = cls.data?.grade
  const year = cls.data?.year
  const config = useDoc<GradeConfig>(grade ? doc(db, 'gradeConfigs', String(grade)) : null, [grade])
  const subjects = useQuery<Subject>(collection(db, 'subjects'), [])
  const terms = useQuery<Term>(year ? query(collection(db, 'terms'), where('year', '==', year)) : null, [year])
  const enrolments = useQuery<Enrolment>(classEnrolmentsQuery(classId), [classId])
  const sortedTerms = [...terms.data].sort((a, b) => a.term - b.term)
  const [pickedTermId, setTermId] = useState('')
  // Until someone picks a term, show the open one (or Term 1).
  const termId = pickedTermId || (sortedTerms.find((t) => t.status === 'open') ?? sortedTerms[0])?.id || ''
  const results = useQuery<TermResult>(termId ? classResultsQuery(classId, termId) : null, [classId, termId])
  const [sortBy, setSortBy] = useState<'index' | 'rank'>('index')

  if (cls.loading || config.loading) return <p className="muted">Loading…</p>
  if (!cls.data || !config.data) return <p>Class or its subjects are not set up yet.</p>
  if (results.error) return <p className="notice error">You do not have access to this class's marks.</p>

  const order = (code: string) => subjects.data.find((s) => s.code === code)?.order ?? 99
  const short = (code: string) => subjects.data.find((s) => s.code === code)?.name ?? code
  const g = config.data
  const columns = [...new Set([...g.core, ...g.groups.flatMap((grp) => grp.options)])].sort((a, b) => order(a) - order(b))
  const passMark = settings?.passMark ?? 35

  const rows = enrolments.data.map((e) => {
    const marks = results.data.find((r) => r.studentId === e.studentId)?.marks ?? {}
    return { id: e.studentId, e, marks, ...studentTotals(e.subjects, marks) }
  })
  const ranks = rankByTotal(rows)
  const sorted = [...rows].sort((a, b) =>
    sortBy === 'rank' ? (ranks.get(a.id)! - ranks.get(b.id)!) || a.e.indexNo - b.e.indexNo : a.e.indexNo - b.e.indexNo,
  )
  const missing = rows.reduce((n, r) => n + r.missing, 0)
  const term = sortedTerms.find((t) => t.id === termId)

  return (
    <div className="stack">
      <div className="row spread wrap">
        <div>
          <h1>{cls.data.name} mark sheet</h1>
          <p className="muted">
            {settings?.name} · {year} · Term {term?.term ?? ''} · {rows.length} students ·{' '}
            {missing === 0 ? 'all marks entered' : `${missing} marks still to enter`}
          </p>
        </div>
        <div className="row no-print">
          <select value={termId} onChange={(e) => setTermId(e.target.value)}>
            {sortedTerms.map((t) => <option key={t.id} value={t.id}>Term {t.term}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'index' | 'rank')}>
            <option value="index">Sort by index number</option>
            <option value="rank">Sort by rank</option>
          </select>
          <button onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <div className="scroll card tight">
        <table className="grid sheet">
          <thead>
            <tr>
              <th className="num">No.</th>
              <th className="sticky">Student</th>
              {columns.map((c) => <th key={c} className="num vertical" title={short(c)}><span>{short(c)}</span></th>)}
              <th className="num">Total</th>
              <th className="num">Average</th>
              <th className="num">Rank</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="num">{r.e.indexNo}</td>
                <td className="sticky">{r.e.studentName}</td>
                {columns.map((c) => {
                  const takes = r.e.subjects.includes(c)
                  const v = r.marks[c]
                  return (
                    <td key={c} className={`num ${!takes ? 'na' : typeof v === 'number' && v < passMark ? 'low' : ''} ${takes && (v === undefined || v === null) ? 'empty' : ''}`}>
                      {takes ? formatMark(v) : ''}
                    </td>
                  )
                })}
                <td className="num strong">{r.total}</td>
                <td className="num">{r.average.toFixed(2)}</td>
                <td className="num strong">{ranks.get(r.id)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {(['average', 'highest', 'lowest', 'passRate'] as const).map((k) => (
              <tr key={k}>
                <td />
                <td className="sticky muted">{{ average: 'Subject average', highest: 'Highest', lowest: 'Lowest', passRate: `Pass rate (${passMark}+)` }[k]}</td>
                {columns.map((c) => {
                  const s = subjectStats(rows.filter((r) => r.e.subjects.includes(c)).map((r) => r.marks[c]), passMark)
                  const v = s.sat ? (k === 'passRate' ? `${s.passRate}%` : s[k]) : ''
                  return <td key={c} className="num muted">{v}</td>
                })}
                <td colSpan={3} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <p className="small muted">
        Rank is by total; equal totals share a rank. Average is the total divided by the subjects the student takes (exempt subjects
        left out). AB = absent, MED = medical, EX = exempt. Marks below {passMark} are highlighted.
      </p>
      <Link to="/" className="no-print">Back to home</Link>
    </div>
  )
}
