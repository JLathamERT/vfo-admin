import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, loadCachedAction } from '../../../lib/api'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'
import { PFTTrackSkeleton } from '../../shared/Skeleton'
import { TrackHero, PhaseBadge } from '../../shared/TrackKit'
import StepDate from '../../shared/StepDate'

const pftStatusColors = { Complete: '#1b9254', Completed: '#1b9254', 'Complete - Yes': '#1b9254', 'Complete - No': '#e74c3c', Yes: '#1b9254', No: '#e74c3c', Undecided: '#e06717', VFOS: '#0095ff', Member: '#0095ff', New: '#1b9254', 'Re-Set': '#1b9254', 'VFO FT': '#1b9254', 'VFO Associate': '#1b9254', Stopped: '#e74c3c', 'No show': '#e74c3c', 'Meeting 1 scheduled': '#1b9254', 'Meeting 2 scheduled': '#1b9254', 'Meeting 3 scheduled': '#1b9254', 'Confirmation email sent': '#1b9254', 'Email sent - date not yet arranged': '#1b9254', 'Meeting declined': '#e74c3c', 'No response': '#e74c3c', 'Call arranged': '#1b9254', 'VFO FT confirmed': '#1b9254', 'VFO Associate confirmed': '#1b9254', 'No confirmed': '#e74c3c', 'Undecided - awaiting client': '#e06717' }
const inputStyle = { padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '12px', fontFamily: 'Inter, sans-serif' }
const dateSpanStyle = { fontSize: '11px', color: 'var(--vfo-muted)', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }
const greenBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }
// Solid green — the "mark complete without sending an email" backfill buttons.
// Filled (vs the tinted send buttons above) so the no-email path is visually
// distinct and hard to misclick. PFT-only.
const greenSolidBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid #1b9254', background: '#1b9254', color: '#fff', fontWeight: 600 }
const blueBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600 }
const redBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }
const amberBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(224,103,23,0.4)', background: 'rgba(224,103,23,0.12)', color: '#e06717', fontWeight: 600 }
const cancelBtn = { padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid var(--vfo-border-strong)', background: 'transparent', color: 'var(--vfo-muted)' }

function formatDate(d) {
  if (!d) return ''
  const parts = d.split('-')
  return `${parts[1]}/${parts[2]}`
}

const DISCOVERY_FIELDS = [
  ['business_name', 'Business Name'],
  ['firm_ownership_length', 'How long have you owned your firm?'],
  ['firm_goals', 'Goals for your firm'],
  ['est_current_gross_revenue', 'Est Current Full Year - $ Gross Revenue'],
  ['last_year_gross_revenue', 'Last Year - $ Gross Revenue'],
  ['current_year_clients', 'Current Year - # Clients'],
  ['last_year_clients', 'Last Year - # Clients'],
  ['est_current_hours_billed', 'EST Current Full Year - # Hours Billed'],
  ['last_year_hours_billed', 'Last Year - # Hours Actually Billed'],
  ['current_year_billable_employees', 'Current Year - # Billable Employees Inc Partners'],
  ['last_year_billable_employees', 'Last Year - # Billable Employees Inc Partners'],
  ['current_year_total_employees', 'Current Year - # Total Employees Inc Partners'],
  ['last_year_total_employees', 'Last Year - # Total Employees Inc Partners'],
  ['pct_business_owners', '% of Total Clients - Business Owners'],
  ['pct_nonbusiness_owners', '% of Total Clients - Nonbusiness Owners'],
  ['pct_traditional_services', '% of Total Clients - Traditional Services'],
  ['pct_nontraditional', '% of Total Clients - Nontraditional'],
  ['pct_billed_hourly', '% of Total Clients - Billed Hourly'],
  ['pct_billed_flat_value', '% of Total Clients - Billed Flat Fee or Value'],
  ['strengths', 'Strengths you bring to your business'],
  ['challenges', 'Main challenges'],
  ['hours_per_week', 'Hours worked per week, on average'],
  ['work_life_balance', 'Work/life balance'],
  ['satisfied_with_money', 'Satisfied with money vs. time worked?'],
  ['improve_opportunities', 'Opportunities to improve'],
  ['compelling_reason', 'Compelling reason to do business with you'],
  ['best_describes_you', 'Best describes you'],
  ['referral_team', 'Team of referral professionals?'],
  ['resource_usage_frequency', 'How often do you use these resources?'],
  ['benefit_financially', 'Benefit financially when clients use these resources?'],
  ['magic_wand', 'Magic wand - business in 12 months'],
]

// Initial Contact "Who is completing the tracking…" gate step. When it is NOT
// set to "Member" (unset or "VFOS"), the phase's other steps are inert and only
// this one counts toward the phase.
const isTrackingOwnerTask = (t) => (t?.name || '').startsWith('Who is completing the tracking')

function meetingNumber(name) {
  if (name === 'Meeting 1 confirmation email') return 1
  if (name.startsWith('Meeting 2 confirmation email')) return 2
  if (name === 'Meeting 3 confirmation email') return 3
  return null
}

// Gate answer ("Does the Accountant need a third meeting?"), read across all phases.
function computeGateStatus(phases, progress) {
  const gate = phases.flatMap(ph => ph.program_client_tasks || []).find(t => t.name === 'Does the Accountant need a third meeting?')
  return gate ? progress[gate.id]?.status || null : null
}

// Non-auto tasks for a phase that are actually rendered, given the gate answer.
// Mirrors renderTask: Meeting 3's email only shows on the Yes path, and the
// Meeting-2-phase decision email only shows on the No path. Counting off this
// keeps the phase badge / done-state in lockstep with what renders.
function visiblePhaseTasks(phase, gateStatus, progress = {}) {
  const base = (phase.program_client_tasks || []).filter(t => {
    if (t.status_options === 'auto' || t.status_options?.startsWith('auto_')) return false
    if (t.name === 'Meeting 3 confirmation email') return gateStatus === 'Yes'
    if (t.name === 'Accountant decision confirmation email' && phase.name === 'Accountant Meeting 2') return gateStatus === 'No'
    return true
  })
  // Initial Contact: only the tracking-owner step counts unless it is "Member".
  const owner = base.find(isTrackingOwnerTask)
  if (owner && progress[owner.id]?.status !== 'Member') return [owner]
  return base
}

function Dot({ done, color }) {
  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? color : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? color : 'var(--vfo-border-mid)'}` }} />
}

function StatusPill({ status, color }) {
  return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${color}22`, color, border: `1px solid ${color}44` }}>{status}</span>
}

