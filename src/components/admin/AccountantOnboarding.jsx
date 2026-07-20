import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi, getSession } from '../../lib/api'
import { AccountantOnboardingListSkeleton, AccountantOnboardingDetailSkeleton } from '../shared/Skeleton'
import { TrackHero, PhaseBadge, ListHeader } from '../shared/TrackKit'
import NewModelSaleModal, { SALES_TEAM_NAMES } from './NewModelSaleModal'
import OnboardingExtraMeetingCard from './OnboardingExtraMeetingCard'
import StepEmailsChip from '../shared/StepEmailsChip'
import StepDate from '../shared/StepDate'

const STAGE_NAMES = ['', 'Preliminary Meeting', 'PC Admin', 'Add New Accountant']

// Read-only per-step email previews (see StepEmailsChip).
const ACCOUNTANT_PIPELINE = 'ACCOUNTANT_ONBOARDING'
const ACCOUNTANT_DECISION_EMAILS = [
  { name: 'ACCOUNTANT_undecided', when: 'If Undecided — decision email with buttons' },
  { name: 'ACCOUNTANT_undecided_reminder', when: 'Automatic reminder if no response (48h); auto-declines after 14 days' },
  { name: 'ACCOUNTANT_decline', when: 'If No — decline email (also sent on 14-day auto-decline)' },
]
const ACCOUNTANT_AGREEMENT_EMAILS = [
  { name: 'ACCOUNTANT_agreement_sent', when: 'Automatic — agreement signing link (sent on Yes)' },
  { name: 'ACCOUNTANT_signing_reminder', when: 'Automatic reminder if unsigned (48h)' },
]
const ACCOUNTANT_CEO_EMAILS = [
  { name: 'ACCOUNTANT_ceo_countersign', when: 'Automatic — asks the CEO to countersign' },
]
const ACCOUNTANT_PAYMENT_LINK_EMAILS = [
  { name: 'ACCOUNTANT_payment_link', when: 'Automatic — onboarding payment link' },
  { name: 'ACCOUNTANT_payment_reminder', when: 'Automatic reminder if unpaid (48h)' },
]
const ACCOUNTANT_CONFIRMATION_EMAILS = [
  { name: 'ACCOUNTANT_payment_confirmation|card', when: 'If paid by card' },
  { name: 'ACCOUNTANT_payment_confirmation|ach', when: 'If paid by bank transfer (ACH)' },
]
const ACCOUNTANT_INVOICE_EMAILS = [
  { name: 'ACCOUNTANT_invoice_receipt', when: 'Automatic — invoice + receipt' },
]
const ACCOUNTANT_LOGIN_EMAILS = [
  { name: 'ACCOUNTANT_login_setup', when: 'Portal login setup email' },
]

