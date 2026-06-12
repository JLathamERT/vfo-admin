import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import ClientVault from '../components/client/ClientVault'
import MemberShowroom from '../components/member/MemberShowroom'
import VfoWordmark from '../components/shared/VfoWordmark'

export default function ClientPortal() {
  const navigate = useNavigate()
  const session = getSession()
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
    <div style={{ minHeight: '100vh', background: '#f4f7fd', color: '#16264a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,41,115,0.25)' }}>
        <VfoWordmark size={17} light />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500 }}>{session.name || session.email}</span>
          <button onClick={signOut} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #e3eaf5', padding: '0 24px', background: '#ffffff', position: 'relative', zIndex: 100 }}>
        {[['showroom', 'Showroom'], ['vault', 'The Vault']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '14px 20px', background: 'transparent', border: 'none', borderBottom: tab === key ? '2px solid #125ecc' : '2px solid transparent', color: tab === key ? '#125ecc' : '#4e6087', fontSize: '14px', fontWeight: tab === key ? '600' : '400', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>{label}</button>
        ))}
      </div>

      {tab === 'showroom' && (
        showroomLoading
          ? <div style={{ textAlign: 'center', padding: '60px', color: '#4e6087' }}>Loading…</div>
          : <MemberShowroom experts={showroom.experts} exclusions={showroom.exclusions} ecoMap={showroom.ecoMap} />
      )}
      {tab === 'vault' && (
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
          <ClientVault />
        </div>
      )}
    </div>
  )
}
