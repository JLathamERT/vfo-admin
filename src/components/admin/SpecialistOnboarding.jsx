import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { callApi, getSession } from '../../lib/api'
 
const STAGE_NAMES = ['', 'Preliminary Meeting', 'Detail Meetings', 'Due Diligence', 'Contract & Details', 'Going Live']
 
const STAGE2_CHECKLIST = [
  'Review SIF',
  'Discuss revenue share (detail)',
  'Any queries on contract?',
  'Technology capacity / ability to scale',
  'Tour of VFO Showroom',
  'Tour of VFO Skool',
  'Discuss background check options',
  'Explain benefits of MAX',
  'Explain VFO monthly license',
]
 
const STAGE4_FOLDER_ITEMS = [
  { key: 'bio_collected', label: 'Bio collected' },
  { key: 'headshot_collected', label: 'Headshot collected' },
  { key: 'signed_contracts_collected', label: 'Signed contracts collected' },
  { key: 'misc_docs_collected', label: 'Misc documents collected' },
  { key: 'tax_docs_collected', label: 'Tax documents collected' },
]

const STAGE4_DETAILS_BENEFITS = [
  { key: 'db_strategy_expertise', label: 'Strategy / Expertise' },
  { key: 'db_cutoff_date', label: 'Cut-off Date for Strategy' },
  { key: 'db_client_requirements', label: 'Client Requirements' },
  { key: 'db_investment_cost', label: 'Amount of Investment or Cost' },
  { key: 'db_ideal_client', label: 'Ideal Client Description' },
  { key: 'db_benefits_summary', label: 'Summary of Benefits' },
  { key: 'db_getting_started', label: 'Getting Started with a Client' },
  { key: 'db_process_steps', label: 'Steps of Professional Process' },
  { key: 'db_competitive_advantage', label: 'What Makes You Better Than the Competition' },
  { key: 'db_tax_audit_risk', label: 'Tax Planning Audit Risk Questionnaire' },
  { key: 'db_revenue_share', label: 'Revenue Share' },
]
 
const STAGE5_SKOOL_ITEMS = [
  { key: 'profile_created', label: 'Profile created', options: ['Completed'] },
  { key: 'intro_post', label: 'Introduction post made', options: ['Completed'] },
  { key: 'team_members_added', label: 'Additional team members added', options: ['Completed', 'N/A'] },
]

