import { signOut } from 'firebase/auth'
import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider, roleLabel, useAuth } from './auth'
import { auth } from './firebase'
import { ensurePublicSchoolInfo } from './lib/data'
import AdminSchool from './pages/AdminSchool'
import AdminStaff from './pages/AdminStaff'
import AdminStudents from './pages/AdminStudents'
import ClassManage from './pages/ClassManage'
import ClassSheet from './pages/ClassSheet'
import FirstSetup from './pages/FirstSetup'
import Home from './pages/Home'
import Login from './pages/Login'
import MarkEntry from './pages/MarkEntry'

function Shell() {
  const { user, staff, settings, schoolMissing, loading } = useAuth()

  // The Admin's app keeps the public "school is set up" marker in place, so the sign-in page hides first-time setup.
  const adminSchoolName = staff?.role === 'admin' && staff.active ? settings?.name : undefined
  useEffect(() => {
    if (adminSchoolName) ensurePublicSchoolInfo(adminSchoolName).catch(() => {})
  }, [adminSchoolName])

  if (loading) return <div className="center muted">Loading…</div>
  if (!user) return <Login />
  if (schoolMissing) return <FirstSetup />
  if (!staff || !staff.active) {
    return (
      <div className="center card narrow">
        <h1>No access</h1>
        <p>Your login is not linked to an active staff account. Ask the School Admin to add or re-enable you.</p>
        <button onClick={() => signOut(auth)}>Sign out</button>
      </div>
    )
  }

  const isAdmin = staff.role === 'admin'
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">{settings?.name ?? 'School Marks'}</Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          {isAdmin && <NavLink to="/admin/school">School setup</NavLink>}
          {isAdmin && <NavLink to="/admin/staff">Staff</NavLink>}
          {isAdmin && <NavLink to="/admin/students">Students</NavLink>}
        </nav>
        <div className="who">
          <span>{staff.name}</span>
          <span className="muted small">{roleLabel(staff)}</span>
          <button className="link" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          {isAdmin && <Route path="/admin/school" element={<AdminSchool />} />}
          {isAdmin && <Route path="/admin/staff" element={<AdminStaff />} />}
          {isAdmin && <Route path="/admin/students" element={<AdminStudents />} />}
          <Route path="/class/:classId/manage" element={<ClassManage />} />
          <Route path="/class/:classId/sheet" element={<ClassSheet />} />
          <Route path="/entry/:classId/:subject" element={<MarkEntry />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  )
}
