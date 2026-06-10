import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession } from '../lib/api'
import ClientVault from '../components/client/ClientVault'
import VfoWordmark from '../components/shared/VfoWordmark'

export default function ClientPortal() {
  const navigate = useNavigate()
  const session = getSession()
  const [tab, setTab] = useState(sessionStorage.getItem('clientActiveTab') || 'showroom')

  useEffect(() => {
    if (!session || session.role !== 'client') navigate('/client/login')
  }, [])
  useEffect(() => { sessionStorage.setItem('clientActiveTab', tab) }, [tab])

  if (!session || session.role !== 'client') return null

  function signOut() { clearSession(); navigate('/client/login') }

  const tabBtn = (active) => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px',
    fontSize: '15px', color: active ? '#125ecc' : '#4e6087', fontWeight: active ? 600 : 400, fontFamily: 'Inter, sans-serif',
    borderBottom: active ? '2px solid #125ecc' : '2px solid transparent', marginRight: '24px',
  })

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
          <button style={tabBtn(tab === 'showroom')} onClick={() => setTab('showroom')}>Showroom</button>
          <button style={tabBtn(tab === 'vault')} onClick={() => setTab('vault')}>The Vault</button>
        </div>

        {tab === 'showroom' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#4e6087', background: '#eef2f9', borderRadius: '12px', border: '1px solid #ebf0f8' }}>
            Your Showroom is coming soon.
          </div>
        )}
        {tab === 'vault' && <ClientVault />}
      </div>
    </div>
  )
}