function NotStarted() {
  return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>
}

// Shared 3-button meeting confirmation step (Meeting 1 / 2 / 3).
function MeetingStep({ task, meeting, p, readOnly, onSend, onCompleteNoEmail, onDate }) {
  const [showDate, setShowDate] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [tz, setTz] = useState('ET')
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || 'var(--vfo-muted)'

  async function fire(decision, d, t, z) {
    if (pending) return
    setPending(decision)
    try { await onSend(decision, d, t, z); setShowDate(false) }
    catch (err) { console.error(err) }
    finally { setPending(null) }
  }

  async function fireNoEmail() {
    if (pending) return
    setPending('no_email')
    try { await onCompleteNoEmail() } catch (err) { console.error(err) } finally { setPending(null) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{task.name}</span>
      {isDone
        ? <StatusPill status={p.status} color={statusColor} />
        : readOnly
          ? <NotStarted />
          : showDate
            ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle }} />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle }} />
                <select value={tz} onChange={e => setTz(e.target.value)} style={{ ...inputStyle, background: 'var(--vfo-card)' }}>
                  <option value="ET">Eastern (ET)</option>
                  <option value="CT">Central (CT)</option>
                  <option value="MT">Mountain (MT)</option>
                  <option value="PT">Pacific (PT)</option>
                  <option value="AKT">Alaska (AKT)</option>
                  <option value="HT">Hawaii (HT)</option>
                </select>
                <button onClick={() => date && fire('confirm_date', date, time, tz)} disabled={!date || !!pending} style={{ ...greenBtn, opacity: (!date || pending) ? 0.6 : 1, cursor: (!date || pending) ? 'not-allowed' : 'pointer' }}>{pending === 'confirm_date' ? 'Sending…' : 'Send'}</button>
                <button onClick={() => !pending && setShowDate(false)} disabled={!!pending} style={cancelBtn}>Cancel</button>
              </div>
            : <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setShowDate(true)} disabled={!!pending} style={greenBtn}>Send email (with date)</button>
                <button onClick={() => fire('confirm_no_date')} disabled={!!pending} style={{ ...greenBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'confirm_no_date' ? 'Sending…' : 'Send email - date not confirmed'}</button>
                <button onClick={() => fire('declined')} disabled={!!pending} style={{ ...redBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'declined' ? 'Sending…' : 'Meeting declined - email client'}</button>
                <button onClick={fireNoEmail} disabled={!!pending} style={{ ...greenSolidBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'no_email' ? 'Saving…' : 'Complete - NO EMAIL'}</button>
              </div>
      }
      {readOnly
        ? <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        : <StepDate value={isDone ? (p.completed_date || '') : ''} onChange={onDate} disabled={!!pending} />
      }
    </div>
  )
}

