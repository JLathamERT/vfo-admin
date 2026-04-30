import { useState, useEffect } from 'react'
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
  { key: 'details_benefits_collected', label: 'Details & benefits collected' },
  { key: 'signed_contracts_collected', label: 'Signed contracts collected' },
  { key: 'misc_docs_collected', label: 'Misc documents collected' },
  { key: 'tax_docs_collected', label: 'Tax documents collected' },
]
 
const STAGE5_SKOOL_ITEMS = [
  { key: 'profile_created', label: 'Profile created' },
  { key: 'intro_post', label: 'Introduction post made' },
  { key: 'team_members_added', label: 'Additional team members added' },
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
      if (data.onboarding) setExpanded(prev => ({ ...prev, [data.onboarding.current_stage]: true }))
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
    return progress[`${stage}-${key}`]?.status || null
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
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px', color: '#5a8ab5', fontSize: '13px' }}>Complete Stage {stage - 1} to unlock.</div>
        )}
      </div>
    )
  }
 
  function AutoStep({ done, label, detail }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', border: `1.5px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, flexShrink: 0 }} />
        <span style={{ fontSize: '13px', color: done ? '#fff' : '#8bacc8' }}>{label}</span>
        {detail && <span style={{ fontSize: '11px', color: '#5a8ab5', marginLeft: 'auto' }}>{detail}</span>}
      </div>
    )
  }
 
  function CheckItem({ done, label, onClick }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div onClick={() => !isStopped && !done && onClick?.()} style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, background: done ? '#27ae60' : 'transparent', cursor: done || isStopped ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#fff', flexShrink: 0 }}>{done ? '✓' : ''}</div>
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
                <span style={{ fontSize: '12px', color: '#5a8ab5', fontStyle: 'italic' }}>Awaiting response...</span>
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
    return (
      <>
        <SectionLabel>Post-meeting decision</SectionLabel>
        {!decision ? (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <ActionButton label="Continue — Send email" onClick={() => { saveProgress(1, 'decision', 'continue'); saveProgress(1, 'email_sent', 'completed') }} color="#27ae60" />
            <ActionButton label="Stop — Send email" onClick={() => { saveProgress(1, 'decision', 'stop'); stopOnboarding() }} color="#e74c3c" />
          </div>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: decision === 'continue' ? '#27ae60' : '#e74c3c', fontWeight: '600' }}>{decision === 'continue' ? '✓ Continuing' : '✗ Stopped'}</span>
          </div>
        )}
        <SectionLabel>Automated</SectionLabel>
        <AutoStep done={!!getTaskStatus(1, 'email_sent')} label="Email sent to potential VFO specialist" detail="DD form, rev share examples, template agreement" />
        {decision === 'continue' && ob.current_stage === 1 && (
          <div style={{ marginTop: '14px' }}>
            <ActionButton label="Advance to Stage 2 →" onClick={advanceStage} />
          </div>
        )}
      </>
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
    
    const bothConfirm = getVote(2, 'Anton Anderson') === 'confirm' && getVote(2, 'Paul Latham') === 'confirm'
    const eitherQuestion = (getVote(2, 'Anton Anderson') === 'further_questions' || getVote(2, 'Paul Latham') === 'further_questions') && !bothConfirm
    const anyVote = getVote(2, 'Anton Anderson') || getVote(2, 'Paul Latham')

    async function logMeeting() {
      // Gather currently checked items that aren't already locked
      const newlyChecked = []
      STAGE2_CHECKLIST.forEach((_, i) => {
        if (getTaskStatus(2, `checklist_${i}`) && !lockedItems.has(String(i))) {
          newlyChecked.push(String(i))
        }
      })
      if (newlyChecked.length === 0) return
      
      try {
        const result = await callApi('save_onboarding_meeting', {
          onboarding_id: id,
          meeting_date: new Date().toISOString().split('T')[0],
          items_discussed: [...lockedItems, ...newlyChecked],
          outcome: 'interested',
          created_by: session?.name || 'Admin',
        })
        setMeetings(prev => [result.meeting, ...prev])
      } catch (err) { console.error(err) }
    }

    async function logStop() {
      try {
        await callApi('save_onboarding_meeting', {
          onboarding_id: id,
          meeting_date: new Date().toISOString().split('T')[0],
          items_discussed: [...lockedItems],
          outcome: 'stopped',
          created_by: session?.name || 'Admin',
        })
        saveProgress(2, 'decision', 'stop')
        stopOnboarding()
      } catch (err) { console.error(err) }
    }

    // Items remaining (not locked by previous meetings)
    const remainingItems = STAGE2_CHECKLIST.map((item, i) => ({ item, index: i })).filter(({ index }) => !lockedItems.has(String(index)))

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
              {meeting.outcome === 'stopped' && <div style={{ fontSize: '12px', color: '#e74c3c', fontWeight: '600', marginTop: '6px' }}>✗ Process stopped</div>}
              {meeting.outcome === 'interested' && <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '6px' }}>✓ Still interested — email sent</div>}
            </div>
          )
        })}

        {/* Current meeting section — only if not all locked and not stopped */}
        {!allLocked && !isStopped && (
          <>
            <SectionLabel>{meetingCount === 0 ? 'Stage 2 Checklist' : `Meeting ${meetingCount + 1} — Remaining Items`}</SectionLabel>
            {remainingItems.map(({ item, index }) => (
              <CheckItem key={index} done={!!getTaskStatus(2, `checklist_${index}`)} label={item} onClick={() => saveProgress(2, `checklist_${index}`, 'completed')} />
            ))}

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <ActionButton label="Still interested — Send email" onClick={logMeeting} color="#27ae60" />
              <ActionButton label="Stop — Send email" onClick={logStop} color="#e74c3c" />
            </div>
            <div style={{ fontSize: '11px', color: '#5a8ab5', marginBottom: '12px' }}>Email includes completed/remaining items.</div>
          </>
        )}

        {/* All items covered message */}
        {allLocked && !isStopped && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(39,174,96,0.3)', background: 'rgba(39,174,96,0.06)', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', color: '#27ae60' }}>✓ All Stage 2 items completed across {meetingCount} meeting{meetingCount !== 1 ? 's' : ''}.</span>
          </div>
        )}

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
                      <span style={{ fontSize: '12px', color: '#5a8ab5', fontStyle: 'italic' }}>Awaiting response...</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: v === 'confirm' ? '#27ae60' : '#f39c12', fontWeight: '600' }}>
                        {v === 'confirm' ? '✓ Confirmed' : '⚠ Further questions'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {!anyVote && <div style={{ fontSize: '11px', color: '#5a8ab5', fontStyle: 'italic', marginBottom: '12px' }}>Executive approval emails sent — waiting for responses.</div>}
            {eitherQuestion && <div style={{ fontSize: '12px', color: '#f39c12', padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.06)', marginBottom: '12px' }}>Process paused — executive has further questions.</div>}
            {bothConfirm && <div style={{ fontSize: '11px', color: '#27ae60', marginBottom: '8px' }}>Both executives confirmed. Background check email triggered.</div>}
            <SectionLabel>Automated</SectionLabel>
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
 
  function Stage3Content() {
    const [revSharePercent, setRevSharePercent] = useState('')
    const [submittingRevShare, setSubmittingRevShare] = useState(false)

    const bgInitiated = !!getTaskStatus(3, 'bg_initiated')
    const ddStatus = getTaskStatus(3, 'dd_checklist')
    const revResponse = getTaskStatus(3, 'rev_share_response')
    const bgResult = getTaskStatus(3, 'bg_results_received')
    const ddDone = ddStatus === 'completed'
    const revDone = revResponse === 'happy'
    const bgDone = bgResult === 'passed'
    const bgFailed = bgResult === 'failed'
    const allDone = ddDone && revDone && bgDone

    async function submitRevShareProposal() {
      if (!revSharePercent) return
      setSubmittingRevShare(true)
      try {
        await saveProgress(3, 'rev_share_prepared', 'completed', `Revenue share: ${revSharePercent}%`)
        await saveProgress(3, 'rev_share_email_sent', 'completed')
      } catch (err) { console.error(err) }
      finally { setSubmittingRevShare(false) }
    }

    return (
      <>
        {/* 1. Tracy confirms background check sent */}
        <SectionLabel>Tracy's action</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: bgInitiated ? '#27ae60' : 'transparent', border: `1.5px solid ${bgInitiated ? '#27ae60' : 'rgba(255,255,255,0.3)'}`, flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: bgInitiated ? '#fff' : '#8bacc8' }}>Background check sent to {ob.background_check_type === 'Max' ? 'Scherzer International' : 'Checkr'}</span>
            <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.2)' }}>{ob.background_check_type || 'Core'}</span>
          </div>
          {!bgInitiated && <ActionButton label="Background check sent" onClick={() => { saveProgress(3, 'bg_initiated', 'completed'); saveProgress(3, 'dd_email_sent', 'completed') }} />}
        </div>

        {/* 2. Auto: DD checklist email — fires when Tracy clicks above */}
        <SectionLabel>Automated</SectionLabel>
        <AutoStep done={!!getTaskStatus(3, 'dd_email_sent')} label="DD checklist email sent to specialist" />

        {/* 3. DD checklist response — read-only, populated by email */}
        <SectionLabel>Waiting on specialist</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>DD checklist</span>
          {!ddStatus ? (
            <span style={{ fontSize: '12px', color: '#5a8ab5', fontStyle: 'italic', marginLeft: 'auto' }}>Awaiting response...</span>
          ) : ddStatus === 'help_requested' ? (
            <span style={{ fontSize: '12px', color: '#f39c12', fontWeight: '600', marginLeft: 'auto' }}>⚠ Specialist needs help — Tracy notified</span>
          ) : ddStatus === 'completed' ? (
            <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', marginLeft: 'auto' }}>✓ Completed</span>
          ) : null}
        </div>

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />

        {/* 4. Revenue share proposal — form */}
        <SectionLabel>Tracy's input — Revenue share proposal</SectionLabel>
        {!getTaskStatus(3, 'rev_share_prepared') ? (
          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.3)', background: 'rgba(255,255,255,0.02)', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', color: '#8bacc8', marginBottom: '8px' }}>Revenue Share Percentage</div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" value={revSharePercent} onChange={e => setRevSharePercent(e.target.value)} placeholder="e.g. 15" style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', width: '100px' }} />
                <span style={{ fontSize: '14px', color: '#8bacc8' }}>%</span>
              </div>
              <ActionButton label={submittingRevShare ? 'Submitting...' : 'Submit & Send to Specialist'} onClick={submitRevShareProposal} disabled={!revSharePercent || submittingRevShare} color="#27ae60" />
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600' }}>✓ Revenue share proposal submitted</span>
            <span style={{ fontSize: '11px', color: '#5a8ab5', marginLeft: '10px' }}>{progress['3-rev_share_prepared']?.notes || ''}</span>
          </div>
        )}

        {/* 5. Auto: revenue share email — fires when form submitted */}
        <SectionLabel>Automated</SectionLabel>
        <AutoStep done={!!getTaskStatus(3, 'rev_share_email_sent')} label="Revenue share proposal email sent to specialist" />

        {/* 6. Revenue share response — read-only, populated by email */}
        <SectionLabel>Waiting on specialist</SectionLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#fff', fontWeight: '500' }}>Revenue share proposal</span>
          {!revResponse ? (
            <span style={{ fontSize: '12px', color: '#5a8ab5', fontStyle: 'italic', marginLeft: 'auto' }}>Awaiting response...</span>
          ) : revResponse === 'further_questions' ? (
            <span style={{ fontSize: '12px', color: '#f39c12', fontWeight: '600', marginLeft: 'auto' }}>⚠ Further questions — Tracy notified</span>
          ) : revResponse === 'happy' ? (
            <span style={{ fontSize: '12px', color: '#27ae60', fontWeight: '600', marginLeft: 'auto' }}>✓ Happy with proposal</span>
          ) : revResponse === 'stopped' ? (
            <span style={{ fontSize: '12px', color: '#e74c3c', fontWeight: '600', marginLeft: 'auto' }}>✗ Stopped</span>
          ) : null}
        </div>

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />

        {/* 7. Background check results — Tracy clicks Passed or Failed */}
        <SectionLabel>Background check results</SectionLabel>
        {!bgResult ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#fff' }}>Background check results</span>
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
              <ActionButton label="Passed" onClick={() => saveProgress(3, 'bg_results_received', 'passed')} color="#27ae60" />
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
        <div style={{ padding: '8px 12px', borderRadius: '6px', border: `1px dashed ${allDone ? 'rgba(39,174,96,0.3)' : bgFailed ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.1)'}`, background: allDone ? 'rgba(39,174,96,0.06)' : bgFailed ? 'rgba(231,76,60,0.06)' : 'transparent', marginTop: '14px', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', color: allDone ? '#27ae60' : bgFailed ? '#e74c3c' : '#8bacc8' }}>
            {allDone ? '✓ All 3 requirements met — ready for Stage 4' : bgFailed ? '✗ Background check failed — onboarding stopped' : 'All 3 must be done: DD checklist + revenue share agreed + background check passed'}
          </span>
        </div>
        {allDone && (
          <>
            <AutoStep done={true} label="Email sent — Step 3 complete, moving to Step 4" />
            {ob.current_stage === 3 && <div style={{ marginTop: '10px' }}><ActionButton label="Advance to Stage 4 →" onClick={advanceStage} /></div>}
          </>
        )}
      </>
    )
  }
 
  function Stage4Content() {
    const bothConfirm = getVote(4, 'Anton Anderson') === 'confirm' && getVote(4, 'Paul Latham') === 'confirm'
    const eitherQuestion = (getVote(4, 'Anton Anderson') === 'further_questions' || getVote(4, 'Paul Latham') === 'further_questions') && !bothConfirm
    const allFolderDone = STAGE4_FOLDER_ITEMS.every(item => getTaskStatus(4, item.key))
 
    return (
      <>
        <SectionLabel>Automated</SectionLabel>
        <AutoStep done={true} label="Final executive approval emails sent" />
 
        <SectionLabel>Final executive approval</SectionLabel>
        <VotePanel stage={4} />
        {eitherQuestion && <div style={{ fontSize: '12px', color: '#f39c12', padding: '8px 12px', borderRadius: '6px', border: '1px dashed rgba(243,156,18,0.3)', background: 'rgba(243,156,18,0.06)', marginBottom: '12px' }}>Process paused — executive has further questions.</div>}
 
        {bothConfirm && <div style={{ fontSize: '11px', color: '#27ae60', marginBottom: '8px' }}>Both executives confirmed.</div>}

        <div style={{ borderTop: '1px dashed rgba(255,255,255,0.1)', margin: '16px 0' }} />
        <SectionLabel>Automated</SectionLabel>
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
        {STAGE4_FOLDER_ITEMS.map(item => (
          <CheckItem key={item.key} done={!!getTaskStatus(4, item.key)} label={item.label} onClick={() => saveProgress(4, item.key, 'completed')} />
        ))}
        {allFolderDone && ob.current_stage === 4 && (
          <div style={{ marginTop: '14px' }}><ActionButton label="Advance to Stage 5 →" onClick={advanceStage} /></div>
        )}
      </>
    )
  }
 
  function Stage5Content() {
    return (
      <>
        <SectionLabel>VFO Skool</SectionLabel>
        {STAGE5_SKOOL_ITEMS.map(item => {
          const status = getTaskStatus(5, item.key)
          return (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize: '13px', color: '#fff' }}>{item.label}</span>
              <select value={status || ''} onChange={e => e.target.value && saveProgress(5, item.key, e.target.value)} disabled={isStopped} style={{ ...inputStyle, minWidth: '120px', borderColor: status ? 'rgba(39,174,96,0.4)' : 'rgba(255,255,255,0.15)', color: status ? '#27ae60' : '#fff' }}>
                <option value="">-- Select --</option>
                <option value="Completed">Completed</option>
                <option value="N/A">N/A</option>
              </select>
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