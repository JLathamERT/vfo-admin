import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession } from '../lib/api'
import SpecialistVault from '../components/specialist/SpecialistVault'
import VfoWordmark from '../components/shared/VfoWordmark'

// The specialist portal is a single page: the secure document vault. No other
// tabs — this is their only area.
export default function SpecialistPortal() {
  const navigate = useNavigate()
  const session = getSession()

  useEffect(() => {
    if (!session || session.role !== 'specialist') navigate('/specialist/login')
  }, [])

  if (!session || session.role !== 'specialist') return null

  function signOut() { clearSession(); navigate('/specialist/login') }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fd', color: '#16264a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', boxShadow: '0 2px 12px rgba(0,41,115,0.25)' }}>
        <VfoWordmark size={18} light />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{session.name || session.email}</span>
          <button onClick={signOut} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.32)', color: '#fff', borderRadius: '99px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ borderBottom: '1px solid #e3eaf5', marginBottom: '24px' }}>
          <span style={{ display: 'inline-block', padding: '10px 4px', fontSize: '15px', color: '#125ecc', fontWeight: 600, borderBottom: '2px solid #125ecc' }}>The Vault</span>
        </div>
        <SpecialistVault />
      </div>
    </div>
  )
}
