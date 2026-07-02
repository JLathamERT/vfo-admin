import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, loadCachedAction } from '../../lib/api'
import { Skeleton, ClientsListSkeleton, TrainingTrackSkeleton, CoachingMeetingsSkeleton, CoachingRenewalSkeleton, MsmHomeSkeleton } from '../shared/Skeleton'
import { TrackHero, PhaseBadge } from '../shared/TrackKit'

// Training-track section headers (task_type='section') are labels only — never counted toward completion.
const countableTasks = (list) => (list || []).filter(t => t.task_type !== 'section')

// Group a phase's tasks so each section header owns the contiguous sub-steps beneath it,
// letting the UI enclose the group and keep following standalone tasks visually separate.
const groupTasks = (list) => {
  const tasks = list || []
  const nodes = []
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]
    if (t.task_type === 'section') {
      const subs = []
      while (i + 1 < tasks.length && tasks[i + 1].task_type === 'substep') { subs.push(tasks[i + 1]); i++ }
      nodes.push({ kind: 'group', section: t, subs })
    } else {
      nodes.push({ kind: 'task', task: t })
    }
  }
  return nodes
}

const PROGRAMS = [
  { key: 'holistic', name: 'VFO Holistic Planning' },
  { key: 'partnership', name: 'Partnership Fast Track' },
  { key: 'tax', name: 'VFO Tax Planning' },
  { key: 'coaching', name: 'Advanced Coaching' },
]

