import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession, clearSession } from '../lib/api'
import SpecialistVault from '../components/specialist/SpecialistVault'
import SpecialistShared from '../components/specialist/SpecialistShared'
import ChangePasswordCard from '../components/shared/ChangePasswordCard'
import VfoWordmark from '../components/shared/VfoWordmark'

// The specialist portal: two content tabs — their own document vault, and
// "Shared with Me" (client documents the VFO team shared with them to review).
export default function SpecialistPortal() {
  const navigate = useNavigate()
  const session = getSession()
  const [tab, setTab] = useState('vault')
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!session || session.role !== 'specialist') { navigate('/specialist/login'); return }
    refreshUnread()
  }, [])

  async function refreshUnread() {
    try { const d = await callApi('specialist_shared_unread_count', {}); setUnread(d.unread || 0) }
    catch { /* badge is best-effort */ }
  }

  if (!session || session.role !== 'specialist') return null

  function signOut() { clearSession(); navigate('/specialist/login') }

  const TABS = [['vault', 'Vault'], ['shared', 'Shared with Me']]

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fd', color: '#16264a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,41,115,0.25)' }}>
        <VfoWordmark size={17} light onClick={() => setTab('vault')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{session.name || session.email}</span>
          <button onClick={() => setTab('settings')} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: tab === 'settings' ? 'rgba(255,255,255,0.18)' : 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Settings</button>
          <button onClick={signOut} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
        {tab === 'settings' ? (
          <ChangePasswordCard action="specialist_update_login" />
        ) : (
          <>
            <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e3eaf5', marginBottom: '24px' }}>
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'transparent', border: 'none', cursor: 'pointer', padding: '10px 4px', fontSize: '15px', fontFamily: 'Inter, sans-serif', fontWeight: 600, color: tab === key ? '#125ecc' : '#4e6087', borderBottom: tab === key ? '2px solid #125ecc' : '2px solid transparent' }}>
                  {label}
                  {key === 'shared' && unread > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '999px', background: '#e74c3c', color: '#fff', fontSize: '11px', fontWeight: 700 }}>{unread}</span>
                  )}
                </button>
              ))}
            </div>
            {tab === 'vault' && <SpecialistVault />}
            {tab === 'shared' && <SpecialistShared onUnreadChange={refreshUnread} />}
          </>
        )}
      </div>
    </div>
  )
}
