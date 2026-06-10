import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, loadCachedAction } from '../../../lib/api'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'
import { PFTTrackSkeleton } from '../../shared/Skeleton'

const pftStatusColors = { Complete: '#1b9254', Completed: '#1b9254', 'Complete - Yes': '#1b9254', 'Complete - No': '#e74c3c', Yes: '#1b9254', No: '#e74c3c', Undecided: '#e06717', New: '#1b9254', 'Re-Set': '#1b9254', 'VFO FT': '#1b9254', 'VFO Associate': '#1b9254', Stopped: '#e74c3c', 'No show': '#e74c3c', 'Meeting 1 scheduled': '#1b9254', 'Meeting 2 scheduled': '#1b9254', 'Meeting 3 scheduled': '#1b9254', 'Confirmation email sent': '#1b9254', 'Email sent - date not yet arranged': '#1b9254', 'Meeting declined': '#e74c3c', 'No response': '#e74c3c', 'Call arranged': '#1b9254', 'VFO FT confirmed': '#1b9254', 'VFO Associate confirmed': '#1b9254', 'No confirmed': '#e74c3c' }
const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '12px', fontFamily: 'Inter, sans-serif' }
const dateSpanStyle = { fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }
const greenBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }
const blueBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600 }
const redBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }
const cancelBtn = { padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', border: '1px solid #d6e0ee', background: 'transparent', color: '#4e6087' }

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

function meetingNumber(name) {
  if (name === 'Meeting 1 confirmation email') return 1
  if (name.startsWith('Meeting 2 confirmation email')) return 2
  if (name === 'Meeting 3 confirmation email') return 3
  return null
}

function Dot({ done, color }) {
  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? color : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? color : '#c7d4e8'}` }} />
}

function StatusPill({ status, color }) {
  return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${color}22`, color, border: `1px solid ${color}44` }}>{status}</span>
}

function NotStarted() {
  return <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Not started</span>
}

// Shared 3-button meeting confirmation step (Meeting 1 / 2 / 3).
function MeetingStep({ task, meeting, p, readOnly, onSend }) {
  const [showDate, setShowDate] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [tz, setTz] = useState('ET')
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || '#4e6087'

  async function fire(decision, d, t, z) {
    if (pending) return
    setPending(decision)
    try { await onSend(decision, d, t, z); setShowDate(false) }
    catch (err) { console.error(err) }
    finally { setPending(null) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
      {isDone
        ? <StatusPill status={p.status} color={statusColor} />
        : readOnly
          ? <NotStarted />
          : showDate
            ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle }} />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...inputStyle }} />
                <select value={tz} onChange={e => setTz(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
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
              </div>
      }
      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
    </div>
  )
}

