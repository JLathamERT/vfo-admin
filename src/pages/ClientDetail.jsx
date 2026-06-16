import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getSession, callApi, loadCachedData } from '../lib/api'
import ClientTrackViewV2 from '../components/admin/map1/ClientTrackViewV2'
import RegularPrioritiesTab from '../components/admin/regular/RegularPrioritiesTab'
import PipMeetingsTab from '../components/admin/pip/PipMeetingsTab'
import ClientVaultTab from '../components/admin/ClientVaultTab'
import ClientPaymentsTab from '../components/payments/ClientPaymentsTab'
import PFTEngagementTrack from '../components/admin/pft/PFTEngagementTrack'
import TaxPrioritiesTab from '../components/admin/tax/TaxPrioritiesTab'
import AddGeneralNote from '../components/shared/AddGeneralNote'
import { PhaseNotesButton, PhaseNotesPanel } from '../components/shared/PhaseNotes'
import { Skeleton, ProfileTabSkeleton } from '../components/shared/Skeleton'
import { TrackHero } from '../components/shared/TrackKit'
import VfoWordmark from '../components/shared/VfoWordmark'

const TEAM_MEMBERS = ['Sarah Freitas', 'Rachael', 'Bridger Silvester', 'Tracy Miller', 'Evan Anderson']
const statusColors = { Completed: '#1b9254', Confirmed: '#1b9254', Yes: '#1b9254', 'In Progress': '#e06717', Scheduled: '#0095ff', No: '#e74c3c', 'N/A': '#4e6087', Pending: '#e06717' }

