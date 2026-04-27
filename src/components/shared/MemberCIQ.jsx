import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

export default function MemberCIQ({ memberNumber }) {
  const [ciqs, setCiqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [showAdditional, setShowAdditional] = useState(false)
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [allClients, setAllClients] = useState([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [activeCiq, setActiveCiq] = useState(null)
  const [answers, setAnswers] = useState({})
  const [saving, setSaving] = useState(false)
  const [contactsMap, setContactsMap] = useState({})

  useEffect(() => { loadCiqs() }, [memberNumber])

  async function loadCiqs() {
    setLoading(true)
    try {
      const [data, contactData] = await Promise.all([
        callApi('ciq_load_list', { member_number: memberNumber }),
        callApi('load_member_contacts', { member_number: memberNumber }),
      ])
      setCiqs(data.ciqs || [])
      setContactsMap(contactData.contacts || {})
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function loadExistingClients() {
    setLoadingClients(true)
    try {
      const data = await callApi('msm_load_member_clients', { member_number: memberNumber })
      setAllClients(data.clients || [])
    } catch (err) { console.error(err) }
    finally { setLoadingClients(false) }
  }

  function selectAddMode(mode) {
    setAddMode(mode)
    setAddStatus('')
    if (mode === 'existing') loadExistingClients()
  }

  async function createForExisting(clientId) {
    try {
      const data = await callApi('ciq_create', { client_id: clientId, member_number: memberNumber })
      setShowAdd(false); setAddMode(null); setAddStatus('')
      loadCiqs()
      openCiq(data.ciq)
    } catch (err) { setAddStatus(err.message) }
  }

  async function createNew() {
    if (!firstName || !lastName || !email) { setAddStatus('First name, last name, and email are required.'); return }
    try {
      const additional_contact = showAdditional && addFirstName && addLastName ? { first_name: addFirstName, last_name: addLastName, email: addEmail } : undefined
      const data = await callApi('ciq_add_client_and_create', { member_number: memberNumber, first_name: firstName, last_name: lastName, email, additional_contact })
      setFirstName(''); setLastName(''); setEmail(''); setShowAdditional(false); setAddFirstName(''); setAddLastName(''); setAddEmail('')
      setShowAdd(false); setAddMode(null); setAddStatus('')
      loadCiqs()
      openCiq(data.ciq)
    } catch (err) { setAddStatus(err.message) }
  }

  async function openCiq(ciq) {
    try {
      const data = await callApi('ciq_load', { ciq_id: ciq.id })
      setActiveCiq(data.ciq)
      setAnswers(data.answers || {})
    } catch (err) { console.error(err) }
  }

  async function saveAnswers() {
    if (!activeCiq) return
    setSaving(true)
    try {
      await callApi('ciq_save', { ciq_id: activeCiq.id, answers })
      setSaving(false)
    } catch (err) { console.error(err); setSaving(false) }
  }

  async function completeCiq() {
    if (!activeCiq) return
    setSaving(true)
    try {
      await callApi('ciq_save', { ciq_id: activeCiq.id, answers })
      await callApi('ciq_complete', { ciq_id: activeCiq.id })
      setActiveCiq(null)
      setAnswers({})
      loadCiqs()
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const statusColors = { draft: '#f39c12', completed: '#27ae60' }

  const filteredClients = clientSearch
    ? allClients.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()) || c.client_ref?.toLowerCase().includes(clientSearch.toLowerCase()))
    : allClients

  // ─── Active CIQ form view ─────────────────────────────
  if (activeCiq) {
    const client = activeCiq.clients
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>{client?.first_name} {client?.last_name}</div>
            <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '4px' }}>{client?.client_ref} · {client?.email}</div>
          </div>
          <button onClick={() => { setActiveCiq(null); setAnswers({}) }} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>← Back to list</button>
        </div>
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
            CIQ Questionnaire {activeCiq.status === 'completed' && <span style={{ color: '#27ae60', marginLeft: '8px' }}>✓ Completed</span>}
          </div>
          <p style={{ color: '#5a8ab5', fontSize: '14px', marginBottom: '20px' }}>Questions will be added here — tell Jake to send them over.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={saveAnswers} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : 'Save Draft'}</button>
          {activeCiq.status !== 'completed' && (
            <button onClick={completeCiq} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: '#27ae60', border: 'none', color: '#fff', fontSize: '14px', cursor: saving ? 'not-allowed' : 'pointer' }}>Mark Complete</button>
          )}
        </div>
      </div>
    )
  }

  // ─── CIQ list view ────────────────────────────────────
  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>

  // Group CIQs by client
  const byClient = {}
  ciqs.forEach(ciq => {
    const key = ciq.client_id
    if (!byClient[key]) byClient[key] = { client: ciq.clients, ciqs: [] }
    byClient[key].ciqs.push(ciq)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#8bacc8' }}>{ciqs.length} questionnaire{ciqs.length !== 1 ? 's' : ''}</div>
        <button onClick={() => { setShowAdd(!showAdd); setAddMode(null); setAddStatus('') }} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>+ Start New CIQ</button>
      </div>

      {/* Add: choose mode */}
      {showAdd && !addMode && (
        <div style={{ ...sectionStyle, marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Start New CIQ</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => selectAddMode('existing')} style={{ flex: 1, padding: '20px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.08)', color: '#5b9fe6', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Existing Client</button>
            <button onClick={() => selectAddMode('new')} style={{ flex: 1, padding: '20px', borderRadius: '8px', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.08)', color: '#27ae60', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>New Client</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button onClick={() => { setShowAdd(false); setAddMode(null) }} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add: existing client */}
      {showAdd && addMode === 'existing' && (
        <div style={{ ...sectionStyle, marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Select Client</div>
          {loadingClients
            ? <div style={{ padding: '20px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>
            : allClients.length === 0
              ? <div style={{ padding: '20px', color: '#8bacc8', textAlign: 'center' }}>No clients found for this member.</div>
              : <>
                  <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search by name or ref..." style={{ ...inputStyle, marginBottom: '12px' }} />
                  {filteredClients.map(c => (
                    <div key={c.id} onClick={() => createForExisting(c.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                      <div>
                        <div style={{ fontSize: '14px', color: '#fff' }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: '12px', color: '#8bacc8' }}>{c.client_ref}{c.email ? ` · ${c.email}` : ''}</div>
                      </div>
                      <span style={{ color: '#5b9fe6', fontSize: '12px' }}>Select →</span>
                    </div>
                  ))}
                </>
          }
          {addStatus && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '8px' }}>{addStatus}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button onClick={() => setAddMode(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Back</button>
          </div>
        </div>
      )}

      {/* Add: new client */}
      {showAdd && addMode === 'new' && (
        <div style={{ ...sectionStyle, marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>New Client</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1, minWidth: '140px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1, minWidth: '180px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
          </div>
          {!showAdditional && (
            <button onClick={() => setShowAdditional(true)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px dashed rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.06)', color: '#5b9fe6', fontSize: '12px', cursor: 'pointer', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif' }}>+ Add additional contact (e.g. spouse)</button>
          )}
          {showAdditional && (
            <div style={{ padding: '16px', background: 'rgba(91,159,230,0.06)', border: '1px solid rgba(91,159,230,0.2)', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: '#5b9fe6', fontStyle: 'italic' }}>Additional contact (not the primary client)</div>
                <button onClick={() => { setShowAdditional(false); setAddFirstName(''); setAddLastName(''); setAddEmail('') }} style={{ background: 'none', border: 'none', color: '#8bacc8', fontSize: '11px', cursor: 'pointer' }}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>First Name</label><input value={addFirstName} onChange={e => setAddFirstName(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1, minWidth: '120px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Last Name</label><input value={addLastName} onChange={e => setAddLastName(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1, minWidth: '160px' }}><label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email</label><input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" style={inputStyle} /></div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Create & Start CIQ</button>
            <button onClick={() => setAddMode(null)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Back</button>
          </div>
          {addStatus && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '8px' }}>{addStatus}</p>}
        </div>
      )}

      {/* CIQ list grouped by client */}
      {ciqs.length === 0 && !showAdd
        ? <div style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>No CIQs yet. Click "Start New CIQ" to begin.</div>
        : Object.values(byClient).map(({ client, ciqs: clientCiqs }) => (
          <div key={client?.id} style={sectionStyle}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>{client?.first_name} {client?.last_name}</div>
            <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: contactsMap[client?.id]?.length > 0 ? '4px' : '16px' }}>{client?.client_ref} · {client?.email}</div>
            {contactsMap[client?.id]?.length > 0 && <div style={{ fontSize: '12px', color: '#5a8ab5', marginBottom: '16px', fontStyle: 'italic' }}>with {contactsMap[client.id].map(c => `${c.first_name} ${c.last_name}`).join(', ')}</div>}
            {clientCiqs.map(ciq => (
              <div key={ciq.id}
                onClick={() => openCiq(ciq)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', marginBottom: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: `${statusColors[ciq.status]}22`, color: statusColors[ciq.status], border: `1px solid ${statusColors[ciq.status]}44` }}>{ciq.status === 'draft' ? 'Draft' : 'Completed'}</span>
                  <span style={{ fontSize: '13px', color: '#8bacc8' }}>Started {ciq.created_at?.split('T')[0]}</span>
                  {ciq.completed_at && <span style={{ fontSize: '13px', color: '#5a8ab5' }}>· Completed {ciq.completed_at.split('T')[0]}</span>}
                </div>
                <span style={{ color: '#5b9fe6', fontSize: '12px' }}>{ciq.status === 'draft' ? 'Continue →' : 'View / Edit →'}</span>
              </div>
            ))}
          </div>
        ))
      }
    </div>
  )
}