// Yes/No gate: "Does the Accountant need a third meeting?"
function GateStep({ task, p, readOnly, onChoose }) {
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  // Both Yes and No are neutral path choices — neither is a "bad" outcome.
  const statusColor = p.status ? '#1b9254' : 'var(--vfo-muted)'
  async function fire(v) {
    if (pending) return
    setPending(v)
    try { await onChoose(v) } catch (err) { console.error(err) } finally { setPending(null) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1, fontWeight: '600' }}>{task.name}</span>
      {isDone
        ? <StatusPill status={p.status} color={statusColor} />
        : readOnly
          ? <NotStarted />
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => fire('Yes')} disabled={!!pending} style={greenBtn}>Yes</button>
              <button onClick={() => fire('No')} disabled={!!pending} style={greenBtn}>No</button>
            </div>
      }
    </div>
  )
}

// Final 3-button decision step (VFO FT / VFO Associate / No).
function DecisionStep({ task, p, readOnly, onChoose, onCompleteNoEmail, onDate }) {
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || 'var(--vfo-muted)'
  async function fire(choice) {
    if (pending) return
    setPending(choice)
    try { await onChoose(choice) } catch (err) { console.error(err) } finally { setPending(null) }
  }
  async function fireNoEmail(choice) {
    if (pending) return
    setPending('ne_' + choice)
    try { await onCompleteNoEmail(choice) } catch (err) { console.error(err) } finally { setPending(null) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{task.name}</span>
      {isDone
        ? <StatusPill status={p.status} color={statusColor} />
        : readOnly
          ? <NotStarted />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button onClick={() => fire('vfo_ft')} disabled={!!pending} style={greenBtn}>{pending === 'vfo_ft' ? 'Sending…' : 'Email confirming VFO FT'}</button>
                <button onClick={() => fire('vfo_associate')} disabled={!!pending} style={greenBtn}>{pending === 'vfo_associate' ? 'Sending…' : 'Email confirming VFO Associate'}</button>
                <button onClick={() => fire('undecided')} disabled={!!pending} style={amberBtn}>{pending === 'undecided' ? 'Sending…' : 'Undecided email'}</button>
                <button onClick={() => fire('no')} disabled={!!pending} style={redBtn}>{pending === 'no' ? 'Sending…' : 'Email confirming No'}</button>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '10px', color: 'var(--vfo-muted)', fontWeight: 600 }}>Complete - NO EMAIL:</span>
                <button onClick={() => fireNoEmail('vfo_ft')} disabled={!!pending} style={{ ...greenSolidBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'ne_vfo_ft' ? 'Saving…' : 'VFO FT'}</button>
                <button onClick={() => fireNoEmail('vfo_associate')} disabled={!!pending} style={{ ...greenSolidBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'ne_vfo_associate' ? 'Saving…' : 'VFO Associate'}</button>
                <button onClick={() => fireNoEmail('no')} disabled={!!pending} style={{ ...greenSolidBtn, opacity: pending ? 0.6 : 1 }}>{pending === 'ne_no' ? 'Saving…' : 'No'}</button>
              </div>
            </div>
      }
      {readOnly
        ? <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        : <StepDate value={isDone ? (p.completed_date || '') : ''} onChange={onDate} disabled={!!pending} />
      }
    </div>
  )
}

// One derived-history row inside the AI PC Admin cascade.
function autoStep(label, done) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
      <span style={{ fontSize: '12px', color: 'var(--vfo-ink)' }}>{label}</span>
      {done
        ? <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, marginLeft: 'auto' }}>Done</span>
        : <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)', marginLeft: 'auto' }}>Not completed</span>}
    </div>
  )
}

