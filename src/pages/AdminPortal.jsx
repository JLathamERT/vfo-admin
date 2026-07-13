import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getSession, clearSession, callApi } from '../lib/api'
import { usePortalTheme } from '../lib/theme'
import SpecialistsPanel from '../components/admin/SpecialistsPanel'
import MembersPanel from '../components/admin/MembersPanel'
import MemberOverviewPanel from '../components/admin/MemberOverviewPanel'
import ClientOverviewPanel from '../components/admin/ClientOverviewPanel'
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
import NotificationEditorPanel from '../components/admin/NotificationEditorPanel'
import VfoWordmark from '../components/shared/VfoWordmark'
import AllPaymentsTab from '../components/payments/AllPaymentsTab'
import SpecialistRevenuePanel from '../components/admin/SpecialistRevenuePanel'
import SpecialistRecurringPanel from '../components/admin/SpecialistRecurringPanel'
import SpecialistLicensePanel from '../components/admin/SpecialistLicensePanel'
import SpecialistBgPanel from '../components/admin/SpecialistBgPanel'
import SpecialistReconciliationPanel from '../components/admin/SpecialistReconciliationPanel'
import HolisticRevenuePanel from '../components/admin/HolisticRevenuePanel'
import HolisticReconciliationPanel from '../components/admin/HolisticReconciliationPanel'
import TaxRevenuePanel from '../components/admin/TaxRevenuePanel'
import TaxReconciliationPanel from '../components/admin/TaxReconciliationPanel'
import PipRevenuePanel from '../components/admin/PipRevenuePanel'
import PipReconciliationPanel from '../components/admin/PipReconciliationPanel'
import MemberOnboardingPanel from '../components/admin/MemberOnboardingPanel'
import MembershipFeesPanel from '../components/admin/MembershipFeesPanel'
import SpecialistRevenueAutomationPanel from '../components/admin/SpecialistRevenueAutomationPanel'
import GrowthCreditsPanel from '../components/admin/GrowthCreditsPanel'
import GrowthCreditsAccountingPanel from '../components/admin/GrowthCreditsAccountingPanel'
import NotificationsPage from '../components/admin/NotificationsPage'
import GrowthCreditsRedemptionsPage from '../components/admin/GrowthCreditsRedemptionsPage'
import { DirectoryListSkeleton } from '../components/shared/Skeleton'

