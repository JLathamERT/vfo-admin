import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import SpecialistsPanel from '../components/admin/SpecialistsPanel'
import MembersPanel from '../components/admin/MembersPanel'
import AdminEditor from '../components/admin/AdminEditor'
import AdminSettings from '../components/admin/AdminSettings'

export default function AdminPortal() {
  const navigate = useNavigate()
  const session = getSession()
  const [activeTab, setActiveTab] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [allExperts, setAllExperts] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [allExclusionMap, setAllExclusionMap] = useState({})
  const [ecoMap, setEcoMap] = useState({})
  const [ciqMap, setCiqMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/admin/login'); return }
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      const data = await callApi('load_data')
      setAllExperts(data.experts || [])
      setAllMembers(data.members || [])
      const excMap = {}
      ;(data.exclusions || []).forEach(e => {
        if (!excMap[e.member_number]) excMap[e.member_number] = []
        excMap[e.member_number].push(e.expert_id)
      })
      setAllExclusionMap(excMap)
      const eco = {}
      ;(data.ecosystems || []).forEach(e => {
        if (!eco[e.expert_id]) eco[e.expert_id] = []
        eco[e.expert_id].push(e.name)
      })
      setEcoMap(eco)
      const ciq = {}
      ;(data.ciq || []).forEach(c => {
        if (!ciq[c.expert_id]) ciq[c.expert_id] = []
        ciq[c.expert_id].push(c.name)
      })
      setCiqMap(ciq)
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    clearSession()
    navigate('/')
  }

  function handleTitleClick() {
    setShowEditor(false)
    setShowSettings(false)
    setActiveTab(null)
  }

  if (!session) return null

  const headerStyle = {
    background: '#0a2260',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '56px',
    position: 'sticky',
    top: 0,
    zIndex: 100
  }

  const tabBarStyle = {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '0 24px',
    background: '#0a2260'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#073991', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', cursor: 'pointer' }} onClick={handleTitleClick}>
          VFO Portal
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: '#8bacc8' }}>{session.name}</span>
          {session.is_superadmin && (
            <button onClick={() => { setShowEditor(true); setShowSettings(false); setActiveTab(null) }}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.3)', background: 'transparent', color: '#d4af37', fontSize: '13px', cursor: 'pointer' }}>
              Admin Editor
            </button>
          )}
          <button onClick={() => { setShowSettings(true); setShowEditor(false); setActiveTab(null) }}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Settings
          </button>
          <button onClick={signOut}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Special panels */}
      {showEditor && <AdminEditor onBack={handleTitleClick} />}
      {showSettings && <AdminSettings onBack={handleTitleClick} session={session} />}

      {/* Main content */}
      {!showEditor && !showSettings && (
        <>
          {/* Tab bar */}
          <div style={tabBarStyle}>
            {['specialists', 'members'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: '14px 20px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #5b9fe6' : '2px solid transparent',
                  color: activeTab === tab ? '#ffffff' : '#8bacc8',
                  fontSize: '14px',
                  fontWeight: activeTab === tab ? '600' : '400',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  whiteSpace: 'nowrap',
                  textTransform: 'capitalize'
                }}>
                {tab === 'specialists' ? 'Specialists' : 'Members'}
              </button>
            ))}
          </div>

          {/* Welcome or panel */}
          {!activeTab && (
            <div style={{ textAlign: 'center', padding: '60px 0 0' }}>
              <p style={{ fontSize: '14px', color: '#8bacc8', marginBottom: '8px' }}>Welcome back</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', color: '#ffffff', margin: 0 }}>{session.name}</p>
            </div>
          )}

          {activeTab === 'specialists' && !loading && (
            <SpecialistsPanel
              allExperts={allExperts}
              ecoMap={ecoMap}
              ciqMap={ciqMap}
              onDataChange={loadAllData}
            />
          )}

          {activeTab === 'members' && !loading && (
            <MembersPanel
              allMembers={allMembers}
              allExperts={allExperts}
              allExclusionMap={allExclusionMap}
              ecoMap={ecoMap}
              ciqMap={ciqMap}
              onDataChange={loadAllData}
            />
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>
          )}
        </>
      )}
    </div>
  )
}