// AI PC Admin — auto-derived history of the Accountant decision flow: the
// Undecided email (if the admin deferred to the client), what the client picked
// in that email, the follow-up confirmation email, and what they clicked in its
// "need another meeting?" choice. Mirrors the Tax 5 AI PC Admin cascade.
function DecisionHistory({ eng, decStatus, onboarding }) {
  const decEmailSent = !!eng?.decision_email_sent_at
  const decResp = eng?.decision_response || null              // vfo_ft | vfo_associate | no (Undecided email click)
  const ftEmailSent = !!eng?.ft_email_sent_at
  const ftResp = eng?.ft_response || null                     // confirm | another_meeting (follow-up email click)

  // Nothing has happened on this step yet — no history to show.
  if (!decEmailSent && !decStatus) return null

  // Effective path: the client's Undecided choice, else the admin's direct pick.
  const fromStatus = decStatus === 'VFO FT confirmed' ? 'vfo_ft' : decStatus === 'VFO Associate confirmed' ? 'vfo_associate' : decStatus === 'No confirmed' ? 'no' : null
  const choice = decResp || fromStatus

  const pathLabel = { vfo_ft: 'VFO Fast Track', vfo_associate: 'VFO Associate', no: 'No thank you' }
  const ftLabel = { confirm: 'Confirm onboarding — no further meeting', another_meeting: "I'd like another meeting" }
  const complete = choice === 'no' || !!ftResp

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: complete ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${complete ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
        <span style={{ fontSize: '13px', color: 'var(--vfo-ink)', flex: 1, fontWeight: '600' }}>AI PC Admin</span>
      </div>
      <div style={{ marginLeft: '18px', padding: '8px 14px', background: 'var(--vfo-tint)', borderRadius: '8px', border: '1px solid var(--vfo-border-chip)' }}>
        {decEmailSent && (
          <>
            {autoStep('Undecided — decision email sent to client (VFO FT / VFO Associate / No)', true)}
            {decResp
              ? autoStep(`Client chose "${pathLabel[decResp]}" in the decision email`, true)
              : autoStep('Waiting for client to choose a path', false)}
            {!decResp && !!eng?.decision_reminder_sent_at && autoStep('2-day reminder email sent to client', true)}
            {!decResp && !!eng?.decision_pf_notified_at && autoStep('4-day passed — assigned PF notified to follow up', true)}
          </>
        )}
        {choice === 'no' && autoStep('Decline email sent to client', true)}
        {(choice === 'vfo_ft' || choice === 'vfo_associate') && (
          <>
            {autoStep(`Accountant Onboarding record created (${pathLabel[choice]})`, !!onboarding)}
            {autoStep("Confirmation email sent with the “need another meeting?” choice", ftEmailSent)}
            {ftResp
              ? autoStep(`Client chose "${ftLabel[ftResp]}" in the follow-up email`, true)
              : (ftEmailSent && autoStep('Waiting for client to respond to the follow-up email', false))}
            {!ftResp && ftEmailSent && !!eng?.ft_reminder_sent_at && autoStep('2-day reminder email sent to client', true)}
            {!ftResp && ftEmailSent && !!eng?.ft_pf_notified_at && autoStep('4-day passed — assigned PF notified to follow up', true)}
          </>
        )}
      </div>
    </div>
  )
}

// Generic dropdown step (Relationship type, Call arranged, Call outcome, presentations, etc.)
function GenericTask({ task, p, readOnly, saving, onSelect, onDate }) {
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || 'var(--vfo-muted)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{task.name}</span>
      {readOnly
        ? (isDone ? <StatusPill status={p.status} color={statusColor} /> : <NotStarted />)
        : <select value={p.status || ''} onChange={e => onSelect(e.target.value)} disabled={saving} style={{ ...inputStyle, background: 'var(--vfo-card)', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'var(--vfo-border-strong)', color: isDone ? statusColor : 'var(--vfo-ink)' }}>
            <option value="">-- Select --</option>
            {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
      }
      {readOnly
        ? <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        : <StepDate value={isDone ? (p.completed_date || '') : ''} onChange={onDate} disabled={saving} />
      }
    </div>
  )
}

