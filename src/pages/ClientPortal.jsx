import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import ClientVault from '../components/client/ClientVault'
import MemberShowroom from '../components/member/MemberShowroom'
import VfoWordmark from '../components/shared/VfoWordmark'
import ChangePasswordCard from '../components/shared/ChangePasswordCard'
import AppearanceCard from '../components/shared/AppearanceCard'
import { usePortalTheme } from '../lib/theme'
import { ShowroomSkeleton } from '../components/shared/Skeleton'

export default function ClientPortal() {
  const navigate = useNavigate()
  const session = getSession()
  usePortalTheme()
  const [tab, setTab] = useState(sessionStorage.getItem('clientActiveTab') || 'showroom')
  const [showroom, setShowroom] = useState(null)
  const [showroomLoading, setShowroomLoading] = useState(true)

  useEffect(() => {
    if (!session || session.role !== 'client') navigate('/client/login')
  }, [])
  useEffect(() => { sessionStorage.setItem('clientActiveTab', tab) }, [tab])

  // Showroom of the member this client is connected to (their enabled specialists).
  useEffect(() => {
    if (!session || session.role !== 'client') return
    let cancelled = false
    ;(async () => {
      try {
        const data = await callApi('client_showroom_load', {})
        const eco = {}
        ;(data.ecosystems || []).forEach(e => {
          if (!eco[e.expert_id]) eco[e.expert_id] = []
          eco[e.expert_id].push(e.name)
        })
        if (!cancelled) setShowroom({ experts: data.experts || [], exclusions: data.exclusions || [], ecoMap: eco })
      } catch (err) {
        console.error('Showroom load error:', err)
        if (!cancelled) setShowroom({ experts: [], exclusions: [], ecoMap: {} })
      } finally {
        if (!cancelled) setShowroomLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (!session || session.role !== 'client') return null

  function signOut() { clearSession(); navigate('/client/login') }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vfo-page)', color: 'var(--vfo-ink)', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,41,115,0.25)' }}>
        <VfoWordmark size={17} light onClick={() => setTab('showroom')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{session.name || session.email}</span>
          <button onClick={() => setTab('settings')} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: tab === 'settings' ? 'rgba(255,255,255,0.18)' : 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Settings</button>
          <button onClick={signOut} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      {tab !== 'settings' && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--vfo-border)', padding: '0 24px', background: 'var(--vfo-card)', position: 'relative', zIndex: 100 }}>
          {[['showroom', 'Showroom'], ['vault', 'Vault']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{ padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: tab === key ? '2px solid #125ecc' : '2px solid transparent', color: tab === key ? '#125ecc' : 'var(--vfo-muted)', fontSize: '14px', fontWeight: tab === key ? '600' : '400', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'showroom' && (
        showroomLoading
          ? <ShowroomSkeleton />
          : <MemberShowroom experts={showroom.experts} exclusions={showroom.exclusions} ecoMap={showroom.ecoMap} />
      )}
      {tab === 'vault' && (
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
          <ClientVault />
        </div>
      )}
      {tab === 'settings' && (
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
          <ChangePasswordCard action="client_update_login" />
          <div style={{ maxWidth: '460px', margin: '20px auto 0' }}>
            <AppearanceCard />
          </div>
        </div>
      )}
    </div>
  )
}