export default function AccountantOnboarding() {
  const [view, setView] = useState('list')
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newType, setNewType] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [showStopped, setShowStopped] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const session = getSession()

  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  useEffect(() => { loadList() }, [])

  // Deep-link: the PFT track's "View onboarding" button (sessionStorage) OR a
  // notification link (/admin?...&onboarding=<id>) opens that record's detail.
  useEffect(() => {
    const sessionId = sessionStorage.getItem('accountantOnboardingOpenId')
    const openId = sessionId || searchParams.get('onboarding')
    if (openId) {
      if (sessionId) sessionStorage.removeItem('accountantOnboardingOpenId')
      setSelectedId(parseInt(openId, 10))
      setView('detail')
    }
  }, [searchParams])

  async function loadList() {
    setLoading(true)
    try {
      const data = await callApi('load_accountant_onboardings')
      setOnboardings(data.onboardings || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function createNew() {
    if (!newFirst.trim() || !newLast.trim()) return
    setCreating(true)
    try {
      await callApi('create_accountant_onboarding', {
        first_name: newFirst.trim(),
        last_name: newLast.trim(),
        email: newEmail.trim() || null,
        created_by: session?.name || 'Admin',
        accountant_type: newType || null,
      })
      setNewFirst(''); setNewLast(''); setNewEmail(''); setNewType(''); setShowNew(false)
      await loadList()
    } catch (err) { console.error(err) }
    finally { setCreating(false) }
  }

  if (view === 'detail' && selectedId) {
    return <OnboardingDetail id={selectedId} onBack={() => {
      setView('list'); setSelectedId(null); loadList()
      // Clear a consumed/stale deep-link param so a deleted id can't re-open.
      if (searchParams.get('onboarding')) { const n = new URLSearchParams(searchParams); n.delete('onboarding'); n.delete('_n'); setSearchParams(n, { replace: true }) }
    }} />
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <ListHeader
        title="Accountant Onboarding"
        count={onboardings.length}
        action={<button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ New Onboarding</button>}
      />

      {showNew && (
        <div style={{ ...sectionStyle, marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Start New Accountant Onboarding</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>First Name *</label>
              <input value={newFirst} onChange={e => setNewFirst(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Last Name *</label>
              <input value={newLast} onChange={e => setNewLast(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Email *</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '12px', maxWidth: '320px' }}>
            <label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Accountant Type *</label>
            <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, background: 'var(--vfo-card)', cursor: 'pointer' }}>
              <option value="">-- Select --</option>
              <option value="VFO FT">VFO FT Accountant</option>
              <option value="VFO Associate">VFO Associate Accountant</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} disabled={creating || !newFirst.trim() || !newLast.trim() || !newEmail.trim() || !newType} style={{ padding: '8px 20px', borderRadius: '8px', background: creating ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>{creating ? 'Creating...' : 'Create'}</button>
            <button onClick={() => { setShowNew(false); setNewFirst(''); setNewLast(''); setNewEmail('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <AccountantOnboardingListSkeleton />
      ) : onboardings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--vfo-muted)' }}>No onboarding records yet. Click "+ New Onboarding" to start.</div>
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
          const stage = ob.member_created_at ? 3 : ob.accountant_type === 'VFO Associate' ? 3 : ob.prelim_meeting_decision ? 2 : 1
          const isDone = variant === 'completed'
          const isStopped = variant === 'stopped'
          const stageColor = isStopped ? '#e74c3c' : isDone ? '#1b9254' : '#0095ff'
          const labelText = isDone ? 'Done' : isStopped ? 'Stopped' : STAGE_NAMES[stage]
          const bg = isStopped ? 'rgba(231,76,60,0.15)' : isDone ? 'rgba(27,146,84,0.15)' : 'rgba(0,149,255,0.15)'
          const border = isStopped ? 'rgba(231,76,60,0.3)' : isDone ? 'rgba(27,146,84,0.3)' : 'rgba(0,149,255,0.3)'
          return (
            <div key={ob.id} onClick={() => { setSelectedId(ob.id); setView('detail') }} style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '18px', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,149,255,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--vfo-border)'}>
              <div>
                <div style={{ fontSize: '15px', color: 'var(--vfo-ink)', fontWeight: '500', marginBottom: '4px' }}>{ob.first_name} {ob.last_name}{ob.member_number ? <span style={{ fontSize: '12px', color: 'var(--vfo-muted)', fontFamily: 'monospace', marginLeft: '8px' }}>#{ob.member_number}</span> : null}</div>
                <div style={{ fontSize: '12px', color: 'var(--vfo-muted)' }}>{ob.email || 'No email'} · Started {ob.created_at?.split('T')[0]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: bg, color: stageColor, border: `1px solid ${border}` }}>
                  {labelText}
                </span>
              </div>
            </div>
          )
        }

        const SectionHeader = ({ title, count, open, onToggle, color }) => (
          <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', marginTop: '20px', marginBottom: '10px', borderRadius: '8px', cursor: 'pointer', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-tint-deep)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'var(--vfo-muted)', fontSize: '10px', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
              <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>({count})</span>
            </div>
          </div>
        )

        return (
          <div>
            {inProgress.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--vfo-muted)', fontSize: '13px' }}>No active onboardings in progress.</div>
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
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [expanded, setExpanded] = useState({ 1: true, 2: true, 3: true })
  const [advisors, setAdvisors] = useState(null)
  const [savingCc, setSavingCc] = useState(false)

  useEffect(() => { loadDetail() }, [id])

  // Lazily load the advisor list the first time the Advisor path is active
  // (the CC Connected Advisor picker only shows then).
  useEffect(() => {
    if (ob?.accountant_partnership === 'Accountant Partnership' && advisors === null) {
      callApi('accountant_load_advisors')
        .then(res => setAdvisors(res?.advisors || []))
        .catch(err => { console.error(err); setAdvisors([]) })
    }
  }, [ob?.accountant_partnership, advisors])

  async function loadDetail() {
    setLoading(true)
    try {
      const data = await callApi('load_accountant_onboarding', { onboarding_id: id })
      if (!data?.onboarding) { onBack(); return }   // deleted/missing → back to list
      setOb(data.onboarding)
    } catch (err) {
      // A stale deep-link to a deleted onboarding 404s — bounce to the list
      // instead of getting stuck on an error.
      if (String(err?.message || err).toLowerCase().includes('not found')) { onBack(); return }
      console.error(err)
    }
    finally { setLoading(false) }
  }

  async function savePrelimMeeting(status) {
    setSaving(true)
    try {
      const res = await callApi('save_accountant_prelim_meeting', { onboarding_id: id, status: status || null })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function savePartnership(partnership) {
    setSaving(true)
    try {
      const res = await callApi('save_accountant_partnership', { onboarding_id: id, partnership: partnership || null })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function saveCcAdvisor(member_number) {
    setSavingCc(true)
    try {
      const res = await callApi('save_accountant_cc_advisor', { onboarding_id: id, member_number: member_number || null })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSavingCc(false) }
  }

  async function saveTeamMember(name) {
    setSaving(true)
    try {
      const res = await callApi('save_accountant_team_member', { onboarding_id: id, team_member: name || null })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  // Inline edit of a manual step's completion date (matches the tracking tracks).
  async function saveStepDate(field, date) {
    setSaving(true)
    try {
      const res = await callApi('save_onboarding_step_date', { pipeline: 'ACCOUNTANT', onboarding_id: id, field, date })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  async function saveDecision(decision) {
    setPendingDecision(decision)
    try {
      const res = await callApi('automation_ACCOUNTANT_decision', { onboarding_id: id, decision })
      if (res?.onboarding) setOb(res.onboarding)
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setPendingDecision(null) }
  }

  async function createAccountant(saleFields) {
    setCreatingMember(true)
    try {
      const res = await callApi('automation_ACCOUNTANT_createmember', { onboarding_id: id, ...(saleFields || {}) })
      if (res?.error) { alert('Error: ' + res.error); return }
      setShowSaleModal(false)
      await loadDetail()
    } catch (err) { console.error(err); alert('Error: ' + err.message) }
    finally { setCreatingMember(false) }
  }

  if (loading) return <AccountantOnboardingDetailSkeleton onBack={onBack} />
  if (!ob) return (
    <div style={{ padding: '40px', color: 'var(--vfo-muted)', textAlign: 'center' }}>
      <p>This onboarding no longer exists.</p>
      <button onClick={onBack} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: '#0095ff', fontSize: '13px', cursor: 'pointer' }}>← Back to list</button>
    </div>
  )

  // Known-value substitutions for the email previews (see StepEmailsChip).
  // Backend tokens: [Accountant Name] = full name, [Accountant First] = first.
  const emailCtx = (() => {
    const ctx = {}
    const full = `${ob.first_name || ''} ${ob.last_name || ''}`.trim()
    if (full) ctx['Accountant Name'] = full
    const first = (ob.first_name || '').trim() || full.split(/\s+/)[0]
    if (first) ctx['Accountant First'] = first
    return ctx
  })()

  const decision = ob.prelim_meeting_decision
  // VFO Associate accountants pay nothing and sign nothing — skip Stage 1 & 2.
  const isAssociate = ob.accountant_type === 'VFO Associate'
  const finalDec = ob.final_decision || (decision === 'Yes' ? 'Yes' : decision === 'No' ? 'No' : null)
  const yesPath = finalDec === 'Yes'
  const noPath = finalDec === 'No'
  const undecidedPending = decision === 'Undecided' && !ob.final_decision

  // Stage state: done if every "interesting" milestone on the active branch is set.
  function stage1State() {
    if (!ob.prelim_meeting_status) return 'pending'
    if (!ob.accountant_partnership) return 'active'
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
    if (isAssociate || (yesPath && ob.invoice_sent_at)) return 'active'
    return 'pending'
  }

  const stage3Locked = isAssociate ? false : !(yesPath && ob.invoice_sent_at)

  // Extra-meeting card, injected into the Yes step list at the point it
  // interrupted (extra_meeting_stage) so the meeting squeezes between rows.
  const emStage = ob.extra_meeting_stage
  const emRequested = !!ob.extra_meeting_requested_at
  const emCard = <OnboardingExtraMeetingCard ob={ob} pipeline="accountant" onComplete={loadDetail} compact />
  const yesRows = (withTags) => (
    <>
      <AutoRow label="Agreement sent" done={!!ob.agreement_sent_at} date={ob.agreement_sent_at} emails={ACCOUNTANT_AGREEMENT_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
      {emRequested && emStage === 'signing' && emCard}
      <AutoRow label="Agreement signed by accountant" done={!!ob.agreement_signed_by_accountant_at} date={ob.agreement_signed_by_accountant_at} tag={withTags ? [ob.selected_vfo_ft && 'VFO FT', ob.selected_pft && 'PFT', ob.selected_corporate && 'CM'] : undefined} />
      <AutoRow label="Agreement signed by CEO" done={!!ob.agreement_signed_by_ceo_at} date={ob.agreement_signed_by_ceo_at} emails={ACCOUNTANT_CEO_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
      <AutoRow label="Payment link sent" done={!!ob.payment_link_sent_at} date={ob.payment_link_sent_at} emails={ACCOUNTANT_PAYMENT_LINK_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
      {emRequested && emStage === 'payment' && emCard}
      <AutoRow label="Payment made" done={ob.payment_status === 'succeeded'} date={ob.payment_completed_at} tag={withTags ? (ob.payment_method_type ? ob.payment_method_type.toUpperCase() : null) : undefined} />
      <AutoRow label="Confirmation email sent" done={!!ob.confirmation_email_sent_at} date={ob.confirmation_email_sent_at} emails={ACCOUNTANT_CONFIRMATION_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
      <AutoRow label="Invoice/receipt sent" done={!!ob.invoice_sent_at} date={ob.invoice_sent_at} emails={ACCOUNTANT_INVOICE_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
    </>
  )

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to list</button>
      <TrackHero
        eyebrow="Accountant Onboarding"
        title={`${ob.first_name} ${ob.last_name}`}
        meta={
          <>
            {ob.accountant_type && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{ob.accountant_type === 'VFO Associate' ? 'VFO Associate' : 'VFO FT'}</span>}
            <span>{ob.email || 'No email'} · Started {ob.created_at?.split('T')[0] || ''}</span>
          </>
        }
        steps={[
          ...(isAssociate ? [] : [
            { label: 'Preliminary Meeting', state: stage1State() },
            { label: 'PC Admin', state: stage2State() },
          ]),
          { label: 'Add New Accountant', state: stage3State() },
        ]}
      />

      {!isAssociate && <StageBlock stage={1} title="Preliminary Meeting" state={stage1State()} expanded={expanded[1]} onToggle={() => setExpanded(p => ({ ...p, 1: !p[1] }))}>
        <Row label="Preliminary Meeting" done={!!ob.prelim_meeting_status} date={ob.prelim_meeting_status_at} onDateChange={d => saveStepDate('prelim_meeting_status_at', d)} saving={saving}>
          <select value={ob.prelim_meeting_status || ''} onChange={e => savePrelimMeeting(e.target.value)} disabled={saving} style={{ ...selectStyle, color: 'var(--vfo-ink)' }}>
            <option value="">-- Select --</option>
            <option value="Completed">Completed</option>
            <option value="No Show">No Show</option>
            <option value="Request no meeting">Request no meeting</option>
          </select>
        </Row>
        <Row label="Team Member Responsible" done={!!ob.onboarding_team_member} date={ob.onboarding_team_member_at} onDateChange={d => saveStepDate('onboarding_team_member_at', d)} saving={saving}>
          <select value={ob.onboarding_team_member || ''} onChange={e => saveTeamMember(e.target.value)} disabled={saving} style={{ ...selectStyle, color: 'var(--vfo-ink)' }}>
            <option value="">-- Select --</option>
            {SALES_TEAM_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Row>
        <Row label="Direct or Advisor Partnership" done={!!ob.accountant_partnership} date={ob.accountant_partnership_at} onDateChange={d => saveStepDate('accountant_partnership_at', d)} saving={saving}>
          <select value={ob.accountant_partnership || ''} onChange={e => savePartnership(e.target.value)} disabled={saving} style={{ ...selectStyle, color: 'var(--vfo-ink)' }}>
            <option value="">-- Select --</option>
            <option value="No accountant partnership">Direct</option>
            <option value="Accountant Partnership">Advisor</option>
          </select>
        </Row>
        {ob.accountant_partnership === 'Accountant Partnership' && (
          <Row label="CC Connected Advisor" done={!!ob.cc_advisor_email} date={ob.cc_advisor_at} onDateChange={d => saveStepDate('cc_advisor_at', d)} saving={saving}>
            <AdvisorCombo
              advisors={advisors}
              currentNumber={ob.cc_advisor_member_number}
              currentName={ob.cc_advisor_name}
              currentEmail={ob.cc_advisor_email}
              disabled={savingCc}
              onPick={saveCcAdvisor}
              onClear={() => saveCcAdvisor(null)}
            />
          </Row>
        )}
        <Row label="Preliminary Meeting Decision" done={!!decision} date={ob.prelim_meeting_decision_at} emails={ACCOUNTANT_DECISION_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} onDateChange={d => saveStepDate('prelim_meeting_decision_at', d)} saving={saving}>
          {decision ? (
            <span style={pillStyle(decision === 'Yes' ? '#1b9254' : decision === 'No' ? '#e74c3c' : '#e06717')}>{decision}</span>
          ) : (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', opacity: (!ob.accountant_partnership || !ob.onboarding_team_member) ? 0.4 : 1 }}>
              <button onClick={() => saveDecision('Yes')} disabled={!!pendingDecision || !ob.accountant_partnership || !ob.onboarding_team_member} style={{ ...pendingBtn('#1b9254', pendingDecision, 'Yes'), cursor: (!ob.accountant_partnership || !ob.onboarding_team_member) ? 'not-allowed' : 'pointer' }}>{pendingDecision === 'Yes' ? 'Sending…' : 'Yes'}</button>
              <button onClick={() => saveDecision('Undecided')} disabled={!!pendingDecision || !ob.accountant_partnership || !ob.onboarding_team_member} style={{ ...pendingBtn('#e06717', pendingDecision, 'Undecided'), cursor: (!ob.accountant_partnership || !ob.onboarding_team_member) ? 'not-allowed' : 'pointer' }}>{pendingDecision === 'Undecided' ? 'Sending…' : 'Undecided'}</button>
              <button onClick={() => saveDecision('No')} disabled={!!pendingDecision || !ob.accountant_partnership || !ob.onboarding_team_member} style={{ ...pendingBtn('#e74c3c', pendingDecision, 'No'), cursor: (!ob.accountant_partnership || !ob.onboarding_team_member) ? 'not-allowed' : 'pointer' }}>{pendingDecision === 'No' ? 'Sending…' : 'No'}</button>
            </div>
          )}
        </Row>
      </StageBlock>}

      {!isAssociate && <StageBlock stage={2} title="PC Admin" state={stage2State()} expanded={expanded[2]} onToggle={() => setExpanded(p => ({ ...p, 2: !p[2] }))}>
        {!decision && <div style={{ padding: '12px', color: 'var(--vfo-muted)', fontSize: '13px' }}>Waiting for Stage 1 decision.</div>}

        {decision === 'Yes' && yesRows(true)}

        {decision === 'Undecided' && (
          <>
            <AutoRow label="Decision email sent" done={!!ob.decision_email_sent_at} date={ob.decision_email_sent_at} />
            <AutoRow label="Client response received" done={!!ob.final_decision} date={ob.final_decision_at} />
            {undecidedPending && <div style={{ marginLeft: '14px', paddingLeft: '12px', borderLeft: '1px solid var(--vfo-tint-deep)', fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '4px' }}>Awaiting client click on Yes / No button in their email…</div>}
            {finalDec && (
              <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '4px', marginBottom: '4px', borderLeft: '1px solid var(--vfo-tint-deep)' }}>
                <div style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', display: 'inline-block', marginBottom: '8px',
                  background: finalDec === 'Yes' ? 'rgba(27,146,84,0.15)' : finalDec === 'ExtraMeeting' ? 'rgba(224,103,23,0.15)' : 'rgba(231,76,60,0.15)',
                  color: finalDec === 'Yes' ? '#1b9254' : finalDec === 'ExtraMeeting' ? '#e06717' : '#e74c3c',
                  border: `1px solid ${finalDec === 'Yes' ? 'rgba(27,146,84,0.3)' : finalDec === 'ExtraMeeting' ? 'rgba(224,103,23,0.3)' : 'rgba(231,76,60,0.3)'}`
                }}>
                  {finalDec === 'Yes' ? 'Yes — proceeding' : finalDec === 'ExtraMeeting' ? 'Extra meeting requested' : 'No — declined'}
                </div>
                {finalDec === 'ExtraMeeting' && emCard}
                {finalDec === 'No' && <AutoRow label="Decline email sent" done={!!ob.decline_email_sent_at} date={ob.decline_email_sent_at} />}
                {finalDec === 'Yes' && (
                  <>
                    {emRequested && emStage === 'decision' && emCard}
                    {yesRows(false)}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {decision === 'No' && (
          <AutoRow label="Decline email sent to accountant" done={!!ob.decline_email_sent_at} date={ob.decline_email_sent_at} />
        )}
      </StageBlock>}

      <StageBlock stage={isAssociate ? 1 : 3} title="Add New Accountant" state={stage3State()} expanded={expanded[3]} onToggle={() => setExpanded(p => ({ ...p, 3: !p[3] }))} dimmed={stage3Locked}>
        {stage3Locked ? (
          <div style={{ padding: '12px', color: 'var(--vfo-muted)', fontSize: '13px' }}>
            Available once the invoice/receipt has been sent in Stage 2.
          </div>
        ) : ob.member_created_at ? (
          <>
            <AutoRow label="Accountant created" done={true} date={ob.member_created_at} emails={ACCOUNTANT_LOGIN_EMAILS} pipeline={ACCOUNTANT_PIPELINE} emailCtx={emailCtx} />
            <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '6px', borderLeft: '1px solid var(--vfo-tint-deep)', fontSize: '12px', color: 'var(--vfo-muted)' }}>
              Member number: <span style={{ color: 'var(--vfo-ink)', fontFamily: 'monospace' }}>{ob.member_number}</span> &middot; Implementation &middot; New Model
            </div>
          </>
        ) : (
          <div style={{ padding: '4px 0' }}>
            <button onClick={() => setShowSaleModal(true)} disabled={creatingMember} style={{ padding: '10px 24px', borderRadius: '8px', background: creatingMember ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: creatingMember ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {creatingMember ? 'Creating & sending...' : 'Create Accountant & Send Setup Link'}
            </button>
          </div>
        )}
      </StageBlock>

      {showSaleModal && (
        <NewModelSaleModal
          ob={ob}
          kind="accountant"
          submitting={creatingMember}
          onClose={() => setShowSaleModal(false)}
          onConfirm={createAccountant}
        />
      )}
    </div>
  )
}

function StageBlock({ stage, title, state, expanded, onToggle, dimmed, children }) {
  const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : 'var(--vfo-border)'
  const titleColor = state === 'active' ? 'var(--vfo-primary)' : 'var(--vfo-heading)'
  return (
    <div style={{ background: 'var(--vfo-card)', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'visible', opacity: dimmed ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <PhaseBadge number={stage} state={state} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {state === 'done' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
          {state === 'active' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>}
          {state === 'pending' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>}
          <span style={{ color: 'var(--vfo-muted)', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
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

const dateTextStyle = { fontSize: '11px', color: 'var(--vfo-muted)', flexShrink: 0, display: 'inline-block', width: '32px' }

function Row({ label, done, date, children, emails, pipeline, emailCtx, onDateChange, saving }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
      <span style={{ fontSize: '13px', color: done ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{label}{emails && <span style={{ marginLeft: '8px' }}><StepEmailsChip pipeline={pipeline} title={label} templates={emails} context={emailCtx} /></span>}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {children}
        {onDateChange && done && date
          ? <StepDate value={(date || '').split('T')[0]} onChange={onDateChange} disabled={saving} />
          : <span style={dateTextStyle}>{done && date ? formatDate(date) : ''}</span>}
      </span>
    </div>
  )
}

function AdvisorCombo({ advisors, currentNumber, currentName, currentEmail, disabled, onPick, onClear }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  if (currentNumber) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '320px' }}>
        <span style={{ fontSize: '12px', textAlign: 'right', lineHeight: 1.3 }}>
          <span style={{ fontWeight: 600, color: 'var(--vfo-ink)' }}>{currentName || '(advisor)'}</span>
          {currentEmail && <span style={{ color: 'var(--vfo-muted)' }}> · {currentEmail}</span>}
        </span>
        <button onClick={onClear} disabled={disabled} title="Remove connected advisor"
          style={{ border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', color: 'var(--vfo-muted)', borderRadius: '6px', width: '22px', height: '22px', fontSize: '13px', lineHeight: 1, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}>×</button>
      </span>
    )
  }

  const loading = advisors === null
  const q = search.trim().toLowerCase()
  const matches = loading ? [] : advisors
    .filter(a => !q || a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
    .slice(0, 30)

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={loading ? 'Loading advisors…' : 'Search advisors…'}
        disabled={disabled || loading}
        style={{ ...selectStyle, minWidth: '220px', color: 'var(--vfo-ink)' }}
      />
      {open && !loading && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '2px', minWidth: '260px', maxHeight: '240px', overflowY: 'auto', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-strong)', borderRadius: '8px', boxShadow: '0 6px 20px rgba(20,45,95,0.18)', zIndex: 20 }}>
          {matches.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--vfo-muted)' }}>No matching advisors</div>
          ) : matches.map(a => (
            <div key={a.member_number} onMouseDown={() => { onPick(a.member_number); setSearch(''); setOpen(false) }}
              style={{ padding: '7px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid var(--vfo-border-soft)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontWeight: 600, color: 'var(--vfo-ink)' }}>{a.name}</span>
              {a.elite_status && a.elite_status !== 'Active' && <span style={{ color: '#e06717' }}> ({a.elite_status})</span>}
              <span style={{ color: 'var(--vfo-muted)', display: 'block' }}>{a.email}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

function AutoRow({ label, done, date, tag, emails, pipeline, emailCtx }) {
  const tags = tag == null ? [] : Array.isArray(tag) ? tag.filter(Boolean) : [tag]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
      <span style={{ fontSize: '12px', color: 'var(--vfo-ink)', flex: 1 }}>{label}{emails && <span style={{ marginLeft: '8px' }}><StepEmailsChip pipeline={pipeline} title={label} templates={emails} context={emailCtx} /></span>}</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {done && tags.length > 0 && tags.map((t, i) => (
          <span key={i} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{t}</span>
        ))}
        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: done ? 'rgba(27,146,84,0.15)' : 'var(--vfo-tint)', border: done ? '1px solid rgba(27,146,84,0.3)' : '1px solid var(--vfo-border-chip)', color: done ? '#1b9254' : 'var(--vfo-muted)' }}>{done ? 'Done' : 'Not completed'}</span>
        <span style={dateTextStyle}>{done && date ? formatDate(date) : ''}</span>
      </span>
    </div>
  )
}

const selectStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', color: 'var(--vfo-ink)', fontSize: '12px', minWidth: '150px', fontFamily: 'Inter, sans-serif' }
function pillStyle(color) { return { fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${color}22`, color, border: `1px solid ${color}44` } }
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