// Yes/No gate: "Does the Accountant need a third meeting?"
function GateStep({ task, p, readOnly, onChoose }) {
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  // Both Yes and No are neutral path choices — neither is a "bad" outcome.
  const statusColor = p.status ? '#1b9254' : '#4e6087'
  async function fire(v) {
    if (pending) return
    setPending(v)
    try { await onChoose(v) } catch (err) { console.error(err) } finally { setPending(null) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
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
function DecisionStep({ task, p, readOnly, onChoose }) {
  const [pending, setPending] = useState(null)
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || '#4e6087'
  async function fire(choice) {
    if (pending) return
    setPending(choice)
    try { await onChoose(choice) } catch (err) { console.error(err) } finally { setPending(null) }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
      {isDone
        ? <StatusPill status={p.status} color={statusColor} />
        : readOnly
          ? <NotStarted />
          : <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => fire('vfo_ft')} disabled={!!pending} style={greenBtn}>{pending === 'vfo_ft' ? 'Sending…' : 'Email confirming VFO FT'}</button>
              <button onClick={() => fire('vfo_associate')} disabled={!!pending} style={greenBtn}>{pending === 'vfo_associate' ? 'Sending…' : 'Email confirming VFO Associate'}</button>
              <button onClick={() => fire('no')} disabled={!!pending} style={redBtn}>{pending === 'no' ? 'Sending…' : 'Email confirming No'}</button>
            </div>
      }
      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
    </div>
  )
}

// Generic dropdown step (Relationship type, Call arranged, Call outcome, presentations, etc.)
function GenericTask({ task, p, readOnly, saving, onSelect }) {
  const isDone = !!p.status
  const statusColor = pftStatusColors[p.status] || '#4e6087'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
      <Dot done={isDone} color={statusColor} />
      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
      {readOnly
        ? (isDone ? <StatusPill status={p.status} color={statusColor} /> : <NotStarted />)
        : <select value={p.status || ''} onChange={e => onSelect(e.target.value)} disabled={saving} style={{ ...inputStyle, background: '#ffffff', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : '#d6e0ee', color: isDone ? statusColor : '#16264a' }}>
            <option value="">-- Select --</option>
            {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
          </select>
      }
      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
        <Dot done={handed} color="#1b9254" />
        <span style={{ fontSize: '13px', color: handed ? '#4e6087' : '#16264a', flex: 1 }}>Sent to Accountant Onboarding</span>
        {handed
          ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>
          : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Pending</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
        <Dot done={false} color="#0095ff" />
        <span style={{ fontSize: '13px', color: '#16264a', flex: 1 }}>Accountant onboarding progress</span>
        {handed
          ? <>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{onboarding.stage_label}</span>
              {!readOnly && <button onClick={() => onOpen(onboarding.id)} style={blueBtn}>View onboarding →</button>}
            </>
          : <span style={{ fontSize: '11px', color: '#697a9c' }}>—</span>}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0 5px 18px', borderBottom: '1px solid #e9eef8' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'transparent', border: '1px solid #c7d4e8', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#4e6087' }}>Discovery form — awaiting completion</span>
      </div>
    )
  }
  return (
    <div style={{ borderBottom: '1px solid #e9eef8', padding: '5px 0 5px 18px' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1b9254', flexShrink: 0 }} />
        <span style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, flex: 1 }}>View discovery form</span>
        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600 }}>Completed</span>
        <span style={{ color: '#4e6087', fontSize: '9px', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '10px 12px 4px 14px' }}>
          {DISCOVERY_FIELDS.map(([k, label]) => (
            <div key={k} style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
              <div style={{ fontSize: '12px', color: '#16264a', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{data[k] ? data[k] : '—'}</div>
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

      const expandState = {}
      loadedPhases.forEach(phase => {
        const isAssoc = phase.name.includes('VFO-Associate')
        const isFT = phase.name.includes('VFO-FT Accountant')
        if (isAssoc || isFT) {
          expandState[phase.id] = (isAssoc && decStatus === 'VFO Associate confirmed') || (isFT && decStatus === 'VFO FT confirmed')
          return
        }
        const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto' && !t.status_options?.startsWith('auto_'))
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
    await callApi('automation_PFT_decisionemail', { client_id: clientId, task_id: task.id, choice })
    const status = choice === 'vfo_ft' ? 'VFO FT confirmed' : choice === 'vfo_associate' ? 'VFO Associate confirmed' : 'No confirmed'
    const today = new Date().toISOString().split('T')[0]
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
    const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto' && !t.status_options?.startsWith('auto_'))
    if (tasks.length === 0) return 'done'
    if (tasks.every(t => progress[t.id]?.status)) return 'done'
    if (tasks.some(t => progress[t.id]?.status)) return 'active'
    return 'pending'
  }

  if (loading) return <PFTTrackSkeleton />

  const allTasksFlat = phases.flatMap(p => p.program_client_tasks || [])
  const gateTask = allTasksFlat.find(t => t.name === 'Does the Accountant need a third meeting?')
  const gateStatus = gateTask ? progress[gateTask.id]?.status : null
  const decisionStatus = allTasksFlat.filter(t => t.name === 'Accountant decision confirmation email').map(t => progress[t.id]?.status).find(s => s) || null
  const onboarding = engagement?.onboarding || null
  const eng = engagement?.engagement || null

  function renderTask(task, phase) {
    const p = progress[task.id] || {}

    // Right accountant questions are rendered inside the grouped a11 section
    if (['Right clients?', 'Right client relationships?', 'Right attitude (to change)?'].includes(task.name)) return null

    // Right accountant conclusion — grouped section
    if (task.status_options === 'auto_pft_a11') {
      const allTasks2 = phases.flatMap(ph => ph.program_client_tasks || [])
      const q1 = allTasks2.find(t => t.name === 'Right clients?')
      const q2 = allTasks2.find(t => t.name === 'Right client relationships?')
      const q3 = allTasks2.find(t => t.name === 'Right attitude (to change)?')
      const a11Val = getA11Status()
      const a11Color = a11Val === 'Yes' ? '#1b9254' : a11Val === 'No' ? '#e74c3c' : '#4e6087'
      const questions = [q1, q2, q3].filter(Boolean)
      return (
        <div key={task.id} style={{ borderBottom: '1px solid #e9eef8', padding: '7px 0' }}>
          <div style={{ fontSize: '12px', color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Right accountant?</div>
          <div style={{ marginLeft: '18px', borderLeft: '1px solid #ebf0f8', paddingLeft: '12px', paddingBottom: '4px' }}>
            {questions.map(q => {
              const qp = progress[q.id] || {}
              const qDone = !!qp.status
              const qColor = pftStatusColors[qp.status] || '#4e6087'
              return (
                <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: qDone ? qColor : 'transparent', flexShrink: 0, border: `1px solid ${qDone ? qColor : '#c7d4e8'}` }} />
                  <span style={{ fontSize: '12px', color: qDone ? '#4e6087' : '#16264a', flex: 1 }}>{q.name}</span>
                  {readOnly
                    ? (qDone ? <StatusPill status={qp.status} color={qColor} /> : <NotStarted />)
                    : <select value={qp.status || ''} onChange={e => saveTask(q.id, e.target.value, qp.completed_date)} disabled={saving[q.id]} style={{ ...inputStyle, background: '#ffffff', minWidth: '100px', fontSize: '11px', borderColor: qDone ? `${qColor}66` : '#d6e0ee', color: qDone ? qColor : '#16264a' }}>
                        <option value="">-- Select --</option>
                        {(q.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                  }
                  <span style={dateSpanStyle}>{qDone && qp.completed_date ? formatDate(qp.completed_date) : ''}</span>
                </div>
              )
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', marginTop: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a11Val ? a11Color : 'transparent', flexShrink: 0, border: `1px solid ${a11Val ? a11Color : '#c7d4e8'}` }} />
              <span style={{ fontSize: '12px', color: '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
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
      const step = <MeetingStep task={task} meeting={mNum} p={p} readOnly={readOnly} onSend={(decision, d, t, z) => handleMeetingSend(task, mNum, decision, d, t, z)} />
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
      return <DecisionStep key={task.id} task={task} p={p} readOnly={readOnly} onChoose={(choice) => handleDecision(task, choice)} />
    }

    return <GenericTask key={task.id} task={task} p={p} readOnly={readOnly} saving={!!saving[task.id]} onSelect={(v) => saveTask(task.id, v, p.completed_date)} />
  }

  return (
    <div>
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
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto' && !t.status_options?.startsWith('auto_'))
        const doneTasks = nonAutoTasks.filter(t => progress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = '#002973'

        return (
          <div key={phase.id} style={{ background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden', opacity: phaseGreyedOut ? 0.3 : 1, pointerEvents: phaseGreyedOut ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? '#c7d4e8' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'PFT').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {isPhase6
                  ? (state === 'active'
                      ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>
                      : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Not started</span>)
                  : <>
                      {state === 'done' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                      {state === 'active' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                      {state === 'pending' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Not started</span>}
                    </>
                }
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#4e6087', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
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