// Phase 6 dynamic progress indicators (no DB tasks — driven by decision + handoff).
// Both VFO FT and VFO Associate behave identically: the decision click creates
// the Accountant Onboarding handoff immediately.
function Phase6Indicators({ onboarding, onOpen, readOnly }) {
  const handed = !!onboarding
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
        <Dot done={handed} color="#1b9254" />
        <span style={{ fontSize: '13px', color: handed ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>Sent to Accountant Onboarding</span>
        {handed
          ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>
          : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Pending</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
        <Dot done={false} color="#0095ff" />
        <span style={{ fontSize: '13px', color: 'var(--vfo-ink)', flex: 1 }}>Accountant onboarding progress</span>
        {handed
          ? <>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{onboarding.stage_label}</span>
              {!readOnly && <button onClick={() => onOpen(onboarding.id)} style={blueBtn}>View onboarding →</button>}
            </>
          : <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>—</span>}
      </div>
    </>
  )
}

// Collapsible viewer of the submitted discovery form, shown below the Meeting 2 step.
function DiscoveryViewer({ eng }) {
  const [open, setOpen] = useState(false)
  const submitted = !!eng?.discovery_submitted_at
  const data = eng?.discovery_data || {}
  if (!submitted) {
    if (!eng?.discovery_email_sent_at) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0 5px 18px', borderBottom: '1px solid var(--vfo-border-soft)' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'transparent', border: '1px solid var(--vfo-border-mid)', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: 'var(--vfo-muted)' }}>Discovery form — awaiting completion</span>
      </div>
    )
  }
  return (
    <div style={{ borderBottom: '1px solid var(--vfo-border-soft)', padding: '5px 0 5px 18px' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1b9254', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, flex: 1 }}>View discovery form</span>
        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600 }}>Completed</span>
        <span style={{ color: 'var(--vfo-muted)', fontSize: '9px', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '10px 12px 4px 14px' }}>
          {DISCOVERY_FIELDS.map(([k, label]) => (
            <div key={k} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: 'var(--vfo-ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{data[k] ? data[k] : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PFTEngagementTrack({ clientId, programId, readOnly = false, notes = [], onNotesChange }) {
  const navigate = useNavigate()
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [engagement, setEngagement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadTrack() }, [clientId])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData, engData] = await Promise.all([
        loadCachedAction('msm_load_client_track', { program_id: programId, track_type: 'partnership_fast_track' }),
        callApi('msm_load_client_progress', { client_id: clientId }),
        callApi('pft_load_engagement', { client_id: clientId }),
      ])
      const loadedPhases = trackData.phases || []
      setPhases(loadedPhases)
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)
      setEngagement(engData || null)

      const allTasks = loadedPhases.flatMap(ph => ph.program_client_tasks || [])
      const decStatus = allTasks.filter(t => t.name === 'Accountant decision confirmation email').map(t => prog[t.id]?.status).find(s => s) || null
      const gateStatus = computeGateStatus(loadedPhases, prog)

      const expandState = {}
      loadedPhases.forEach(phase => {
        const isAssoc = phase.name.includes('VFO-Associate')
        const isFT = phase.name.includes('VFO-FT Accountant')
        if (isAssoc || isFT) {
          expandState[phase.id] = (isAssoc && decStatus === 'VFO Associate confirmed') || (isFT && decStatus === 'VFO FT confirmed')
          return
        }
        const tasks = visiblePhaseTasks(phase, gateStatus, prog)
        const allDone = tasks.length === 0 || tasks.every(t => prog[t.id]?.status)
        expandState[phase.id] = !allDone
      })
      setExpanded(expandState)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function saveTask(taskId, status, existingDate) {
    const today = new Date().toISOString().split('T')[0]
    const date = existingDate || (status ? today : null)
    setSaving(p => ({ ...p, [taskId]: true }))
    try {
      await callApi('msm_save_client_task', { client_id: clientId, task_id: taskId, status, completed_date: date || null, completed_by: null, notes: null })
      setProgress(p => ({ ...p, [taskId]: { ...p[taskId], task_id: taskId, status, completed_date: date } }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [taskId]: false })) }
  }

  async function handleMeetingSend(task, meeting, decision, date, time, tz) {
    await callApi('automation_PFT_meetingemail', {
      client_id: clientId, task_id: task.id, meeting,
      decision, meeting_date: date || null, meeting_time: time || null, meeting_tz: tz || null,
    })
    const status = decision === 'declined' ? 'Meeting declined' : decision === 'confirm_no_date' ? 'Email sent - date not yet arranged' : 'Confirmation email sent'
    const notes = decision === 'confirm_date' ? [date, time, tz].filter(Boolean).join(' ') : null
    const today = new Date().toISOString().split('T')[0]
    setProgress(prev => ({ ...prev, [task.id]: { ...prev[task.id], task_id: task.id, status, completed_date: today, notes } }))
  }

  async function handleDecision(task, choice) {
    const today = new Date().toISOString().split('T')[0]
    // Undecided: defer the choice to the client — email them the 3 buttons
    // (VFO FT / VFO Associate / No) and wait for their click. No phase reveal yet.
    if (choice === 'undecided') {
      await callApi('automation_PFT_undecided', { client_id: clientId, task_id: task.id })
      setProgress(prev => ({ ...prev, [task.id]: { ...prev[task.id], task_id: task.id, status: 'Undecided - awaiting client', completed_date: today } }))
      try { const engData = await callApi('pft_load_engagement', { client_id: clientId }); setEngagement(engData || null) } catch (err) { console.error(err) }
      return
    }
    await callApi('automation_PFT_decisionemail', { client_id: clientId, task_id: task.id, choice })
    const status = choice === 'vfo_ft' ? 'VFO FT confirmed' : choice === 'vfo_associate' ? 'VFO Associate confirmed' : 'No confirmed'
    setProgress(prev => ({ ...prev, [task.id]: { ...prev[task.id], task_id: task.id, status, completed_date: today } }))
    try { const engData = await callApi('pft_load_engagement', { client_id: clientId }); setEngagement(engData || null) } catch (err) { console.error(err) }
    setExpanded(prev => {
      const next = { ...prev }
      phases.forEach(ph => {
        if ((choice === 'vfo_associate' && ph.name.includes('VFO-Associate')) || (choice === 'vfo_ft' && ph.name.includes('VFO-FT Accountant'))) next[ph.id] = true
      })
      return next
    })
  }

  // Backfill helper: mark the decision step complete with its real outcome
  // status (so the matching Phase-6 track reveals) WITHOUT sending an email or
  // creating an Accountant Onboarding record. For migrating existing accountants.
  async function handleDecisionNoEmail(task, choice) {
    const status = choice === 'vfo_ft' ? 'VFO FT confirmed' : choice === 'vfo_associate' ? 'VFO Associate confirmed' : 'No confirmed'
    await saveTask(task.id, status, null)
    setExpanded(prev => {
      const next = { ...prev }
      phases.forEach(ph => {
        if ((choice === 'vfo_associate' && ph.name.includes('VFO-Associate')) || (choice === 'vfo_ft' && ph.name.includes('VFO-FT Accountant'))) next[ph.id] = true
      })
      return next
    })
  }

  function openOnboarding(id) {
    sessionStorage.setItem('accountantOnboardingOpenId', String(id))
    navigate('/admin?tab=accountants&section=accountant_onboarding')
  }

  function getA11Status() {
    const allTasks = phases.flatMap(p => p.program_client_tasks || [])
    const a8 = allTasks.find(t => t.name === 'Right clients?')
    const a9 = allTasks.find(t => t.name === 'Right client relationships?')
    const a10 = allTasks.find(t => t.name === 'Right attitude (to change)?')
    if (!a8 || !a9 || !a10) return null
    const v8 = progress[a8.id]?.status
    const v9 = progress[a9.id]?.status
    const v10 = progress[a10.id]?.status
    if (!v8 || !v9 || !v10) return null
    if (v10 === 'No') return 'No'
    if ([v8, v9, v10].filter(v => v === 'Yes').length >= 2) return 'Yes'
    return 'No'
  }

  function getPhaseState(phase) {
    const tasks = visiblePhaseTasks(phase, computeGateStatus(phases, progress), progress)
    if (tasks.length === 0) return 'done'
    if (tasks.every(t => progress[t.id]?.status)) return 'done'
    if (tasks.some(t => progress[t.id]?.status)) return 'active'
    return 'pending'
  }

  if (loading) return <PFTTrackSkeleton />

  const allTasksFlat = phases.flatMap(p => p.program_client_tasks || [])
  const gateTask = allTasksFlat.find(t => t.name === 'Does the Accountant need a third meeting?')
  const gateStatus = gateTask ? progress[gateTask.id]?.status : null
  const rawDecisionStatus = allTasksFlat.filter(t => t.name === 'Accountant decision confirmation email').map(t => progress[t.id]?.status).find(s => s) || null
  // "Undecided - awaiting client" is a deferred decision (the client hasn't
  // clicked yet), so treat it like "no decision made" for phase-6 gating — keep
  // both VFO-FT / VFO-Associate sections visible-but-pending until the client picks.
  const decisionStatus = rawDecisionStatus === 'Undecided - awaiting client' ? null : rawDecisionStatus
  const onboarding = engagement?.onboarding || null
  const eng = engagement?.engagement || null

  // Display-only hero steps: mirrors the phase visibility rules used in the
  // render below (Meeting 3 hidden until the gate says Yes; Phase 6 variants
  // hidden once a decision picks the other path). Also used to number the
  // visible phase cards.
  const heroSteps = []
  phases.forEach(phase => {
    const isAssociatePhase = phase.name.includes('VFO-Associate')
    const isFTPhase = phase.name.includes('VFO-FT Accountant')
    const isPhase6 = isAssociatePhase || isFTPhase
    if (phase.name === 'Accountant Meeting 3' && gateStatus !== 'Yes') return
    const matched6 = (isAssociatePhase && decisionStatus === 'VFO Associate confirmed') || (isFTPhase && decisionStatus === 'VFO FT confirmed')
    if (isPhase6 && decisionStatus && !matched6) return
    let state = getPhaseState(phase)
    if (isPhase6) state = matched6 ? 'active' : 'pending'
    heroSteps.push({ id: phase.id, label: phase.name.replace(/^Accountant /, ''), state })
  })

  // Task-level hero counts, mirroring the same visibility rules: Phase 6 is
  // indicator-only (no countable tasks), Meeting 3 only exists once the gate
  // says Yes, and Meeting 2's decision-email copy only shows on the No path.
  let heroTotalTasks = 0
  let heroDoneTasks = 0
  phases.forEach(phase => {
    if (phase.name.includes('VFO-Associate') || phase.name.includes('VFO-FT Accountant')) return
    if (phase.name === 'Accountant Meeting 3' && gateStatus !== 'Yes') return
    const counted = visiblePhaseTasks(phase, gateStatus, progress)
    heroTotalTasks += counted.length
    heroDoneTasks += counted.filter(t => progress[t.id]?.status).length
  })

  function renderTask(task, phase) {
    const p = progress[task.id] || {}

    // Initial Contact: the original steps are inert (greyed, not clickable) until
    // the tracking-owner step is set to "Member".
    const ownerTask = (phase.program_client_tasks || []).find(isTrackingOwnerTask)
    if (ownerTask && !isTrackingOwnerTask(task) && progress[ownerTask.id]?.status !== 'Member') {
      return (
        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', opacity: 0.35, pointerEvents: 'none' }}>
          <Dot done={false} color="var(--vfo-muted)" />
          <span style={{ fontSize: '13px', color: 'var(--vfo-muted)', flex: 1 }}>{task.name}</span>
          <span style={dateSpanStyle}>—</span>
        </div>
      )
    }

    // Right accountant questions are rendered inside the grouped a11 section
    if (['Right clients?', 'Right client relationships?', 'Right attitude (to change)?'].includes(task.name)) return null

    // Right accountant conclusion — grouped section
    if (task.status_options === 'auto_pft_a11') {
      const allTasks2 = phases.flatMap(ph => ph.program_client_tasks || [])
      const q1 = allTasks2.find(t => t.name === 'Right clients?')
      const q2 = allTasks2.find(t => t.name === 'Right client relationships?')
      const q3 = allTasks2.find(t => t.name === 'Right attitude (to change)?')
      const a11Val = getA11Status()
      const a11Color = a11Val === 'Yes' ? '#1b9254' : a11Val === 'No' ? '#e74c3c' : 'var(--vfo-muted)'
      const questions = [q1, q2, q3].filter(Boolean)
      return (
        <div key={task.id} style={{ borderBottom: '1px solid var(--vfo-border-soft)', padding: '7px 0' }}>
          <div style={{ fontSize: '12px', color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Right accountant?</div>
          <div style={{ marginLeft: '18px', borderLeft: '1px solid var(--vfo-tint-deep)', paddingLeft: '12px', paddingBottom: '4px' }}>
            {questions.map(q => {
              const qp = progress[q.id] || {}
              const qDone = !!qp.status
              const qColor = pftStatusColors[qp.status] || 'var(--vfo-muted)'
              return (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--vfo-border-soft)', flexWrap: 'wrap' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: qDone ? qColor : 'transparent', flexShrink: 0, border: `1px solid ${qDone ? qColor : 'var(--vfo-border-mid)'}` }} />
                  <span style={{ fontSize: '12px', color: qDone ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{q.name}</span>
                  {readOnly
                    ? (qDone ? <StatusPill status={qp.status} color={qColor} /> : <NotStarted />)
                    : <select value={qp.status || ''} onChange={e => saveTask(q.id, e.target.value, qp.completed_date)} disabled={saving[q.id]} style={{ ...inputStyle, background: 'var(--vfo-card)', minWidth: '100px', fontSize: '11px', borderColor: qDone ? `${qColor}66` : 'var(--vfo-border-strong)', color: qDone ? qColor : 'var(--vfo-ink)' }}>
                        <option value="">-- Select --</option>
                        {(q.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  }
                  {readOnly
                    ? <span style={dateSpanStyle}>{qDone && qp.completed_date ? formatDate(qp.completed_date) : ''}</span>
                    : <StepDate value={qDone ? (qp.completed_date || '') : ''} onChange={d => saveTask(q.id, qp.status, d)} disabled={saving[q.id]} />
                  }
                </div>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', marginTop: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a11Val ? a11Color : 'transparent', flexShrink: 0, border: `1px solid ${a11Val ? a11Color : 'var(--vfo-border-mid)'}` }} />
              <span style={{ fontSize: '12px', color: 'var(--vfo-ink)', flex: 1, fontWeight: '600' }}>{task.name}</span>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${a11Color}22`, color: a11Color, border: `1px solid ${a11Color}44`, fontWeight: '600' }}>{a11Val || 'Pending'}</span>
            </div>
          </div>
        </div>
      )
    }

    // Meeting confirmation steps (1 / 2 / 3). Meeting 3's step is hidden until the gate says Yes.
    const mNum = meetingNumber(task.name)
    if (mNum) {
      if (mNum === 3 && gateStatus !== 'Yes') return null
      const step = <MeetingStep task={task} meeting={mNum} p={p} readOnly={readOnly} onSend={(decision, d, t, z) => handleMeetingSend(task, mNum, decision, d, t, z)} onCompleteNoEmail={() => saveTask(task.id, 'Complete', p.completed_date)} onDate={(d) => saveTask(task.id, p.status, d)} />
      if (mNum === 2) {
        return <div key={task.id}>{step}<DiscoveryViewer eng={eng} /></div>
      }
      return <div key={task.id}>{step}</div>
    }

    // Third-meeting gate
    if (task.name === 'Does the Accountant need a third meeting?') {
      return <GateStep key={task.id} task={task} p={p} readOnly={readOnly} onChoose={(v) => saveTask(task.id, v, p.completed_date)} />
    }

    // Decision step — the Meeting-2-phase copy only shows on the No path; the
    // Meeting-3-phase copy lives in a phase that only renders when gate = Yes.
    if (task.name === 'Accountant decision confirmation email') {
      if (phase.name === 'Accountant Meeting 2' && gateStatus !== 'No') return null
      return (
        <div key={task.id}>
          <DecisionStep task={task} p={p} readOnly={readOnly} onChoose={(choice) => handleDecision(task, choice)} onCompleteNoEmail={(choice) => handleDecisionNoEmail(task, choice)} onDate={(d) => saveTask(task.id, p.status, d)} />
          <DecisionHistory eng={eng} decStatus={p.status} onboarding={onboarding} />
        </div>
      )
    }

    return <GenericTask key={task.id} task={task} p={p} readOnly={readOnly} saving={!!saving[task.id]} onSelect={(v) => saveTask(task.id, v, p.completed_date)} onDate={(d) => saveTask(task.id, p.status, d)} />
  }

  return (
    <div>
      <TrackHero
        eyebrow="Partnership Fast Track"
        title="Engagement Process"
        completed={heroDoneTasks}
        total={heroTotalTasks}
        steps={heroSteps}
      />

      {phases.map(phase => {
        const isAssociatePhase = phase.name.includes('VFO-Associate')
        const isFTPhase = phase.name.includes('VFO-FT Accountant')
        const isPhase6 = isAssociatePhase || isFTPhase
        const isMeeting3Phase = phase.name === 'Accountant Meeting 3'

        // Meeting 3 phase only exists when the gate says Yes
        if (isMeeting3Phase && gateStatus !== 'Yes') return null

        const matched6 = (isAssociatePhase && decisionStatus === 'VFO Associate confirmed') || (isFTPhase && decisionStatus === 'VFO FT confirmed')
        // Before a decision: show both Phase 6 sections greyed. After a choice:
        // show only the matching section (hide the other; both hidden on "No").
        if (isPhase6 && decisionStatus && !matched6) return null
        const phaseGreyedOut = isPhase6 && !matched6

        let state = getPhaseState(phase)
        if (isPhase6) state = matched6 ? 'active' : 'pending'

        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const visibleTasks = visiblePhaseTasks(phase, gateStatus, progress)
        const doneTasks = visibleTasks.filter(t => progress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : 'var(--vfo-border)'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = 'var(--vfo-heading)'

        return (
          <div key={phase.id} style={{ background: 'var(--vfo-card)', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden', opacity: phaseGreyedOut ? 0.3 : 1, pointerEvents: phaseGreyedOut ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                <PhaseBadge number={heroSteps.findIndex(s => s.id === phase.id) + 1} state={state} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'PFT').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {isPhase6
                  ? (state === 'active'
                      ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>
                      : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>)
                  : <>
                      {state === 'done' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                      {state === 'active' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress · {doneTasks}/{visibleTasks.length}</span>}
                      {state === 'pending' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>}
                    </>
                }
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: 'var(--vfo-muted)', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>

            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="PFT" programName="Partnership Fast Track" notes={notes} onNotesChange={onNotesChange} />}

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {isPhase6
                  ? <Phase6Indicators onboarding={onboarding} onOpen={openOnboarding} readOnly={readOnly} />
                  : tasks.map(task => renderTask(task, phase))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PFTEngagementTrack
