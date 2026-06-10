import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi, getSession } from '../../lib/api'
import { AdvisorOnboardingListSkeleton, AdvisorOnboardingDetailSkeleton } from '../shared/Skeleton'

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
  const [showCompleted, setShowCompleted] = useState(false)
  const [showStopped, setShowStopped] = useState(false)
  const [searchParams] = useSearchParams()
  const session = getSession()

  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  useEffect(() => { loadList() }, [])

  // Deep-link from a notification: /admin?...&onboarding=<id> opens that record.
  useEffect(() => {
    const openId = searchParams.get('onboarding')
    if (openId) { setSelectedId(parseInt(openId, 10)); setView('detail') }
  }, [searchParams])

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
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '22px', color: '#16264a' }}>Advisor Onboarding</div>
        <button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ New Onboarding</button>
      </div>

      {showNew && (
        <div style={{ ...sectionStyle, marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Start New Advisor Onboarding</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>First Name *</label>
              <input value={newFirst} onChange={e => setNewFirst(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Last Name *</label>
              <input value={newLast} onChange={e => setNewLast(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: '#4e6087', display: 'block', marginBottom: '6px' }}>Email *</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} disabled={creating || !newFirst.trim() || !newLast.trim() || !newEmail.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: creating ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{creating ? 'Creating...' : 'Create'}</button>
            <button onClick={() => { setShowNew(false); setNewFirst(''); setNewLast(''); setNewEmail('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <AdvisorOnboardingListSkeleton />
      ) : onboardings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#4e6087' }}>No onboarding records yet. Click "+ New Onboarding" to start.</div>
      ) : (() => {
        const classify = ob => {
          if (ob.member_created_at) return 'completed'
          const finalDec = ob.final_decision || (ob.prelim_meeting_decision === 'Yes' ? 'Yes' : ob.prelim_meeting_decision === 'No' ? 'No' : null)
          if (finalDec === 'No' || ob.prelim_meeting_status === 'No Show') return 'stopped'
          return 'in_progress'
        }
        const inProgress = onboardings.filter(o => classify(o) === 'in_progress')
        const completed = onboardings.filter(o => classify(o) === 'completed')
        const stopped = onboardings.filter(o => classify(o) === 'stopped')

        const renderRow = (ob, variant) => {
          const stage = ob.member_created_at ? 3 : ob.prelim_meeting_decision ? 2 : 1
          const isDone = variant === 'completed'
          const isStopped = variant === 'stopped'
          const stageColor = isStopped ? '#e74c3c' : isDone ? '#1b9254' : '#0095ff'
          const labelText = isDone ? 'Done' : isStopped ? 'Stopped' : STAGE_NAMES[stage]
          const bg = isStopped ? 'rgba(231,76,60,0.15)' : isDone ? 'rgba(27,146,84,0.15)' : 'rgba(0,149,255,0.15)'
          const border = isStopped ? 'rgba(231,76,60,0.3)' : isDone ? 'rgba(27,146,84,0.3)' : 'rgba(0,149,255,0.3)'
          return (
            <div key={ob.id} onClick={() => { setSelectedId(ob.id); setView('detail') }} style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,149,255,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e3eaf5'}>
              <div>
                <div style={{ fontSize: '15px', color: '#16264a', fontWeight: '500', marginBottom: '4px' }}>{ob.first_name} {ob.last_name}{ob.member_number ? <span style={{ fontSize: '12px', color: '#4e6087', fontFamily: 'monospace', marginLeft: '8px' }}>#{ob.member_number}</span> : null}</div>
                <div style={{ fontSize: '12px', color: '#4e6087' }}>{ob.email || 'No email'} · Started {ob.created_at?.split('T')[0]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: bg, color: stageColor, border: `1px solid ${border}` }}>
                  {labelText}
                </span>
              </div>
            </div>
          )
        }

        const SectionHeader = ({ title, count, open, onToggle, color }) => (
          <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginTop: '20px', marginBottom: '10px', borderRadius: '8px', cursor: 'pointer', background: '#f8fafd', border: '1px solid #ebf0f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#4e6087', fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
              <span style={{ fontSize: '11px', color: '#4e6087' }}>({count})</span>
            </div>
          </div>
        )

        return (
          <div>
            {inProgress.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#4e6087', fontSize: '13px' }}>No active onboardings in progress.</div>
            )}
            {inProgress.map(ob => renderRow(ob, 'in_progress'))}

            {completed.length > 0 && (
              <>
                <SectionHeader title="Completed" count={completed.length} open={showCompleted} onToggle={() => setShowCompleted(v => !v)} color="#1b9254" />
                {showCompleted && completed.map(ob => renderRow(ob, 'completed'))}
              </>
            )}

            {stopped.length > 0 && (
              <>
                <SectionHeader title="Stopped" count={stopped.length} open={showStopped} onToggle={() => setShowStopped(v => !v)} color="#e74c3c" />
                {showStopped && stopped.map(ob => renderRow(ob, 'stopped'))}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

function OnboardingDetail({ id, onBack }) {
  const [ob, setOb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pendingDecision, setPendingDecision] = useState(null)
  const [creatingMember, setCreatingMember] = useState(false)
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

  async function createAdvisor() {
    setCreatingMember(true)
    try {
      const res = await callApi('automation_ADVISOR_createmember', { onboarding_id: id })
      if (res?.error) { alert('Error: ' + res.error); return }
      await loadDetail()
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setCreatingMember(false) }
  }

  if (loading) return <AdvisorOnboardingDetailSkeleton onBack={onBack} />
  if (!ob) return <div style={{ padding: '40px', color: '#4e6087', textAlign: 'center' }}>Onboarding not found.</div>

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
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e3eaf5' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '28px', color: '#16264a' }}>{ob.first_name} {ob.last_name}</div>
        <div style={{ fontSize: '13px', color: '#4e6087', marginTop: '4px' }}>{ob.email || 'No email'}</div>
      </div>

      <StageBlock stage={1} title="Preliminary Meeting" state={stage1State()} expanded={expanded[1]} onToggle={() => setExpanded(p => ({ ...p, 1: !p[1] }))}>
        <Row label="Preliminary Meeting" done={!!ob.prelim_meeting_status} date={ob.prelim_meeting_status_at}>
          <select value={ob.prelim_meeting_status || ''} onChange={e => savePrelimMeeting(e.target.value)} disabled={saving} style={{ ...selectStyle, color: ob.prelim_meeting_status ? '#1b9254' : '#16264a' }}>
            <option value="">-- Select --</option>
            <option value="Completed">Completed</option>
            <option value="No Show">No Show</option>
          </select>
        </Row>
        <Row label="Preliminary Meeting Decision" done={!!decision} date={ob.prelim_meeting_decision_at}>
          {decision ? (
            <span style={pillStyle(decision === 'Yes' ? '#1b9254' : decision === 'No' ? '#e74c3c' : '#e06717')}>{decision}</span>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => saveDecision('Yes')} disabled={!!pendingDecision} style={pendingBtn('#1b9254', pendingDecision, 'Yes')}>{pendingDecision === 'Yes' ? 'Sending…' : 'Yes'}</button>
              <button onClick={() => saveDecision('Undecided')} disabled={!!pendingDecision} style={pendingBtn('#e06717', pendingDecision, 'Undecided')}>{pendingDecision === 'Undecided' ? 'Sending…' : 'Undecided'}</button>
              <button onClick={() => saveDecision('No')} disabled={!!pendingDecision} style={pendingBtn('#e74c3c', pendingDecision, 'No')}>{pendingDecision === 'No' ? 'Sending…' : 'No'}</button>
            </div>
          )}
        </Row>
      </StageBlock>

      <StageBlock stage={2} title="PC Admin" state={stage2State()} expanded={expanded[2]} onToggle={() => setExpanded(p => ({ ...p, 2: !p[2] }))}>
        {!decision && <div style={{ padding: '12px', color: '#4e6087', fontSize: '13px' }}>Waiting for Stage 1 decision.</div>}

        {decision === 'Yes' && (
          <>
            <AutoRow label="Agreement sent" done={!!ob.agreement_sent_at} date={ob.agreement_sent_at} />
            <AutoRow label="Agreement signed by advisor" done={!!ob.agreement_signed_by_advisor_at} date={ob.agreement_signed_by_advisor_at} tag={[ob.selected_vfo_ft && 'VFO FT', ob.selected_pft && 'PFT', ob.selected_corporate && 'CM']} />
            <AutoRow label="Agreement signed by CEO" done={!!ob.agreement_signed_by_ceo_at} date={ob.agreement_signed_by_ceo_at} />
            <AutoRow label="Payment link sent" done={!!ob.payment_link_sent_at} date={ob.payment_link_sent_at} />
            <AutoRow label="Payment made" done={ob.payment_status === 'succeeded'} date={ob.payment_completed_at} tag={ob.payment_method_type ? ob.payment_method_type.toUpperCase() : null} />
            <AutoRow label="Confirmation email sent" done={!!ob.confirmation_email_sent_at} date={ob.confirmation_email_sent_at} />
            <AutoRow label="Invoice/receipt sent" done={!!ob.invoice_sent_at} date={ob.invoice_sent_at} />
          </>
        )}

        {decision === 'Undecided' && (
          <>
            <AutoRow label="Decision email sent" done={!!ob.decision_email_sent_at} date={ob.decision_email_sent_at} />
            <AutoRow label="Client response received" done={!!ob.final_decision} date={ob.final_decision_at} />
            {undecidedPending && <div style={{ marginLeft: '14px', paddingLeft: '12px', borderLeft: '1px solid #ebf0f8', fontSize: '12px', color: '#697a9c', marginTop: '4px' }}>Awaiting client click on Yes / No button in their email…</div>}
            {finalDec && (
              <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '4px', marginBottom: '4px', borderLeft: '1px solid #ebf0f8' }}>
                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px',
                  background: finalDec === 'Yes' ? 'rgba(27,146,84,0.15)' : 'rgba(231,76,60,0.15)',
                  color: finalDec === 'Yes' ? '#1b9254' : '#e74c3c',
                  border: `1px solid ${finalDec === 'Yes' ? 'rgba(27,146,84,0.3)' : 'rgba(231,76,60,0.3)'}`
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

      <StageBlock stage={3} title="Add New Advisor" state={stage3State()} expanded={expanded[3]} onToggle={() => setExpanded(p => ({ ...p, 3: !p[3] }))} dimmed={stage3Locked}>
        {stage3Locked ? (
          <div style={{ padding: '12px', color: '#4e6087', fontSize: '13px' }}>
            Available once the invoice/receipt has been sent in Stage 2.
          </div>
        ) : ob.member_created_at ? (
          <>
            <AutoRow label="Advisor created" done={true} date={ob.member_created_at} />
            <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '6px', borderLeft: '1px solid #ebf0f8', fontSize: '12px', color: '#4e6087' }}>
              Member number: <span style={{ color: '#16264a', fontFamily: 'monospace' }}>{ob.member_number}</span> &middot; Implementation &middot; New Model &middot; Money Mapping
            </div>
          </>
        ) : (
          <div style={{ padding: '4px 0' }}>
            <button onClick={createAdvisor} disabled={creatingMember} style={{ padding: '10px 24px', borderRadius: '8px', background: creatingMember ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: creatingMember ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {creatingMember ? 'Creating & sending...' : 'Create Advisor & Send Setup Link'}
            </button>
          </div>
        )}
      </StageBlock>
    </div>
  )
}

function StageBlock({ stage, title, state, expanded, onToggle, dimmed, children }) {
  const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
  const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
  const titleColor = state === 'active' ? '#125ecc' : '#16264a'
  return (
    <div style={{ background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden', opacity: dimmed ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? '#c7d4e8' : dotColor}`, flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
          {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>}
          {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>}
          <span style={{ color: '#4e6087', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
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

const dateTextStyle = { fontSize: '11px', color: '#697a9c', flexShrink: 0, display: 'inline-block', width: '32px' }

function Row({ label, done, date, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? '#1b9254' : '#c7d4e8'}` }} />
      <span style={{ fontSize: '13px', color: done ? '#4e6087' : '#16264a', flex: 1 }}>{label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {children}
        <span style={dateTextStyle}>{done && date ? formatDate(date) : ''}</span>
      </span>
    </div>
  )
}

function AutoRow({ label, done, date, tag }) {
  const tags = tag == null ? [] : Array.isArray(tag) ? tag.filter(Boolean) : [tag]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f7f9fc' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : '#c7d4e8'}` }} />
      <span style={{ fontSize: '12px', color: done ? '#1b9254' : '#4e6087', flex: 1 }}>{label}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {done && tags.length > 0 && tags.map((t, i) => (
          <span key={i} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{t}</span>
        ))}
        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: done ? 'rgba(27,146,84,0.15)' : '#f2f5fa', color: done ? '#1b9254' : '#4e6087' }}>{done ? 'Done' : 'Not completed'}</span>
        <span style={dateTextStyle}>{done && date ? formatDate(date) : ''}</span>
      </span>
    </div>
  )
}

const selectStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid #d6e0ee', background: '#ffffff', color: '#16264a', fontSize: '12px', minWidth: '150px', fontFamily: 'Inter, sans-serif' }
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
