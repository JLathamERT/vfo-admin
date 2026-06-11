import { useState, useEffect, useRef } from 'react'
import { callApi, getSession } from '../../lib/api'
import MemberWebsitePlugin from '../shared/MemberWebsitePlugin'
import MemberVault from '../shared/MemberVault'
import MemberCIQ from '../shared/MemberCIQ'
import MSMTracking from './MSMTracking'
import AdvisorOnboarding from './AdvisorOnboarding'
import AccountantOnboarding from './AccountantOnboarding'
import { MemberProfileDetailsSkeleton, Skeleton } from '../shared/Skeleton'
import { TrackHero, ListHeader } from '../shared/TrackKit'

const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/'
import vfoCertifiedSeal from '../../assets/vfo-certified-emblem.png'
import vfoAccreditedSeal from '../../assets/vfo-accredited-emblem.png'

const MEMBER_TYPES = [
  'Implementation', 'Catalyst', 'Catalyst A', 'Free Catalyst',
  'Fusion', 'Fusion A', 'Fusion A - I/M', 'Free Fusion', 'Free Legacy TBM', 'Legacy Fusion',
  'Accelerator', 'Accelerator A', 'Legacy Accelerator',
  'Corporate Member', 'Free Corporate Member', 'Free Corporate Member (Legacy)',
  'Financial Collaborator', 'VFO Reconciliation (Free)'
]

const CORPORATE_TYPES = ['Corporate Member', 'Free Corporate Member', 'Free Corporate Member (Legacy)']

const ACCOUNTANT_TYPES = [
  'Implementation',
  'Advanced (Direct)', 'Advanced (Advisor)',
  'Plus (Direct)', 'Plus (Advisor)',
  'VFO FT (Direct)', 'VFO FT (Advisor)',
  'VFO Associate (Direct)', 'VFO Associate (Advisor)',
  'Team Member',
  'Survey #1', 'Survey #2', 'Survey #3',
  'FAC Historic',
]

export default function MembersPanel({ allMembers, allExperts, allExclusionMap, onDataChange, section, navClickCount }) {
  if (section === 'advisor_onboarding') return <AdvisorOnboarding />
  if (section === 'accountant_onboarding') return <AccountantOnboarding />
  if (section === 'accountant_search' || section === 'add_accountant') {
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <AccountantsPanel allMembers={allMembers} allExperts={allExperts} allExclusionMap={allExclusionMap} onDataChange={onDataChange} initialTab={section === 'add_accountant' ? 'add' : 'search'} section={section} navClickCount={navClickCount} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <AdvisorsPanel allMembers={allMembers} allExperts={allExperts} allExclusionMap={allExclusionMap} onDataChange={onDataChange} initialTab={section === 'add_advisor' ? 'add' : 'search'} section={section} navClickCount={navClickCount} />
    </div>
  )
}

function AccountantsPanel({ allMembers, allExperts, allExclusionMap, onDataChange, initialTab, section, navClickCount }) {
  // Accountants are tagged durably by member_category (set at create time).
  const accountantMembers = allMembers.filter(m => m.member_category === 'accountant')

  return (
    <MemberDirectoryView
      displayMembers={accountantMembers}
      allMembers={allMembers}
      allExperts={allExperts}
      allExclusionMap={allExclusionMap}
      onDataChange={onDataChange}
      addForm={<AddAccountantForm allMembers={allMembers} onDataChange={onDataChange} />}
      selectedKey="adminSelectedAccountant"
      featureTabKey="adminAccountantFeatureTab"
      initialTab={initialTab}
      navClickCount={navClickCount}
      hiddenFields={['revenue_decision']}
      listTitle="Accountants"
    />
  )
}

