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
import AdvisorDecidePage from './pages/AdvisorDecidePage'
import AccountantDecidePage from './pages/AccountantDecidePage'
import PayPage from './pages/PayPage'
import TaxPayPage from './pages/TaxPayPage'
import AdvisorPayPage from './pages/AdvisorPayPage'
import AccountantPayPage from './pages/AccountantPayPage'
import PipPayPage from './pages/PipPayPage'
import MemberSetupPage from './pages/MemberSetupPage'
import SpecialistSifPage from './pages/SpecialistSifPage'
import SpecialistRevShareDecidePage from './pages/SpecialistRevShareDecidePage'
import SpecialistPayPage from './pages/SpecialistPayPage'
import SpecialistQuestionsPage from './pages/SpecialistQuestionsPage'

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
      <Route path="/advisor-decide" element={<AdvisorDecidePage />} />
      <Route path="/accountant-decide" element={<AccountantDecidePage />} />
      <Route path="/pay" element={<PayPage />} />
      <Route path="/tax-pay" element={<TaxPayPage />} />
      <Route path="/advisor-pay" element={<AdvisorPayPage />} />
      <Route path="/accountant-pay" element={<AccountantPayPage />} />
      <Route path="/pip-pay" element={<PipPayPage />} />
      <Route path="/member-setup" element={<MemberSetupPage />} />
      <Route path="/specialist-sif" element={<SpecialistSifPage />} />
      <Route path="/specialist-revshare-decide" element={<SpecialistRevShareDecidePage />} />
      <Route path="/specialist-pay" element={<SpecialistPayPage />} />
      <Route path="/specialist-questions" element={<SpecialistQuestionsPage />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}