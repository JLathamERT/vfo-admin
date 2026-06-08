import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession } from '../lib/api'
import ClientVault from '../components/client/ClientVault'

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
    fontSize: '15px', color: active ? '#fff' : '#8bacc8', fontFamily: 'DM Sans, sans-serif',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent', marginRight: '24px',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#073991', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', background: '#0a2566', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px' }}>VFO Portal</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#cfe0f5' }}>{session.name || session.email}</span>
          <button onClick={signOut} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
          <button style={tabBtn(tab === 'showroom')} onClick={() => setTab('showroom')}>Showroom</button>
          <button style={tabBtn(tab === 'vault')} onClick={() => setTab('vault')}>Vault</button>
        </div>

        {tab === 'showroom' && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#8bacc8', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            Your Showroom is coming soon.
          </div>
        )}
        {tab === 'vault' && <ClientVault />}
      </div>
    </div>
  )
}