export default function MemberMSMTracking({ member, activeTab, onNavigate }) {
  const [programs, setPrograms] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [enabledPrograms, setEnabledPrograms] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [vfo90Count, setVfo90Count] = useState(0)
  

  useEffect(() => { loadData() }, [member.member_number])

  async function loadData() {
    setLoading(true)
    try {
      const [progData, enrollData, enabledData, meetData] = await Promise.all([
        loadCachedAction('msm_load_programs'),
        callApi('msm_load_enrollments', { member_number: member.member_number }),
        callApi('msm_load_enabled_programs', { member_number: member.member_number }),
        callApi('msm_load_meetings', { member_number: member.member_number }),
      ])
      setPrograms(progData.programs || [])
      setEnrollments(enrollData.enrollments || [])
      setEnabledPrograms(enabledData.enabled || [])
      setMeetings(meetData.meetings || [])

      // Calculate VFO 90 Day Plan count from completed phases
      const holisticProg = (progData.programs || []).find(p => p.name === 'VFO Holistic Planning')
      const holisticEnroll = (enrollData.enrollments || []).find(e => e.programs?.name === 'VFO Holistic Planning')
      if (holisticProg && holisticEnroll) {
        const [trackData, progressData] = await Promise.all([
          loadCachedAction('msm_load_training_track', { program_id: holisticProg.id }),
          callApi('msm_load_training_progress', { enrollment_id: holisticEnroll.id }),
        ])
        const phases = trackData.phases || []
        const prog = {}
        ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
        const completedPhases = phases.filter(phase => {
          if (phase.name.includes('Review')) return false
          const tasks = countableTasks(phase.program_training_tasks)
          return tasks.length > 0 && tasks.every(t => prog[t.id]?.status)
        }).length
        setVfo90Count(completedPhases)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function getEnrollment(programName) {
    return enrollments.find(e => e.programs?.name === programName) || null
  }

  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }

  const msmCount = meetings.filter(m => m.meeting_type === 'MSM Meeting').length
  const advancedCount = meetings.filter(m => m.meeting_type === 'Advanced Meeting').length
  const pft90Count = meetings.filter(m => m.meeting_type === 'PFT 90 Day Plan Meeting').length

  if (loading) {
    if (activeTab === 'msm_home') return <MsmHomeSkeleton />
    const isCoach = activeTab === 'msm_coaching'
    const inner =
      isCoach ? <CoachingMeetingsSkeleton /> :
      activeTab === 'msm_tax' ? <ClientsListSkeleton /> :
      (activeTab === 'msm_holistic' || activeTab === 'msm_partnership') ? <TrainingTrackSkeleton /> :
      <TrainingTrackSkeleton phaseCount={3} rowsPerPhase={3} />
    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        <Skeleton width={240} height={28} style={{ marginBottom: '20px' }} />
        <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width={90} height={11} />
              <Skeleton width={100} height={15} />
            </div>
            {!isCoach && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton width={110} height={11} />
                <Skeleton width={100} height={15} />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', paddingBottom: '10px', borderBottom: '1px solid var(--vfo-border)' }}>
          <Skeleton width={80} height={20} />
          {activeTab !== 'msm_tax' && <Skeleton width={80} height={20} />}
        </div>
        {inner}
      </div>
    )
  }

  const activeProgramKey = activeTab === 'msm_home' ? null
    : activeTab === 'msm_holistic' ? 'holistic'
    : activeTab === 'msm_partnership' ? 'partnership'
    : activeTab === 'msm_tax' ? 'tax'
    : activeTab === 'msm_coaching' ? 'coaching'
    : null

  if (activeTab === 'msm_home') {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Assigned MSM</div>
          <div style={{ fontSize: '16px', color: 'var(--vfo-ink)', fontWeight: '600' }}>{member.assigned_msm || '—'}</div>
        </div>

        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Your Programs</div>
          {PROGRAMS.map(p => {
            const dbProgram = programs.find(prog => prog.name === p.name)
            if (!dbProgram) return null
            const isEnabled = enabledPrograms.some(e => e.program_id === dbProgram.id)
            if (!isEnabled) return null
            const tabKey = { holistic: 'msm_holistic', partnership: 'msm_partnership', tax: 'msm_tax', coaching: 'msm_coaching' }[p.key]
            return (
              <div key={p.key} onClick={() => onNavigate(tabKey)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--vfo-tint)', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: '14px', color: '#0095ff', fontWeight: 500 }}>{p.name}</span>
              </div>
            )
          })}
          {enabledPrograms.length === 0 && <p style={{ color: 'var(--vfo-muted)', fontSize: '14px' }}>No programs enabled yet.</p>}
        </div>

        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Meeting Summary</div>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {[['MSM Meetings', msmCount], ['Advanced Meetings', advancedCount], ['VFO 90 Day Plan', vfo90Count], ['PFT 90 Day Plan', pft90Count]].map(([label, count]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--vfo-heading)' }}>{count}</div>
                <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--vfo-muted)', marginTop: '3px', textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Meeting History</div>
          {meetings.length === 0
            ? <p style={{ color: 'var(--vfo-muted)', fontSize: '14px' }}>No meetings logged yet.</p>
            : meetings.map(m => (
              <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
                <div style={{ fontSize: '14px', color: 'var(--vfo-ink)' }}>{m.meeting_type}</div>
                <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>
                  {new Date(m.meeting_date + 'T12:00:00').toLocaleDateString()}{m.conducted_by ? ` · ${m.conducted_by}` : ''}
                </div>
                {m.notes && <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>{m.notes}</div>}
              </div>
            ))
          }
        </div>
      </div>
    )
  }

  if (activeProgramKey) {
    const p = PROGRAMS.find(p => p.key === activeProgramKey)
    const dbProgram = programs.find(prog => prog.name === p?.name)
    const isEnabled = dbProgram && enabledPrograms.some(e => e.program_id === dbProgram.id)

    if (!isEnabled) return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--vfo-muted)' }}>
        <div style={{ fontSize: '18px', color: 'var(--vfo-ink)', marginBottom: '8px', fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>{p?.name}</div>
        <div style={{ fontSize: '14px' }}>This program is not enabled.</div>
      </div>
    )

    const enrollment = getEnrollment(p.name)

    return (
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
        {!enrollment
          ? <>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '22px', color: 'var(--vfo-ink)', marginBottom: '20px' }}>{p.name}</div>
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-muted)' }}>You are not yet enrolled in this program.</div>
            </>
          : <MemberEnrolledView enrollment={enrollment} program={dbProgram} member={member} />
        }
      </div>
    )
  }

  return null
}



