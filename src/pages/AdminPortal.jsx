import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import SpecialistsPanel from '../components/admin/SpecialistsPanel'
import MembersPanel from '../components/admin/MembersPanel'
import AdminEditor from '../components/admin/AdminEditor'
import AdminSettings from '../components/admin/AdminSettings'
import AutomationPanel from '../components/admin/AutomationPanel'
import TaxAutomationPanel from '../components/admin/TaxAutomationPanel'
import PipAutomationPanel from '../components/admin/PipAutomationPanel'
import AdvisorAutomationPanel from '../components/admin/AdvisorAutomationPanel'
import AccountantAutomationPanel from '../components/admin/AccountantAutomationPanel'
import SpecialistAutomationPanel from '../components/admin/SpecialistAutomationPanel'
import NotificationBell from '../components/NotificationBell'
import EmailTemplatesPanel from '../components/admin/EmailTemplatesPanel'

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
  const location = useLocation()
  const session = getSession()
  const [activeTab, setActiveTab] = useState(() => {
    const t = sessionStorage.getItem('adminActiveTab')
    return t === 'members' ? 'advisors' : (t || null)
  })
  const [advisorsSection, setAdvisorsSection] = useState(sessionStorage.getItem('adminAdvisorsSection') || 'advisor_search')
  const [accountantsSection, setAccountantsSection] = useState(sessionStorage.getItem('adminAccountantsSection') || 'accountant_search')
  const [navClickCount, setNavClickCount] = useState(0)
  const [specialistsSection, setSpecialistsSection] = useState(sessionStorage.getItem('adminSpecialistsSection') || 'specialist_search')
  const [automationSection, setAutomationSection] = useState(sessionStorage.getItem('adminAutomationSection') || 'map1_pipeline')
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [allExperts, setAllExperts] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [allExclusionMap, setAllExclusionMap] = useState({})
  const [ecoMap, setEcoMap] = useState({})
  const [ciqMap, setCiqMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search)); return }
    loadAllData()
  }, [])

  // Deep-link from notifications etc: ?tab=&section= drives the active tab/section.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const section = params.get('section')
    if (!tab) return
    setActiveTab(tab)
    sessionStorage.setItem('adminActiveTab', tab)
    if (section) {
      const sectionSetters = {
        advisors: [setAdvisorsSection, 'adminAdvisorsSection'],
        accountants: [setAccountantsSection, 'adminAccountantsSection'],
        specialists: [setSpecialistsSection, 'adminSpecialistsSection'],
        automation: [setAutomationSection, 'adminAutomationSection'],
      }
      const entry = sectionSetters[tab]
      if (entry) { entry[0](section); sessionStorage.setItem(entry[1], section) }
    }
  }, [location.search])

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

  function selectAdvisorsSection(key) {
    setActiveTab('advisors')
    sessionStorage.setItem('adminActiveTab', 'advisors')
    setAdvisorsSection(key)
    sessionStorage.setItem('adminAdvisorsSection', key)
    sessionStorage.removeItem('adminSelectedMember')
    sessionStorage.removeItem('adminMemberFeatureTab')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  function selectAccountantsSection(key) {
    setActiveTab('accountants')
    sessionStorage.setItem('adminActiveTab', 'accountants')
    setAccountantsSection(key)
    sessionStorage.setItem('adminAccountantsSection', key)
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

  function selectAutomationSection(key) {
    setActiveTab('automation')
    sessionStorage.setItem('adminActiveTab', 'automation')
    setAutomationSection(key)
    sessionStorage.setItem('adminAutomationSection', key)
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

  const advisorsDropdownItems = [
    {
      key: 'advisors', header: null,
      options: [
        { key: 'advisor_search', label: 'Advisor Search' },
        { key: 'add_advisor', label: 'Add Advisor' },
        { key: 'advisor_onboarding', label: 'Advisor Onboarding' },
      ]
    },
  ]

  const accountantsDropdownItems = [
    {
      key: 'accountants', header: null,
      options: [
        { key: 'accountant_search', label: 'Accountant Search' },
        { key: 'add_accountant', label: 'Add Accountant' },
        { key: 'accountant_onboarding', label: 'Accountant Onboarding' },
      ]
    },
  ]

  const specialistsDropdownItems = [
    {
      key: 'specialists', header: null,
      options: [
        { key: 'specialist_search', label: 'Specialist Search' },
        { key: 'add_specialist', label: 'Add Specialist' },
        { key: 'specialist_onboarding', label: 'Specialist Onboarding' },
      ]
    },
  ]

  const automationDropdownItems = [
    {
      key: 'automation', header: null,
      options: [
        { key: 'map1_pipeline', label: 'Holistic Planning - MAP 1' },
        { key: 'tax_pipeline', label: 'Holistic Planning - Tax Priorities' },
        { key: 'pip_pipeline', label: 'Holistic Planning - PIP Meetings' },
        { key: 'standalone_tax_pipeline', label: 'Tax Planning' },
        { key: 'advisor_pipeline', label: 'Advisor Onboarding' },
        { key: 'accountant_pipeline', label: 'Accountant Onboarding' },
        { key: 'specialist_pipeline', label: 'Specialist Onboarding' },
        { key: 'email_templates', label: 'Email Templates' },
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
          <NotificationBell />
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
              label="Advisors"
              items={advisorsDropdownItems}
              onSelect={selectAdvisorsSection}
              isActive={activeTab === 'advisors'}
            />
            <NavDropdown
              label="Accountants"
              items={accountantsDropdownItems}
              onSelect={selectAccountantsSection}
              isActive={activeTab === 'accountants'}
            />
            <NavDropdown
              label="Specialists"
              items={specialistsDropdownItems}
              onSelect={selectSpecialistsSection}
              isActive={activeTab === 'specialists'}
            />
            <NavDropdown
              label="Automation"
              items={automationDropdownItems}
              onSelect={selectAutomationSection}
              isActive={activeTab === 'automation'}
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

          {activeTab === 'advisors' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap} ciqMap={ciqMap}
              onDataChange={loadAllData} section={advisorsSection} navClickCount={navClickCount}
            />
          )}

          {activeTab === 'accountants' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap} ciqMap={ciqMap}
              onDataChange={loadAllData} section={accountantsSection} navClickCount={navClickCount}
            />
          )}

          {activeTab === 'automation' && !loading && automationSection === 'map1_pipeline' && (
            <AutomationPanel section={automationSection} />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'tax_pipeline' && (
            <TaxAutomationPanel programScope="holistic" />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'pip_pipeline' && (
            <PipAutomationPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'standalone_tax_pipeline' && (
            <TaxAutomationPanel programScope="standalone" />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'advisor_pipeline' && (
            <AdvisorAutomationPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'accountant_pipeline' && (
            <AccountantAutomationPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'specialist_pipeline' && (
            <SpecialistAutomationPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'email_templates' && (
            <EmailTemplatesPanel />
          )}

          {loading && <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>}
          </div>
        </>
      )}
    </div>
  )
}