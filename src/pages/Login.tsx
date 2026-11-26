import { useEffect, useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'first'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // null while checking; once the school is set up, first-time setup is hidden.
  const [school, setSchool] = useState<{ name: string; setupDone: boolean } | null | 'none'>(null)

  useEffect(() => {
    getDoc(doc(db, 'public', 'school'))
      .then((snap) => setSchool(snap.exists() ? (snap.data() as { name: string; setupDone: boolean }) : 'none'))
      .catch(() => setSchool('none'))
  }, [])
  const setupDone = school !== null && school !== 'none' && school.setupDone

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'signin') await signInWithEmailAndPassword(auth, email.trim(), password)
      else await createUserWithEmailAndPassword(auth, email.trim(), password)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setMessage(
        code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')
          ? 'Email or password is not correct.'
          : code.includes('weak-password')
            ? 'Use a password of at least 8 characters.'
            : code.includes('email-already-in-use')
              ? 'That email already has a login. Use Sign in instead.'
              : 'Could not sign in. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!email) return setMessage('Type your email first, then press "Forgot password".')
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setMessage('A password reset link has been sent to your email.')
    } catch {
      setMessage('Could not send the reset email. Check the address.')
    }
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        {setupDone && <p className="school-name">{(school as { name: string }).name}</p>}
        <h1>{mode === 'signin' ? 'Sign in' : 'Set up the school'}</h1>
        {mode === 'first' && (
          <p className="muted">Only for the School Admin, the very first time. Create your login, then name the school.</p>
        )}
        <label>
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {message && <p className="notice">{message}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create Admin login'}
        </button>
        {mode === 'signin' ? (
          <div className="row spread small">
            <button type="button" className="link" onClick={reset}>Forgot password</button>
            {school === 'none' && (
              <button type="button" className="link" onClick={() => setMode('first')}>First-time school setup</button>
            )}
          </div>
        ) : (
          <button type="button" className="link small" onClick={() => setMode('signin')}>Back to sign in</button>
        )}
      </form>
    </div>
  )
}