function MemberEnrolledView({ enrollment, program, member }) {
  const isCoaching = program.name === 'Advanced Coaching'
  const defaultTab = isCoaching ? 'meetings' : program.name === 'VFO Tax Planning' ? 'clients' : 'training'
  const [activeTab, setActiveTab] = useState(defaultTab)
  useEffect(() => { setActiveTab(defaultTab) }, [program.id])
  const tabStyle = (active) => ({ padding: '7px 16px', background: active ? '#125ecc' : 'transparent', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : 'var(--vfo-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', marginRight: '4px' })
  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }
  const statusColors = { 'On Fast Track': '#1b9254', 'Paused Fast Track': '#e06717', 'Lost/Removed': '#e74c3c', 'Revert to Legacy': 'var(--vfo-muted)', 'Active': '#1b9254' }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#0095ff', textTransform: 'uppercase', marginBottom: '4px' }}>Program</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.03em', fontSize: '22px', color: 'var(--vfo-heading)' }}>{program.name}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--vfo-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>Joined {enrollment.date_enrolled ? enrollment.date_enrolled.split('T')[0] : '—'}</span>
          {!isCoaching && enrollment.program_status && <><span style={{ color: 'var(--vfo-border-mid)' }}>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--vfo-ink)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColors[enrollment.program_status] || 'var(--vfo-faint)', flexShrink: 0 }} />{enrollment.program_status}</span></>}
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--vfo-border)', marginBottom: '24px' }}>
        {isCoaching ? (
          <>
            <button style={tabStyle(activeTab === 'meetings')} onClick={() => setActiveTab('meetings')}>Meetings</button>
            <button style={tabStyle(activeTab === 'renewal')} onClick={() => setActiveTab('renewal')}>Renewal</button>
          </>
        ) : program.name === 'VFO Tax Planning' ? (
          <>
            <button style={tabStyle(activeTab === 'clients')} onClick={() => setActiveTab('clients')}>Clients</button>
          </>
        ) : (
          <>
            <button style={tabStyle(activeTab === 'training')} onClick={() => setActiveTab('training')}>90 Day Plan</button>
            <button style={tabStyle(activeTab === 'clients')} onClick={() => setActiveTab('clients')}>Clients</button>
          </>
        )}
      </div>
      {activeTab === 'training' && <MemberTrainingView enrollment={enrollment} program={program} />}
      {activeTab === 'clients' && <MemberClientsView enrollment={enrollment} member={member} program={program} />}
      {activeTab === 'meetings' && <MemberCoachingMeetings enrollment={enrollment} />}
      {activeTab === 'renewal' && <MemberCoachingRenewal enrollment={enrollment} />}
    </div>
  )
}

function MemberTrainingView({ enrollment, program }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)

  function handleTaskComplete(taskId, status, date) {
    setProgress(p => ({ ...p, [taskId]: { ...p[taskId], task_id: taskId, status, completed_date: date } }))
  }

  useEffect(() => { loadTrack() }, [enrollment.id])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData] = await Promise.all([
        loadCachedAction('msm_load_training_track', { program_id: program.id }),
        callApi('msm_load_training_progress', { enrollment_id: enrollment.id }),
      ])
      setPhases(trackData.phases || [])
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '16px' }
  const statusColors = { Completed: '#1b9254', 'Have Watched': '#1b9254', 'In Progress': '#e06717', 'N/A': 'var(--vfo-muted)', Pending: '#e74c3c' }
  const statusBg = { Completed: 'rgba(27,146,84,0.15)', 'Have Watched': 'rgba(27,146,84,0.15)', 'In Progress': 'rgba(251,137,90,0.15)', 'N/A': 'rgba(91,107,140,0.15)', Pending: 'rgba(231,76,60,0.15)' }

  if (loading) return <TrainingTrackSkeleton />
  if (phases.length === 0) return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-muted)' }}>No training track defined yet.</div>

  const totalTasks = phases.reduce((s, p) => s + countableTasks(p.program_training_tasks).length, 0)
  const completedTasks = Object.values(progress).filter(p => p.status && p.status !== '').length

  return (
    <div>
      <TrackHero
        accent={false}
        completed={completedTasks}
        total={totalTasks}
        steps={phases.map(ph => {
          const ts = countableTasks(ph.program_training_tasks)
          const done = ts.length > 0 && ts.every(t => progress[t.id]?.status)
          const some = ts.some(t => progress[t.id]?.status)
          return { label: ph.name, state: done ? 'done' : some ? 'active' : 'pending' }
        })}
      />
      {phases.map(phase => {
        const isReview = phase.name.includes('Review')
        return (
        <div key={phase.id} style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '16px', marginTop: isReview ? '-6px' : '0', marginLeft: isReview ? '20px' : '0', borderTopLeftRadius: isReview ? '0' : '12px' }}>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: 'var(--vfo-heading)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>{phase.name}{isReview && <span style={{ fontSize: '10px', color: 'var(--vfo-muted)', marginLeft: '8px', textTransform: 'none', fontWeight: '400', letterSpacing: '0' }}>checkpoint</span>}</div>
          {(() => {
            const renderMemberTask = (task, inGroup) => {
              const p = progress[task.id] || {}
              if (task.video_url) return (
                <div key={task.id} style={{ marginBottom: '8px' }}>
                  <VideoTask task={task} progress={p} enrollmentId={enrollment.id} onComplete={handleTaskComplete} />
                </div>
              )
              return (
                <div key={task.id} style={{ padding: '10px 0', borderBottom: inGroup ? 'none' : '1px solid var(--vfo-tint)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColors[p.status] || 'transparent', flexShrink: 0, border: '1px solid var(--vfo-border-mid)' }} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', color: 'var(--vfo-ink)' }}>{task.name}</span>
                  </div>
                  {p.status && (
                    <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '12px', background: statusBg[p.status] || 'var(--vfo-tint)', color: statusColors[p.status] || 'var(--vfo-ink)' }}>{p.status}</span>
                  )}
                </div>
              )
            }
            return groupTasks(phase.program_training_tasks).map(node => node.kind === 'group' ? (
              <div key={`sec-${node.section.id}`} style={{ margin: '12px 0', padding: '4px 16px 8px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-soft)', borderRadius: '12px' }}>
                <div style={{ padding: '8px 0 6px' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11.5px', fontWeight: 800, color: 'var(--vfo-heading)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{node.section.name}</span>
                </div>
                {node.subs.map(t => renderMemberTask(t, true))}
              </div>
            ) : renderMemberTask(node.task, false))
          })()}
        </div>
        )
      })}
    </div>
  )
}

