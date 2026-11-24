import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { SchoolSettings, Staff } from './lib/types'

interface AuthState {
  user: User | null
  staff: Staff | null
  settings: SchoolSettings | null
  /** True when nobody has set up the school yet (the first sign-in becomes Admin). */
  schoolMissing: boolean
  loading: boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  staff: null,
  settings: null,
  schoolMissing: false,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [staffReady, setStaffReady] = useState(false)
  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [settingsState, setSettingsState] = useState<'loading' | 'found' | 'missing'>('loading')

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u)
    setAuthReady(true)
  }), [])

  useEffect(() => {
    setStaff(null)
    setStaffReady(false)
    if (!user) return
    return onSnapshot(
      doc(db, 'staff', user.uid),
      (snap) => {
        setStaff(snap.exists() ? ({ uid: snap.id, ...snap.data() } as Staff) : null)
        setStaffReady(true)
      },
      () => setStaffReady(true),
    )
  }, [user])

  // Settings can only be read by active staff, so listen again once the staff record appears (for example right after first-run setup).
  const isActiveStaff = Boolean(staff?.active)
  useEffect(() => {
    setSettings(null)
    setSettingsState('loading')
    if (!user) return
    return onSnapshot(
      doc(db, 'settings', 'school'),
      (snap) => {
        setSettings(snap.exists() ? (snap.data() as SchoolSettings) : null)
        setSettingsState(snap.exists() ? 'found' : 'missing')
      },
      // Not staff yet, so settings cannot be read: the school may not exist. First-run setup is refused by the rules if it does.
      () => setSettingsState('missing'),
    )
  }, [user, isActiveStaff])

  const loading = !authReady || (user !== null && (!staffReady || settingsState === 'loading'))
  const schoolMissing = user !== null && !staff && settingsState === 'missing'

  return (
    <AuthContext.Provider value={{ user, staff, settings, schoolMissing, loading }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function roleLabel(staff: Staff): string {
  switch (staff.role) {
    case 'admin':
      return 'School Admin'
    case 'principal':
      return 'Principal'
    case 'sectionHead':
      return `Section Head (grades ${staff.sectionGrades.join(', ')})`
    default:
      return 'Teacher'
  }
}
