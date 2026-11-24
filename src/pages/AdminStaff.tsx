import { useState, type FormEvent } from 'react'
import { collection } from 'firebase/firestore'
import { roleLabel, useAuth } from '../auth'
import { db } from '../firebase'
import { addStaff, updateStaff } from '../lib/data'
import { useQuery } from '../lib/hooks'
import { GRADES } from '../lib/schoolDefaults'
import type { Role, Staff } from '../lib/types'

const ROLES: { value: Role; label: string }[] = [
  { value: 'teacher', label: 'Teacher (subject teacher or Class Teacher)' },
  { value: 'sectionHead', label: 'Section Head' },
  { value: 'principal', label: 'Principal' },
]

export default function AdminStaff() {
  const { staff: me } = useAuth()
  const staff = useQuery<Staff>(collection(db, 'staff'), [])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('teacher')
  const [grades, setGrades] = useState<number[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const s = await addStaff({ name, email, role, sectionGrades: grades })
      setMessage(`${s.name} added. They will get an email from Firebase with a link to set their password.`)
      setName('')
      setEmail('')
      setGrades([])
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setMessage(code.includes('email-already-in-use') ? 'That email already has a login.' : `Could not add: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleGrade = (g: number) => setGrades((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g].sort((a, b) => a - b)))
  const list = [...staff.data].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  return (
    <div className="stack">
      <form className="card" onSubmit={submit}>
        <h2>Add a staff member</h2>
        <div className="form-grid">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>
        {role === 'sectionHead' && (
          <fieldset>
            <legend>Grades in this section</legend>
            {GRADES.map((g) => (
              <label key={g} className="check">
                <input type="checkbox" checked={grades.includes(g)} onChange={() => toggleGrade(g)} /> Grade {g}
              </label>
            ))}
          </fieldset>
        )}
        <p className="small muted">Class Teachers are chosen on the School setup page. Subject teachers are chosen by each Class Teacher.</p>
        {message && <p className="notice">{message}</p>}
        <button className="primary" disabled={busy || (role === 'sectionHead' && grades.length === 0)}>
          {busy ? 'Adding…' : 'Add staff member'}
        </button>
      </form>

      <section className="card">
        <h2>Staff ({list.filter((s) => s.active).length} active)</h2>
        <table className="grid">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th /></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.uid} className={s.active ? '' : 'inactive'}>
                <td>{s.name}</td>
                <td className="small">{s.email}</td>
                <td>{roleLabel(s)}{!s.active && ' (disabled)'}</td>
                <td>
                  {s.uid !== me?.uid && (
                    <button className="small" onClick={() => updateStaff(s.uid, { active: !s.active })}>
                      {s.active ? 'Disable login' : 'Enable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">Disabling a login keeps every mark and change-log entry that person made.</p>
      </section>
    </div>
  )
}