function ClientTabDropdown({ label, isActive, options, onSelect }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef(null)
  function handleMouseEnter() { clearTimeout(closeTimer.current); setOpen(true) }
  function handleMouseLeave() { closeTimer.current = setTimeout(() => setOpen(false), 200) }
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

  // PFT accountants are reached from MSMTracking's internal drill-down (not a
  // route), so navigate(-1) loses that state. Restore the member's Accountants
  // list by re-seeding the AdminPortal/MemberDirectoryView sessionStorage keys.
  const isPFTBack = program?.name === 'Partnership Fast Track' && location.state?.backTo === 'pft_accountants'
  const backLabel = isPFTBack ? '← Back to Accountants' : '← Back to Clients'
  function handleBack() {
    if (isPFTBack && location.state?.memberNumber) {
      sessionStorage.setItem('adminActiveTab', 'accountants')
      sessionStorage.setItem('adminAccountantsSection', 'accountant_search')
      sessionStorage.setItem('adminSelectedAccountant', String(location.state.memberNumber))
      sessionStorage.setItem('adminAccountantFeatureTab', 'msm_program_partnership')
      sessionStorage.setItem('pftReturnEnrolledTab', 'clients')
      navigate('/admin')
    } else {
      navigate(-1)
    }
  }

  useEffect(() => {
    if (!session) { navigate('/admin/login?next=' + encodeURIComponent(location.pathname + location.search)); return }
    loadData()
  }, [clientId])

  async function loadData() {
    setLoading(true)
    try {
      const qp = new URLSearchParams(window.location.search)
      const passedEnrollmentId = location.state?.enrollment_id || null
      const passedProgramId = location.state?.program_id || (qp.get('program') ? parseInt(qp.get('program')) : null)
      const [data, expertsData] = await Promise.all([
        callApi('msm_load_client_home', { client_id: parseInt(clientId), enrollment_id: passedEnrollmentId, program_id: passedProgramId }),
        loadCachedData(),
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

  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const tabStyle = (active) => ({ padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : '#4e6087', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' })
  const statusColors2 = { active: '#1b9254', pending: '#e06717', lost: '#e74c3c' }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f7fd', color: '#16264a', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'linear-gradient(90deg, #002973 0%, #125ecc 100%)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '58px', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 12px rgba(0,41,115,0.25)' }}>
        <VfoWordmark size={17} light onClick={() => navigate(isMember ? '/member' : '/admin')} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '14px', fontWeight: 500 }}>{session?.name || ''}</span>
          <button onClick={() => { sessionStorage.clear(); navigate(isMember ? '/member/login' : '/admin/login') }} style={{ padding: '6px 16px', borderRadius: '99px', border: '1px solid rgba(255,255,255,0.32)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Sign Out</button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>{backLabel}</button>

        {/* Client header */}
        {loading ? (
          <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e3eaf5' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <Skeleton width={260} height={32} />
            </div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Skeleton width={90} height={14} />
              <Skeleton width={130} height={14} />
              <Skeleton width={70} height={20} style={{ borderRadius: '4px' }} />
            </div>
          </div>
        ) : (
          <TrackHero
            eyebrow="Clients"
            title={`${client?.first_name} ${client?.last_name}`}
            meta={
              <>
                <span style={{ fontFamily: 'monospace' }}>{client?.client_ref}</span>
                {program && <><span style={{ color: '#c7d4e8' }}>·</span><span style={{ color: '#0095ff', fontWeight: 500 }}>{program.name}</span></>}
                {client?.member_name && <><span style={{ color: '#c7d4e8' }}>·</span><span>Member: {client.member_name}</span></>}
                {contacts?.length > 0 && <><span style={{ color: '#c7d4e8' }}>·</span><span style={{ fontStyle: 'italic' }}>with {contacts.map(c => `${c.first_name} ${c.last_name}`).join(', ')}</span></>}
                {client?.status && <><span style={{ color: '#c7d4e8' }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#16264a' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors2[client?.status] || '#9aa6bf', flexShrink: 0 }} />{client.status.charAt(0).toUpperCase() + client.status.slice(1)}</span></>}
              </>
            }
          />
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e3eaf5', marginBottom: '24px', gap: '8px', paddingBottom: '10px' }}>
          {loading ? (
            <>
              <Skeleton width={70} height={20} />
              <Skeleton width={80} height={20} />
              <Skeleton width={110} height={20} />
            </>
          ) : (
            <>
              {isMember
                ? <button style={tabStyle(activeTab === 'home')} onClick={() => setActiveTab('home')}>Profile</button>
                : <ClientTabDropdown label="Profile" isActive={activeTab === 'home' || activeTab === 'details' || activeTab === 'vault' || activeTab === 'payments'} options={[{key:'home',label:'Profile'},{key:'details',label:'Edit Profile'},{key:'vault',label:'Vault'},{key:'payments',label:'Payments'}]} onSelect={setActiveTab} />
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
                  <button style={tabStyle(activeTab === 'pip')} onClick={() => setActiveTab('pip')}>PIP Meetings</button>
                </>
              )}
            </>
          )}
        </div>

        {loading ? (
          <ProfileTabSkeleton sections={isMember ? 3 : 4} />
        ) : (
          <>
            {activeTab === 'home' && <ClientHome client={client} contacts={contacts} onUpdate={loadData} sectionStyle={sectionStyle} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} program={program} />}
            {activeTab === 'details' && !isMember && <ClientDetails client={client} contacts={contacts} onUpdate={loadData} onReloadContacts={reloadContacts} sectionStyle={sectionStyle} />}
            {activeTab === 'map1' && program && <ClientTrackViewV2 clientId={parseInt(clientId)} programId={program.id} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
            {activeTab === 'pft' && program && <PFTEngagementTrack clientId={parseInt(clientId)} programId={program.id} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
            {activeTab === 'regular' && program && <RegularPrioritiesTab clientId={parseInt(clientId)} programId={program.id} client={client} specialists={specialists} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
            {activeTab === 'tax' && program && <TaxPrioritiesTab clientId={parseInt(clientId)} programId={program.id} programName={program.name} client={client} specialists={specialists} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
            {activeTab === 'pip' && program && <PipMeetingsTab clientId={parseInt(clientId)} programId={program.id} readOnly={isMember} notes={clientNotes} onNotesChange={setClientNotes} />}
            {activeTab === 'vault' && !isMember && <ClientVaultTab clientId={parseInt(clientId)} sectionStyle={sectionStyle} />}
            {activeTab === 'payments' && !isMember && <ClientPaymentsTab clientId={parseInt(clientId)} sectionStyle={sectionStyle} />}
          </>
        )}
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
  const statusColors = { active: '#1b9254', pending: '#e06717', lost: '#e74c3c' }

  async function updateStatus(newStatus) {
    setStatus(newStatus)
    setSaving(true)
    try {
      await callApi('msm_update_client', { client_id: client.id, status: newStatus, first_name: client.first_name, last_name: client.last_name, email: client.email, phone: client.phone })
      onUpdate()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const fieldLabel = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', color: '#7c8aa6', textTransform: 'uppercase' }
  const fieldValue = { fontSize: '15px', color: '#16264a', fontWeight: 600, marginTop: '5px', wordBreak: 'break-word' }
  const initials = (first, last) => `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase()

  return (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

      {/* Main column — contact info + notes */}
      <div style={{ flex: '2 1 400px', minWidth: '300px' }}>
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '18px' }}>Contact Info</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '18px 24px' }}>
          <div><div style={fieldLabel}>Email</div><div style={fieldValue}>{client?.email || '—'}</div></div>
          <div><div style={fieldLabel}>Phone</div><div style={fieldValue}>{client?.phone || '—'}</div></div>
        </div>
        {contacts?.length > 0 && <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid #eef2f9' }}>
          <div style={{ ...fieldLabel, marginBottom: '10px' }}>Additional Contacts</div>
          {contacts.map((c, i) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: i < contacts.length - 1 ? '1px solid #eef2f9' : 'none' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>{initials(c.first_name, c.last_name)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#16264a' }}>{c.first_name} {c.last_name}</div>
                {c.email && <div style={{ fontSize: '12px', color: '#4e6087', marginTop: '1px' }}>{c.email}</div>}
              </div>
            </div>
          ))}
        </div>}
      </div>
      {!readOnly && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px' }}>All Notes</span>
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>{notes.length}</span>
            </div>
            <AddGeneralNote clientId={client.id} notes={notes} onNotesChange={onNotesChange} programName={program?.name || null} />
          </div>
          {notes.map(note => (
            <div key={note.id} style={{ padding: '10px 0', borderBottom: '1px solid #e9eef8' }}>
              {editingNoteId === note.id ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} rows={2} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(0,149,255,0.4)', background: '#f7f9fc', color: '#16264a', fontSize: '13px', fontFamily: 'Inter, sans-serif', resize: 'vertical' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => updateNote(note.id)} style={{ padding: '4px 10px', borderRadius: '6px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                    <button onClick={() => setEditingNoteId(null)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '13px', color: '#16264a', lineHeight: '1.5', marginBottom: '6px', whiteSpace: 'pre-wrap' }}>{note.note_text}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>{note.created_by}</span>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>·</span>
                    <span style={{ fontSize: '11px', color: '#697a9c' }}>{note.created_at?.split('T')[0]}</span>
                    {note.program_name && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.2)' }}>{note.program_name}</span>}
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.2)' }}>{note.tab_name}</span>
                    {note.phase_name !== 'General' && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>{note.phase_name}</span>}
                    <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.note_text) }} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#0095ff', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => deleteNote(note.id)} style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#e74c3c', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Side column — status + assigned PF */}
      <div style={{ flex: '1 1 250px', minWidth: '250px' }}>
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Client Status</div>
          {readOnly
            ? <span style={{ padding: '4px 14px', borderRadius: '6px', fontSize: '14px', fontWeight: '600', background: `${statusColors[status]}22`, color: statusColors[status], border: `1px solid ${statusColors[status]}44` }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
            : <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[['active','Active'], ['pending','Pending'], ['lost','Lost']].map(([val, label]) => (
                  <button key={val} onClick={() => updateStatus(val)} disabled={saving}
                    style={{ padding: '8px 20px', borderRadius: '6px', border: `1px solid ${status === val ? statusColors[val] : '#c7d4e8'}`, background: status === val ? `${statusColors[val]}22` : 'transparent', color: status === val ? statusColors[val] : '#4e6087', fontSize: '13px', cursor: 'pointer', fontWeight: status === val ? '600' : '400' }}>
                    {label}
                  </button>
                ))}
              </div>
          }
        </div>
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Assigned PF</div>
          {readOnly
            ? <div style={{ fontSize: '14px', color: '#16264a' }}>{client?.assigned_pf || '—'}</div>
            : <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select value={assignedPf} onChange={e => setAssignedPf(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#ffffff', color: '#16264a', fontSize: '14px', fontFamily: 'Inter, sans-serif', minWidth: '160px', flex: 1 }}>
                  <option value="">-- Select --</option>
                  <option value="Evan Anderson">Evan Anderson</option>
                  <option value="Bridger Silvester">Bridger Silvester</option>
                  <option value="Ian Welham">Ian Welham</option>
                </select>
                <button onClick={savePf} disabled={savingPf} style={{ padding: '8px 20px', borderRadius: '8px', background: savingPf ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: savingPf ? 'not-allowed' : 'pointer' }}>{savingPf ? 'Saving...' : 'Save'}</button>
                {pfSaved && <span style={{ color: '#1b9254', fontSize: '14px', fontWeight: '600' }}>✓ Saved!</span>}
              </div>
          }
        </div>
      </div>
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

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }

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
        <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Primary Contact</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>First Name</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Last Name</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
          <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: saving ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
          {status === 'saved' && <span style={{ color: '#1b9254', fontSize: '14px', fontWeight: '600' }}>✓ Changes saved</span>}
          {status === 'error' && <span style={{ color: '#e74c3c', fontWeight: 500, fontSize: '14px' }}>Something went wrong</span>}
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px' }}>Additional Contacts</div>
          <button onClick={() => setShowAddContact(!showAddContact)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>+ Add</button>
        </div>

        {showAddContact && (
          <div style={{ padding: '16px', background: '#eef2f9', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>First Name *</label><input value={contactFirst} onChange={e => setContactFirst(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '140px' }}><label style={labelStyle}>Last Name *</label><input value={contactLast} onChange={e => setContactLast(e.target.value)} style={inputStyle} /></div>
              <div style={{ flex: 1, minWidth: '180px' }}><label style={labelStyle}>Email</label><input value={contactEmail} onChange={e => setContactEmail(e.target.value)} type="email" style={inputStyle} /></div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={addContact} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setShowAddContact(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}

        {contactStatus === 'saved' && <div style={{ color: '#1b9254', fontSize: '14px', fontWeight: '600', marginBottom: '12px' }}>✓ Contact added</div>}
        {contacts.length === 0 && !showAddContact && <p style={{ color: '#697a9c', fontSize: '14px' }}>No additional contacts yet.</p>}
        {contacts.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eef2f9' }}>
            <div>
              <div style={{ fontSize: '14px', color: '#16264a' }}>{c.first_name} {c.last_name}</div>
              {c.email && <div style={{ fontSize: '12px', color: '#4e6087', marginTop: '2px' }}>{c.email}</div>}
            </div>
            <button onClick={() => deleteContact(c.id)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}

