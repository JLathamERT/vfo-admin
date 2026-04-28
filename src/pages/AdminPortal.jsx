import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import SpecialistsPanel from '../components/admin/SpecialistsPanel'
import MembersPanel from '../components/admin/MembersPanel'
import AdminEditor from '../components/admin/AdminEditor'
import AdminSettings from '../components/admin/AdminSettings'

function NavDropdown({ label, items, onSelect, isActive }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function handleMouseLeave() {
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={{
        padding: '14px 20px', background: 'transparent', border: 'none',
        borderBottom: isActive ? '2px solid #5b9fe6' : '2px solid transparent',
        color: isActive ? '#fff' : '#8bacc8', fontSize: '14px',
        fontWeight: isActive ? '600' : '400', cursor: 'pointer',
        fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: '6px'
      }}>
        {label}
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#0d2a6e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', minWidth: '180px', zIndex: 200, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {items.map(item => (
            <div key={item.key}>
              {item.header && (
                <div style={{ padding: '8px 16px 4px', fontSize: '10px', color: '#5a8ab5', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.header}</div>
              )}
              {item.options && item.options.map(opt => (
                <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPortal() {
  const navigate = useNavigate()
  const session = getSession()
  const [activeTab, setActiveTab] = useState(sessionStorage.getItem('adminActiveTab') || null)
  const [membersSection, setMembersSection] = useState(sessionStorage.getItem('adminMembersSection') || 'search_advisors')
  const [navClickCount, setNavClickCount] = useState(0)
const [specialistsSection, setSpecialistsSection] = useState(sessionStorage.getItem('adminSpecialistsSection') || 'search_specialists')
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

  function signOut() { clearSession(); navigate('/') }
  function handleTitleClick() { setShowEditor(false); setShowSettings(false); setActiveTab(null) }

  function selectMembersSection(key) {
    setActiveTab('members')
    sessionStorage.setItem('adminActiveTab', 'members')
    setMembersSection(key)
    sessionStorage.setItem('adminMembersSection', key)
    sessionStorage.removeItem('adminSelectedMember')
    sessionStorage.removeItem('adminMemberFeatureTab')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  function selectSpecialistsSection(key) {
    setActiveTab('specialists')
    sessionStorage.setItem('adminActiveTab', 'specialists')
    setSpecialistsSection(key)
    sessionStorage.setItem('adminSpecialistsSection', key)
    sessionStorage.removeItem('adminSelectedMember')
    sessionStorage.removeItem('adminMemberFeatureTab')
    setShowEditor(false)
    setShowSettings(false)
  }

  if (!session) return null

  const headerStyle = {
    background: '#0a2260', borderBottom: '1px solid rgba(255,255,255,0.1)',
    padding: '0 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100
  }

  const membersDropdownItems = [
    {
      key: 'advisors', header: 'Advisors',
      options: [
        { key: 'search_advisors', label: 'Search Advisors' },
        { key: 'add_advisor', label: 'Add Advisor' },
      ]
    },
    {
      key: 'accountants', header: 'Accountants',
      options: [
        { key: 'search_accountants', label: 'Search Accountants' },
        { key: 'add_accountant', label: 'Add Accountant' },
      ]
    },
  ]

  const specialistsDropdownItems = [
    {
      key: 'specialists', header: null,
      options: [
        { key: 'search_specialists', label: 'Search Specialists' },
        { key: 'add_specialist', label: 'Add Specialist' },
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#073991', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
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

      {showEditor && <AdminEditor onBack={handleTitleClick} />}
      {showSettings && <AdminSettings onBack={handleTitleClick} session={session} />}

      {!showEditor && !showSettings && (
        <>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 24px', background: '#0a2260' }}>
            <NavDropdown
              label="Members"
              items={membersDropdownItems}
              onSelect={selectMembersSection}
              isActive={activeTab === 'members'}
            />
            <NavDropdown
              label="Specialists"
              items={specialistsDropdownItems}
              onSelect={selectSpecialistsSection}
              isActive={activeTab === 'specialists'}
            />
          </div>

          <div style={{ flex: 1 }}>
          {!activeTab && (
            <div style={{ textAlign: 'center', padding: '60px 0 0' }}>
              <p style={{ fontSize: '14px', color: '#8bacc8', marginBottom: '8px' }}>Welcome back</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', color: '#ffffff', margin: 0 }}>{session.name}</p>
            </div>
          )}

          {activeTab === 'specialists' && !loading && (
            <SpecialistsPanel allExperts={allExperts} ecoMap={ecoMap} ciqMap={ciqMap} onDataChange={loadAllData} section={specialistsSection} />
          )}

          {activeTab === 'members' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap} ciqMap={ciqMap}
              onDataChange={loadAllData} section={membersSection} navClickCount={navClickCount}
            />
          )}

          {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>}
          </div>
        </>
      )}
    </div>
  )
}