function MemberClientsView({ enrollment, member, program }) {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [contactsMap, setContactsMap] = useState({})
  const [expandedClient, setExpandedClient] = useState(null)
  const [showAdditional, setShowAdditional] = useState(false)
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addEmail, setAddEmail] = useState('')

  useEffect(() => { loadClients() }, [enrollment.id])

  async function loadClients() {
    setLoading(true)
    try {
      const [data, contactData] = await Promise.all([
        callApi('msm_load_clients', { enrollment_id: enrollment.id }),
        callApi('load_member_contacts', { member_number: member.member_number }),
      ])
      setClients(data.clients || [])
      setContactsMap(contactData.contacts || {})
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function addClient() {
    if (!firstName || !lastName || !email) { setAddStatus('First name, last name, and email are required.'); return }
    try {
      const additional_contact = showAdditional && addFirstName && addLastName ? { first_name: addFirstName, last_name: addLastName, email: addEmail } : undefined
      await callApi('msm_add_client', { enrollment_id: enrollment.id, member_number: member.member_number, first_name: firstName, last_name: lastName, email, phone, additional_contact })
      setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setShowAdd(false); setAddStatus(''); setShowAdditional(false); setAddFirstName(''); setAddLastName(''); setAddEmail('')
      loadClients()
    } catch (err) { setAddStatus(err.message) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '16px' }
  const statusColors = { pending: '#e06717', active: '#1b9254', declined: '#e74c3c' }

  if (loading) return <ClientsListSkeleton />


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', paddingLeft: '24px' }}>
          <div><div style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--vfo-heading)', lineHeight: 1 }}>{clients.length}</div><div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--vfo-muted)', marginTop: '4px' }}>TOTAL</div></div>
          <div><div style={{ fontFamily: 'Inter, sans-serif', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--vfo-heading)', lineHeight: 1 }}>{clients.filter(c => c.status === 'active').length}</div><div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.8px', color: 'var(--vfo-muted)', marginTop: '4px' }}>ACTIVE</div></div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>+ Add Client</button>
      </div>

      {showAdd && (
        <div style={{ ...sectionStyle, marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add New Client</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>First Name *</label><input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1, minWidth: '140px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Last Name *</label><input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} /></div>
            <div style={{ flex: 1, minWidth: '180px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Email *</label><input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} /></div>
            <div style={{ flex: 1, minWidth: '140px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Phone</label><input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} /></div>
          </div>
          {!showAdditional && (
            <button onClick={() => setShowAdditional(true)} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px dashed rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.06)', color: '#0095ff', fontWeight: 600, fontSize: '12px', cursor: 'pointer', marginBottom: '12px', fontFamily: 'Inter, sans-serif' }}>+ Add additional contact (e.g. spouse)</button>
          )}
          {showAdditional && (
            <div style={{ padding: '16px', background: 'rgba(0,149,255,0.06)', border: '1px solid rgba(0,149,255,0.2)', borderRadius: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, fontStyle: 'italic' }}>Additional contact (not the primary client)</div>
                <button onClick={() => { setShowAdditional(false); setAddFirstName(''); setAddLastName(''); setAddEmail('') }} style={{ background: 'none', border: 'none', color: 'var(--vfo-muted)', fontSize: '11px', cursor: 'pointer' }}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>First Name</label><input value={addFirstName} onChange={e => setAddFirstName(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1, minWidth: '120px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Last Name</label><input value={addLastName} onChange={e => setAddLastName(e.target.value)} style={inputStyle} /></div>
                <div style={{ flex: 1, minWidth: '160px' }}><label style={{ fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px' }}>Email</label><input value={addEmail} onChange={e => setAddEmail(e.target.value)} type="email" style={inputStyle} /></div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addClient} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
          {addStatus && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginTop: '8px' }}>{addStatus}</p>}
        </div>
      )}

      {clients.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-muted)' }}>No clients added yet.</div>
        : clients.map(client => (
          <div key={client.id} style={{ ...sectionStyle, cursor: 'pointer' }}
            onClick={() => navigate(`/member/client/${client.id}`, { state: { enrollment_id: enrollment.id } })}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--vfo-card)'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--vfo-ink)' }}>{client.first_name} {client.last_name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>{client.client_ref}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: `${statusColors[client.status] || 'var(--vfo-muted)'}22`, color: statusColors[client.status] || 'var(--vfo-muted)', border: `1px solid ${statusColors[client.status] || 'var(--vfo-muted)'}44` }}>{client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : ''}</span>
                </div>
                {(client.email || client.phone) && <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '4px' }}>{client.email}{client.email && client.phone ? ' · ' : ''}{client.phone}</div>}
                {contactsMap[client.id]?.length > 0 && <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px', fontStyle: 'italic' }}>with {contactsMap[client.id].map(c => `${c.first_name} ${c.last_name}`).join(', ')}</div>}
              </div>
              <span style={{ color: '#0095ff', fontWeight: 500, fontSize: '13px' }}>View →</span>
            </div>
          </div>
        ))
      }
    </div>
  )
}

function MemberClientTrackView({ client, program }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [pipelineData, setPipelineData] = useState(null)

  useEffect(() => { loadTrack() }, [client.id])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData, pipelineRes] = await Promise.all([
        loadCachedAction('msm_load_client_track', { program_id: program.id }),
        callApi('msm_load_client_progress', { client_id: client.id }),
        callApi('member_load_pipeline', { client_id: client.id }),
      ])
      const loadedPhases = trackData.phases || []
      setPhases(loadedPhases)
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)
      setPipelineData(pipelineRes?.row || null)

      const expandState = {}
      loadedPhases.forEach(phase => {
        const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
        const allDone = tasks.length > 0 && tasks.every(t => prog[t.id]?.status)
        expandState[phase.id] = !allDone
      })
      setExpanded(expandState)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  function formatDate(d) {
    if (!d) return ''
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  }

  function getPhaseState(phase) {
    const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (tasks.length === 0) return 'done'
    if (tasks.every(t => progress[t.id]?.status)) return 'done'
    if (tasks.some(t => progress[t.id]?.status)) return 'active'
    return 'pending'
  }

  const statusColors = { Completed: '#1b9254', Confirmed: '#1b9254', Yes: '#1b9254', 'Call arranged': '#1b9254', 'PIP 1 scheduled': '#1b9254', 'Follow-up scheduled': '#1b9254', 'PIP Follow-up confirmed': '#1b9254', 'Send confirmation email': '#1b9254', 'Regular priorities tab enabled': '#1b9254', 'Tax priorities tab enabled': '#1b9254', 'Completed + N/A': '#1b9254', 'Completed + Risk 1': '#1b9254', 'Completed + Risk 2': '#1b9254', 'Completed + Risk 3': '#1b9254', 'Completed + Risk 4': '#1b9254', 'Completed + Risk 5': '#1b9254', Lite: '#1b9254', Core: '#1b9254', Max: '#1b9254', 'In Progress': '#e06717', Undecided: '#e06717', 'No response': '#e74c3c', No: '#e74c3c', 'PIP Follow-up declined': '#e74c3c', 'Send declined email': '#e74c3c' }

  if (loading) return <div style={{ color: 'var(--vfo-muted)', fontSize: '13px', padding: '16px' }}>Loading track...</div>
  if (phases.length === 0) return <div style={{ color: 'var(--vfo-muted)', fontSize: '13px', padding: '16px' }}>No client track defined yet.</div>

  const totalTasks = phases.reduce((s, p) => s + (p.program_client_tasks || []).filter(t => t.status_options !== 'auto').length, 0)
  const completedTasks = phases.reduce((s, phase) => s + (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto' && progress[t.id]?.status && progress[t.id].status !== '').length, 0)

  return (
    <div>
      <TrackHero
        eyebrow={program?.name || 'Client Track'}
        title="MAP 1 — Engagement Process"
        completed={completedTasks}
        total={totalTasks}
        steps={phases.map(ph => ({ label: ph.name.replace(/^MAP 1 - /, ''), state: getPhaseState(ph) }))}
      />

      {phases.map((phase, phaseIdx) => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        const doneTasks = nonAutoTasks.filter(t => progress[t.id]?.status && progress[t.id].status !== '').length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : 'var(--vfo-border)'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = state === 'active' ? '#125ecc' : '#002973'
        const c10TaskId = phases.find(ph => ph.name === 'MAP 1 - PIP Follow Up')?.program_client_tasks?.find(t => t.task_code === 'C10')?.id
        const c10Status = progress[c10TaskId]?.status || ''
        const c14c15Active = c10Status === 'No' || c10Status === 'Undecided'

        return (
          <div key={phase.id} style={{ background: 'var(--vfo-card)', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden' }}>
            <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PhaseBadge number={phaseIdx + 1} state={state} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {state === 'done' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>}
                <span style={{ color: 'var(--vfo-muted)', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {tasks.map(task => {
                  const p = progress[task.id] || {}
                  const isDone = !!p.status && p.status !== ''
                  const statusColor = statusColors[p.status] || 'var(--vfo-muted)'
                  const isGreyedOut = (task.task_code === 'C14' || task.task_code === 'C15') && !c14c15Active

                  if (task.name === 'AI PC Admin' && pipelineData) {
                    const pd = pipelineData
                    const pipDecision = pd?.c13_decision
                    const finalDec = pd?.c15_final_decision
                    const autoStep = (label, done, tag = null) => (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
                        <span style={{ fontSize: '12px', color: 'var(--vfo-ink)' }}>{label}</span>
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                          {done && tag && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>{tag}</span>}
                          {done && <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600 }}>Done</span>}
                        </span>
                      </div>
                    )
                    return (
                      <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--vfo-border-soft)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: pd?.c18_ceo_signed === 'Yes' ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${pd?.c18_ceo_signed === 'Yes' ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
                          <span style={{ fontSize: '13px', color: 'var(--vfo-ink)', flex: 1 }}>{task.name}</span>
                        </div>
                        {pipDecision && (
                          <div style={{ marginLeft: '18px' }}>
                            {finalDec === 'Yes' && (
                              <>
                                {autoStep('Agreement sent to client', pd?.c16_sent === 'Yes')}
                                {autoStep('Client signed', pd?.c17_client_signed === 'Yes')}
                                {autoStep('CEO signed', pd?.c18_ceo_signed === 'Yes')}
                                {autoStep('Payment link sent', false)}
                                {autoStep('Payment made', !!pd?.pay1_status, pd?.pay1_status && pd?.payment_method_type ? pd.payment_method_type.toUpperCase() : null)}
                                {autoStep('Payment received', pd?.pay1_status === 'succeeded')}
                                {autoStep('Invoice/receipt sent', !!pd?.invoice_number)}
                                {autoStep('Revenue share paid', !!pd?.rec1_rev_share)}
                                {autoStep('Member notified of revenue share', pd?.c24_email_sent === 'Yes')}
                              </>
                            )}
                            {finalDec === 'No' && autoStep('Decline email sent to client', true)}
                            {!finalDec && autoStep('Awaiting client decision', false)}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid var(--vfo-border-soft)', opacity: isGreyedOut ? 0.3 : 1 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.status_options === 'auto' || isDone ? (task.status_options === 'auto' ? '#1b9254' : statusColor) : 'transparent', flexShrink: 0, border: `1.5px solid ${task.status_options === 'auto' || isDone ? (task.status_options === 'auto' ? '#1b9254' : statusColor) : 'var(--vfo-border-mid)'}` }} />
                      <span style={{ fontSize: '12px', color: 'var(--vfo-muted)', fontFamily: 'monospace', width: '32px' }}>{task.task_code}</span>
                      <span style={{ fontSize: '13px', color: isDone || task.status_options === 'auto' ? 'var(--vfo-muted)' : 'var(--vfo-ink)', flex: 1 }}>{task.name}</span>
                      {task.status_options === 'auto'
                        ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>
                        : isDone
                          ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                          : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'var(--vfo-tint)', border: '1px solid var(--vfo-border-chip)', color: 'var(--vfo-muted)' }}>Not started</span>
                      }
                      {isDone && p.completed_date && <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>{formatDate(p.completed_date)}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function VideoTask({ task, progress, enrollmentId, onComplete }) {
  const [showVideo, setShowVideo] = useState(false)
  const [completed, setCompleted] = useState(!!progress?.status)
  const playerRef = useRef(null)
  const containerId = `yt-player-${task.id}`

  const videoId = task.video_url?.match(/v=([^&]+)/)?.[1]
  const statusColor = completed ? '#1b9254' : '#0095ff'

  useEffect(() => {
    if (!showVideo || !videoId) return
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
      window.onYouTubeIframeAPIReady = () => initPlayer()
    } else {
      initPlayer()
    }
    return () => { if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null } }
  }, [showVideo])

  function initPlayer() {
    if (playerRef.current) return
    playerRef.current = new window.YT.Player(containerId, {
      videoId,
      width: '100%',
      height: '360',
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onStateChange: () => {}
      }
    })
  }

  

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: showVideo ? '12px' : '0' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: completed ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${completed ? '#1b9254' : 'var(--vfo-border-mid)'}` }} />
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '13px', color: 'var(--vfo-muted)', marginRight: '8px' }}>{task.task_code}</span>
          <span style={{ fontSize: '14px', color: completed ? 'var(--vfo-muted)' : 'var(--vfo-ink)' }}>{task.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setShowVideo(!showVideo)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: `1px solid rgba(0,149,255,0.4)`, background: showVideo ? 'rgba(231,76,60,0.15)' : 'rgba(0,149,255,0.15)', color: showVideo ? '#e74c3c' : '#0095ff' }}>
            {showVideo ? 'Hide Video' : '▶ Watch Video'}
          </button>
          {completed && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Have Watched</span>}
        </div>
      </div>
      {showVideo && (
        <div style={{ borderRadius: '8px', overflow: 'hidden', marginLeft: '22px' }}>
          <div id={containerId} />
        </div>
      )}
    </div>
  )
}

function MemberCoachingMeetings({ enrollment }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedMeeting, setExpandedMeeting] = useState(null)

  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }

  useEffect(() => { loadMeetings() }, [enrollment.id])

  async function loadMeetings() {
    setLoading(true)
    try {
      const data = await callApi('coaching_load_meetings', { enrollment_id: enrollment.id })
      setMeetings(data.meetings || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const completedMeetings = meetings.filter(m => m.status === 'completed').sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
  const scheduledMeetings = meetings.filter(m => m.status === 'scheduled').sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
  const nextScheduled = scheduledMeetings[0]

  if (loading) return <CoachingMeetingsSkeleton />

  return (
    <div>
      <TrackHero
        eyebrow="Advanced Coaching"
        title="Coaching Meetings"
        meta={<>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--vfo-ink)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1b9254', flexShrink: 0 }} />{completedMeetings.length} completed</span>
          <span style={{ color: 'var(--vfo-border-mid)' }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--vfo-ink)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0095ff', flexShrink: 0 }} />{scheduledMeetings.length} scheduled</span>
          {nextScheduled && <><span style={{ color: 'var(--vfo-border-mid)' }}>·</span><span>Next meeting {nextScheduled.meeting_date.split('T')[0]}</span></>}
        </>}
      />

      {scheduledMeetings.length > 0 && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Upcoming</div>
          {scheduledMeetings.map(m => (
            <div key={m.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--vfo-tint)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--vfo-ink)' }}>{m.meeting_date.split('T')[0]}</span>
              <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>Scheduled</span>
            </div>
          ))}
        </div>
      )}

      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Meeting History</div>
        {completedMeetings.length === 0
          ? <p style={{ color: 'var(--vfo-muted)', fontSize: '14px' }}>No meetings completed yet.</p>
          : completedMeetings.map(m => (
            <div key={m.id} style={{ borderBottom: '1px solid var(--vfo-tint)' }}>
              <div onClick={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: m.notes ? 'pointer' : 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--vfo-ink)' }}>{m.meeting_date.split('T')[0]}</span>
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Completed</span>
                </div>
                {m.notes && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--vfo-muted)' }}>has notes</span>
                    <span style={{ color: 'var(--vfo-muted)', fontSize: '10px', transform: expandedMeeting === m.id ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                )}
              </div>
              {expandedMeeting === m.id && m.notes && (
                <div style={{ padding: '0 0 12px 0' }}>
                  <p style={{ fontSize: '13px', color: 'var(--vfo-muted)', lineHeight: '1.5', margin: 0 }}>{m.notes}</p>
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  )
}

function MemberCoachingRenewal({ enrollment }) {
  const [renewals, setRenewals] = useState([])
  const [loading, setLoading] = useState(true)

  const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }

  useEffect(() => { loadRenewals() }, [enrollment.id])

  async function loadRenewals() {
    setLoading(true)
    try {
      const data = await callApi('coaching_load_renewals', { enrollment_id: enrollment.id })
      setRenewals(data.renewals || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const latestRenewal = renewals.length > 0 ? renewals[0] : null
  const nextDate = latestRenewal?.next_renewal_date
  const joinDate = enrollment.date_enrolled?.split('T')[0]
  const currentPeriod = latestRenewal?.period_label || 'Year 1'
  const currentStatus = latestRenewal?.action === 'cancelled' ? 'Cancelled' : 'Active'
  const statusColor = currentStatus === 'Active' ? '#1b9254' : '#e74c3c'

  let daysUntilRenewal = null
  let renewalUrgency = '#1b9254'
  if (nextDate) {
    const diff = Math.ceil((new Date(nextDate) - new Date()) / (1000 * 60 * 60 * 24))
    daysUntilRenewal = diff
    if (diff < 0) renewalUrgency = '#e74c3c'
    else if (diff <= 30) renewalUrgency = '#e74c3c'
    else if (diff <= 60) renewalUrgency = '#e06717'
  }

  const actionColors = { renewed: '#1b9254', cancelled: '#e74c3c' }

  if (loading) return <CoachingRenewalSkeleton />


  return (
    <div>
      <TrackHero
        eyebrow="Advanced Coaching"
        title="Membership Renewal"
        meta={<>
          <span>Joined {joinDate || '—'}</span>
          <span style={{ color: 'var(--vfo-border-mid)' }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--vfo-ink)' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />{currentStatus}</span>
          <span style={{ color: 'var(--vfo-border-mid)' }}>·</span>
          <span>{currentPeriod}</span>
          {nextDate && <><span style={{ color: 'var(--vfo-border-mid)' }}>·</span><span style={{ fontWeight: 600, color: renewalUrgency }}>{daysUntilRenewal !== null && daysUntilRenewal < 0 ? `Overdue ${Math.abs(daysUntilRenewal)} days` : `Ends ${nextDate.split('T')[0]}${daysUntilRenewal !== null ? ` (${daysUntilRenewal} days)` : ''}`}</span></>}
        </>}
      />

      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Renewal History</div>
        {renewals.length === 0
          ? <p style={{ color: 'var(--vfo-muted)', fontSize: '14px' }}>No renewals recorded yet.</p>
          : renewals.map(r => (
            <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--vfo-tint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${actionColors[r.action] || 'var(--vfo-muted)'}22`, color: actionColors[r.action] || 'var(--vfo-muted)', border: `1px solid ${actionColors[r.action] || 'var(--vfo-muted)'}44`, textTransform: 'capitalize' }}>{r.action}</span>
                <span style={{ fontSize: '14px', color: 'var(--vfo-ink)' }}>{r.action_date?.split('T')[0]}</span>
                {r.period_label && <span style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600 }}>{r.period_label}</span>}
              </div>
              {r.notes && <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '4px' }}>{r.notes}</div>}
            </div>
          ))
        }
      </div>
    </div>
  )
}