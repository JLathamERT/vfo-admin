import { Routes, Route, Navigate } from 'react-router-dom'
import RolePicker from './pages/RolePicker'
import AdminLogin from './pages/AdminLogin'
import MemberLogin from './pages/MemberLogin'
import AdminPortal from './pages/AdminPortal'
import MemberPortal from './pages/MemberPortal'
import ClientDetail from './pages/ClientDetail'
import DecidePage from './pages/DecidePage'
import TaxDecidePage from './pages/TaxDecidePage'
import TaxImplementDecidePage from './pages/TaxImplementDecidePage'
import TaxPostReviewDecidePage from './pages/TaxPostReviewDecidePage'
import PayPage from './pages/PayPage'
import TaxPayPage from './pages/TaxPayPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RolePicker />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/member/login" element={<MemberLogin />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="/admin/client/:clientId" element={<ClientDetail />} />
      <Route path="/member" element={<MemberPortal />} />
      <Route path="/member/client/:clientId" element={<ClientDetail />} />
      <Route path="/decide" element={<DecidePage />} />
      <Route path="/tax-decide" element={<TaxDecidePage />} />
      <Route path="/tax-implement-decide" element={<TaxImplementDecidePage />} />
      <Route path="/tax-postreview-decide" element={<TaxPostReviewDecidePage />} />
      <Route path="/pay" element={<PayPage />} />
      <Route path="/tax-pay" element={<TaxPayPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}