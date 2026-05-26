import { useState, useEffect } from 'react'
import { callApi, getSession } from '../../lib/api'

const STAGE_NAMES = ['', 'Preliminary Meeting', 'PC Admin', 'Add New Advisor']

export default function AdvisorOnboarding() {
  const [view, setView] = useState('list')
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const session = getSession()

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }

  useEffect(() => { loadList() }, [])

  async function loadList() {
    setLoading(true)
    try {
      const data = await callApi('load_advisor_onboardings')
      setOnboardings(data.onboardings || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function createNew() {
    if (!newFirst.trim() || !newLast.trim()) return
    setCreating(true)
    try {
      await callApi('create_advisor_onboarding', {
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        email: newEmail.trim() || null,
        created_by: session?.name || 'Admin',
      })
      setNewFirst(''); setNewLast(''); setNewEmail(''); setShowNew(false)
      await loadList()
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  if (view === 'detail' && selectedId) {
    return <OnboardingDetail id={selectedId} onBack={() => { setView('list'); setSelectedId(null); loadList() }} />
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff' }}>Advisor Onboarding</div>
        <button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ New Onboarding</button>
      </div>

      {showNew && (
        <div style={{ ...sectionStyle, marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Start New Advisor Onboarding</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>First Name *</label>
              <input value={newFirst} onChange={e => setNewFirst(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Last Name *</label>
              <input value={newLast} onChange={e => setNewLast(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} disabled={creating || !newFirst.trim() || !newLast.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: creating ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{creating ? 'Creating...' : 'Create'}</button>
            <button onClick={() => { setShowNew(false); setNewFirst(''); setNewLast(''); setNewEmail('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>Loading...</div>
      ) : onboardings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>No onboarding records yet. Click "+ New Onboarding" to start.</div>
      ) : (
        <div>
          {onboardings.map(ob => {
            const stage = ob.member_created_at ? 3 : ob.prelim_meeting_decision ? 2 : 1
            const stageColor = ob.status === 'stopped' ? '#e74c3c' : ob.status === 'completed' ? '#27ae60' : '#5b9fe6'
            return (
              <div key={ob.id} onClick={() => { setSelectedId(ob.id); setView('detail') }} style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '18px', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(91,159,230,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>
                <div>
                  <div style={{ fontSize: '15px', color: '#fff', fontWeight: '500', marginBottom: '4px' }}>{ob.first_name} {ob.last_name}</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8' }}>{ob.email || 'No email'} · Started {ob.created_at?.split('T')[0]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: ob.status === 'stopped' ? 'rgba(231,76,60,0.15)' : ob.status === 'completed' ? 'rgba(39,174,96,0.15)' : 'rgba(91,159,230,0.15)', color: stageColor, border: `1px solid ${ob.status === 'stopped' ? 'rgba(231,76,60,0.3)' : ob.status === 'completed' ? 'rgba(39,174,96,0.3)' : 'rgba(91,159,230,0.3)'}` }}>
                    {ob.status === 'stopped' ? 'Stopped' : ob.status === 'completed' ? 'Completed' : `Stage ${stage} · ${STAGE_NAMES[stage]}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OnboardingDetail({ id, onBack }) {
  const [ob, setOb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingDecision, setPendingDecision] = useState(null)
  const [expanded, setExpanded] = useState({ 1: true, 2: true, 3: true })

  useEffect(() => { loadDetail() }, [id])

  async function loadDetail() {
    setLoading(true)
    try {
      const data = await callApi('load_advisor_onboarding', { onboarding_id: id })
      setOb(data.onboarding || null)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function savePrelimMeeting(status) {
    setSaving(true)
    try {
      const res = await callApi('save_advisor_prelim_meeting', { onboarding_id: id, status: status || null })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function saveDecision(decision) {
    setPendingDecision(decision)
    try {
      const res = await callApi('automation_ADVISOR_decision', { onboarding_id: id, decision })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setPendingDecision(null) }
  }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>
  if (!ob) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Onboarding not found.</div>

  const decision = ob.prelim_meeting_decision
  const finalDec = ob.final_decision || (decision === 'Yes' ? 'Yes' : decision === 'No' ? 'No' : null)
  const yesPath = finalDec === 'Yes'
  const noPath = finalDec === 'No'
  const undecidedPending = decision === 'Undecided' && !ob.final_decision

  // Stage state: done if every "interesting" milestone on the active branch is set.
  function stage1State() {
    if (!ob.prelim_meeting_status) return 'pending'
    if (!ob.prelim_meeting_decision) return 'active'
    return 'done'
  }
  function stage2State() {
    if (!decision) return 'pending'
    if (noPath && ob.decline_email_sent_at) return 'done'
    if (yesPath && ob.invoice_sent_at) return 'done'
    return 'active'
  }
  function stage3State() {
    if (ob.member_created_at) return 'done'
    if (yesPath && ob.invoice_sent_at) return 'active'
    return 'pending'
  }

  const stage3Locked = !(yesPath && ob.invoice_sent_at)

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#5b9fe6', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: '#fff' }}>{ob.first_name} {ob.last_name}</div>
        <div style={{ fontSize: '13px', color: '#8bacc8', marginTop: '4px' }}>{ob.email || 'No email'}</div>
      </div>

      <StageBlock stage={1} title="Stage 1 — Preliminary Meeting" state={stage1State()} expanded={expanded[1]} onToggle={() => setExpanded(p => ({ ...p, 1: !p[1] }))}>
        <Row label="Preliminary Meeting" done={!!ob.prelim_meeting_status} date={ob.prelim_meeting_status_at}>
          <select value={ob.prelim_meeting_status || ''} onChange={e => savePrelimMeeting(e.target.value)} disabled={saving} style={{ ...selectStyle, color: ob.prelim_meeting_status ? '#27ae60' : '#fff' }}>
            <option value="">-- Select --</option>
            <option value="Completed">Completed</option>
            <option value="No Show">No Show</option>
          </select>
        </Row>
        <Row label="Preliminary Meeting Decision" done={!!decision} date={ob.prelim_meeting_decision_at}>
          {decision ? (
            <span style={pillStyle(decision === 'Yes' ? '#27ae60' : decision === 'No' ? '#e74c3c' : '#f39c12')}>{decision}</span>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => saveDecision('Yes')} disabled={!!pendingDecision} style={pendingBtn('#27ae60', pendingDecision, 'Yes')}>{pendingDecision === 'Yes' ? 'Sending…' : 'Yes'}</button>
              <button onClick={() => saveDecision('Undecided')} disabled={!!pendingDecision} style={pendingBtn('#f39c12', pendingDecision, 'Undecided')}>{pendingDecision === 'Undecided' ? 'Sending…' : 'Undecided'}</button>
              <button onClick={() => saveDecision('No')} disabled={!!pendingDecision} style={pendingBtn('#e74c3c', pendingDecision, 'No')}>{pendingDecision === 'No' ? 'Sending…' : 'No'}</button>
            </div>
          )}
        </Row>
      </StageBlock>

      <StageBlock stage={2} title="Stage 2 — PC Admin" state={stage2State()} expanded={expanded[2]} onToggle={() => setExpanded(p => ({ ...p, 2: !p[2] }))}>
        {!decision && <div style={{ padding: '12px', color: '#8bacc8', fontSize: '13px' }}>Waiting for Stage 1 decision.</div>}

        {decision === 'Yes' && (
          <>
            <AutoRow label="Agreement sent" done={!!ob.agreement_sent_at} date={ob.agreement_sent_at} />
            <AutoRow label="Agreement signed by advisor" done={!!ob.agreement_signed_by_advisor_at} date={ob.agreement_signed_by_advisor_at} />
            <AutoRow label="Agreement signed by CEO" done={!!ob.agreement_signed_by_ceo_at} date={ob.agreement_signed_by_ceo_at} />
            <AutoRow label="Payment link sent" done={!!ob.payment_link_sent_at} date={ob.payment_link_sent_at} />
            <AutoRow label="Payment made" done={ob.payment_status === 'succeeded'} date={ob.payment_completed_at} />
            <AutoRow label="Confirmation email sent" done={!!ob.confirmation_email_sent_at} date={ob.confirmation_email_sent_at} />
            <AutoRow label="Invoice/receipt sent" done={!!ob.invoice_sent_at} date={ob.invoice_sent_at} />
          </>
        )}

        {decision === 'Undecided' && (
          <>
            <AutoRow label="Decision email sent" done={!!ob.decision_email_sent_at} date={ob.decision_email_sent_at} />
            <AutoRow label="Client response received" done={!!ob.final_decision} date={ob.final_decision_at} />
            {undecidedPending && <div style={{ marginLeft: '14px', paddingLeft: '12px', borderLeft: '1px solid rgba(255,255,255,0.08)', fontSize: '12px', color: '#5a8ab5', marginTop: '4px' }}>Awaiting client click on Yes / No button in their email…</div>}
            {finalDec && (
              <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '4px', marginBottom: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px',
                  background: finalDec === 'Yes' ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.15)',
                  color: finalDec === 'Yes' ? '#27ae60' : '#e74c3c',
                  border: `1px solid ${finalDec === 'Yes' ? 'rgba(39,174,96,0.3)' : 'rgba(231,76,60,0.3)'}`
                }}>
                  {finalDec === 'Yes' ? 'Yes — proceeding' : 'No — declined'}
                </div>
                {finalDec === 'No' && <AutoRow label="Decline email sent" done={!!ob.decline_email_sent_at} date={ob.decline_email_sent_at} />}
                {finalDec === 'Yes' && (
                  <>
                    <AutoRow label="Agreement sent" done={!!ob.agreement_sent_at} date={ob.agreement_sent_at} />
                    <AutoRow label="Agreement signed by advisor" done={!!ob.agreement_signed_by_advisor_at} date={ob.agreement_signed_by_advisor_at} />
                    <AutoRow label="Agreement signed by CEO" done={!!ob.agreement_signed_by_ceo_at} date={ob.agreement_signed_by_ceo_at} />
                    <AutoRow label="Payment link sent" done={!!ob.payment_link_sent_at} date={ob.payment_link_sent_at} />
                    <AutoRow label="Payment made" done={ob.payment_status === 'succeeded'} date={ob.payment_completed_at} />
                    <AutoRow label="Confirmation email sent" done={!!ob.confirmation_email_sent_at} date={ob.confirmation_email_sent_at} />
                    <AutoRow label="Invoice/receipt sent" done={!!ob.invoice_sent_at} date={ob.invoice_sent_at} />
                  </>
                )}
              </div>
            )}
          </>
        )}

        {decision === 'No' && (
          <AutoRow label="Decline email sent to advisor" done={!!ob.decline_email_sent_at} date={ob.decline_email_sent_at} />
        )}
      </StageBlock>

      <StageBlock stage={3} title="Stage 3 — Add New Advisor" state={stage3State()} expanded={expanded[3]} onToggle={() => setExpanded(p => ({ ...p, 3: !p[3] }))} dimmed={stage3Locked}>
        {stage3Locked ? (
          <div style={{ padding: '12px', color: '#8bacc8', fontSize: '13px' }}>
            Available once the invoice/receipt has been sent in Stage 2.
          </div>
        ) : (
          <div style={{ padding: '8px 0', color: '#8bacc8', fontSize: '13px' }}>
            Stage 3 UI (Revenue Decision + Create Advisor) wires up in Phase 5.
          </div>
        )}
      </StageBlock>
    </div>
  )
}

function StageBlock({ stage, title, state, expanded, onToggle, dimmed, children }) {
  const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
  const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
  const titleColor = state === 'active' ? '#5b9fe6' : '#fff'
  return (
    <div style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden', opacity: dimmed ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor}`, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>}
          {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress</span>}
          {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
          <span style={{ color: '#8bacc8', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>
      {expanded && <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>{children}</div>}
    </div>
  )
}

function formatDate(d) {
  if (!d) return ''
  const iso = d.includes('T') ? d.split('T')[0] : d
  const parts = iso.split('-')
  return `${parts[1]}/${parts[2]}`
}

const dateSpanStyle = { fontSize: '11px', color: '#5a8ab5', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }

function Row({ label, done, date, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
      <span style={{ fontSize: '13px', color: done ? '#8bacc8' : '#fff', flex: 1 }}>{label}</span>
      {children}
      <span style={dateSpanStyle}>{done && date ? formatDate(date) : ''}</span>
    </div>
  )
}

function AutoRow({ label, done, date }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
      <span style={{ fontSize: '12px', color: done ? '#27ae60' : '#8bacc8', flex: 1 }}>{label}</span>
      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: done ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: done ? '#27ae60' : '#8bacc8' }}>{done ? 'Done' : 'Not completed'}</span>
      <span style={dateSpanStyle}>{done && date ? formatDate(date) : ''}</span>
    </div>
  )
}

const selectStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0d2a6e', color: '#fff', fontSize: '12px', minWidth: '150px', fontFamily: 'DM Sans, sans-serif' }
function pillStyle(color) { return { fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${color}22`, color, border: `1px solid ${color}44` } }
function branchBtn(color) { return { padding: '4px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${color}66`, background: `${color}22`, color } }
function pendingBtn(color, pendingValue, myValue) {
  const base = branchBtn(color)
  if (!pendingValue) return base
  if (pendingValue === myValue) {
    // The clicked button — show as "in-flight" with stronger color + wait cursor
    return { ...base, background: `${color}44`, fontWeight: '600' }
  }
  // The other buttons — dim them
  return { ...base, opacity: 0.3, cursor: 'not-allowed' }
}