// A dropdown row that, on hover, flies out a submenu of options to the right.
function SubmenuRow({ label, options, onSelect }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', padding: '8px 20px', background: open ? 'var(--vfo-tint)' : 'transparent', border: 'none', color: 'var(--vfo-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
        {label}<span style={{ fontSize: '9px', opacity: 0.6 }}>▸</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '-4px', left: '100%', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border)', borderRadius: '12px', minWidth: '210px', zIndex: 210, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => onSelect(opt.key)}
              style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--vfo-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NavDropdown({ label, items, onSelect, isActive, muted = false }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() {
    clearTimeout(closeTimer.current)
    setOpen(true)
  }

  function handleMouseLeave() {
    setOpen(false)
  }

  // Key tabs (default) read as primary — larger, bolder, darker. Muted "other"
  // tabs (Accounting / Automation) are visually secondary.
  const btnStyle = muted ? {
    padding: '14px 14px', background: 'transparent', border: 'none',
    borderBottom: isActive ? '2px solid #125ecc' : '2px solid transparent',
    color: isActive ? '#125ecc' : '#97a3ba', fontSize: '13px',
    fontWeight: isActive ? '600' : '500', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: '6px'
  } : {
    padding: '15px 20px', background: 'transparent', border: 'none',
    borderBottom: isActive ? '2px solid #125ecc' : '2px solid transparent',
    color: isActive ? '#125ecc' : 'var(--vfo-ink)', fontSize: '14.5px',
    fontWeight: isActive ? '700' : '600', cursor: 'pointer',
    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
    display: 'flex', alignItems: 'center', gap: '6px'
  }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={btnStyle}>
        {label}
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--vfo-card)', border: '1px solid var(--vfo-border)', borderRadius: '12px', minWidth: '180px', zIndex: 200, paddingTop: '4px', paddingBottom: '4px', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {items.map(item => (
            <div key={item.key}>
              {item.submenu && (
                <SubmenuRow label={item.submenuLabel} options={item.submenu} onSelect={(k) => { onSelect(k); setOpen(false) }} />
              )}
              {item.header && (
                <div style={{ padding: '8px 16px 4px', fontSize: '10px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.header}</div>
              )}
              {item.options && item.options.map(opt => (
                <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
                  style={{ display: 'block', width: '100%', padding: '8px 20px', background: 'transparent', border: 'none', color: 'var(--vfo-ink)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
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
  usePortalTheme()
  // The three superadmin-managed "other" tabs. A non-superadmin admin sees one
  // only if Jake granted it (session.allowed_tabs). Superadmin sees all.
  const canSeeTab = (key) => !!session?.is_superadmin || (session?.allowed_tabs || []).includes(key)
  const [activeTab, setActiveTab] = useState(() => {
    const t = sessionStorage.getItem('adminActiveTab')
    // The "other" tabs are access-gated — never restore an admin into one they lack.
    if (t === 'automation' && !canSeeTab('automation')) return null
    if ((t === 'accounting' || t === 'payments') && !canSeeTab('accounting')) return null
    if (t === 'member_overview' && !canSeeTab('member_overview')) return null
    if (t === 'client_overview' && !canSeeTab('client_overview')) return null
    if (t === 'growth_credits' && !canSeeTab('growth_credits')) return null
    if (t === 'members') return 'advisors'
    // Legacy: the standalone Payments tab is now a sub-tab of Accounting.
    if (t === 'payments') return 'accounting'
    return t || null
  })
  const [advisorsSection, setAdvisorsSection] = useState(sessionStorage.getItem('adminAdvisorsSection') || 'advisor_search')
  const [accountantsSection, setAccountantsSection] = useState(sessionStorage.getItem('adminAccountantsSection') || 'accountant_search')
  const [navClickCount, setNavClickCount] = useState(0)
  const [specialistsSection, setSpecialistsSection] = useState(sessionStorage.getItem('adminSpecialistsSection') || 'specialist_search')
  const [strategicSection, setStrategicSection] = useState(sessionStorage.getItem('adminStrategicSection') || 'strategic_member_search')
  const [automationSection, setAutomationSection] = useState(sessionStorage.getItem('adminAutomationSection') || 'map1_pipeline')
  const [accountingSection, setAccountingSection] = useState(sessionStorage.getItem('adminAccountingSection') || 'payments')
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [allExperts, setAllExperts] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [allExclusionMap, setAllExclusionMap] = useState({})
  const [ecoMap, setEcoMap] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session || session.role !== 'admin') { navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search)); return }
    loadAllData()
    // Deep-link from the ClientDetail header's Settings / Admin Editor buttons
    // (that route can't reach this component's view state directly).
    const view = sessionStorage.getItem('adminOpenView')
    if (view) {
      sessionStorage.removeItem('adminOpenView')
      if (view === 'settings') { setShowSettings(true); setActiveTab(null) }
      if (view === 'editor' && session.is_superadmin) { setShowEditor(true); setActiveTab(null) }
    }
  }, [])

  // Deep-link from notifications etc: ?tab=&section= drives the active tab/section,
  // and ?member=&feature= opens a specific member's detail view on a feature tab
  // (e.g. a Growth Plan notification → that member's One Page Plan).
  useEffect(() => {
    // Read the LIVE URL, not router state: after we strip consumed params with
    // history.replaceState below, react-router's location.search still holds
    // the old value, and this effect re-runs when allMembers loads — reading
    // window.location keeps that re-run from re-applying a consumed deep link.
    const params = new URLSearchParams(window.location.search)
    const memberNum = params.get('member')
    if (memberNum) {
      if (!allMembers.length) return // members not loaded yet — effect re-runs when they are
      const m = allMembers.find(x => String(x.plugin_member_number) === String(memberNum))
      if (m) {
        openMemberProfile(m, params.get('feature') || 'profile_details')
        navigate('/admin', { replace: true }) // strip params so manual nav isn't re-hijacked
      }
      return
    }
    const tab = params.get('tab')
    const section = params.get('section')
    if (!tab) return
    // The "other" tabs are access-gated — ignore a deep-link into one the admin lacks.
    if (tab === 'automation' && !canSeeTab('automation')) return
    if ((tab === 'accounting' || tab === 'payments') && !canSeeTab('accounting')) return
    if (tab === 'member_overview' && !canSeeTab('member_overview')) return
    if (tab === 'client_overview' && !canSeeTab('client_overview')) return
    if (tab === 'growth_credits' && !canSeeTab('growth_credits')) return
    setActiveTab(tab)
    sessionStorage.setItem('adminActiveTab', tab)
    if (section) {
      const sectionSetters = {
        advisors: [setAdvisorsSection, 'adminAdvisorsSection'],
        accountants: [setAccountantsSection, 'adminAccountantsSection'],
        strategic: [setStrategicSection, 'adminStrategicSection'],
        specialists: [setSpecialistsSection, 'adminSpecialistsSection'],
        automation: [setAutomationSection, 'adminAutomationSection'],
        accounting: [setAccountingSection, 'adminAccountingSection'],
      }
      const entry = sectionSetters[tab]
      if (entry) { entry[0](section); sessionStorage.setItem(entry[1], section) }
    }
    // Deep link consumed — strip it so the URL is clean and a reload restores
    // from sessionStorage instead of re-hijacking to this tab (gotcha #182;
    // replaceState, never navigate, for self-heals).
    window.history.replaceState({}, '', '/admin')
  }, [location.search, allMembers])

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
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function signOut() { clearSession(); navigate('/') }
  function handleTitleClick() { setShowEditor(false); setShowSettings(false); setActiveTab(null); sessionStorage.removeItem('adminActiveTab') }

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

  function selectStrategicSection(key) {
    setActiveTab('strategic')
    sessionStorage.setItem('adminActiveTab', 'strategic')
    setStrategicSection(key)
    sessionStorage.setItem('adminStrategicSection', key)
    sessionStorage.removeItem('adminSelectedStrategicMember')
    sessionStorage.removeItem('adminStrategicFeatureTab')
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

  function selectAccountingSection(key) {
    setActiveTab('accounting')
    sessionStorage.setItem('adminActiveTab', 'accounting')
    setAccountingSection(key)
    sessionStorage.setItem('adminAccountingSection', key)
    sessionStorage.removeItem('adminSelectedMember')
    sessionStorage.removeItem('adminMemberFeatureTab')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  function selectMemberOverview() {
    setActiveTab('member_overview')
    sessionStorage.setItem('adminActiveTab', 'member_overview')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  function selectClientOverview() {
    setActiveTab('client_overview')
    sessionStorage.setItem('adminActiveTab', 'client_overview')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  function selectGrowthCredits() {
    setActiveTab('growth_credits')
    sessionStorage.setItem('adminActiveTab', 'growth_credits')
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  // Member Overview → open a member's full existing detail view in their own
  // category tab (Advisors / Accountants / Strategic). Each MemberDirectoryView
  // restores its selection from sessionStorage on mount, so we pre-seed the right
  // selection key + feature tab, then switch tabs.
  function openMemberProfile(m, feature = 'profile_details') {
    const cat = m.member_category
    let tab, sectionSetter, sectionKey, section, selKey, featKey
    if (cat === 'accountant') {
      tab = 'accountants'; sectionSetter = setAccountantsSection; sectionKey = 'adminAccountantsSection'; section = 'accountant_search'
      selKey = 'adminSelectedAccountant'; featKey = 'adminAccountantFeatureTab'
    } else if (cat === 'strategic_member') {
      tab = 'strategic'; sectionSetter = setStrategicSection; sectionKey = 'adminStrategicSection'; section = 'strategic_member_search'
      selKey = 'adminSelectedStrategicMember'; featKey = 'adminStrategicFeatureTab'
    } else {
      tab = 'advisors'; sectionSetter = setAdvisorsSection; sectionKey = 'adminAdvisorsSection'; section = 'advisor_search'
      selKey = 'adminSelectedMember'; featKey = 'adminMemberFeatureTab'
    }
    sessionStorage.setItem(selKey, m.plugin_member_number)
    sessionStorage.setItem(featKey, feature)
    sectionSetter(section)
    sessionStorage.setItem(sectionKey, section)
    setActiveTab(tab)
    sessionStorage.setItem('adminActiveTab', tab)
    setNavClickCount(c => c + 1)
    setShowEditor(false)
    setShowSettings(false)
  }

  // Collapse the muted "other" tabs into a single More ▾ menu when the nav
  // would otherwise overflow off-screen.
  const [navNarrow, setNavNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1180px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1180px)')
    const fn = () => setNavNarrow(mq.matches)
    mq.addEventListener('change', fn)
    window.addEventListener('resize', fn)
    return () => { mq.removeEventListener('change', fn); window.removeEventListener('resize', fn) }
  }, [])

  if (!session) return null

  const headerStyle = {
    background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)',
    padding: '0 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100,
    boxShadow: '0 2px 12px rgba(0,41,115,0.25)'
  }

  const advisorsDropdownItems = [
    {
      key: 'advisors', header: null,
      options: [
        { key: 'advisor_search', label: 'Advisor Search' },
        { key: 'advisor_kpis', label: 'Advisor KPIs' },
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
        { key: 'accountant_kpis', label: 'Accountant KPIs' },
        { key: 'add_accountant', label: 'Add Accountant' },
        { key: 'accountant_onboarding', label: 'Accountant Onboarding' },
      ]
    },
  ]

  const strategicDropdownItems = [
    {
      key: 'strategic', header: null,
      options: [
        { key: 'strategic_member_search', label: 'Strategic Member Search' },
        { key: 'strategic_member_kpis', label: 'Strategic Member KPIs' },
        { key: 'strategic_partners', label: 'Strategic Partners' },
        { key: 'add_strategic_member', label: 'Add Strategic Member' },
      ]
    },
  ]

  const specialistsDropdownItems = [
    {
      key: 'specialists', header: null,
      options: [
        { key: 'specialist_search', label: 'Specialist Search' },
        { key: 'specialist_kpis', label: 'Specialist KPIs' },
        { key: 'add_specialist', label: 'Add Specialist' },
        { key: 'specialist_onboarding', label: 'Specialist Onboarding' },
        { key: 'specialist_showroom', label: 'Showroom' },
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
        { key: 'specialist_revenue_pipeline', label: 'VFO Specialist Revenue' },
        { key: 'growth_credits', label: 'Growth Credits' },
        { key: 'email_templates', label: 'Email Templates' },
        { key: 'notification_editor', label: 'Notification Editor' },
      ]
    },
  ]

  const accountingDropdownItems = [
    {
      key: 'accounting', header: null,
      options: [
        { key: 'payments', label: 'Payments' },
      ]
    },
    {
      key: 'accounting_specialists',
      submenuLabel: 'Specialists',
      submenu: [
        { key: 'specialist_revenue', label: 'VFO Specialist Revenue' },
        { key: 'specialist_recurring', label: 'VFO Specialist Recurring Revenue Payments' },
        { key: 'specialist_reconciliation', label: 'VFO Specialist Reconciliation' },
        { key: 'specialist_license', label: 'VFO Specialist License Fees' },
        { key: 'specialist_bg', label: 'VFO Specialist Background Check Fees' },
      ],
    },
    {
      key: 'accounting_vfo_services',
      submenuLabel: 'VFO Services',
      submenu: [
        { key: 'holistic_revenue', label: 'Holistic Planning Revenue' },
        { key: 'holistic_reconciliation', label: 'Holistic Planning Reconciliation' },
        { key: 'tax_revenue', label: 'Tax Planning Revenue' },
        { key: 'tax_reconciliation', label: 'Tax Planning Reconciliation' },
        { key: 'pip_revenue', label: 'Additional PIP Revenue' },
        { key: 'pip_reconciliation', label: 'Additional PIP Reconciliation' },
      ],
    },
    {
      key: 'accounting_members',
      submenuLabel: 'Members',
      submenu: [
        { key: 'advisor_onboarding_fees', label: 'Advisor Onboarding' },
        { key: 'advisor_membership_fees', label: 'Advisor Membership Fees' },
        { key: 'accountant_onboarding_fees', label: 'Accountant Onboarding' },
        { key: 'accountant_membership_fees', label: 'Accountant Membership Fees' },
        { key: 'gc_accounting', label: 'Growth Credits' },
      ],
    },
  ]

  // Narrow-nav variant: the three muted tabs folded into one More ▾ menu.
  // Keys are prefixed so one onSelect can route back to the right section setter.
  const moreDropdownItems = [
    ...(canSeeTab('member_overview') ? [{ key: 'more_mo', options: [{ key: '__member_overview', label: 'Member Overview' }] }] : []),
    ...(canSeeTab('client_overview') ? [{ key: 'more_co', options: [{ key: '__client_overview', label: 'Client Overview' }] }] : []),
    ...(canSeeTab('growth_credits') ? [{ key: 'more_gc', options: [{ key: '__growth_credits', label: 'Growth Credits' }] }] : []),
    ...(canSeeTab('automation') ? [
      { key: 'more_auto_h', header: 'Automation & Config' },
      { key: 'more_auto', options: automationDropdownItems[0].options.map(o => ({ ...o, key: 'auto:' + o.key })) },
    ] : []),
    ...(canSeeTab('accounting') ? [
      { key: 'more_acct_h', header: 'Accounting' },
      { key: 'more_acct_pay', options: [{ key: 'acct:payments', label: 'Payments' }] },
      ...accountingDropdownItems.slice(1).map(item => ({ ...item, key: 'more_' + item.key, submenu: item.submenu.map(o => ({ ...o, key: 'acct:' + o.key })) })),
    ] : []),
  ]
  function selectMoreOption(key) {
    if (key === '__member_overview') return selectMemberOverview()
    if (key === '__client_overview') return selectClientOverview()
    if (key === '__growth_credits') return selectGrowthCredits()
    if (key.startsWith('auto:')) return selectAutomationSection(key.slice(5))
    if (key.startsWith('acct:')) return selectAccountingSection(key.slice(5))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vfo-page)', color: 'var(--vfo-ink)', fontFamily: 'Inter, sans-serif' }}>
      <div style={headerStyle}>
        <VfoWordmark size={17} light onClick={handleTitleClick} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <NotificationBell />
          <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontWeight: 500, whiteSpace: 'nowrap', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</span>
          {session.is_superadmin && (
            <button onClick={() => { setShowEditor(true); setShowSettings(false); setActiveTab(null) }}
              style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,205,150,0.5)', background: 'transparent', color: '#ffd9a0', fontWeight: 500, fontSize: '13px', cursor: 'pointer' }}>
              Admin Editor
            </button>
          )}
          <button onClick={() => { setShowSettings(true); setShowEditor(false); setActiveTab(null) }}
            style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Settings
          </button>
          <button onClick={signOut}
            style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {showEditor && <AdminEditor onBack={handleTitleClick} />}
      {showSettings && <AdminSettings onBack={handleTitleClick} session={session} />}

      {!showEditor && !showSettings && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--vfo-border)', padding: '0 24px', background: 'var(--vfo-card)', boxShadow: '0 2px 8px rgba(20,45,95,0.04)' }}>
            {/* Key tabs — the four primary member/specialist directories. */}
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
              label="Strategic Members"
              items={strategicDropdownItems}
              onSelect={selectStrategicSection}
              isActive={activeTab === 'strategic'}
            />
            <NavDropdown
              label="Specialists"
              items={specialistsDropdownItems}
              onSelect={selectSpecialistsSection}
              isActive={activeTab === 'specialists'}
            />

            {/* Secondary "other" tabs — beside the key tabs, muted, access-gated,
                separated by a faint divider. On narrow screens they collapse
                into a single More ▾ menu so nothing falls off-screen. */}
            {(canSeeTab('member_overview') || canSeeTab('client_overview') || canSeeTab('growth_credits') || canSeeTab('automation') || canSeeTab('accounting')) && navNarrow && (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px', paddingLeft: '12px', borderLeft: '1px solid var(--vfo-tint)' }}>
                <NavDropdown
                  label="More" muted
                  items={moreDropdownItems}
                  onSelect={selectMoreOption}
                  isActive={['member_overview', 'client_overview', 'growth_credits', 'automation', 'accounting'].includes(activeTab)}
                />
              </div>
            )}
            {(canSeeTab('member_overview') || canSeeTab('client_overview') || canSeeTab('growth_credits') || canSeeTab('automation') || canSeeTab('accounting')) && !navNarrow && (
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px', paddingLeft: '12px', borderLeft: '1px solid var(--vfo-tint)' }}>
                {canSeeTab('member_overview') && (
                  <button onClick={selectMemberOverview} style={{
                    padding: '14px 14px', background: 'transparent', border: 'none',
                    borderBottom: activeTab === 'member_overview' ? '2px solid #125ecc' : '2px solid transparent',
                    color: activeTab === 'member_overview' ? '#125ecc' : '#97a3ba', fontSize: '13px',
                    fontWeight: activeTab === 'member_overview' ? '600' : '500', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap'
                  }}>
                    Member Overview
                  </button>
                )}
                {canSeeTab('client_overview') && (
                  <button onClick={selectClientOverview} style={{
                    padding: '14px 14px', background: 'transparent', border: 'none',
                    borderBottom: activeTab === 'client_overview' ? '2px solid #125ecc' : '2px solid transparent',
                    color: activeTab === 'client_overview' ? '#125ecc' : '#97a3ba', fontSize: '13px',
                    fontWeight: activeTab === 'client_overview' ? '600' : '500', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap'
                  }}>
                    Client Overview
                  </button>
                )}
                {canSeeTab('growth_credits') && (
                  <button onClick={selectGrowthCredits} style={{
                    padding: '14px 14px', background: 'transparent', border: 'none',
                    borderBottom: activeTab === 'growth_credits' ? '2px solid #125ecc' : '2px solid transparent',
                    color: activeTab === 'growth_credits' ? '#125ecc' : '#97a3ba', fontSize: '13px',
                    fontWeight: activeTab === 'growth_credits' ? '600' : '500', cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap'
                  }}>
                    Growth Credits
                  </button>
                )}
                {canSeeTab('automation') && (
                  <NavDropdown
                    label="Automation & Config" muted
                    items={automationDropdownItems}
                    onSelect={selectAutomationSection}
                    isActive={activeTab === 'automation'}
                  />
                )}
                {canSeeTab('accounting') && (
                  <NavDropdown
                    label="Accounting" muted
                    items={accountingDropdownItems}
                    onSelect={selectAccountingSection}
                    isActive={activeTab === 'accounting'}
                  />
                )}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
          {!activeTab && (
            <div style={{ textAlign: 'center', padding: '60px 24px 0' }}>
              <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px', marginBottom: '10px' }}>Welcome back</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', fontSize: '38px', color: 'var(--vfo-heading)', margin: 0 }}>{session.name}</p>
              <div style={{ width: '46px', height: '4px', borderRadius: '99px', background: '#fb895a', margin: '18px auto 0' }} />
              {!loading && (() => {
                // Mirrors MemberKpiPanel: null status counts as Active, and the
                // separate buckets (advisor: VFO Reconciliation (Free); accountant:
                // Team Member) are excluded so these match the KPI Active counts.
                const active = (m) => (m.elite_status || 'Active') === 'Active'
                const cards = [
                  { label: 'Active Advisors', value: allMembers.filter(m => m.member_category !== 'accountant' && m.member_category !== 'strategic_member' && m.member_type !== 'VFO Reconciliation (Free)' && active(m)).length, go: () => selectAdvisorsSection('advisor_search') },
                  { label: 'Active Accountants', value: allMembers.filter(m => m.member_category === 'accountant' && m.member_type !== 'Team Member' && active(m)).length, go: () => selectAccountantsSection('accountant_search') },
                  { label: 'Active Strategic Members', value: allMembers.filter(m => m.member_category === 'strategic_member' && active(m)).length, go: () => selectStrategicSection('strategic_member_search') },
                  { label: 'Active Specialists', value: allExperts.filter(e => (e.status || 'Active') === 'Active').length, go: () => selectSpecialistsSection('specialist_search') },
                ]
                return (
                  <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '40px' }}>
                    {cards.map(c => (
                      <button key={c.label} onClick={c.go} style={{ width: '170px', padding: '20px 14px 16px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                        <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--vfo-heading)', lineHeight: 1 }}>{c.value}</div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.9px', color: 'var(--vfo-muted)', textTransform: 'uppercase', marginTop: '9px' }}>{c.label}</div>
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'specialists' && !loading && (
            // key on section forces a clean remount when switching between the
            // onboarding view and the search/add views — SpecialistsPanel early-
            // returns <SpecialistOnboarding/> before its hooks, so changing section
            // in place would trip React's hooks-count check and the navigation
            // (e.g. the Stage-5 "Open specialist →" link) could silently fail.
            <SpecialistsPanel key={specialistsSection} allExperts={allExperts} ecoMap={ecoMap} onDataChange={loadAllData} section={specialistsSection} />
          )}

          {activeTab === 'member_overview' && !loading && (
            <MemberOverviewPanel allMembers={allMembers} onOpenMember={openMemberProfile} />
          )}

          {activeTab === 'client_overview' && !loading && (
            <ClientOverviewPanel />
          )}

          {activeTab === 'advisors' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap}
              onDataChange={loadAllData} section={advisorsSection} navClickCount={navClickCount}
            />
          )}

          {activeTab === 'accountants' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap}
              onDataChange={loadAllData} section={accountantsSection} navClickCount={navClickCount}
            />
          )}

          {activeTab === 'strategic' && !loading && (
            <MembersPanel
              allMembers={allMembers} allExperts={allExperts}
              allExclusionMap={allExclusionMap} ecoMap={ecoMap}
              onDataChange={loadAllData} section={strategicSection} navClickCount={navClickCount}
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
          {activeTab === 'automation' && !loading && automationSection === 'specialist_revenue_pipeline' && (
            <SpecialistRevenueAutomationPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'growth_credits' && (
            <GrowthCreditsPanel />
          )}
          {activeTab === 'notifications' && !loading && (
            <NotificationsPage />
          )}
          {activeTab === 'growth_credits' && !loading && canSeeTab('growth_credits') && (
            <GrowthCreditsRedemptionsPage />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'email_templates' && (
            <EmailTemplatesPanel />
          )}
          {activeTab === 'automation' && !loading && automationSection === 'notification_editor' && (
            <NotificationEditorPanel />
          )}

          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'payments' && (
            <AllPaymentsTab />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && (accountingSection === 'specialist_revenue' || accountingSection === 'specialist_payment_input') && (
            <SpecialistRevenuePanel allExperts={allExperts} allMembers={allMembers} />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'specialist_recurring' && (
            <SpecialistRecurringPanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'specialist_license' && (
            <SpecialistLicensePanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'specialist_bg' && (
            <SpecialistBgPanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'specialist_reconciliation' && (
            <SpecialistReconciliationPanel allMembers={allMembers} />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'holistic_revenue' && (
            <HolisticRevenuePanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'holistic_reconciliation' && (
            <HolisticReconciliationPanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'tax_revenue' && (
            <TaxRevenuePanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'tax_reconciliation' && (
            <TaxReconciliationPanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'pip_revenue' && (
            <PipRevenuePanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'pip_reconciliation' && (
            <PipReconciliationPanel />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'advisor_onboarding_fees' && (
            <MemberOnboardingPanel kind="advisor" title="Advisor Onboarding" />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'advisor_membership_fees' && (
            <MembershipFeesPanel title="Advisor Membership Fees" category="advisor" allMembers={allMembers} />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'accountant_onboarding_fees' && (
            <MemberOnboardingPanel kind="accountant" title="Accountant Onboarding" />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'accountant_membership_fees' && (
            <MembershipFeesPanel title="Accountant Membership Fees" category="accountant" allMembers={allMembers} />
          )}
          {activeTab === 'accounting' && !loading && session.is_superadmin && accountingSection === 'gc_accounting' && (
            <GrowthCreditsAccountingPanel />
          )}

          {loading && activeTab && <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}><DirectoryListSkeleton /></div>}
          </div>
        </>
      )}
    </div>
  )
}