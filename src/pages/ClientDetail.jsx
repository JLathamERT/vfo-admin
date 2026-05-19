import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getSession, callApi } from '../lib/api'
import ClientTrackViewV2 from '../components/admin/map1/ClientTrackViewV2'
import RegularPrioritiesTab from '../components/admin/regular/RegularPrioritiesTab'
import PFTEngagementTrack from '../components/admin/pft/PFTEngagementTrack'
import TaxPrioritiesTab from '../components/admin/tax/TaxPrioritiesTab'
import AddGeneralNote from '../components/shared/AddGeneralNote'
import { PhaseNotesButton, PhaseNotesPanel } from '../components/shared/PhaseNotes'

const TEAM_MEMBERS = ['Sarah Freitas', 'Rachael', 'Bridger Silvester', 'Tracy Miller', 'Evan Anderson']
const statusColors = { Completed: '#27ae60', Confirmed: '#27ae60', Yes: '#27ae60', 'In Progress': '#f39c12', Scheduled: '#5b9fe6', No: '#e74c3c', 'N/A': '#8bacc8', Pending: '#f39c12' }

function ClientTabDropdown({ label, isActive, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  function handleMouseEnter() { clearTimeout(closeTimer.current); setOpen(true) }
  function handleMouseLeave() { closeTimer.current = setTimeout(() => setOpen(false), 200) }
  return (
    <div style={{ position: 'relative' }} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button style={{ padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: isActive ? '2px solid #5b9fe6' : '2px solid transparent', color: isActive ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: isActive ? '600' : '400', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {label}<span style={{ fontSize: '9px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#0d2a6e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', minWidth: '160px', zIndex: 200, padding: '4px 0', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {options.map(opt => (
            <button key={opt.key} onClick={() => { onSelect(opt.key); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'transparent', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  console.log('session on client detail:', session)
  const [activeTab, setActiveTab] = useState(new URLSearchParams(window.location.search).get('tab') || 'home')
  const [client, setClient] = useState(null)
  const [program, setProgram] = useState(null)
  const [contacts, setContacts] = useState([])
  const [specialists, setSpecialists] = useState([])
  const [loading, setLoading] = useState(true)
  const [clientNotes, setClientNotes] = useState([])

  // Back URL — prefer state passed via navigate, fallback to admin
  const isMember = location.pathname.startsWith('/member')
  const backUrl = location.state?.from || (isMember ? '/member' : '/admin')

  useEffect(() => {
    if (!session) { navigate('/admin/login'); return }
    loadData()
  }, [clientId])

  async function loadData() {
    setLoading(true)
    try {
      const passedEnrollmentId = location.state?.enrollment_id || null
      const [data, expertsData] = await Promise.all([
        callApi('msm_load_client_home', { client_id: parseInt(clientId), enrollment_id: passedEnrollmentId }),
        callApi('load_data'),
      ])
      setClient(data.client)
      setProgram(data.program)
      setContacts(data.contacts || [])
      setSpecialists(expertsData.experts || [])
      if (!isMember) {
        const notesData = await callApi('load_client_notes', { client_id: parseInt(clientId) })
        setClientNotes(notesData.notes || [])
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function reloadContacts() {
    try {
      const data = await callApi('msm_load_client_home', { client_id: parseInt(clientId) })
      setContacts(data.contacts || [])
    } catch (err) { console.error(err) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const tabStyle = (active) => ({ padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent', color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' })
  const statusColors2 = { active: '#27ae60', pending: '#f39c12', lost: '#e74c3c' }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#073991', color: '#fff', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#8bacc8' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#073991', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ background: '#0a2260', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100 }}>
        <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', cursor: 'pointer' }} onClick={() => navigate(isMember ? '/member' : '/admin')}>VFO Portal</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#5b9fe6', fontSize: '14px' }}>{session?.name || ''}</span>
          <button onClick={() => { sessionStorage.clear(); navigate(isMember ? '/member/login' : '/admin/login') }} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#5b9fe6', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to Clients</button>

        {/* Client header */}
        <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: '#fff' }}>{client?.first_name} {client?.last_name}</div>
            {contacts?.length > 0 && <div style={{ fontSize: '14px', color: '#5a8ab5', fontStyle: 'italic' }}>with {contacts.map(c => `${c.first_name} ${c.last_name}`).join(', ')}</div>}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#8bacc8', fontFamily: 'monospace' }}>{client?.client_ref}</span>
            {program && <span style={{ fontSize: '13px', color: '#5b9fe6' }}>{program.name}</span>}
            {client?.member_name && <span style={{ fontSize: '13px', color: '#8bacc8' }}>Member: {client.member_name}</span>}
            <span style={{ padding: '2px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: `${statusColors2[client?.status] || '#8bacc8'}22`, color: statusColors2[client?.status] || '#8bacc8', border: `1px solid ${statusColors2[client?.status] || '#8bacc8'}44` }}>{client?.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : ''}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
          {isMember
            ? <button style={tabStyle(activeTab === 'home')} onClick={() => setActiveTab('home')}>Profile</button>
            : <ClientTabDropdown label="Profile" isActive={activeTab === 'home' || activeTab === 'details'} options={[{key:'home',label:'Profile'},{key:'details',label:'Edit Profile'}]} onSelect={setActiveTab} />
          }
          {program?.name === 'Partnership Fast Track' ? (
            <button style={tabStyle(activeTab === 'pft')} onClick={() => setActiveTab('pft')}>PFT Engagement Process</button>
          ) : program?.name === 'VFO Tax Planning' ? (
            <button style={tabStyle(activeTab === 'tax')} onClick={() => setActiveTab('tax')}>Tax Priorities</button>
          ) : (
            <>
              <button style={tabStyle(activeTab === 'map1')} onClick={() => setActiveTab('map1')}>MAP 1</button>
              <button style={tabStyle(activeTab === 'regular')} onClick={() => setActiveTab('regular')}>Regular Priorities</button>
              <button style={tabStyle(activeTab === 'tax')} onClick={() => setActiveTab('tax')}>Tax Priorities</button>
            </>
          )}
        </div>

        {activeTab === 'home' && <ClientHome client={client} contacts={contacts} onUpdate={loadData} sectionStyle={sectionStyle} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} program={program} />}
        {activeTab === 'details' && !isMember && <ClientDetails client={client} contacts={contacts} onUpdate={loadData} onReloadContacts={reloadContacts} sectionStyle={sectionStyle} />}
        {activeTab === 'map1' && program && <ClientTrackViewV2 clientId={parseInt(clientId)} programId={program.id} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
        {activeTab === 'pft' && program && <PFTEngagementTrack clientId={parseInt(clientId)} programId={program.id} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
        {activeTab === 'regular' && program && <RegularPrioritiesTab clientId={parseInt(clientId)} programId={program.id} client={client} specialists={specialists} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
        {activeTab === 'tax' && program && <TaxPrioritiesTab clientId={parseInt(clientId)} programId={program.id} programName={program.name} client={client} specialists={specialists} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
      </div>
    </div>
  )
}

function ClientHome({ client, contacts = [], onUpdate, sectionStyle, readOnly = false, notes = [], onNotesChange, program }) {
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const [status, setStatus] = useState(client?.status || 'pending')
  const [saving, setSaving] = useState(false)
  const [assignedPf, setAssignedPf] = useState(client?.assigned_pf || '')
  const [savingPf, setSavingPf] = useState(false)
  const [pfSaved, setPfSaved] = useState(false)

  async function updateNote(noteId) {
    if (!editNoteText.trim()) return
    try {
      const result = await callApi('update_client_note', { note_id: noteId, note_text: editNoteText.trim() })
      onNotesChange(notes.map(n => n.id === noteId ? result.note : n))
      setEditingNoteId(null)
    } catch (err) { console.error(err) }
  }

  async function deleteNote(noteId) {
    try {
      await callApi('delete_client_note', { note_id: noteId })
      onNotesChange(notes.filter(n => n.id !== noteId))
    } catch (err) { console.error(err) }
  }

  async function savePf() {
    setSavingPf(true)
    try {
      await callApi('msm_update_client', { client_id: client.id, status: client.status, first_name: client.first_name, last_name: client.last_name, email: client.email, phone: client.phone, assigned_pf: assignedPf })
      setPfSaved(true)
      setTimeout(() => setPfSaved(false), 3000)
      onUpdate()
    } catch (err) { console.error(err) }
    finally { setSavingPf(false) }
  }
  const statusColors = { active: '#27ae60', pending: '#f39c12', lost: '#e74c3c' }

  async function updateStatus(newStatus) {
    setStatus(newStatus)
    setSaving(true)
    try {
      await callApi('msm_update_client', { client_id: client.id, status: newStatus, first_name: client.first_name, last_name: client.last_name, email: client.email, phone: client.phone })
      onUpdate()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Client Status</div>
        {readOnly
          ? <span style={{ padding: '4px 14px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', background: `${statusColors[status]}22`, color: statusColors[status], border: `1px solid ${statusColors[status]}44` }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          : <div style={{ display: 'flex', gap: '8px' }}>
              {[['active','Active'], ['pending','Pending'], ['lost','Lost']].map(([val, label]) => (
                <button key={val} onClick={() => updateStatus(val)} disabled={saving}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: `1px solid ${status === val ? statusColors[val] : 'rgba(255,255,255,0.2)'}`, background: status === val ? `${statusColors[val]}22` : 'transparent', color: status === val ? statusColors[val] : '#8bacc8', fontSize: '13px', cursor: 'pointer', fontWeight: status === val ? '600' : '400' }}>
                  {label}
                </button>
              ))}
            </div>
        }
      </div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Assigned PF</div>
        {readOnly
          ? <div style={{ fontSize: '14px', color: '#fff' }}>{client?.assigned_pf || '—'}</div>
          : <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select value={assignedPf} onChange={e => setAssignedPf(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: '#0d2a6e', color: '#fff', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', minWidth: '200px' }}>
                <option value="">-- Select --</option>
                <option value="Evan Anderson">Evan Anderson</option>
                <option value="Bridger Silvester">Bridger Silvester</option>
              </select>
              <button onClick={savePf} disabled={savingPf} style={{ padding: '8px 20px', borderRadius: '8px', background: savingPf ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: savingPf ? 'not-allowed' : 'pointer' }}>{savingPf ? 'Saving...' : 'Save'}</button>
              {pfSaved && <span style={{ color: '#27ae60', fontSize: '14px', fontWeight: '600' }}>✓ Saved!</span>}
            </div>
        }
      </div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Contact Info</div>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: '11px', color: '#8bacc8', marginBottom: '4px' }}>EMAIL</div><div style={{ fontSize: '14px', color: '#fff' }}>{client?.email || '—'}</div></div>
          <div><div style={{ fontSize: '11px', color: '#8bacc8', marginBottom: '4px' }}>PHONE</div><div style={{ fontSize: '14px', color: '#fff' }}>{client?.phone || '—'}</div></div>
        </div>
        {contacts?.length > 0 && <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '11px', color: '#8bacc8', marginBottom: '8px' }}>ADDITIONAL CONTACTS</div>
          {contacts.map(c => (
            <div key={c.id} style={{ fontSize: '14px', color: '#fff', marginBottom: '4px' }}>{c.first_name} {c.last_name}{c.email ? <span style={{ color: '#8bacc8', fontSize: '12px' }}> · {c.email}</span> : ''}</div>
          ))}
        </div>}
      </div>
      {!readOnly && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px' }}>All Notes ({notes.length})</div>
            <AddGeneralNote clientId={client.id} notes={notes} onNotesChange={onNotesChange} programName={program?.name || null} />
          </div>
          {notes.map(note => (
            <div key={note.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {editingNoteId === note.id ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} rows={2} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => updateNote(note.id)} style={{ padding: '4px 10px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingNoteId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: '#fff', lineHeight: '1.5', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{note.note_text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{note.created_by}</span>
                    <span style={{ fontSize: '11px', color: '#5a8ab5' }}>·</span>
                    <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{note.created_at?.split('T')[0]}</span>
                    {note.program_name && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.12)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.2)' }}>{note.program_name}</span>}
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.2)' }}>{note.tab_name}</span>
                    {note.phase_name !== 'General' && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>{note.phase_name}</span>}
                    <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.note_text) }} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#5b9fe6', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => deleteNote(note.id)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#e74c3c', fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientDetails({ client, contacts, onUpdate, onReloadContacts, sectionStyle }) {
  const [firstName, setFirstName] = useState(client?.first_name || '')
  const [lastName, setLastName] = useState(client?.last_name || '')
  const [email, setEmail] = useState(client?.email || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [contactStatus, setContactStatus] = useState('')
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactFirst, setContactFirst] = useState('')
  const [contactLast, setContactLast] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }

  async function save() {
    setSaving(true)
    try {
      await callApi('msm_update_client', { client_id: client.id, status: client.status, first_name: firstName, last_name: lastName, email, phone })
      setStatus('saved')
      setTimeout(() => setStatus(''), 4000)
    } catch (err) { setStatus('error') }
    finally { setSaving(false) }
  }

  async function addContact() {
    if (!contactFirst || !contactLast) return
    try {
      await callApi('msm_add_client_contact', { client_id: client.id, first_name: contactFirst, last_name: contactLast, email: contactEmail })
      setContactFirst(''); setContactLast(''); setContactEmail(''); setShowAddContact(false)
      setContactStatus('saved')
      setTimeout(() => setContactStatus(''), 4000)
      onReloadContacts()
    } catch (err) { console.error(err) }
  }

  async function deleteContact(contactId) {
    try { await callApi('msm_delete_client_contact', { contact_id: contactId }); onReloadContacts() }
    catch (err) { console.error(err) }
  }

  return (
    <div>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Primary Contact</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: saving ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          {status === 'saved' && <span style={{ color: '#27ae60', fontSize: '14px', fontWeight: '600' }}>✓ Changes saved</span>}
          {status === 'error' && <span style={{ color: '#e74c3c', fontSize: '14px' }}>Something went wrong</span>}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px' }}>Additional Contacts</div>
          <button onClick={() => setShowAddContact(!showAddContact)} style={{ padding: '6px 14px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>+ Add</button>
        </div>

        {showAddContact && (
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>First Name *</label><input value={contactFirst} onChange={e => setContactFirst(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Last Name *</label><input value={contactLast} onChange={e => setContactLast(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email</label><input value={contactEmail} onChange={e => setContactEmail(e.target.value)} type="email" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addContact} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setShowAddContact(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {contactStatus === 'saved' && <div style={{ color: '#27ae60', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>✓ Contact added</div>}
        {contacts.length === 0 && !showAddContact && <p style={{ color: '#5a8ab5', fontSize: '14px' }}>No additional contacts yet.</p>}
        {contacts.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#fff' }}>{c.first_name} {c.last_name}</div>
              {c.email && <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>{c.email}</div>}
            </div>
            <button onClick={() => deleteContact(c.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '11px', cursor: 'pointer' }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