function AddAccountantForm({ allMembers, onDataChange }) {
  const [memberType, setMemberType] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [eliteStatus, setEliteStatus] = useState('')
  const [advisorModel, setAdvisorModel] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)
  const [customMemberNumber, setCustomMemberNumber] = useState('')

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }

  async function submit() {
    if (!firstName || !lastName || !memberType) { setStatusType('error'); setStatus('First name, last name, and member type are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatus('Email is required.'); return }
    if (!eliteStatus) { setStatusType('error'); setStatus('Please pick a status.'); return }
    if (!advisorModel) { setStatusType('error'); setStatus('Please pick Legacy Model or New Model.'); return }
    setLoading(true)
    try {
      const customNum = customMemberNumber.trim()
      if (customNum) {
        const exists = (allMembers || []).find(m => m.plugin_member_number === customNum)
        if (exists) { setStatusType('error'); setStatus(`Member number ${customNum} already exists.`); setLoading(false); return }
      }
      // Member number: explicit custom value, or omit so the backend auto-generates
      // for the (accountant × advisorModel) bucket — single source of truth.
      const res = await callApi('add_member_full', {
        name: `${firstName} ${lastName}`,
        member_number: customNum || undefined,
        first_name: firstName,
        last_name: lastName,
        member_type: memberType,
        elite_status: eliteStatus,
        email,
        advisor_model: advisorModel,
        member_category: 'accountant',
        connected_member_number: null,
      })
      await onDataChange()
      setFirstName(''); setLastName(''); setEmail(''); setMemberType(''); setCustomMemberNumber(''); setAdvisorModel(''); setEliteStatus('')
      setStatusType('success'); setStatus(`Accountant created with number ${res.member_number}`)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Member Type *</label>
          <select value={memberType} onChange={e => setMemberType(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            {ACCOUNTANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Status *</label>
          <select value={eliteStatus} onChange={e => setEliteStatus(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            {['Active', 'Lost', 'Removed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Advisor Model *</label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['Legacy Model', 'New Model'].map(m => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${advisorModel === m ? 'rgba(0,149,255,0.5)' : '#d6e0ee'}`, background: advisorModel === m ? 'rgba(0,149,255,0.08)' : '#eef2f9', cursor: 'pointer', fontSize: '13px', color: advisorModel === m ? '#16264a' : '#4e6087' }}>
              <input type="radio" name="add_acct_advisor_model" value={m} checked={advisorModel === m} onChange={() => setAdvisorModel(m)} style={{ accentColor: '#0095ff' }} />
              {m}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Member Number <span style={{ fontSize: '11px', color: '#697a9c', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>— leave blank to auto-generate</span></label>
        <input value={customMemberNumber} onChange={e => setCustomMemberNumber(e.target.value)} placeholder="e.g. 59452" style={{ ...inputStyle, maxWidth: '200px' }} />
      </div>
      <button onClick={submit} disabled={loading} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
        {loading ? 'Creating...' : 'Create Accountant'}
      </button>
      {status && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
    </div>
  )
}

function FeatureTabDropdown({ label, isActive, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)

  function handleMouseEnter() { clearTimeout(closeTimer.current); setOpen(true) }
  function handleMouseLeave() { setOpen(false) }

  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={{ padding: '7px 16px', background: isActive ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: isActive ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: isActive ? '#ffffff' : '#4e6087', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}<span style={{ fontSize: '9px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#ffffff', border: '1px solid #e3eaf5', borderRadius: '12px', minWidth: '160px', zIndex: 200, padding: '4px 0', boxShadow: '0 14px 36px rgba(20,45,95,0.16)' }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'transparent', border: 'none', color: '#16264a', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = '#eef2f9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Shared search-list + click-into-profile view used by both AdvisorsPanel
// and AccountantsPanel. Type-specific bits are passed in as props:
//   - displayMembers : the filtered list rendered in the search results
//     (e.g. allMembers for advisors, accountant-filtered for accountants)
//   - allMembers     : the FULL unfiltered list, needed by shared inner
//     components (Connected Member lookup, corporate roster, etc.)
//   - addForm        : the type-specific Add form rendered when activeTab='add'
//   - selectedKey    : sessionStorage key for "which member is selected"
//                      (advisors use 'adminSelectedMember', accountants
//                       use 'adminSelectedAccountant')
//   - featureTabKey  : sessionStorage key for the active feature sub-tab
//   - hiddenFields   : list of profile field strings to suppress in the
//                      profile view (e.g. ['revenue_decision'] for accountants)
function MemberDirectoryView({
  displayMembers,
  allMembers,
  allExperts,
  allExclusionMap,
  onDataChange,
  addForm,
  selectedKey,
  featureTabKey,
  initialTab,
  navClickCount,
  hiddenFields = [],
  listTitle = 'Members',
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'search')
  useEffect(() => { setActiveTab(initialTab || 'search') }, [initialTab])
  const [selectedMember, setSelectedMember] = useState(() => {
    const saved = sessionStorage.getItem(selectedKey)
    if (saved && allMembers.length) return allMembers.find(m => m.plugin_member_number === saved) || null
    return null
  })

  useEffect(() => {
    const saved = sessionStorage.getItem(selectedKey)
    if (!saved) { setSelectedMember(null); setMemberFeatureTab('profile_details') }
  }, [navClickCount])

  // Keep selectedMember in sync when allMembers refreshes (e.g. after saving MSM assignment)
  useEffect(() => {
    if (selectedMember && allMembers.length) {
      const fresh = allMembers.find(m => m.plugin_member_number === selectedMember.plugin_member_number)
      if (fresh && fresh !== selectedMember) setSelectedMember(fresh)
    }
  }, [allMembers])
  const [memberFeatureTab, setMemberFeatureTab] = useState(sessionStorage.getItem(featureTabKey) || 'profile')
  const [memberSearch, setMemberSearch] = useState('')

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  const filteredMembers = memberSearch
    ? displayMembers.filter(m => m.name?.toLowerCase().includes(memberSearch) || m.plugin_member_number?.toLowerCase().includes(memberSearch))
    : displayMembers

  return (
    <div>

      {activeTab === 'add' && addForm}

      {activeTab === 'search' && !selectedMember && (
        <>
          <ListHeader title={listTitle} count={displayMembers.length} />
          <div style={{ marginBottom: '16px' }}>
            <input placeholder="Search by name or member number..." style={inputStyle} onChange={e => setMemberSearch(e.target.value.toLowerCase())} value={memberSearch} />
          </div>
          <div>
            {filteredMembers.map(m => (
              <div key={m.plugin_member_number}
                onClick={() => { setSelectedMember(m); setMemberFeatureTab('profile_details'); sessionStorage.setItem(selectedKey, m.plugin_member_number); sessionStorage.setItem(featureTabKey, 'profile_details') }}
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,149,255,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#e9eef8'}>
                <span style={{ fontSize: '12px', color: '#4e6087', width: '70px', flexShrink: 0, fontFamily: 'monospace' }}>{m.plugin_member_number}</span>
                <span style={{ fontSize: '14px', color: '#16264a', fontWeight: 600, width: '200px', flexShrink: 0 }}>{m.name}</span>
                <span style={{ width: '80px', flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, background: m.elite_status === 'Active' ? 'rgba(27,146,84,0.13)' : m.elite_status === 'Lost' ? 'rgba(231,76,60,0.13)' : '#eef2f9', color: m.elite_status === 'Active' ? '#1b9254' : m.elite_status === 'Lost' ? '#e74c3c' : '#4e6087', border: `1px solid ${m.elite_status === 'Active' ? 'rgba(27,146,84,0.3)' : m.elite_status === 'Lost' ? 'rgba(231,76,60,0.3)' : '#dde5f2'}` }}>{m.elite_status || '—'}</span>
                </span>
                <span style={{ fontSize: '12px', color: '#4e6087', width: '160px', flexShrink: 0 }}>{m.member_type || '—'}</span>
                <span style={{ fontSize: '12px', color: m.advisor_model === 'New Model' ? '#0095ff' : '#4e6087' }}>{m.advisor_model || '—'}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'search' && selectedMember && (
        <>
          <button onClick={() => { setSelectedMember(null); sessionStorage.removeItem(selectedKey); sessionStorage.removeItem(featureTabKey) }} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
          <TrackHero
            eyebrow={listTitle}
            title={selectedMember.name}
            meta={
              <>
                <span style={{ fontFamily: 'monospace' }}>{selectedMember.plugin_member_number}</span>
                {selectedMember.member_type && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', color: '#4e6087', border: '1px solid #dde5f2' }}>{selectedMember.member_type}</span>}
                {selectedMember.elite_status && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${selectedMember.elite_status === 'Active' ? 'rgba(27,146,84,0.15)' : selectedMember.elite_status === 'Lost' ? 'rgba(231,76,60,0.15)' : '#eef2f9'}`, color: selectedMember.elite_status === 'Active' ? '#1b9254' : selectedMember.elite_status === 'Lost' ? '#e74c3c' : '#4e6087', border: `1px solid ${selectedMember.elite_status === 'Active' ? 'rgba(27,146,84,0.3)' : selectedMember.elite_status === 'Lost' ? 'rgba(231,76,60,0.3)' : '#e3eaf5'}` }}>{selectedMember.elite_status}</span>}
                {selectedMember.paused && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(251,137,90,0.15)', color: '#e06717', fontWeight: 600, border: '1px solid rgba(251,137,90,0.3)' }}>Paused</span>}
                {selectedMember.suspended && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', fontWeight: 600, border: '1px solid rgba(231,76,60,0.3)' }}>Suspended</span>}
              </>
            }
          />
          <div style={{ display: 'flex', borderBottom: '1px solid #e3eaf5', marginBottom: '24px', flexWrap: 'wrap', position: 'relative', zIndex: 50 }}>
          <FeatureTabDropdown label="Profile" isActive={['profile_details','profile_edit','profile_history'].includes(memberFeatureTab)} options={[{key:'profile_details',label:'Profile'},{key:'profile_edit',label:'Edit Profile'},{key:'profile_history',label:'Type History'}]} onSelect={setMemberFeatureTab} />
          <FeatureTabDropdown label="MSM" isActive={['msm_meetings','msm_program_holistic','msm_program_partnership','msm_program_tax','msm_program_coaching'].includes(memberFeatureTab)} options={[{key:'msm_meetings',label:'MSM'},{key:'msm_program_holistic',label:'VFO Holistic Planning'},{key:'msm_program_partnership',label:'Partnership Fast Track'},{key:'msm_program_tax',label:'VFO Tax Planning'},{key:'msm_program_coaching',label:'Advanced Coaching'}]} onSelect={k => { setMemberFeatureTab(k); sessionStorage.setItem(featureTabKey, k) }} />
            {[['specialists','Specialists'],['showroom','Showroom'],['website','Website Plugin'],['ciq','CIQ'],['growthplan','Growth Plan'],['gc','GC Marketplace'],['vault','The Vault'],['settings','Settings']].map(([key, label]) => (
            <button key={key} style={{ padding: '7px 16px', background: memberFeatureTab === key ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: memberFeatureTab === key ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: memberFeatureTab === key ? '#ffffff' : '#4e6087', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' }} onClick={() => { setMemberFeatureTab(key); sessionStorage.setItem(featureTabKey, key) }}>{label}</button>
          ))}
          </div>
          {['profile_details','profile_edit','profile_history'].includes(memberFeatureTab) && <MemberProfile member={selectedMember} allMembers={allMembers} onDataChange={onDataChange} activeSection={memberFeatureTab} hiddenFields={hiddenFields} />}
          {['msm_meetings','msm_program_holistic','msm_program_partnership','msm_program_tax','msm_program_coaching'].includes(memberFeatureTab) && <MSMTracking member={selectedMember} activeSection={memberFeatureTab} onDataChange={onDataChange} />}          {memberFeatureTab === 'specialists' && <MemberSpecialists member={selectedMember} allExperts={allExperts} allExclusionMap={allExclusionMap} onDataChange={onDataChange} />}
          {memberFeatureTab === 'showroom' && <ComingSoon title="Showroom" />}
          {memberFeatureTab === 'website' && <MemberWebsitePlugin member={selectedMember} onDataChange={onDataChange} readOnly={false} isAdmin={true} />}
          {memberFeatureTab === 'ciq' && <MemberCIQ memberNumber={selectedMember.plugin_member_number} memberName={selectedMember.name} ciqEnabled={selectedMember.ciq_enabled} ciqVfosManaged={selectedMember.ciq_vfos_managed} isAdmin={true} />}
          {memberFeatureTab === 'growthplan' && <ComingSoon title="Growth Plan" />}
          {memberFeatureTab === 'gc' && <MemberGC member={selectedMember} />}
          {memberFeatureTab === 'vault' && <MemberVault memberNumber={selectedMember.plugin_member_number} />}
          {memberFeatureTab === 'settings' && <MemberSettings member={selectedMember} onDataChange={onDataChange} />}
        </>
      )}
    </div>
  )
}

function AdvisorsPanel({ allMembers, allExperts, allExclusionMap, onDataChange, initialTab, section, navClickCount }) {
  return (
    <MemberDirectoryView
      displayMembers={allMembers.filter(m => m.member_category !== 'accountant')}
      allMembers={allMembers}
      allExperts={allExperts}
      allExclusionMap={allExclusionMap}
      onDataChange={onDataChange}
      addForm={<AddAdvisorForm allMembers={allMembers} onDataChange={onDataChange} />}
      selectedKey="adminSelectedMember"
      featureTabKey="adminMemberFeatureTab"
      initialTab={initialTab}
      navClickCount={navClickCount}
      hiddenFields={[]}
      listTitle="Members"
    />
  )
}

function AddAdvisorForm({ allMembers, onDataChange }) {
  const [memberType, setMemberType] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [eliteStatus, setEliteStatus] = useState('')
  const [revenueDecision, setRevenueDecision] = useState('')
  const [advisorModel, setAdvisorModel] = useState('')
  const [connectedSearch, setConnectedSearch] = useState('')
  const [connectedMember, setConnectedMember] = useState(null)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loading, setLoading] = useState(false)
  const [customMemberNumber, setCustomMemberNumber] = useState('')

  const isCorporate = CORPORATE_TYPES.includes(memberType)
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }

  // Corporate members keep their parent-linked "<parent>-C<n>" numbering and
  // stay uncategorized (member_category=null), so they never enter the integer
  // numbering buckets. Standard advisors are auto-numbered by the backend.
  function corporateMemberNumber() {
    const existing = allMembers.filter(m => m.plugin_member_number?.startsWith(connectedMember.plugin_member_number + '-C'))
    return `${connectedMember.plugin_member_number}-C${existing.length + 1}`
  }

  async function submit() {
    if (!firstName || !lastName || !memberType) { setStatusType('error'); setStatus('First name, last name, and member type are required.'); return }
    if (!email.trim()) { setStatusType('error'); setStatus('Email is required.'); return }
    if (!eliteStatus) { setStatusType('error'); setStatus('Please pick a status.'); return }
    if (!revenueDecision) { setStatusType('error'); setStatus('Please pick a revenue decision.'); return }
    if (!advisorModel) { setStatusType('error'); setStatus('Please pick Legacy Model or New Model.'); return }
    if (isCorporate && !connectedMember) { setStatusType('error'); setStatus('Corporate members require a connected member.'); return }
    setLoading(true)
    try {
      if (customMemberNumber.trim()) {
        const exists = allMembers.find(m => m.plugin_member_number === customMemberNumber.trim())
        if (exists) { setStatusType('error'); setStatus(`Member number ${customMemberNumber.trim()} already exists.`); setLoading(false); return }
      }
      // Explicit number for a custom override or corporate -C; otherwise omit
      // so the backend auto-generates for the (advisor × advisorModel) bucket.
      const customNum = customMemberNumber.trim()
      const member_number = customNum || (isCorporate && connectedMember ? corporateMemberNumber() : undefined)
      const res = await callApi('add_member_full', { name: `${firstName} ${lastName}`, member_number, first_name: firstName, last_name: lastName, member_type: memberType, elite_status: eliteStatus, email, revenue_decision: revenueDecision, advisor_model: advisorModel, member_category: isCorporate ? null : 'advisor', connected_member_number: connectedMember?.plugin_member_number || null })
      await onDataChange()
      setFirstName(''); setLastName(''); setEmail(''); setMemberType(''); setConnectedMember(null); setConnectedSearch(''); setCustomMemberNumber(''); setAdvisorModel(''); setEliteStatus(''); setRevenueDecision('')
      setStatusType('success'); setStatus(`Member created with number ${res.member_number}`)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}><label style={labelStyle}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Member Type *</label>
          <select value={memberType} onChange={e => setMemberType(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            {MEMBER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {isCorporate && (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <label style={labelStyle}>Connected Member *</label>
          <input value={connectedSearch} onChange={e => { setConnectedSearch(e.target.value); setConnectedMember(null) }} placeholder="Search by name or number..." style={inputStyle} />
          {connectedSearch && !connectedMember && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#ffffff', border: '1px solid #c7d4e8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
              {allMembers.filter(m => m.name?.toLowerCase().includes(connectedSearch.toLowerCase()) || m.plugin_member_number?.toLowerCase().includes(connectedSearch.toLowerCase())).map(m => (
                <div key={m.plugin_member_number} onClick={() => { setConnectedMember(m); setConnectedSearch(m.name + ' (' + m.plugin_member_number + ')') }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #ebf0f8', color: '#16264a', fontSize: '14px' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#eef2f9'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  {m.name} <span style={{ color: '#4e6087' }}>({m.plugin_member_number})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={labelStyle}>Status *</label>
          <select value={eliteStatus} onChange={e => setEliteStatus(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            {['Active', 'Lost', 'Removed'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label style={labelStyle}>Revenue Decision *</label>
          <select value={revenueDecision} onChange={e => setRevenueDecision(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            <option value="Revenue Share">Revenue Share</option>
            <option value="Money Mapping">Money Mapping</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Advisor Model *</label>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {['Legacy Model', 'New Model'].map(m => (
            <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: `1px solid ${advisorModel === m ? 'rgba(0,149,255,0.5)' : '#d6e0ee'}`, background: advisorModel === m ? 'rgba(0,149,255,0.08)' : '#eef2f9', cursor: 'pointer', fontSize: '13px', color: advisorModel === m ? '#16264a' : '#4e6087' }}>
              <input type="radio" name="advisor_model" value={m} checked={advisorModel === m} onChange={() => setAdvisorModel(m)} style={{ accentColor: '#0095ff' }} />
              {m}
            </label>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Member Number <span style={{ fontSize: '11px', color: '#697a9c', fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>— leave blank to auto-generate</span></label>
        <input value={customMemberNumber} onChange={e => setCustomMemberNumber(e.target.value)} placeholder="e.g. 59452" style={{ ...inputStyle, maxWidth: '200px' }} />
      </div>
      <button onClick={submit} disabled={loading} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
        {loading ? 'Creating...' : 'Create Advisor'}
      </button>
      {status && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
    </div>
  )
}

function MemberProfile({ member, allMembers, onDataChange, activeSection, hiddenFields = [] }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const activeTab = activeSection === 'profile_edit' ? 'edit' : activeSection === 'profile_history' ? 'history' : 'details'
  const [typeHistory, setTypeHistory] = useState([])
  const [corporateMembers, setCorporateMembers] = useState([])
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [connectedSearch, setConnectedSearch] = useState('')
  const [showConnectedSearch, setShowConnectedSearch] = useState(false)
  const [programNotes, setProgramNotes] = useState([])

  useEffect(() => { loadProfile(); loadProgramNotes() }, [member.plugin_member_number])

  async function loadProgramNotes() {
    try {
      const data = await callApi('load_member_program_notes', { member_number: member.plugin_member_number })
      setProgramNotes(data.notes || [])
    } catch (err) { console.error(err) }
  }

  async function loadProfile() {
    setLoading(true)
    try {
      const data = await callApi('member_profile_load', { member_number: member.plugin_member_number })
      setProfile(data.profile || { member_number: member.plugin_member_number, first_name: member.name?.split(' ')[0] || '', last_name: member.name?.split(' ').slice(1).join(' ') || '', elite_status: 'Active', member_type: '', email: '', suspended: false, paused: false, revenue_decision: 'Revenue Share', stripe_account_id: '', connected_member_number: null, connection_type: '', notes: '' })
      setTypeHistory(data.type_history || [])
      setCorporateMembers(allMembers.filter(m => m.plugin_member_number?.startsWith(member.plugin_member_number + '-C') || m.plugin_member_number?.startsWith(member.plugin_member_number + '-FC')))
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function update(key, val) { setProfile(p => ({ ...p, [key]: val })); setDirty(true) }

  async function save() {
    setSaving(true)
    try {
      await callApi('member_profile_save', { profile })
      setDirty(false)
      setStatusType('success'); setStatus('Saved!')
      setTimeout(() => setStatus(''), 4000)
      await loadProfile()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
    finally { setSaving(false) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '11px', color: '#4e6087', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eef2f9' }
  const subTabStyle = (active) => ({ padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : '#4e6087', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' })
  const CONNECTION_TYPES = ['5% - Regular Advisor', '10% - Accredited Introducer', '10% - Accredited Mentor', '20% - Accredited Introducer + Mentor']
  const statusColors = { Active: '#1b9254', Lost: '#e74c3c', Removed: '#4e6087' }

  if (loading) return <MemberProfileDetailsSkeleton />
  if (!profile) return null

  const connectedMemberObj = allMembers.find(m => m.plugin_member_number === profile.connected_member_number)

  return (
    <div>
      

      {activeTab === 'details' && (
        <div>
          {profile.stripe_account_id && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Stripe Account</div><div style={{ fontSize: '14px', color: '#4e6087', fontFamily: 'monospace', marginTop: '4px' }}>{profile.stripe_account_id}</div>
            </div>
          )}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}><div style={labelStyle}>Join Date</div><div style={{ fontSize: '15px', color: '#16264a', marginTop: '4px' }}>{profile.join_date ? profile.join_date.split('T')[0] : '—'}</div></div>
              {(profile.elite_status === 'Lost' || profile.elite_status === 'Removed') && <div style={{ flex: 1, minWidth: '140px' }}><div style={labelStyle}>Leave Date</div><div style={{ fontSize: '15px', color: '#16264a', marginTop: '4px' }}>{profile.leave_date ? profile.leave_date.split('T')[0] : '—'}</div></div>}
              <div style={{ flex: 2, minWidth: '200px' }}><div style={labelStyle}>Email</div><div style={{ fontSize: '15px', color: '#16264a', marginTop: '4px' }}>{profile.email || '—'}</div></div>
              {!hiddenFields.includes('revenue_decision') && (
                <div style={{ flex: 1, minWidth: '160px' }}><div style={labelStyle}>Revenue Decision</div><div style={{ fontSize: '15px', color: '#16264a', marginTop: '4px' }}>{profile.revenue_decision || '—'}</div></div>
              )}
            </div>
            {(profile.vfo_certified_date || profile.vfo_accredited_date) && (
              <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid #eef2f9', marginTop: '16px' }}>
                {profile.vfo_certified_date && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><img src={vfoCertifiedSeal} style={{ width: '36px', height: '36px' }} /><div><div style={{ fontSize: '14px', color: '#b08d26', fontWeight: '600' }}>VFO Certified</div><div style={{ fontSize: '11px', color: '#4e6087', marginTop: '2px' }}>{profile.vfo_certified_date.split('T')[0]}</div></div></div>}
                {profile.vfo_accredited_date && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><img src={vfoAccreditedSeal} style={{ width: '36px', height: '36px' }} /><div><div style={{ fontSize: '14px', color: '#4e6087', fontWeight: '600' }}>VFO Accredited</div><div style={{ fontSize: '11px', color: '#4e6087', marginTop: '2px' }}>{profile.vfo_accredited_date.split('T')[0]}</div></div></div>}
              </div>
            )}
          </div>
          
          {corporateMembers.length > 0 && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Corporate Members</div>
              {corporateMembers.map(cm => <div key={cm.plugin_member_number} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef2f9' }}><span style={{ fontSize: '14px', color: '#16264a' }}>{cm.name}</span><span style={{ fontSize: '13px', color: '#4e6087' }}>{cm.plugin_member_number}</span></div>)}
            </div>
          )}
          {connectedMemberObj && !CORPORATE_TYPES.includes(member.member_type) && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Connected Member</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', color: '#16264a' }}>{connectedMemberObj.name}</span>
                <div style={{ textAlign: 'right' }}><div style={{ fontSize: '13px', color: '#4e6087' }}>{connectedMemberObj.plugin_member_number}</div>{profile.connection_type && <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, marginTop: '2px' }}>{profile.connection_type}</div>}</div>
              </div>
            </div>
          )}
          {profile.notes && <div style={sectionStyle}><div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Notes</div><p style={{ fontSize: '14px', color: '#16264a', lineHeight: '1.6', margin: 0 }}>{profile.notes}</p></div>}
          {programNotes.length > 0 && (
            <div style={sectionStyle}>
              <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>All Program Notes ({programNotes.length})</div>
              {programNotes.map(note => (
                <div key={note.id} style={{ padding: '10px 0', borderBottom: '1px solid #e9eef8' }}>
                  <div style={{ fontSize: '13px', color: '#16264a', lineHeight: '1.5', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{note.note_text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>{note.created_by}</span>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>·</span>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>{note.created_at?.split('T')[0]}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.2)' }}>{note.program_name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'edit' && (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Basic Info</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>First Name</label><input value={profile.first_name || ''} onChange={e => update('first_name', e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Last Name</label><input value={profile.last_name || ''} onChange={e => update('last_name', e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 2, minWidth: '200px' }}><label style={labelStyle}>Email</label><input value={profile.email || ''} onChange={e => update('email', e.target.value)} type="email" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '0', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={labelStyle}>Member Type</label>
                <select value={profile.member_type || ''} onChange={e => update('member_type', e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
                  <option value="">-- Select --</option>
                  {MEMBER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <label style={labelStyle}>Status</label>
                <select value={profile.elite_status || 'Active'} onChange={e => update('elite_status', e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
                  {['Active', 'Lost', 'Removed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Join Date</label><input type="date" value={profile.join_date || ''} onChange={e => update('join_date', e.target.value)} style={inputStyle} /></div>
              {(profile.elite_status === 'Lost' || profile.elite_status === 'Removed') && <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Leave Date</label><input type="date" value={profile.leave_date || ''} onChange={e => update('leave_date', e.target.value)} style={inputStyle} /></div>}
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Settings</div>
            <div style={rowStyle}>
              <div><div style={{ fontSize: '14px', color: '#16264a' }}>Suspended</div><div style={{ fontSize: '12px', color: '#4e6087' }}>Stops all active processing</div></div>
              <div onClick={() => update('suspended', !profile.suspended)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: profile.suspended ? '#e74c3c' : '#d6e0ee', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '2px', left: profile.suspended ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div><div style={{ fontSize: '14px', color: '#16264a' }}>Paused</div><div style={{ fontSize: '12px', color: '#4e6087' }}>Temporarily pauses activity</div></div>
              <div onClick={() => update('paused', !profile.paused)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: profile.paused ? '#e06717' : '#d6e0ee', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: '2px', left: profile.paused ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Revenue & Stripe</div>
            {!hiddenFields.includes('revenue_decision') && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Revenue Decision</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {['Revenue Share', 'Money Mapping'].map(v => (
                    <button key={v} onClick={() => update('revenue_decision', v)} style={{ padding: '8px 18px', borderRadius: '6px', border: `1px solid ${profile.revenue_decision === v ? '#0095ff' : '#c7d4e8'}`, background: profile.revenue_decision === v ? 'rgba(0,149,255,0.15)' : 'transparent', color: profile.revenue_decision === v ? '#0095ff' : '#4e6087', fontSize: '13px', cursor: 'pointer' }}>{v}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label style={labelStyle}>Stripe Account ID</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input value={profile.stripe_account_id || ''} onChange={e => update('stripe_account_id', e.target.value)} placeholder="acct_..." style={inputStyle} />
                <button style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Send Request</button>
              </div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Connected Member</div>
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={labelStyle}>Search Member</label>
              <input
                value={connectedMemberObj && !showConnectedSearch ? `${connectedMemberObj.name} (${connectedMemberObj.plugin_member_number})` : connectedSearch}
                onChange={e => { setConnectedSearch(e.target.value); setShowConnectedSearch(true); if (!e.target.value) update('connected_member_number', null) }}
                placeholder="Search by name or number..."
                style={{ ...inputStyle, marginTop: '6px' }}
                onFocus={() => setShowConnectedSearch(true)}
              />
              {showConnectedSearch && connectedSearch && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#ffffff', border: '1px solid #c7d4e8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                  {allMembers.filter(m => m.plugin_member_number !== member.plugin_member_number && (m.name?.toLowerCase().includes(connectedSearch.toLowerCase()) || m.plugin_member_number?.toLowerCase().includes(connectedSearch.toLowerCase()))).map(m => (
                    <div key={m.plugin_member_number} onClick={() => { update('connected_member_number', m.plugin_member_number); setConnectedSearch(''); setShowConnectedSearch(false) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #ebf0f8', color: '#16264a', fontSize: '14px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#eef2f9'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {m.name} <span style={{ color: '#4e6087' }}>({m.plugin_member_number})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Connection Type</label>
              <select value={profile.connection_type || ''} onChange={e => update('connection_type', e.target.value)} style={{ ...inputStyle, background: '#ffffff', marginTop: '6px' }}>
                <option value="">-- Select --</option>
                {CONNECTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {profile.connected_member_number && (
              <button onClick={() => { update('connected_member_number', null); update('connection_type', ''); setConnectedSearch('') }} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Remove Connection</button>
            )}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>VFO Certification</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>VFO Certified Date</label><input type="date" value={profile.vfo_certified_date || ''} onChange={e => update('vfo_certified_date', e.target.value || null)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '200px' }}><label style={labelStyle}>VFO Accredited Date</label><input type="date" value={profile.vfo_accredited_date || ''} onChange={e => update('vfo_accredited_date', e.target.value || null)} style={inputStyle} /></div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Notes</div>
            <textarea value={profile.notes || ''} onChange={e => update('notes', e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ position: 'sticky', bottom: 0, background: '#f4f7fd', borderTop: '1px solid #e3eaf5', padding: '16px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
            {dirty && <span style={{ fontSize: '13px', color: '#b08d26', fontWeight: 500 }}>You have unsaved changes</span>}
            <button onClick={save} disabled={saving} style={{ padding: '10px 28px', borderRadius: '8px', background: saving ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
            {status && <span style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{status}</span>}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Member Type History</div>
          {typeHistory.length === 0
            ? <p style={{ color: '#697a9c', fontSize: '14px' }}>No type changes recorded yet.</p>
            : typeHistory.map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
                <div style={{ textAlign: 'left' }}><span style={{ color: '#4e6087', fontSize: '13px' }}>{h.old_type}</span><span style={{ color: '#4e6087', margin: '0 8px' }}>→</span><span style={{ color: '#16264a', fontSize: '13px', fontWeight: '600' }}>{h.new_type}</span></div>
                <div style={{ fontSize: '12px', color: '#4e6087' }}>{new Date(h.changed_at).toLocaleDateString()}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

function ComingSoon({ title }) {
  return <div style={{ textAlign: 'center', padding: '60px 20px' }}><p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '22px', color: '#16264a', marginBottom: '12px' }}>{title}</p><p style={{ fontSize: '14px', color: '#4e6087' }}>Coming soon.</p></div>
}

function MemberSpecialists({ member, allExperts, allExclusionMap, onDataChange }) {
  const excluded = allExclusionMap[member.plugin_member_number] || []
  const [enabled, setEnabled] = useState(() => { const set = {}; allExperts.forEach(e => { set[e.id] = !excluded.includes(e.id) }); return set })
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  const enabledCount = Object.values(enabled).filter(Boolean).length
  const filtered = search ? allExperts.filter(e => e.name.toLowerCase().includes(search.toLowerCase())) : allExperts

  function toggle(id) { setEnabled(p => ({ ...p, [id]: !p[id] })); setDirty(true) }
  function enableAll() { const s = {}; allExperts.forEach(e => s[e.id] = true); setEnabled(s); setDirty(true) }
  function disableAll() { const s = {}; allExperts.forEach(e => s[e.id] = false); setEnabled(s); setDirty(true) }

  async function save() {
    const newExcluded = allExperts.filter(e => !enabled[e.id]).map(e => e.id)
    try {
      await callApi('save_member', { member_number: member.plugin_member_number, exclusions: newExcluded })
      await onDataChange()
      setDirty(false)
      setStatusType('success'); setStatus('Changes saved!')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  return (
    <div>
      <p style={{ color: '#4e6087', fontSize: '13px', marginBottom: '20px', fontStyle: 'italic' }}>Changes here affect which specialists appear in this member's VFO Showroom and Website Plugin.</p>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
        <div><div style={{ fontSize: '32px', fontWeight: '700', color: '#16264a' }}>{enabledCount}</div><div style={{ fontSize: '11px', color: '#4e6087', letterSpacing: '1px' }}>ENABLED</div></div>
        <div><div style={{ fontSize: '32px', fontWeight: '700', color: '#16264a' }}>{allExperts.length}</div><div style={{ fontSize: '11px', color: '#4e6087', letterSpacing: '1px' }}>TOTAL</div></div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search specialists..." style={{ ...inputStyle, marginBottom: '12px' }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={enableAll} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer' }}>Enable All</button>
        <button onClick={disableAll} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer' }}>Disable All</button>
      </div>
      <div style={{ marginBottom: '8px' }}>
        {filtered.map(expert => (
          <div key={expert.id} onClick={() => toggle(expert.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: '4px', background: '#eef2f9', border: '1px solid #ebf0f8', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: '#e3eaf5', flexShrink: 0 }}>
                {expert.headshot_image && <img src={HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', color: '#16264a' }}>{expert.name}</div>
                <div style={{ fontSize: '12px', color: '#4e6087' }}>{expert.short_bio}</div>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${enabled[expert.id] ? '#0095ff' : '#c7d4e8'}`, background: enabled[expert.id] ? '#0095ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {enabled[expert.id] && <span style={{ color: '#16264a', fontSize: '12px' }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'sticky', bottom: 0, background: '#f4f7fd', borderTop: '1px solid #e3eaf5', padding: '16px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {dirty && <span style={{ fontSize: '13px', color: '#b08d26', fontWeight: 500 }}>You have unsaved changes</span>}
        <button onClick={save} style={{ padding: '10px 28px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Save Changes</button>
        {status && <span style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px' }}>{status}</span>}
      </div>
    </div>
  )
}

function MemberGC({ member }) {
  const [gcTab, setGcTab] = useState('dashboard')
  const [balance, setBalance] = useState(null)
  const [transactions, setTransactions] = useState(null)
  const [redemptions, setRedemptions] = useState(null)
  const [addAmount, setAddAmount] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  useEffect(() => { loadGC() }, [member.plugin_member_number])

  async function loadGC() {
    try {
      const [bal, trans, red] = await Promise.all([
        callApi('gc_load_balance', { member_number: member.plugin_member_number }),
        callApi('gc_load_transactions', { member_number: member.plugin_member_number }),
        callApi('gc_load_redemptions', { member_number: member.plugin_member_number }),
      ])
      setBalance(bal.balance || 0)
      setTransactions(trans.transactions || [])
      setRedemptions(red.redemptions || [])
    } catch (err) { console.error(err) }
  }

  async function addCredits() {
    if (!addAmount) return
    try {
      await callApi('gc_add_credits', { member_number: member.plugin_member_number, amount: parseInt(addAmount), description: addDesc })
      setAddAmount(''); setAddDesc('')
      setStatusType('success'); setStatus('Credits added!')
      setTimeout(() => setStatus(''), 4000)
      loadGC()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const subTabStyle = (active) => ({ padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : '#4e6087', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' })
  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid #e3eaf5', marginBottom: '24px' }}>
        <button style={subTabStyle(gcTab === 'dashboard')} onClick={() => setGcTab('dashboard')}>Dashboard</button>
        <button style={subTabStyle(gcTab === 'details')} onClick={() => setGcTab('details')}>Member Details</button>
      </div>
      {gcTab === 'dashboard' && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...sectionStyle, flex: 1, textAlign: 'center' }}>
              <p style={{ color: '#4e6087', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Credit Balance</p>
              <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '42px', color: '#16264a', margin: 0, minHeight: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {balance === null ? <Skeleton width={70} height={36} /> : balance}
              </p>
            </div>
            <div style={{ ...sectionStyle, flex: 1 }}>
              <p style={{ color: '#4e6087', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Quick Stats</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eef2f9' }}>
                <span style={{ color: '#4e6087', fontSize: '13px' }}>Total Redemptions</span>
                {redemptions === null ? <Skeleton width={30} height={14} /> : <span style={{ color: '#16264a', fontWeight: '600' }}>{redemptions.length}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#4e6087', fontSize: '13px' }}>Total Spent</span>
                {redemptions === null ? <Skeleton width={30} height={14} /> : <span style={{ color: '#16264a', fontWeight: '600' }}>{redemptions.reduce((s, r) => s + (r.credits || 0), 0)}</span>}
              </div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add Credits</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Amount</label><input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="e.g. 100" min="1" style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Description (optional)</label><input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="e.g. Monthly allocation" style={inputStyle} /></div>
              <button onClick={addCredits} style={{ padding: '12px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add Credits</button>
            </div>
            {status && <p style={{ color: statusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
          </div>
        </>
      )}
      {gcTab === 'details' && (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Transaction History</div>
            {transactions === null
              ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
                  <div style={{ textAlign: 'left' }}><Skeleton width={140} height={14} /><Skeleton width={70} height={11} style={{ marginLeft: '8px' }} /></div>
                  <Skeleton width={40} height={14} />
                </div>
              ))
              : transactions.length === 0
              ? <p style={{ color: '#697a9c', fontSize: '14px' }}>No transactions yet.</p>
              : transactions.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
                <div style={{ textAlign: 'left' }}><span style={{ fontSize: '13px', color: '#16264a' }}>{t.description}</span><span style={{ fontSize: '11px', color: '#4e6087', marginLeft: '8px' }}>{new Date(t.created_at).toLocaleDateString()}</span></div>
                <span style={{ color: t.amount > 0 ? '#1b9254' : '#e74c3c', fontWeight: '600', fontSize: '14px' }}>{t.amount > 0 ? '+' : ''}{t.amount}</span>
              </div>
            ))}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Redemption History</div>
            {redemptions === null
              ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
                  <div style={{ textAlign: 'left' }}><Skeleton width={140} height={14} /><Skeleton width={70} height={11} style={{ marginLeft: '8px' }} /></div>
                  <Skeleton width={40} height={14} />
                </div>
              ))
              : redemptions.length === 0
              ? <p style={{ color: '#697a9c', fontSize: '14px' }}>No redemptions yet.</p>
              : redemptions.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
                <div style={{ textAlign: 'left' }}><span style={{ fontSize: '13px', color: '#16264a' }}>{r.service_name || 'Service'}</span><span style={{ fontSize: '11px', color: '#4e6087', marginLeft: '8px' }}>{new Date(r.created_at).toLocaleDateString()}</span></div>
                <span style={{ color: '#e74c3c', fontWeight: '600', fontSize: '14px' }}>-{r.credits}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}



function MemberSettings({ member, onDataChange }) {
  const [loginLoading, setLoginLoading] = useState(true)
  const [existingLogin, setExistingLogin] = useState(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPasscode, setLoginPasscode] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [loginStatusType, setLoginStatusType] = useState('success')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState('')
  const [ciqEnabled, setCiqEnabled] = useState(member.ciq_enabled || false)
  const [ciqVfosManaged, setCiqVfosManaged] = useState(member.ciq_vfos_managed !== false)
  const [ciqStatus, setCiqStatus] = useState('')

  useEffect(() => { loadLogin() }, [member.plugin_member_number])

  async function loadLogin() {
    setLoginLoading(true)
    try {
      const data = await callApi('load_member_login', { member_number: member.plugin_member_number })
      setExistingLogin(data.login || null)
      if (data.login) setLoginEmail(data.login.email)
    } catch (err) { console.error(err) }
    finally { setLoginLoading(false) }
  }

  function showLoginStatus(type, msg) { setLoginStatusType(type); setLoginStatus(msg); setTimeout(() => setLoginStatus(''), 4000) }

  async function saveCiqSettings(enabled, vfosManaged) {
    try {
      await callApi('member_profile_save', { profile: { member_number: member.plugin_member_number, ciq_enabled: enabled, ciq_vfos_managed: vfosManaged } })
      setCiqEnabled(enabled)
      setCiqVfosManaged(vfosManaged)
      if (onDataChange) await onDataChange()
      setCiqStatus('Saved!'); setTimeout(() => setCiqStatus(''), 3000)
    } catch (err) { setCiqStatus(err.message) }
  }

  async function createLogin() {
    if (!loginEmail || !loginPasscode) { showLoginStatus('error', 'Email and passcode are required.'); return }
    try { await callApi('create_member_login', { member_number: member.plugin_member_number, email: loginEmail, passcode: loginPasscode, name: member.name }); showLoginStatus('success', 'Login created!'); loadLogin() }
    catch (err) { showLoginStatus('error', err.message) }
  }

  async function updateLogin() {
    try { await callApi('update_member_login', { member_number: member.plugin_member_number, email: loginEmail, passcode: loginPasscode || undefined }); showLoginStatus('success', 'Login updated!'); loadLogin() }
    catch (err) { showLoginStatus('error', err.message) }
  }

  async function deleteMember() {
    try { await callApi('delete_member', { member_number: member.plugin_member_number }); await onDataChange() }
    catch (err) { setDeleteStatus(err.message) }
  }

  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Member Login</div>
        {loginLoading && <p style={{ color: '#4e6087', fontSize: '14px' }}>Loading...</p>}
        {!loginLoading && !existingLogin && (
          <>
            <p style={{ color: '#697a9c', fontSize: '14px', marginBottom: '16px' }}>No login set up. Create one to give this member portal access.</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Email *</label><input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="member@example.com" style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Passcode *</label><input value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} placeholder="Login passcode" style={inputStyle} /></div>
            </div>
            <button onClick={createLogin} style={{ padding: '10px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Create Login</button>
          </>
        )}
        {!loginLoading && existingLogin && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Email</label><input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>New Passcode (leave blank to keep)</label><input value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} placeholder="New passcode" style={inputStyle} /></div>
            </div>
            <button onClick={updateLogin} style={{ padding: '10px 24px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Update Login</button>
          </>
        )}
        {loginStatus && <p style={{ color: loginStatusType === 'success' ? '#1b9254' : '#d93025', fontSize: '13px', marginTop: '12px' }}>{loginStatus}</p>}
      </div>
      <div style={{ ...sectionStyle, border: '1px solid rgba(231,76,60,0.3)' }}>
        <div style={{ fontSize: '13px', color: '#e74c3c', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Danger Zone</div>
        {!deleteConfirm
          ? <button onClick={() => setDeleteConfirm(true)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'transparent', color: '#e74c3c', fontWeight: 500, fontSize: '14px', cursor: 'pointer' }}>Delete Member</button>
          : <div>
              <p style={{ color: '#e74c3c', fontWeight: 500, fontSize: '14px', marginBottom: '12px' }}>Are you sure? This will remove all settings and exclusions. This cannot be undone.</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={deleteMember} style={{ padding: '10px 24px', borderRadius: '8px', background: '#e74c3c', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Yes, Delete</button>
                <button onClick={() => setDeleteConfirm(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              </div>
              {deleteStatus && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginTop: '12px' }}>{deleteStatus}</p>}
            </div>
        }
      </div>
    </div>
  )
}