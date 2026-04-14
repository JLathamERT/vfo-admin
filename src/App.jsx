import { Routes, Route, Navigate } from 'react-router-dom'
import RolePicker from './pages/RolePicker'
import AdminLogin from './pages/AdminLogin'
import MemberLogin from './pages/MemberLogin'
import AdminPortal from './pages/AdminPortal'
import MemberPortal from './pages/MemberPortal'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RolePicker />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/member/login" element={<MemberLogin />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="/member" element={<MemberPortal />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}