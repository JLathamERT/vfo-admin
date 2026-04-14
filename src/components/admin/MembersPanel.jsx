import { useState } from 'react'
import { callApi } from '../../lib/api'

const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/'
const ECOSYSTEMS = ['Tax Planning', 'Business Advisory', 'Legal', 'Insurance', 'Wealth Management']

export default function MembersPanel({ allMembers, allExperts, allExclusionMap, onDataChange }) {
  const [activeTab, setActiveTab] = useState('add')
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [addStatusType, setAddStatusType] = useState('success')
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberFeatureTab, setMemberFeatureTab] = useState('specialists')

  function showStatus(type, msg) {
    setAddStatusType(type); setAddStatus(msg)
    setTimeout(() => setAddStatus(''), 4000)
  }

  async function createMember() {
    if (!newName || !newNumber) { showStatus('error', 'Both fields are required.'); return }
    try {
      await callApi('add_member', { name: newName, member_number: newNumber })
      await onDataChange()
      setNewName(''); setNewNumber('')
      showStatus('success', 'Member created! Switch to Edit Member to configure.')
    } catch (err) { showStatus('error', err.message) }
  }

  function selectMember(mn) {
    if (!mn) { setSelectedMember(null); return }
    const member = allMembers.find(m => m.member_number === mn)
    if (member) { setSelectedMember(member); setMemberFeatureTab('specialists') }
  }

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      {/* Sub tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        {[['add', 'Add Member'], ['edit', 'Edit Member']].map(([key, label]) => (
          <button key={key} style={subTabStyle(activeTab === key)} onClick={() => setActiveTab(key)}>{label}</button>
        ))}
      </div>

      {/* Add Member */}
      {activeTab === 'add' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Member Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. John Smith" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Member Number *</label>
              <input value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="e.g. MEM001" style={inputStyle} />
            </div>
          </div>
          <button onClick={createMember} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
            Create Member
          </button>
          {addStatus && <p style={{ color: addStatusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{addStatus}</p>}
        </div>
      )}

      {/* Edit Member */}
      {activeTab === 'edit' && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Select Member</label>
            <select onChange={e => selectMember(e.target.value)} style={{...inputStyle, background: '#0d2a6e'}}>
              <option value="">-- Choose a member --</option>
              {allMembers.map(m => <option key={m.member_number} value={m.member_number}>{m.name} ({m.member_number})</option>)}
            </select>
          </div>

          {selectedMember && (
            <>
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px', overflowX: 'auto' }}>
                {[
                  ['specialists', 'Specialists'],
                  ['showroom', 'Showroom'],
                  ['website', 'Website Plugin'],
                  ['ciq', 'CIQ'],
                  ['growthplan', 'Growth Plan'],
                  ['gc', 'GC Marketplace'],
                  ['vault', 'The Vault'],
                  ['settings', 'Settings'],
                ].map(([key, label]) => (
                  <button key={key} style={subTabStyle(memberFeatureTab === key)} onClick={() => setMemberFeatureTab(key)}>{label}</button>
                ))}
              </div>

              {memberFeatureTab === 'specialists' && (
                <MemberSpecialists member={selectedMember} allExperts={allExperts} allExclusionMap={allExclusionMap} onDataChange={onDataChange} />
              )}
              {memberFeatureTab === 'showroom' && <ComingSoon title="Showroom" />}
              {memberFeatureTab === 'website' && (
                <MemberWebsitePlugin member={selectedMember} onDataChange={onDataChange} />
              )}
              {memberFeatureTab === 'ciq' && <ComingSoon title="CIQ" />}
              {memberFeatureTab === 'growthplan' && <ComingSoon title="Growth Plan" />}
              {memberFeatureTab === 'gc' && (
                <MemberGC member={selectedMember} />
              )}
              {memberFeatureTab === 'vault' && (
                <MemberVault member={selectedMember} />
              )}
              {memberFeatureTab === 'settings' && (
                <MemberSettings member={selectedMember} allMembers={allMembers} onDataChange={onDataChange} />
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function ComingSoon({ title }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#ffffff', marginBottom: '12px' }}>{title}</p>
      <p style={{ fontSize: '14px', color: '#8bacc8' }}>Coming soon.</p>
    </div>
  )
}

function MemberSpecialists({ member, allExperts, allExclusionMap, onDataChange }) {
  const excluded = allExclusionMap[member.member_number] || []
  const [enabled, setEnabled] = useState(() => {
    const set = {}
    allExperts.forEach(e => { set[e.id] = !excluded.includes(e.id) })
    return set
  })
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
      await callApi('save_member', { member_number: member.member_number, exclusions: newExcluded })
      await onDataChange()
      setDirty(false)
      setStatusType('success'); setStatus('Changes saved!')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div>
      <p style={{ color: '#8bacc8', fontSize: '13px', marginBottom: '20px', fontStyle: 'italic' }}>Changes here affect which specialists appear in this member's VFO Showroom and Website Plugin.</p>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>{enabledCount}</div><div style={{ fontSize: '11px', color: '#8bacc8', letterSpacing: '1px' }}>ENABLED</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '32px', fontWeight: '700', color: '#fff' }}>{allExperts.length}</div><div style={{ fontSize: '11px', color: '#8bacc8', letterSpacing: '1px' }}>TOTAL</div></div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search specialists..." style={{ ...inputStyle, marginBottom: '12px' }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button onClick={enableAll} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Enable All</button>
        <button onClick={disableAll} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Disable All</button>
      </div>
      <div style={{ marginBottom: '20px' }}>
        {filtered.map(expert => (
          <div key={expert.id} onClick={() => toggle(expert.id)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
                {expert.headshot_image && <img src={HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div>
                <div style={{ fontSize: '14px', color: '#fff', textAlign: 'left' }}>{expert.name}</div>
                <div style={{ fontSize: '12px', color: '#8bacc8', textAlign: 'left' }}>{expert.short_bio}</div>
              </div>
            </div>
            <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: `2px solid ${enabled[expert.id] ? '#5b9fe6' : 'rgba(255,255,255,0.2)'}`, background: enabled[expert.id] ? '#5b9fe6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {enabled[expert.id] && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'sticky', bottom: 0, background: '#073991', borderTop: '1px solid rgba(255,255,255,0.1)', padding: '16px 0', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {dirty && <span style={{ fontSize: '13px', color: '#d4af37' }}>You have unsaved changes</span>}
        <button onClick={save} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Save Changes</button>
        {status && <span style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px' }}>{status}</span>}
      </div>
    </div>
  )
}

function MemberWebsitePlugin({ member, onDataChange }) {
  const [appearanceTab, setAppearanceTab] = useState('appearance')
  const [settings, setSettings] = useState({
    bg_color: member.bg_color || '#0a1628',
    text_color: member.text_color || '#ffffff',
    accent_color: member.accent_color || '#1a2744',
    card_text_color: member.card_text_color || '#ffffff',
    primary_color: member.primary_color || '#d4af37',
    font: member.font || 'DM Sans',
    last_initial_only: member.last_initial_only || false,
    show_count: member.show_count !== false,
    show_search: member.show_search !== false,
    display_mode: member.display_mode || 'filter',
    website_enabled: member.website_enabled || false,
  })
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  function update(key, val) { setSettings(p => ({ ...p, [key]: val })); setDirty(true) }

  async function save() {
    try {
      await callApi('save_member', { member_number: member.member_number, settings })
      await onDataChange()
      setDirty(false)
      setStatusType('success'); setStatus('Changes saved!')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const embedCode = `<div id="vfo-showroom"></div>\n<script src="https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/vfo-widget/vfo-widget.js?v=23" data-vfo-key="${member.manage_key}"><\/script>`

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }
  const labelStyle = { fontSize: '14px', color: '#fff' }
  const descStyle = { fontSize: '12px', color: '#8bacc8', marginTop: '2px' }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        <button style={subTabStyle(appearanceTab === 'appearance')} onClick={() => setAppearanceTab('appearance')}>Appearance</button>
        <button style={subTabStyle(appearanceTab === 'plugin')} onClick={() => setAppearanceTab('plugin')}>Plugin Settings</button>
      </div>

      {appearanceTab === 'appearance' && (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Colors</div>
            {[
              ['bg_color', 'Background Color', 'Page background'],
              ['text_color', 'Heading Text Color', 'Title, subtitle, search, filters, group headings'],
              ['accent_color', 'Card Background', 'Card and modal background'],
              ['card_text_color', 'Card Text Color', 'Names and bios on cards and modal'],
              ['primary_color', 'Accent Color', 'Active buttons, tags, hover effects, underlines'],
            ].map(([key, label, desc]) => (
              <div key={key} style={rowStyle}>
                <div><div style={labelStyle}>{label}</div><div style={descStyle}>{desc}</div></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" value={settings[key]} onChange={e => update(key, e.target.value)}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: 'none' }} />
                  <input value={settings[key]} onChange={e => update(key, e.target.value)}
                    style={{ width: '90px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Display Options</div>
            {[
              ['last_initial_only', 'Last Name Initial Only', 'Show "Bill L." instead of "Bill Lloyd"'],
              ['show_count', 'Show Specialist Count', 'Display "60 SPECIALISTS" text'],
              ['show_search', 'Show Search Bar', 'Display the search specialists input'],
            ].map(([key, label, desc]) => (
              <div key={key} style={rowStyle}>
                <div><div style={labelStyle}>{label}</div><div style={descStyle}>{desc}</div></div>
                <div onClick={() => update(key, !settings[key])}
                  style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings[key] ? '#2563eb' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: settings[key] ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
            <div style={rowStyle}>
              <div><div style={labelStyle}>Display Mode</div><div style={descStyle}>How specialists are organized</div></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[['filter', 'Filter Buttons'], ['grouped', 'Grouped']].map(([val, label]) => (
                  <button key={val} onClick={() => update('display_mode', val)}
                    style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${settings.display_mode === val ? '#5b9fe6' : 'rgba(255,255,255,0.2)'}`, background: settings.display_mode === val ? 'rgba(91,159,230,0.15)' : 'transparent', color: settings.display_mode === val ? '#5b9fe6' : '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {appearanceTab === 'plugin' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Website Plugin</div>
          <div style={rowStyle}>
            <div><div style={labelStyle}>Enable Website Plugin</div><div style={descStyle}>Allow this member to use their showroom widget</div></div>
            <div onClick={() => update('website_enabled', !settings.website_enabled)}
              style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings.website_enabled ? '#2563eb' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: '2px', left: settings.website_enabled ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Embed Code</div>
            <p style={{ color: '#5a8ab5', fontSize: '14px', marginBottom: '12px' }}>Copy this code and paste it into an HTML widget on the member's website.</p>
            <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', color: '#a0b0c4', fontSize: '13px', overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: '0 0 12px' }}>{embedCode}</pre>
            <button onClick={() => navigator.clipboard.writeText(embedCode)}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid rgba(39,174,96,0.3)', background: 'transparent', color: '#27ae60', fontSize: '13px', cursor: 'pointer' }}>
              Copy Code
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
        {dirty && <span style={{ fontSize: '13px', color: '#d4af37' }}>You have unsaved changes</span>}
        <button onClick={save} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Save Changes</button>
      </div>
      {status && <p style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
    </div>
  )
}

function MemberGC({ member }) {
  const [gcTab, setGcTab] = useState('dashboard')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState([])
  const [redemptions, setRedemptions] = useState([])
  const [addAmount, setAddAmount] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')
  const [loaded, setLoaded] = useState(false)

  useState(() => { loadGC() }, [member.member_number])

  async function loadGC() {
    try {
      const [bal, trans, red] = await Promise.all([
        callApi('gc_load_balance', { member_number: member.member_number }),
        callApi('gc_load_transactions', { member_number: member.member_number }),
        callApi('gc_load_redemptions', { member_number: member.member_number }),
      ])
      setBalance(bal.balance || 0)
      setTransactions(trans.transactions || [])
      setRedemptions(red.redemptions || [])
      setLoaded(true)
    } catch (err) { console.error(err) }
  }

  async function addCredits() {
    if (!addAmount) return
    try {
      await callApi('gc_add_credits', { member_number: member.member_number, amount: parseInt(addAmount), description: addDesc })
      setAddAmount(''); setAddDesc('')
      setStatusType('success'); setStatus('Credits added!')
      setTimeout(() => setStatus(''), 4000)
      loadGC()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        <button style={subTabStyle(gcTab === 'dashboard')} onClick={() => setGcTab('dashboard')}>Dashboard</button>
        <button style={subTabStyle(gcTab === 'details')} onClick={() => setGcTab('details')}>Member Details</button>
      </div>

      {gcTab === 'dashboard' && (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div style={{ ...sectionStyle, flex: 1, textAlign: 'center' }}>
              <p style={{ color: '#8bacc8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Credit Balance</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: '42px', color: '#fff', margin: 0 }}>{balance}</p>
            </div>
            <div style={{ ...sectionStyle, flex: 1 }}>
              <p style={{ color: '#8bacc8', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Quick Stats</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: '#8bacc8', fontSize: '13px' }}>Total Redemptions</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{redemptions.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#8bacc8', fontSize: '13px' }}>Total Spent</span>
                <span style={{ color: '#fff', fontWeight: '600' }}>{redemptions.reduce((s, r) => s + (r.credits || 0), 0)}</span>
              </div>
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add Credits</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Amount</label>
                <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="e.g. 100" min="1" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Description (optional)</label>
                <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="e.g. Monthly allocation" style={inputStyle} />
              </div>
              <button onClick={addCredits} style={{ padding: '12px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add Credits</button>
            </div>
            {status && <p style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
          </div>
        </>
      )}

      {gcTab === 'details' && (
        <>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Transaction History</div>
            {transactions.length === 0 ? <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No transactions yet.</p> : transactions.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#fff' }}>{t.description}</span>
                  <span style={{ fontSize: '11px', color: '#8bacc8', marginLeft: '8px' }}>{new Date(t.created_at).toLocaleDateString()}</span>
                </div>
                <span style={{ color: t.amount > 0 ? '#27ae60' : '#e74c3c', fontWeight: '600', fontSize: '14px' }}>{t.amount > 0 ? '+' : ''}{t.amount}</span>
              </div>
            ))}
          </div>
          <div style={sectionStyle}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Redemption History</div>
            {redemptions.length === 0 ? <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No redemptions yet.</p> : redemptions.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#fff' }}>{r.service_name || 'Service'}</span>
                  <span style={{ fontSize: '11px', color: '#8bacc8', marginLeft: '8px' }}>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
                <span style={{ color: '#e74c3c', fontWeight: '600', fontSize: '14px' }}>-{r.credits}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function MemberVault({ member }) {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [statusType, setStatusType] = useState('success')

  useState(() => { loadFiles() }, [member.member_number])

  async function loadFiles() {
    try {
      const data = await callApi('vault_list', { member_number: member.member_number })
      setFiles(data.files || [])
    } catch (err) { console.error(err) }
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      await callApi('vault_upload', { member_number: member.member_number, filename: file.name, file_base64: base64, content_type: file.type })
      setStatusType('success'); setStatus('File uploaded!')
      setTimeout(() => setStatus(''), 4000)
      loadFiles()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
    finally { setUploading(false) }
  }

  async function deleteFile(filename) {
    try {
      await callApi('vault_delete', { member_number: member.member_number, filename })
      loadFiles()
    } catch (err) { setStatusType('error'); setStatus(err.message) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>The Vault</div>
        <p style={{ color: '#8bacc8', fontSize: '13px', marginBottom: '20px' }}>Upload and manage files for this member.</p>
        <label style={{ display: 'block', border: '2px dashed rgba(255,255,255,0.25)', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', marginBottom: '20px' }}>
          <p style={{ color: '#8bacc8', fontSize: '14px', marginBottom: '8px' }}>Click to browse files</p>
          <p style={{ color: '#5a8ab5', fontSize: '12px' }}>Max 50MB per file</p>
          <input type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
        </label>
        {uploading && <p style={{ color: '#8bacc8', fontSize: '14px' }}>Uploading...</p>}
        {status && <p style={{ color: statusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px' }}>{status}</p>}
      </div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Member Files</div>
        {files.length === 0 ? <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No files uploaded yet.</p> : files.map(f => (
          <div key={f.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize: '14px', color: '#fff' }}>{f.name}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', color: '#8bacc8', fontSize: '12px', textDecoration: 'none' }}>Download</a>
              <button onClick={() => deleteFile(f.name)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '12px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MemberSettings({ member, allMembers, onDataChange }) {
  const [loginLoading, setLoginLoading] = useState(true)
  const [existingLogin, setExistingLogin] = useState(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPasscode, setLoginPasscode] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [loginStatusType, setLoginStatusType] = useState('success')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteStatus, setDeleteStatus] = useState('')

  useState(() => { loadLogin() }, [member.member_number])

  async function loadLogin() {
    setLoginLoading(true)
    try {
      const data = await callApi('load_member_login', { member_number: member.member_number })
      setExistingLogin(data.login || null)
      if (data.login) setLoginEmail(data.login.email)
    } catch (err) { console.error(err) }
    finally { setLoginLoading(false) }
  }

  function showLoginStatus(type, msg) {
    setLoginStatusType(type); setLoginStatus(msg)
    setTimeout(() => setLoginStatus(''), 4000)
  }

  async function createLogin() {
    if (!loginEmail || !loginPasscode) { showLoginStatus('error', 'Email and passcode are required.'); return }
    try {
      await callApi('create_member_login', { member_number: member.member_number, email: loginEmail, passcode: loginPasscode, name: member.name })
      showLoginStatus('success', 'Login created!')
      loadLogin()
    } catch (err) { showLoginStatus('error', err.message) }
  }

  async function updateLogin() {
    try {
      await callApi('update_member_login', { member_number: member.member_number, email: loginEmail, passcode: loginPasscode || undefined })
      showLoginStatus('success', 'Login updated!')
      loadLogin()
    } catch (err) { showLoginStatus('error', err.message) }
  }

  async function deleteMember() {
    try {
      await callApi('delete_member', { member_number: member.member_number })
      await onDataChange()
    } catch (err) { setDeleteStatus(err.message) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Member Login</div>
        {loginLoading && <p style={{ color: '#8bacc8', fontSize: '14px' }}>Loading...</p>}
        {!loginLoading && !existingLogin && (
          <>
            <p style={{ color: '#5a8ab5', fontSize: '14px', marginBottom: '16px' }}>No login set up. Create one to give this member portal access.</p>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email *</label><input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="member@example.com" style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Passcode *</label><input value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} placeholder="Login passcode" style={inputStyle} /></div>
            </div>
            <button onClick={createLogin} style={{ padding: '10px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Create Login</button>
          </>
        )}
        {!loginLoading && existingLogin && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email</label><input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1 }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>New Passcode (leave blank to keep)</label><input value={loginPasscode} onChange={e => setLoginPasscode(e.target.value)} placeholder="New passcode" style={inputStyle} /></div>
            </div>
            <button onClick={updateLogin} style={{ padding: '10px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Update Login</button>
          </>
        )}
        {loginStatus && <p style={{ color: loginStatusType === 'success' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{loginStatus}</p>}
      </div>

      <div style={{ ...sectionStyle, border: '1px solid rgba(231,76,60,0.3)' }}>
        <div style={{ fontSize: '13px', color: '#e74c3c', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Danger Zone</div>
        {!deleteConfirm ? (
          <button onClick={() => setDeleteConfirm(true)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(231,76,60,0.4)', background: 'transparent', color: '#e74c3c', fontSize: '14px', cursor: 'pointer' }}>
            Delete Member
          </button>
        ) : (
          <div>
            <p style={{ color: '#e74c3c', fontSize: '14px', marginBottom: '12px' }}>Are you sure? This will remove all settings and exclusions. This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={deleteMember} style={{ padding: '10px 24px', borderRadius: '8px', background: '#e74c3c', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>Yes, Delete</button>
              <button onClick={() => setDeleteConfirm(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
            </div>
            {deleteStatus && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{deleteStatus}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