const SIF_FIELDS = [
  ['full_name', 'Full Name'],
  ['company_name', 'Company Name'],
  ['address', 'Address'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['website_url', 'Website URL'],
  ['time_zone', 'Time Zone'],
  ['strategy_expertise', 'Strategy / Expertise'],
  ['cutoff_date', 'Cut-off Date for Strategy'],
  ['client_requirements', 'Client Requirements'],
  ['investment_cost', 'Amount of Investment or Cost'],
  ['ideal_client', 'Ideal Client Description'],
  ['benefits_summary', 'Summary of Benefits'],
  ['getting_started', 'Getting Started with a Client'],
  ['process_steps', 'Steps of Professional Process'],
  ['competitive_advantage', 'What Makes You Better than the Competition'],
]
 
export default function SpecialistOnboarding() {
  const [view, setView] = useState('list')
  const [onboardings, setOnboardings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const session = getSession()
  const [searchParams] = useSearchParams()

  // Deep-link from a notification: ?onboarding=<id> opens that specialist's detail.
  useEffect(() => {
    const oid = searchParams.get('onboarding')
    if (oid) { setSelectedId(Number(oid)); setView('detail') }
  }, [searchParams])

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
 
  useEffect(() => { loadList() }, [])
 
  async function loadList() {
    setLoading(true)
    try {
      const data = await callApi('load_onboardings')
      setOnboardings(data.onboardings || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }
 
  async function createNew() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await callApi('create_onboarding', { specialist_name: newName.trim(), specialist_email: newEmail.trim() || null, created_by: session?.name || 'Admin' })
      setNewName('')
      setNewEmail('')
      setShowNew(false)
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
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff' }}>Specialist Onboarding</div>
        <button onClick={() => setShowNew(!showNew)} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ New Onboarding</button>
      </div>
 
      {showNew && (
        <div style={{ ...sectionStyle, marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Start New Onboarding</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Specialist Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email</label>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} disabled={creating || !newName.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: creating ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: creating ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>{creating ? 'Creating...' : 'Create'}</button>
            <button onClick={() => { setShowNew(false); setNewName(''); setNewEmail('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
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
            const stageColor = ob.status === 'stopped' ? '#e74c3c' : ob.status === 'completed' ? '#27ae60' : '#5b9fe6'
            return (
              <div key={ob.id} onClick={() => { setSelectedId(ob.id); setView('detail') }} style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '18px', marginBottom: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(91,159,230,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}>
                <div>
                  <div style={{ fontSize: '15px', color: '#fff', fontWeight: '500', marginBottom: '4px' }}>{ob.specialist_name}</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8' }}>{ob.specialist_email || 'No email'} · Started {ob.created_at?.split('T')[0]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: ob.status === 'stopped' ? 'rgba(231,76,60,0.15)' : ob.status === 'completed' ? 'rgba(39,174,96,0.15)' : 'rgba(91,159,230,0.15)', color: stageColor, border: `1px solid ${ob.status === 'stopped' ? 'rgba(231,76,60,0.3)' : ob.status === 'completed' ? 'rgba(39,174,96,0.3)' : 'rgba(91,159,230,0.3)'}` }}>
                    {ob.status === 'stopped' ? 'Stopped' : ob.status === 'completed' ? 'Completed' : `Stage ${ob.current_stage} · ${STAGE_NAMES[ob.current_stage]}`}
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
  const [progress, setProgress] = useState({})
  const [meetings, setMeetings] = useState([])
  const [votes, setVotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const session = getSession()
 
  useEffect(() => { loadDetail() }, [id])
 
  async function loadDetail() {
    setLoading(true)
    try {
      const data = await callApi('load_onboarding', { onboarding_id: id })
      setOb(data.onboarding)
      const prog = {}
      ;(data.progress || []).forEach(p => { prog[`${p.stage}-${p.task_key}`] = p })
      setProgress(prog)
      setMeetings(data.meetings || [])
      const v = {}
      ;(data.votes || []).forEach(vote => { v[`${vote.stage}-${vote.voter_name}`] = vote })
      setVotes(v)
      if (data.onboarding) {
        const o = data.onboarding
        const stageComplete = (s) => o.status === 'completed' ? true : o.current_stage > s
        setExpanded({ 1: !stageComplete(1), 2: !stageComplete(2), 3: !stageComplete(3), 4: !stageComplete(4), 5: !stageComplete(5) })
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }
 
  async function saveProgress(stage, taskKey, status, notes) {
    const key = `${stage}-${taskKey}`
    setSaving(p => ({ ...p, [key]: true }))
    try {
      const result = await callApi('save_onboarding_progress', { onboarding_id: id, stage, task_key: taskKey, status: status || 'completed', completed_by: session?.name || 'Admin', notes })
      setProgress(p => ({ ...p, [key]: result.progress }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }
 
  async function sendPrelimEmail(decision, date, time, tz) {
    try {
      await callApi('automation_SPECIALIST_prelimemail', { onboarding_id: id, decision, meeting_date: date || null, meeting_time: time || null, meeting_tz: tz || null })
    } catch (err) { console.error(err) }
  }

  async function saveVote(stage, voterName, vote) {
    const key = `${stage}-${voterName}`
    setSaving(p => ({ ...p, [key]: true }))
    try {
      const result = await callApi('save_onboarding_vote', { onboarding_id: id, stage, voter_name: voterName, vote })
      setVotes(v => ({ ...v, [key]: result.vote }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }
 
  async function updateOnboarding(updates) {
    try {
      const result = await callApi('update_onboarding', { onboarding_id: id, ...updates })
      setOb(result.onboarding)
    } catch (err) { console.error(err) }
  }
 
  async function advanceStage() {
    if (!ob || ob.current_stage >= 5) return
    await updateOnboarding({ current_stage: ob.current_stage + 1 })
  }
 
  async function stopOnboarding() {
    await updateOnboarding({ status: 'stopped' })
  }
 
  async function completeOnboarding() {
    await updateOnboarding({ status: 'completed' })
  }
 
  function getTaskStatus(stage, key) {
    const s = progress[`${stage}-${key}`]?.status
    return (s && s !== 'unchecked') ? s : null
  }
 
  function getVote(stage, voter) {
    return votes[`${stage}-${voter}`]?.vote || null
  }
 
  function getStageState(stage) {
    if (ob?.status === 'stopped') return ob?.current_stage > stage ? 'done' : ob?.current_stage === stage ? 'active' : 'pending'
    if (ob?.current_stage > stage) return 'done'
    if (ob?.current_stage === stage) return 'active'
    return 'pending'
  }
 
  const inputStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0d2a6e', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }
 
  if (loading) return <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', textAlign: 'center', color: '#8bacc8' }}>Loading...</div>
  if (!ob) return <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', textAlign: 'center', color: '#8bacc8' }}>Not found.</div>
 
  const isStopped = ob.status === 'stopped'
  const isCompleted = ob.status === 'completed'
 
  function StageBadge({ stage }) {
    const state = getStageState(stage)
    if (state === 'done') return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>
    if (state === 'active') return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress</span>
    return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
  }
 
  function StageHeader({ stage, title }) {
    const state = getStageState(stage)
    const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
    const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
    const dotBorder = state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor
    const titleColor = state === 'active' ? '#5b9fe6' : '#fff'
    const isExpanded = expanded[stage]
 
    return (
      <div style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
          <div onClick={() => setExpanded(p => ({ ...p, [stage]: !p[stage] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${dotBorder}`, flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StageBadge stage={stage} />
            <span onClick={() => setExpanded(p => ({ ...p, [stage]: !p[stage] }))} style={{ color: '#8bacc8', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
          </div>
        </div>
        {isExpanded && ob.current_stage >= stage && (
          <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
            {stage === 1 && <Stage1Content />}
            {stage === 2 && <Stage2Content />}
            {stage === 3 && <Stage3Content />}
            {stage === 4 && <Stage4Content />}
            {stage === 5 && <Stage5Content />}
          </div>
        )}
        {isExpanded && ob.current_stage < stage && (
          <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
            {stage === 1 && <Stage1Content />}
            {stage === 2 && <Stage2Content />}
            {stage === 3 && <Stage3Content />}
            {stage === 4 && <Stage4Content />}
            {stage === 5 && <Stage5Content />}
          </div>
        )}
      </div>
    )
  }
 
  function AutoStep({ done, label, detail }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>{label}</span>
        {detail && <span style={{ fontSize: '11px', color: '#5a8ab5', marginRight: '8px' }}>{detail}</span>}
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: done ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: done ? '#27ae60' : '#8bacc8', border: `1px solid ${done ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.1)'}` }}>{done ? 'Completed' : 'Not completed'}</span>
      </div>
    )
  }
 
  function CheckItem({ done, label, onClick, toggle }) {
    const clickable = !isStopped && (toggle || !done)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div onClick={() => clickable && onClick?.()} style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, background: done ? '#27ae60' : 'transparent', cursor: clickable ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', flexShrink: 0 }}>{done ? '✓' : ''}</div>
        <span style={{ fontSize: '13px', color: done ? '#8bacc8' : '#fff', textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
      </div>
    )
  }
 
  function ActionButton({ label, onClick, color = '#5b9fe6', disabled = false }) {
    const bg = color === '#27ae60' ? 'rgba(39,174,96,0.15)' : color === '#e74c3c' ? 'rgba(231,76,60,0.15)' : color === '#f39c12' ? 'rgba(243,156,18,0.15)' : 'rgba(91,159,230,0.15)'
    const border = color === '#27ae60' ? 'rgba(39,174,96,0.4)' : color === '#e74c3c' ? 'rgba(231,76,60,0.4)' : color === '#f39c12' ? 'rgba(243,156,18,0.4)' : 'rgba(91,159,230,0.4)'
    return (
      <button onClick={onClick} disabled={disabled || isStopped} style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11px', cursor: disabled || isStopped ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', background: bg, border: `1px solid ${border}`, color, whiteSpace: 'nowrap' }}>{label}</button>
    )
  }
 
  function VotePanel({ stage }) {
    return (
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
        {['Anton Anderson', 'Paul Latham'].map(voter => {
          const v = getVote(stage, voter)
          return (
            <div key={voter} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '8px' }}>{voter}</div>
              {!v ? (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8', border: '1px solid rgba(255,255,255,0.1)' }}>Awaiting response</span>
              ) : (
                <span style={{ fontSize: '12px', color: v === 'confirm' ? '#27ae60' : '#f39c12', fontWeight: '600' }}>
                  {v === 'confirm' ? '✓ Confirmed' : '⚠ Further questions'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }
 
  function SectionLabel({ children }) {
    return <div style={{ fontSize: '11px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', marginTop: '14px' }}>{children}</div>
  }
 
  function Stage1Content() {
    const decision = getTaskStatus(1, 'decision')
    const [showDate, setShowDate] = useState(false)
    const [meetingDate, setMeetingDate] = useState('')
    const [meetingTime, setMeetingTime] = useState('')
    const [meetingTz, setMeetingTz] = useState('ET')
    const [sifOpen, setSifOpen] = useState(false)
    const [pending, setPending] = useState(null)

    const isDone = !!decision
    const statusColor = decision === 'stop' ? '#e74c3c' : '#27ae60'
    const statusLabel = decision === 'continue'
      ? `Continuing - next meeting ${progress['1-decision']?.notes || ''}`
      : decision === 'continue_no_date'
        ? 'Continuing - date not yet arranged'
        : decision === 'stop'
          ? 'Declined - email sent'
          : ''

    const greenBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }
    const redBtn = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }
    const cancelBtn = { padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8bacc8' }

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
          <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>Post-meeting decision</span>
          {isDone
            ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{statusLabel}</span>
            : showDate
              ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '11px' }} />
                  <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '11px' }} />
                  <select value={meetingTz} onChange={e => setMeetingTz(e.target.value)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: '#0d2a6e', color: '#fff', fontSize: '11px' }}>
                    <option value="ET">Eastern (ET)</option>
                    <option value="CT">Central (CT)</option>
                    <option value="MT">Mountain (MT)</option>
                    <option value="PT">Pacific (PT)</option>
                    <option value="AKT">Alaska (AKT)</option>
                    <option value="HT">Hawaii (HT)</option>
                  </select>
                  <button onClick={async () => { if (!meetingDate || pending) return; setPending('continue'); await sendPrelimEmail('continue', meetingDate, meetingTime, meetingTz); saveProgress(1, 'decision', 'continue', meetingDate + (meetingTime ? ' ' + meetingTime : '') + (meetingTime && meetingTz ? ' ' + meetingTz : '')); saveProgress(1, 'email_sent', 'completed'); advanceStage() }} disabled={!meetingDate || !!pending} style={{ ...greenBtn, opacity: (!meetingDate || pending) ? 0.6 : 1, cursor: (!meetingDate || pending) ? 'not-allowed' : 'pointer' }}>{pending === 'continue' ? 'Sending…' : 'Send'}</button>
                  <button onClick={() => !pending && setShowDate(false)} disabled={!!pending} style={cancelBtn}>Cancel</button>
                </div>
              : <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setShowDate(true)} disabled={isStopped || !!pending} style={{ ...greenBtn, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}>Continue - Send email (with date)</button>
                  <button onClick={async () => { if (pending) return; setPending('continue_no_date'); await sendPrelimEmail('continue_no_date'); saveProgress(1, 'decision', 'continue_no_date'); saveProgress(1, 'email_sent', 'completed'); advanceStage() }} disabled={isStopped || !!pending} style={{ ...greenBtn, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}>{pending === 'continue_no_date' ? 'Sending…' : 'Continue - date not yet arranged'}</button>
                  <button onClick={async () => { if (pending) return; setPending('stop'); await sendPrelimEmail('stop'); await saveProgress(1, 'decision', 'stop'); await stopOnboarding() }} disabled={isStopped || !!pending} style={{ ...redBtn, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}>{pending === 'stop' ? 'Sending…' : 'Stop - Send email'}</button>
                </div>
          }
        </div>

        {decision && decision !== 'stop' && (() => {
          const emailSent = !!getTaskStatus(1, 'email_sent')
          const autoStep = (label, done) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
              <span style={{ fontSize: '12px', color: done ? '#27ae60' : '#8bacc8' }}>{label}</span>
              {done && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', marginLeft: 'auto' }}>Done</span>}
            </div>
          )
          const sifDone = !!ob.sif_submitted_at
          const sifData = ob.sif_data || {}
          const aipcDone = emailSent && sifDone
          return (
            <div style={{ padding: '7px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aipcDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${aipcDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                <span style={{ fontSize: '13px', color: '#fff', flex: 1, fontWeight: '600' }}>AI PC Admin</span>
              </div>
              <div style={{ marginLeft: '18px', padding: '8px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {autoStep('Email sent to potential VFO specialist (SIF form, rev share examples, template agreement attached)', emailSent)}
                <div>
                  <div onClick={() => sifDone && setSifOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: sifDone ? 'pointer' : 'default' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: sifDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${sifDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                    <span style={{ fontSize: '12px', color: sifDone ? '#27ae60' : '#8bacc8' }}>SIF form completed by potential specialist</span>
                    {sifDone
                      ? <>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', marginLeft: 'auto' }}>Done</span>
                          <span style={{ color: '#8bacc8', fontSize: '9px', transform: sifOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                        </>
                      : <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8', marginLeft: 'auto' }}>Awaiting</span>}
                  </div>
                  {sifDone && sifOpen && (
                    <div style={{ padding: '10px 12px 4px 16px' }}>
                      {SIF_FIELDS.map(([k, label]) => (
                        <div key={k} style={{ marginBottom: '10px' }}>
                          <div style={{ fontSize: '10px', fontWeight: 700, color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '12px', color: '#fff', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{sifData[k] ? sifData[k] : '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </>
    )
  }
 
  function Stage2MeetingButtons({ onLogMeeting, onLogStop, blockSend, allComplete }) {
    const [showDateInput, setShowDateInput] = useState(false)
    const [meetingDate, setMeetingDate] = useState('')
    const [meetingTime, setMeetingTime] = useState('')
    const [meetingTz, setMeetingTz] = useState('ET')
    const [sending, setSending] = useState(null) // 'meeting' | 'stop'

    const inStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#0d2a6e', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }

    async function doMeeting(date, time, tz) {
      if (sending) return
      setSending('meeting')
      try { await onLogMeeting(date, time, tz) } finally { setSending(null); setShowDateInput(false) }
    }
    async function doStop() {
      if (sending) return
      setSending('stop')
      try { await onLogStop() } finally { setSending(null) }
    }

    return (
      <div style={{ marginTop: '12px', marginBottom: '12px' }}>
        {!showDateInput ? (
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {allComplete ? (
                <ActionButton label={sending === 'meeting' ? 'Sending…' : 'Still interested — Send email'} onClick={() => doMeeting()} color="#27ae60" disabled={!!sending || blockSend} />
              ) : (
                <>
                  <ActionButton label="Still interested — Send email (with date)" onClick={() => setShowDateInput(true)} color="#27ae60" disabled={!!sending || blockSend} />
                  <ActionButton label={sending === 'meeting' ? 'Sending…' : 'Still interested — date not yet arranged'} onClick={() => doMeeting()} color="#27ae60" disabled={!!sending || blockSend} />
                </>
              )}
              <ActionButton label={sending === 'stop' ? 'Sending…' : 'Stop — Send email'} onClick={doStop} color="#e74c3c" disabled={!!sending} />
            </div>
            {blockSend && <div style={{ fontSize: '11px', color: '#f39c12', marginTop: '6px' }}>Fill in the revenue share proposal above before sending.</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#8bacc8' }}>Next meeting:</span>
            <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={inStyle} />
            <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} style={inStyle} />
            <select value={meetingTz} onChange={e => setMeetingTz(e.target.value)} style={inStyle}>
              <option value="ET">Eastern (ET)</option>
              <option value="CT">Central (CT)</option>
              <option value="MT">Mountain (MT)</option>
              <option value="PT">Pacific (PT)</option>
              <option value="AKT">Alaska (AKT)</option>
              <option value="HT">Hawaii (HT)</option>
            </select>
            <ActionButton label={sending === 'meeting' ? 'Sending…' : 'Confirm & Send email'} onClick={() => { if (!meetingDate) return; doMeeting(meetingDate, meetingTime, meetingTz) }} color="#27ae60" disabled={!meetingDate || !!sending || blockSend} />
            <ActionButton label="Cancel" onClick={() => setShowDateInput(false)} color="#5b9fe6" disabled={!!sending} />
          </div>
        )}
      </div>
    )
  }

  function Stage2Content() {
    // Build meeting history from progress keys
    const meetingCount = meetings.length
    
    // Figure out which items have been locked by previous meetings
    const lockedItems = new Set()
    meetings.forEach(m => {
      (m.items_discussed || []).forEach(item => lockedItems.add(item))
    })
    
    // All 9 items covered across all meetings?
    const allCovered = STAGE2_CHECKLIST.every((_, i) => lockedItems.has(String(i)) || getTaskStatus(2, `checklist_${i}`))
    const allLocked = STAGE2_CHECKLIST.every((_, i) => lockedItems.has(String(i)))
    const stoppedHere = isStopped && ob.current_stage >= 2  // stopped during Stage 2 (vs stopped earlier)
    
    const bothConfirm = getVote(2, 'Anton Anderson') === 'confirm' && getVote(2, 'Paul Latham') === 'confirm'
    const eitherQuestion = (getVote(2, 'Anton Anderson') === 'further_questions' || getVote(2, 'Paul Latham') === 'further_questions') && !bothConfirm
    const anyVote = getVote(2, 'Anton Anderson') || getVote(2, 'Paul Latham')

    const [revSharePercent, setRevSharePercent] = useState('')
    const [submittingRevShare, setSubmittingRevShare] = useState(false)
    const [revProposal, setRevProposal] = useState('')
    const [revOpen, setRevOpen] = useState({})
    const revShareCheckedThisMeeting = !!getTaskStatus(2, 'checklist_1') && !lockedItems.has('1')
    async function submitRevShareProposal() {
      if (!revSharePercent) return
      setSubmittingRevShare(true)
      try {
        await saveProgress(2, 'rev_share_prepared', 'completed', revSharePercent.trim())
      } catch (err) { console.error(err) }
      finally { setSubmittingRevShare(false) }
    }

    // Toggle a checklist item on/off (editable until the meeting is submitted).
    // 'unchecked' is treated as not-done by getTaskStatus.
    function toggleChecklist(index) {
      const done = !!getTaskStatus(2, `checklist_${index}`)
      saveProgress(2, `checklist_${index}`, done ? 'unchecked' : 'completed')
    }

    async function logMeeting(date, time, tz) {
      // Gather currently checked items that aren't already locked
      const newlyChecked = []
      STAGE2_CHECKLIST.forEach((_, i) => {
        if (getTaskStatus(2, `checklist_${i}`) && !lockedItems.has(String(i))) {
          newlyChecked.push(String(i))
        }
      })
      if (newlyChecked.length === 0) return

      const completedIdx = [...lockedItems, ...newlyChecked]
      const completedLabels = STAGE2_CHECKLIST.filter((_, i) => completedIdx.includes(String(i)))
      const pendingLabels = STAGE2_CHECKLIST.filter((_, i) => !completedIdx.includes(String(i)))
      const revThisMeeting = newlyChecked.includes('1')  // index 1 = Discuss revenue share (detail)

      // Save the meeting first (carries the rev-share proposal + mints its token),
      // then send the in-progress email referencing that meeting so the proposal
      // block + Approve/Propose-edit buttons can be injected.
      const noteParts = [date, time, tz].filter(Boolean)
      let meetingId = null
      try {
        const result = await callApi('save_onboarding_meeting', {
          onboarding_id: id,
          meeting_date: new Date().toISOString().split('T')[0],
          items_discussed: completedIdx,
          outcome: 'interested',
          notes: noteParts.length ? `Next meeting: ${noteParts.join(' ')}` : 'Next meeting date not yet arranged',
          created_by: session?.name || 'Admin',
          rev_proposal_text: revThisMeeting ? revProposal.trim() : null,
        })
        meetingId = result.meeting?.id
        setMeetings(prev => [result.meeting, ...prev])
      } catch (err) { console.error(err) }

      try {
        await callApi('automation_SPECIALIST_stage2email', { onboarding_id: id, meeting_id: meetingId, completed: completedLabels, pending: pendingLabels, meeting_date: date || null, meeting_time: time || null, meeting_tz: tz || null })
      } catch (err) { console.error(err) }
    }

    async function logStop() {
      // Send the decline (No) email — same as the Stage 1 Stop email
      try { await sendPrelimEmail('stop') } catch (err) { console.error(err) }
      try {
        // Gather all currently checked items
        const allChecked = []
        STAGE2_CHECKLIST.forEach((_, i) => {
          if (getTaskStatus(2, `checklist_${i}`) || lockedItems.has(String(i))) {
            allChecked.push(String(i))
          }
        })
        const result = await callApi('save_onboarding_meeting', {
          onboarding_id: id,
          meeting_date: new Date().toISOString().split('T')[0],
          items_discussed: allChecked,
          outcome: 'stopped',
          created_by: session?.name || 'Admin',
        })
        setMeetings(prev => [result.meeting, ...prev])
        await saveProgress(2, 'decision', 'stop')
        await stopOnboarding()
      } catch (err) { console.error(err) }
    }

    // Items remaining (not locked by previous meetings)
    const remainingItems = STAGE2_CHECKLIST.map((item, i) => ({ item, index: i })).filter(({ index }) => !lockedItems.has(String(index)))
    // This send will cover every item -> no next meeting, so no date/no-date split.
    const allComplete = remainingItems.length > 0 && remainingItems.every(({ index }) => !!getTaskStatus(2, `checklist_${index}`))

    return (
      <>
        {/* Previous meetings */}
        {[...meetings].reverse().map((meeting, mi) => {
          const discussed = meeting.items_discussed || []
          // Items that were NEW in this meeting (not in previous meetings)
          const previousMeetings = [...meetings].reverse().slice(0, mi)
          const previousItems = new Set()
          previousMeetings.forEach(pm => (pm.items_discussed || []).forEach(item => previousItems.add(item)))
          const newInThisMeeting = discussed.filter(idx => !previousItems.has(idx))
          
          return (
            <div key={meeting.id} style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#5b9fe6', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meeting {mi + 1}</span>
                <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{meeting.meeting_date} · {meeting.created_by}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#8bacc8', marginBottom: '4px' }}>Covered in this meeting:</div>
              {newInThisMeeting.map(idx => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 0' }}>
                  <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid #27ae60', background: '#27ae60', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', flexShrink: 0 }}>✓</div>
                  <span style={{ fontSize: '13px', color: '#8bacc8', textDecoration: 'line-through' }}>{STAGE2_CHECKLIST[parseInt(idx)]}</span>
                </div>
              ))}
              {meeting.outcome === 'stopped' && (
                <>
                  {STAGE2_CHECKLIST.map((item, i) => {
                    if (!(meeting.items_discussed || []).includes(String(i))) {
                      return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '3px 0' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: '#8bacc8' }}>{item}</span>
                      </div>
                    }
                    return null
                  })}
                  <div style={{ fontSize: '12px', color: '#e74c3c', fontWeight: '600', marginTop: '6px' }}>✗ Process stopped — email sent</div>
                </>
              )}
              {meeting.outcome === 'interested' && (
                <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '6px' }}>
                  ✓ Still interested — email sent
                  {meeting.notes && <span style={{ color: '#8bacc8', marginLeft: '8px' }}>({meeting.notes})</span>}
                </div>
              )}
              {meeting.rev_proposal_text && (() => {
                const resp = meeting.rev_proposal_response
                const respColor = resp === 'Approved' ? '#27ae60' : resp ? '#f39c12' : '#8bacc8'
                const open = !!revOpen[meeting.id]
                return (
                  <div style={{ marginTop: '10px', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600', marginBottom: '6px' }}>AI PC Admin</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#27ae60', flexShrink: 0, border: '1px solid #27ae60' }} />
                      <span style={{ fontSize: '12px', color: '#27ae60' }}>Revenue share proposal email sent to specialist</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', marginLeft: 'auto' }}>Done</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: resp ? respColor : 'transparent', flexShrink: 0, border: `1px solid ${resp ? respColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '12px', color: resp ? respColor : '#8bacc8' }}>Revenue share proposal outcome</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: resp ? `${respColor}22` : 'rgba(255,255,255,0.06)', color: respColor, marginLeft: 'auto' }}>{resp || 'Awaiting response'}</span>
                    </div>
                    <div onClick={() => setRevOpen(o => ({ ...o, [meeting.id]: !o[meeting.id] }))} style={{ fontSize: '11px', color: '#5b9fe6', cursor: 'pointer', marginTop: '8px' }}>{open ? '▼ Hide proposal' : '▶ View proposal'}</div>
                    {open && <div style={{ fontSize: '12px', color: '#8bacc8', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginTop: '6px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>{meeting.rev_proposal_text}</div>}
                  </div>
                )
              })()}
            </div>
          )
        })}

        {/* Current meeting section — live checklist + buttons. Hidden once the
            process is stopped: no clickable remaining items after a Stop (the
            meeting history above still shows what was/wasn't covered). */}
        {!allLocked && !stoppedHere && (
          <>
            <SectionLabel>{meetingCount === 0 ? 'Stage 2 Checklist' : `Meeting ${meetingCount + 1} — Remaining Items`}</SectionLabel>
            {remainingItems.map(({ item, index }) => (
              <CheckItem key={index} done={!!getTaskStatus(2, `checklist_${index}`)} label={item} toggle onClick={() => toggleChecklist(index)} />
            ))}

            {revShareCheckedThisMeeting && (
              <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.3)', background: 'rgba(255,255,255,0.02)', margin: '10px 0' }}>
                <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '8px' }}>Revenue Share Proposal — sent to the specialist with this email</div>
                <textarea value={revProposal} onChange={e => setRevProposal(e.target.value)} placeholder="Enter revenue share proposal details..." rows={5} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            )}

            {!isStopped && <Stage2MeetingButtons onLogMeeting={logMeeting} onLogStop={logStop} blockSend={revShareCheckedThisMeeting && !revProposal.trim()} allComplete={allComplete} />}
          </>
        )}

        {/* All items covered message */}
        {allLocked && !isStopped && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(39,174,96,0.3)', background: 'rgba(39,174,96,0.06)', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', color: '#27ae60' }}>✓ All Stage 2 items completed across {meetingCount} meeting{meetingCount !== 1 ? 's' : ''}.</span>
          </div>
        )}

        {/* Revenue share proposal — comes before Initial executive approval */}
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
        <SectionLabel>Revenue share proposal</SectionLabel>
        {!getTaskStatus(2, 'rev_share_prepared') ? (
          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.3)', background: 'rgba(255,255,255,0.02)', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '8px' }}>Revenue Share Proposal</div>
            <textarea value={revSharePercent} onChange={e => setRevSharePercent(e.target.value)} placeholder="Enter revenue share proposal details..." rows={6} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }} />
            <ActionButton label={submittingRevShare ? 'Submitting...' : 'Submit final revenue share proposal'} onClick={submitRevShareProposal} disabled={!revSharePercent.trim() || submittingRevShare} color="#27ae60" />
          </div>
        ) : (
          <RevShareDisplay notes={progress['2-rev_share_prepared']?.notes || ''} />
        )}
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />

        {/* Executive approval — read only, populated by email webhooks */}
        <>
            <SectionLabel>Initial executive approval</SectionLabel>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
              {['Anton Anderson', 'Paul Latham'].map(voter => {
                const v = getVote(2, voter)
                return (
                  <div key={voter} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '8px' }}>{voter}</div>
                    {!v ? (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8', border: '1px solid rgba(255,255,255,0.1)' }}>Awaiting response</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: v === 'confirm' ? '#27ae60' : '#f39c12', fontWeight: '600' }}>
                        {v === 'confirm' ? '✓ Confirmed' : '⚠ Further questions'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            
            {eitherQuestion && <div style={{ fontSize: '12px', color: '#f39c12', padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.06)', marginBottom: '12px' }}>Process paused — executive has further questions.</div>}
            {bothConfirm && <div style={{ fontSize: '11px', color: '#27ae60', marginBottom: '8px' }}>Both executives confirmed. Background check email triggered.</div>}
            
            <AutoStep done={!!getTaskStatus(2, 'bg_email_sent')} label="Background check email sent (Core $350 / Max $950)" />
            <AutoStep done={!!getTaskStatus(2, 'payment_received')} label="Payment received" detail={ob.background_check_type || ''} />
            {!getTaskStatus(2, 'payment_received') && bothConfirm && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <ActionButton label="Core selected" onClick={() => { saveProgress(2, 'bg_email_sent', 'completed'); saveProgress(2, 'payment_received', 'completed'); updateOnboarding({ background_check_type: 'Core' }) }} />
                <ActionButton label="Max selected" onClick={() => { saveProgress(2, 'bg_email_sent', 'completed'); saveProgress(2, 'payment_received', 'completed'); updateOnboarding({ background_check_type: 'Max' }) }} />
              </div>
            )}
            {getTaskStatus(2, 'payment_received') && ob.current_stage === 2 && (
              <div style={{ marginTop: '14px' }}><ActionButton label="Advance to Stage 3 →" onClick={advanceStage} /></div>
            )}
        </>
      </>
    )
  }
 
  function RevShareDisplay({ notes }) {
    const [open, setOpen] = useState(false)
    return (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60', flexShrink: 0, border: '1.5px solid #27ae60' }} />
          <span style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600' }}>Revenue share proposal submitted</span>
        </div>
        <div onClick={() => setOpen(o => !o)} style={{ fontSize: '11px', color: '#5b9fe6', cursor: 'pointer' }}>{open ? '▼ Hide proposal' : '▶ View proposal'}</div>
        {open && notes && (
          <div style={{ fontSize: '12px', color: '#8bacc8', lineHeight: '1.6', whiteSpace: 'pre-wrap', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginTop: '6px' }}>
            {notes}
          </div>
        )}
      </div>
    )
  }

  function Stage3Content() {
    const bgInitiated = !!getTaskStatus(3, 'bg_initiated')
    const ddStatus = getTaskStatus(3, 'dd_checklist')
    const bgResult = getTaskStatus(3, 'bg_results_received')
    const ddDone = ddStatus === 'completed'
    const bgDone = bgResult === 'passed'
    const bgFailed = bgResult === 'failed'
    const allDone = ddDone && bgDone

    return (
      <>
        {/* 1. Tracy confirms background check sent */}
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: bgInitiated ? '#27ae60' : 'transparent', border: `1.5px solid ${bgInitiated ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: bgInitiated ? '#fff' : '#8bacc8' }}>Background check sent{ob.background_check_type ? ` to ${ob.background_check_type === 'Max' ? 'Scherzer International' : 'Checkr'}` : ''}</span>
            {ob.background_check_type && <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.2)' }}>{ob.background_check_type}</span>}
          </div>
          {!bgInitiated && <ActionButton label="Background check sent" onClick={() => { saveProgress(3, 'bg_initiated', 'completed'); saveProgress(3, 'dd_email_sent', 'completed') }} />}
        </div>

        {/* 2. Auto: DD checklist email — fires when Tracy clicks above */}
        
        <AutoStep done={!!getTaskStatus(3, 'dd_email_sent')} label="DD checklist email sent to specialist" />

        {/* 3. DD checklist response — read-only, populated by email */}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>DD checklist</span>
          {!ddStatus ? (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8', border: '1px solid rgba(255,255,255,0.1)', marginLeft: 'auto' }}>Not completed</span>
          ) : ddStatus === 'help_requested' ? (
            <span style={{ fontSize: '12px', color: '#f39c12', fontWeight: '600', marginLeft: 'auto' }}>⚠ Specialist needs help — Tracy notified</span>
          ) : ddStatus === 'completed' ? (
            <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', marginLeft: 'auto' }}>✓ Completed</span>
          ) : null}
        </div>

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />


        {/* 5. Auto: revenue share email — fires when form submitted */}
        

        {/* 6. Revenue share response — read-only, populated by email */}
        

        {/* 7. Background check results — Tracy clicks Passed or Failed */}
        <SectionLabel>Background check results</SectionLabel>
        {!bgResult ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>Background check results</span>
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <ActionButton label="Passed" onClick={async () => { await saveProgress(3, 'bg_results_received', 'passed'); if (ddDone) advanceStage() }} color="#27ae60" />
              <ActionButton label="Failed" onClick={() => { saveProgress(3, 'bg_results_received', 'failed'); stopOnboarding() }} color="#e74c3c" />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>Background check results</span>
            <span style={{ fontSize: '12px', color: bgDone ? '#27ae60' : '#e74c3c', fontWeight: '600', marginLeft: 'auto' }}>{bgDone ? '✓ Passed' : '✗ Failed'}</span>
          </div>
        )}

        {/* Gate */}
        {bgFailed && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(231,76,60,0.3)', background: 'rgba(231,76,60,0.06)', marginTop: '14px', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', color: '#e74c3c' }}>✗ Background check failed — onboarding stopped</span>
          </div>
        )}
        <AutoStep done={allDone} label="Email sent — Step 3 complete, moving to Step 4" />
      </>
    )
  }

  function DetailsAndBenefits({ getTaskStatus, saveProgress, isStopped }) {
    const completedCount = STAGE4_DETAILS_BENEFITS.filter(item => getTaskStatus(4, item.key)).length
    const allDone = completedCount === STAGE4_DETAILS_BENEFITS.length

    return (
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
          <span style={{ fontSize: '13px', color: allDone ? '#27ae60' : '#fff', fontWeight: '500', flex: 1 }}>{allDone ? '✓ ' : ''}Details & benefits</span>
          <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{completedCount}/{STAGE4_DETAILS_BENEFITS.length}</span>
        </div>
        <div style={{ paddingLeft: '16px', paddingBottom: '8px' }}>
          {STAGE4_DETAILS_BENEFITS.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
              <div onClick={() => !isStopped && !getTaskStatus(4, item.key) && saveProgress(4, item.key, 'completed')} style={{ width: '14px', height: '14px', borderRadius: '3px', border: `1.5px solid ${getTaskStatus(4, item.key) ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, background: getTaskStatus(4, item.key) ? '#27ae60' : 'transparent', cursor: getTaskStatus(4, item.key) || isStopped ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', flexShrink: 0 }}>{getTaskStatus(4, item.key) ? '✓' : ''}</div>
              <span style={{ fontSize: '12px', color: getTaskStatus(4, item.key) ? '#8bacc8' : '#fff', textDecoration: getTaskStatus(4, item.key) ? 'line-through' : 'none' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
 
  function Stage4Content() {
    const bothConfirm = getVote(4, 'Anton Anderson') === 'confirm' && getVote(4, 'Paul Latham') === 'confirm'
    const eitherQuestion = (getVote(4, 'Anton Anderson') === 'further_questions' || getVote(4, 'Paul Latham') === 'further_questions') && !bothConfirm
    const allFolderDone = STAGE4_FOLDER_ITEMS.every(item => getTaskStatus(4, item.key)) && STAGE4_DETAILS_BENEFITS.every(item => getTaskStatus(4, item.key))
 
    return (
      <>
        
        <AutoStep done={ob.current_stage >= 4} label="Final executive approval emails sent" />
 
        <SectionLabel>Final executive approval</SectionLabel>
        <VotePanel stage={4} />
        {eitherQuestion && <div style={{ fontSize: '12px', color: '#f39c12', padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.06)', marginBottom: '12px' }}>Process paused — executive has further questions.</div>}
 
        {bothConfirm && <div style={{ fontSize: '11px', color: '#27ae60', marginBottom: '8px' }}>Both executives confirmed.</div>}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
        
        <AutoStep done={!!getTaskStatus(4, 'agreement_created')} label="VFO Specialist Agreement created" />
        <AutoStep done={!!getTaskStatus(4, 'specialist_signed')} label="VFO Specialist Agreement signed by specialist" />
        <AutoStep done={!!getTaskStatus(4, 'ert_signed')} label="VFO Specialist Agreement signed by ERT" />
        <AutoStep done={!!getTaskStatus(4, 'license_setup')} label="VFO license payment set up ($99/mo)" />

        {!getTaskStatus(4, 'license_setup') && bothConfirm && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {!getTaskStatus(4, 'agreement_created') && <ActionButton label="Mark agreement created" onClick={() => saveProgress(4, 'agreement_created', 'completed')} />}
            {getTaskStatus(4, 'agreement_created') && !getTaskStatus(4, 'specialist_signed') && <ActionButton label="Mark specialist signed" onClick={() => saveProgress(4, 'specialist_signed', 'completed')} />}
            {getTaskStatus(4, 'specialist_signed') && !getTaskStatus(4, 'ert_signed') && <ActionButton label="Mark ERT signed" onClick={() => saveProgress(4, 'ert_signed', 'completed')} />}
            {getTaskStatus(4, 'ert_signed') && !getTaskStatus(4, 'license_setup') && <ActionButton label="Mark license set up" onClick={() => saveProgress(4, 'license_setup', 'completed')} />}
          </div>
        )}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
        <SectionLabel>Personal folder</SectionLabel>
        <CheckItem done={!!getTaskStatus(4, 'bio_collected')} label="Bio collected" onClick={async () => { await saveProgress(4, 'bio_collected', 'completed'); const allDone = ['headshot_collected','signed_contracts_collected','misc_docs_collected','tax_docs_collected'].every(k => getTaskStatus(4, k)) && STAGE4_DETAILS_BENEFITS.every(i => getTaskStatus(4, i.key)); if (allDone && ob.current_stage === 4) advanceStage() }} />
        <CheckItem done={!!getTaskStatus(4, 'headshot_collected')} label="Headshot collected" onClick={async () => { await saveProgress(4, 'headshot_collected', 'completed'); const allDone = ['bio_collected','signed_contracts_collected','misc_docs_collected','tax_docs_collected'].every(k => getTaskStatus(4, k)) && STAGE4_DETAILS_BENEFITS.every(i => getTaskStatus(4, i.key)); if (allDone && ob.current_stage === 4) advanceStage() }} />

        <DetailsAndBenefits getTaskStatus={getTaskStatus} saveProgress={saveProgress} isStopped={isStopped} />

        <CheckItem done={!!getTaskStatus(4, 'signed_contracts_collected')} label="Signed contracts collected" onClick={async () => { await saveProgress(4, 'signed_contracts_collected', 'completed'); const allDone = ['bio_collected','headshot_collected','misc_docs_collected','tax_docs_collected'].every(k => getTaskStatus(4, k)) && STAGE4_DETAILS_BENEFITS.every(i => getTaskStatus(4, i.key)); if (allDone && ob.current_stage === 4) advanceStage() }} />
        <CheckItem done={!!getTaskStatus(4, 'misc_docs_collected')} label="Misc documents collected" onClick={async () => { await saveProgress(4, 'misc_docs_collected', 'completed'); const allDone = ['bio_collected','headshot_collected','signed_contracts_collected','tax_docs_collected'].every(k => getTaskStatus(4, k)) && STAGE4_DETAILS_BENEFITS.every(i => getTaskStatus(4, i.key)); if (allDone && ob.current_stage === 4) advanceStage() }} />
        <CheckItem done={!!getTaskStatus(4, 'tax_docs_collected')} label="Tax documents collected" onClick={async () => { await saveProgress(4, 'tax_docs_collected', 'completed'); const allDone = ['bio_collected','headshot_collected','signed_contracts_collected','misc_docs_collected'].every(k => getTaskStatus(4, k)) && STAGE4_DETAILS_BENEFITS.every(i => getTaskStatus(4, i.key)); if (allDone && ob.current_stage === 4) advanceStage() }} />
        
      </>
    )
  }
 
  function TeamMembersInput({ currentNotes, onSave }) {
    const [names, setNames] = useState(currentNotes)
    const [saved, setSaved] = useState(false)

    async function handleSave() {
      await onSave(names)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }

    return (
      <div style={{ padding: '10px 0 10px 26px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '6px' }}>Team member names</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea value={names} onChange={e => { setNames(e.target.value); setSaved(false) }} placeholder="Enter team member names..." rows={2} style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', resize: 'vertical' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <ActionButton label={saved ? '✓ Saved' : 'Save'} onClick={handleSave} color={saved ? '#27ae60' : '#5b9fe6'} disabled={saved} />
          </div>
        </div>
      </div>
    )
  }

  function Stage5Content() {
    return (
      <>
        <SectionLabel>VFO Skool</SectionLabel>
        {STAGE5_SKOOL_ITEMS.map(item => {
          const status = getTaskStatus(5, item.key)
          if (item.options.length === 1) {
            return <CheckItem key={item.key} done={!!status} label={item.label} onClick={() => saveProgress(5, item.key, 'Completed')} />
          }
          return (
            <div key={item.key}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '13px', color: '#fff' }}>{item.label}</span>
                <select value={status || ''} onChange={e => e.target.value && saveProgress(5, item.key, e.target.value)} disabled={isStopped} style={{ ...inputStyle, minWidth: '120px', borderColor: status ? 'rgba(39,174,96,0.4)' : 'rgba(255,255,255,0.15)', color: status ? '#27ae60' : '#fff' }}>
                  <option value="">-- Select --</option>
                  {item.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {item.key === 'team_members_added' && status === 'Completed' && (
                <TeamMembersInput onboarding_id={id} currentNotes={progress['5-team_members_added']?.notes || ''} onSave={(notes) => saveProgress(5, 'team_members_added', 'Completed', notes)} />
              )}
            </div>
          )
        })}
 
        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
 
        <SectionLabel>VFO Showroom</SectionLabel>
        {!getTaskStatus(5, 'added_to_showroom') ? (
          <button onClick={() => { saveProgress(5, 'added_to_showroom', 'completed'); completeOnboarding() }} disabled={isStopped} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: isStopped ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', width: '100%' }}>Add to VFO Showroom</button>
        ) : (
          <div style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600', textAlign: 'center', padding: '10px' }}>✓ Added to VFO Showroom — Onboarding Complete</div>
        )}
      </>
    )
  }
 
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#5b9fe6', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>← Back to list</button>
 
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff', marginBottom: '4px' }}>{ob.specialist_name}</div>
          <div style={{ fontSize: '13px', color: '#8bacc8' }}>{ob.specialist_email || 'No email'} · Started {ob.created_at?.split('T')[0]}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {isStopped && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(231,76,60,0.15)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)' }}>Stopped</span>}
          {isCompleted && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Completed</span>}
          {!isStopped && !isCompleted && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>Stage {ob.current_stage} · {STAGE_NAMES[ob.current_stage]}</span>}
        </div>
      </div>
 
      <StageHeader stage={1} title="Stage 1 — Preliminary Meeting" />
      <StageHeader stage={2} title="Stage 2 — Detail Meetings" />
      <StageHeader stage={3} title="Stage 3 — Due Diligence" />
      <StageHeader stage={4} title="Stage 4 — Contract & Details" />
      <StageHeader stage={5} title="Stage 5 — Going Live" />
    </div>
  )
}