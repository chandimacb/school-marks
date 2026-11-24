import { useState, type FormEvent } from 'react'
import { signOut } from 'firebase/auth'
import { useAuth } from '../auth'
import { auth } from '../firebase'
import { createSchool, loadStandardSubjects, setUpYear } from '../lib/data'

export default function FirstSetup() {
  const { user } = useAuth()
  const [schoolName, setSchoolName] = useState('')
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      await createSchool(user.uid, name.trim(), user.email ?? '', schoolName.trim(), year)
    } catch {
      setError('The school is already set up, so this login cannot become Admin. Ask the Admin to add you as staff.')
      setBusy(false)
      return
    }
    try {
      await loadStandardSubjects()
      await setUpYear(year, [])
    } catch {
      setError('The school was created, but loading subjects failed. Open School setup and press "Load standard subjects".')
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>Set up your school</h1>
        <p className="muted">
          You will become the School Admin. The standard subjects, grades 6 to 11 and three terms for the year are
          created for you, and you can change them later.
        </p>
        <label>
          School name
          <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
        </label>
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Academic year
          <input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} required />
        </label>
        {error && <p className="notice error">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>{busy ? 'Setting up…' : 'Create school'}</button>
        <button type="button" className="link small" onClick={() => signOut(auth)}>Sign out</button>
      </form>
    </div>
  )
}
