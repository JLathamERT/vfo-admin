import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'

const PROGRAMS = [
  { key: 'holistic', name: 'VFO Holistic Planning' },
  { key: 'partnership', name: 'Partnership Fast Track' },
  { key: 'tax', name: 'VFO Tax Planning' },
]

const TEAM_MEMBERS = ['Sarah Freitas', 'Rachael', 'Bridger Silvester', 'Tracy Miller', 'Evan Anderson']
const MEETING_TYPES = ['MSM Meeting', 'Advanced Meeting', 'VFO 90 Day Plan Meeting', 'PFT 90 Day Plan Meeting', 'Other']

export default function MSMTracking({ member }) {
  const [programs, setPrograms] = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [meetings, setMeetings] = useState([])
  const [activeProgram, setActiveProgram] = useState('holistic')
  const [loading, setLoading] = useState(true)

  // Meeting log state
  const [showLogMeeting, setShowLogMeeting] = useState(false)
  const [meetingDate, setMeetingDate] = useState('')
  const [meetingType, setMeetingType] = useState('')
  const [meetingConductedBy, setMeetingConductedBy] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [meetingStatus, setMeetingStatus] = useState('')

  useEffect(() => {
    loadData()
  }, [member.plugin_member_number])

  async function loadData() {
    setLoading(true)
    try {
      const [progData, enrollData, meetData] = await Promise.all([
        callApi('msm_load_programs'),
        callApi('msm_load_enrollments', { member_number: member.plugin_member_number }),
        callApi('msm_load_meetings', { member_number: member.plugin_member_number }),
      ])
      setPrograms(progData.programs || [])
      setEnrollments(enrollData.enrollments || [])
      setMeetings(meetData.meetings || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function logMeeting() {
    if (!meetingDate || !meetingType) { setMeetingStatus('Date and type are required.'); return }
    try {
      await callApi('msm_log_meeting', {
        member_number: member.plugin_member_number,
        meeting_date: meetingDate,
        meeting_type: meetingType,
        conducted_by: meetingConductedBy,
        notes: meetingNotes,
      })
      setMeetingDate(''); setMeetingType(''); setMeetingConductedBy(''); setMeetingNotes('')
      setShowLogMeeting(false)
      setMeetingStatus('')
      loadData()
    } catch (err) { setMeetingStatus(err.message) }
  }

  async function deleteMeeting(id) {
    try {
      await callApi('msm_delete_meeting', { meeting_id: id })
      loadData()
    } catch (err) { console.error(err) }
  }

  function getEnrollment(programName) {
    return enrollments.find(e => e.programs?.name === programName) || null
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>

  const meetingCounts = {}
  MEETING_TYPES.forEach(t => { meetingCounts[t] = meetings.filter(m => m.meeting_type === t).length })

  return (
    <div>
      {/* Meeting Stats */}
      <div style={sectionStyle}>
        <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Meeting Summary</div>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {MEETING_TYPES.filter(t => t !== 'Other').map(type => (
            <div key={type} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{meetingCounts[type] || 0}</div>
              <div style={{ fontSize: '11px', color: '#8bacc8', marginTop: '2px' }}>{type.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowLogMeeting(!showLogMeeting)}
          style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', marginBottom: showLogMeeting ? '16px' : '0' }}>
          + Log Meeting
        </button>

        {showLogMeeting && (
          <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Date *</label>
                <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Type *</label>
                <select value={meetingType} onChange={e => setMeetingType(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Conducted By</label>
                <select value={meetingConductedBy} onChange={e => setMeetingConductedBy(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  {TEAM_MEMBERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Notes</label>
              <textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={logMeeting} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setShowLogMeeting(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
            {meetingStatus && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '8px' }}>{meetingStatus}</p>}
          </div>
        )}
      </div>

      {/* Meeting History */}
      {meetings.length > 0 && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Meeting History</div>
          {meetings.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '14px', color: '#fff' }}>{m.meeting_type}</div>
                <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '2px' }}>
                  {new Date(m.meeting_date).toLocaleDateString()}{m.conducted_by ? ` · ${m.conducted_by}` : ''}
                </div>
                {m.notes && <div style={{ fontSize: '12px', color: '#5a8ab5', marginTop: '2px' }}>{m.notes}</div>}
              </div>
              <button onClick={() => deleteMeeting(m.id)}
                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'transparent', color: '#e74c3c', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Program Tabs */}
      <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Programs</div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        {PROGRAMS.map(p => (
          <button key={p.key} style={subTabStyle(activeProgram === p.key)} onClick={() => setActiveProgram(p.key)}>
            {p.name}
          </button>
        ))}
      </div>

      {PROGRAMS.map(p => {
        if (activeProgram !== p.key) return null
        const dbProgram = programs.find(prog => prog.name === p.name)
        const enrollment = dbProgram ? getEnrollment(p.name) : null

        if (!dbProgram) {
          return (
            <div key={p.key} style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>
              Program not found in database. Add "{p.name}" to the programs table first.
            </div>
          )
        }

        if (!enrollment) {
          return <EnrollPanel key={p.key} member={member} program={dbProgram} onEnrolled={loadData} />
        }

        return (
          <EnrolledPanel key={p.key} member={member} enrollment={enrollment} program={dbProgram} onDataChange={loadData} />
        )
      })}
    </div>
  )
}

function EnrollPanel({ member, program, onEnrolled }) {
  const [dateEnrolled, setDateEnrolled] = useState('')
  const [assignedMsm, setAssignedMsm] = useState('')
  const [targetClients, setTargetClients] = useState('')
  const [status, setStatus] = useState('')

  const TEAM_MEMBERS = ['Sarah Freitas', 'Rachael', 'Bridger Silvester', 'Tracy Miller', 'Evan Anderson']
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }

  async function enroll() {
    try {
      await callApi('msm_enroll_member', {
        member_number: member.plugin_member_number,
        program_id: program.id,
        date_enrolled: dateEnrolled || new Date().toISOString().split('T')[0],
        assigned_msm: assignedMsm,
        target_clients: parseInt(targetClients) || 0,
      })
      onEnrolled()
    } catch (err) { setStatus(err.message) }
  }

  return (
    <div style={sectionStyle}>
      <p style={{ color: '#8bacc8', fontSize: '14px', marginBottom: '20px' }}>
        {member.name} is not enrolled in {program.name}. Enroll them to start tracking progress.
      </p>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Date Joined</label>
          <input type="date" value={dateEnrolled} onChange={e => setDateEnrolled(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Assigned MSM</label>
          <select value={assignedMsm} onChange={e => setAssignedMsm(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
            <option value="">-- Select --</option>
            {TEAM_MEMBERS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Target Clients</label>
          <input type="number" value={targetClients} onChange={e => setTargetClients(e.target.value)} placeholder="0" style={inputStyle} />
        </div>
      </div>
      <button onClick={enroll} style={{ padding: '10px 28px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
        Enroll in {program.name}
      </button>
      {status && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '12px' }}>{status}</p>}
    </div>
  )
}

function EnrolledPanel({ member, enrollment, program, onDataChange }) {
  const [activeTab, setActiveTab] = useState('training')
  const [editingEnrollment, setEditingEnrollment] = useState(false)
  const [programStatus, setProgramStatus] = useState(enrollment.program_status || 'active')
  const [assignedMsm, setAssignedMsm] = useState(enrollment.assigned_msm || '')
  const [targetClients, setTargetClients] = useState(enrollment.target_clients || 0)
  const [saveStatus, setSaveStatus] = useState('')

  const TEAM_MEMBERS = ['Sarah Freitas', 'Rachael', 'Bridger Silvester', 'Tracy Miller', 'Evan Anderson']
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '20px' }
  const subTabStyle = (active) => ({
    padding: '10px 18px', background: 'transparent', border: 'none',
    borderBottom: active ? '2px solid #5b9fe6' : '2px solid transparent',
    color: active ? '#fff' : '#8bacc8', fontSize: '13px', fontWeight: active ? '600' : '400',
    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap'
  })

  async function saveEnrollment() {
    try {
      await callApi('msm_update_enrollment', {
        enrollment_id: enrollment.id,
        program_status: programStatus,
        assigned_msm: assignedMsm,
        target_clients: parseInt(targetClients) || 0,
      })
      setSaveStatus('Saved!')
      setTimeout(() => setSaveStatus(''), 3000)
      onDataChange()
    } catch (err) { setSaveStatus(err.message) }
  }

  const statusColors = {
    active: '#27ae60', paused: '#f39c12', 'lost/removed': '#e74c3c', 'on ft': '#5b9fe6'
  }
  const statusColor = statusColors[programStatus?.toLowerCase()] || '#8bacc8'

  return (
    <div>
      {/* Enrollment summary */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Enrollment Details</div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div><div style={{ fontSize: '12px', color: '#8bacc8' }}>Date Joined</div><div style={{ fontSize: '14px', color: '#fff' }}>{enrollment.date_enrolled ? new Date(enrollment.date_enrolled).toLocaleDateString() : '—'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#8bacc8' }}>Status</div><div style={{ fontSize: '14px', color: statusColor, fontWeight: '600' }}>{enrollment.program_status}</div></div>
              <div><div style={{ fontSize: '12px', color: '#8bacc8' }}>Assigned MSM</div><div style={{ fontSize: '14px', color: '#fff' }}>{enrollment.assigned_msm || '—'}</div></div>
              <div><div style={{ fontSize: '12px', color: '#8bacc8' }}>Target Clients</div><div style={{ fontSize: '14px', color: '#fff' }}>{enrollment.target_clients || 0}</div></div>
              <div><div style={{ fontSize: '12px', color: '#8bacc8' }}>Training</div><div style={{ fontSize: '14px', color: '#fff' }}>{enrollment.training_status}</div></div>
            </div>
          </div>
          <button onClick={() => setEditingEnrollment(!editingEnrollment)}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '12px', cursor: 'pointer' }}>
            {editingEnrollment ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editingEnrollment && (
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Program Status</label>
                <select value={programStatus} onChange={e => setProgramStatus(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  {['active', 'on ft', 'pre 90 day plan', 'paused', 'lost/removed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '160px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Assigned MSM</label>
                <select value={assignedMsm} onChange={e => setAssignedMsm(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  {TEAM_MEMBERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Target Clients</label>
                <input type="number" value={targetClients} onChange={e => setTargetClients(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button onClick={saveEnrollment} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
              Save
            </button>
            {saveStatus && <span style={{ color: saveStatus === 'Saved!' ? '#27ae60' : '#ff6b6b', fontSize: '13px', marginLeft: '12px' }}>{saveStatus}</span>}
          </div>
        )}
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '24px' }}>
        <button style={subTabStyle(activeTab === 'training')} onClick={() => setActiveTab('training')}>90 Day Plan</button>
        <button style={subTabStyle(activeTab === 'clients')} onClick={() => setActiveTab('clients')}>Clients</button>
      </div>

      {activeTab === 'training' && (
        <TrainingTrack enrollment={enrollment} program={program} />
      )}
      {activeTab === 'clients' && (
        <ClientsPanel enrollment={enrollment} member={member} program={program} />
      )}
    </div>
  )
}

function TrainingTrack({ enrollment, program }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => { loadTrack() }, [enrollment.id])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData] = await Promise.all([
        callApi('msm_load_training_track', { program_id: program.id }),
        callApi('msm_load_training_progress', { enrollment_id: enrollment.id }),
      ])
      setPhases(trackData.phases || [])
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function saveTask(taskId, status, completedDate, completedBy, notes) {
    setSaving(p => ({ ...p, [taskId]: true }))
    try {
      await callApi('msm_save_training_task', {
        enrollment_id: enrollment.id,
        task_id: taskId,
        status,
        completed_date: completedDate || null,
        completed_by: completedBy || null,
        notes: notes || null,
      })
      setProgress(p => ({ ...p, [taskId]: { ...p[taskId], task_id: taskId, status, completed_date: completedDate, completed_by: completedBy, notes } }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [taskId]: false })) }
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }
  const inputStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }

  const STATUS_OPTIONS = ['', 'Completed', 'Have Watched', 'In Progress', 'N/A', 'Pending']
  const statusColors = { 'Completed': '#27ae60', 'Have Watched': '#5b9fe6', 'In Progress': '#f39c12', 'N/A': '#8bacc8', 'Pending': '#e74c3c' }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading training track...</div>

  if (phases.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>
      No training track defined for this program yet. Add phases and tasks in the Programs setup.
    </div>
  )

  const totalTasks = phases.reduce((s, p) => s + (p.program_training_tasks?.length || 0), 0)
  const completedTasks = Object.values(progress).filter(p => p.status === 'Completed').length

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
        <div><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{completedTasks}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>COMPLETED</div></div>
        <div><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{totalTasks}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>TOTAL TASKS</div></div>
        <div><div style={{ fontSize: '28px', fontWeight: '700', color: totalTasks > 0 ? '#27ae60' : '#8bacc8' }}>{totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0}%</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>PROGRESS</div></div>
      </div>

      {phases.map(phase => (
        <div key={phase.id} style={sectionStyle}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '16px', fontFamily: 'Playfair Display, serif' }}>{phase.name}</div>
          {(phase.program_training_tasks || []).map(task => {
            const p = progress[task.id] || {}
            const statusColor = statusColors[p.status] || 'transparent'
            return (
              <div key={task.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <span style={{ fontSize: '13px', color: '#8bacc8', marginRight: '8px' }}>{task.task_code}</span>
                  <span style={{ fontSize: '14px', color: '#fff' }}>{task.name}</span>
                </div>
                <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, p.completed_by, p.notes)}
                  disabled={saving[task.id]}
                  style={{ ...inputStyle, background: '#0d2a6e', minWidth: '130px' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || '-- Status --'}</option>)}
                </select>
                <input type="date" value={p.completed_date || ''} onChange={e => saveTask(task.id, p.status, e.target.value, p.completed_by, p.notes)}
                  style={{ ...inputStyle, width: '140px' }} />
                <input value={p.completed_by || ''} onChange={e => saveTask(task.id, p.status, p.completed_date, e.target.value, p.notes)}
                  placeholder="By" style={{ ...inputStyle, width: '120px' }} onBlur={e => saveTask(task.id, p.status, p.completed_date, e.target.value, p.notes)} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function ClientsPanel({ enrollment, member, program }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [expandedClient, setExpandedClient] = useState(null)

  useEffect(() => { loadClients() }, [enrollment.id])

  async function loadClients() {
    setLoading(true)
    try {
      const data = await callApi('msm_load_clients', { enrollment_id: enrollment.id })
      setClients(data.clients || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function addClient() {
    if (!firstName || !lastName) { setAddStatus('First and last name are required.'); return }
    try {
      await callApi('msm_add_client', {
        enrollment_id: enrollment.id,
        member_number: member.plugin_member_number,
        first_name: firstName,
        last_name: lastName,
        email, phone,
      })
      setFirstName(''); setLastName(''); setEmail(''); setPhone('')
      setShowAdd(false); setAddStatus('')
      loadClients()
    } catch (err) { setAddStatus(err.message) }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }
  const statusColors = { pending: '#f39c12', active: '#27ae60', declined: '#e74c3c' }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading clients...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          <div><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{clients.length}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>TOTAL CLIENTS</div></div>
          <div><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{clients.filter(c => c.status === 'active').length}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>ACTIVE</div></div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
          + Add Client
        </button>
      </div>

      {showAdd && (
        <div style={{ ...sectionStyle, marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add New Client</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>First Name *</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Last Name *</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '12px', color: '#8bacc8', display: 'block', marginBottom: '6px' }}>Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addClient} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          </div>
          {addStatus && <p style={{ color: '#ff6b6b', fontSize: '13px', marginTop: '8px' }}>{addStatus}</p>}
        </div>
      )}

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>No clients added yet.</div>
      ) : (
        clients.map(client => (
          <div key={client.id} style={sectionStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{client.first_name} {client.last_name}</span>
                  <span style={{ fontSize: '11px', color: '#8bacc8' }}>{client.client_ref}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: `${statusColors[client.status] || '#8bacc8'}22`, color: statusColors[client.status] || '#8bacc8', border: `1px solid ${statusColors[client.status] || '#8bacc8'}44` }}>{client.status}</span>
                </div>
                {(client.email || client.phone) && (
                  <div style={{ fontSize: '12px', color: '#8bacc8', marginTop: '4px' }}>
                    {client.email}{client.email && client.phone ? ' · ' : ''}{client.phone}
                  </div>
                )}
              </div>
              <span style={{ color: '#8bacc8', fontSize: '18px' }}>{expandedClient === client.id ? '▲' : '▼'}</span>
            </div>
            {expandedClient === client.id && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <ClientTrack client={client} program={program} />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

function ClientTrack({ client, program }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})

  useEffect(() => { loadTrack() }, [client.id])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData] = await Promise.all([
        callApi('msm_load_client_track', { program_id: program.id }),
        callApi('msm_load_client_progress', { client_id: client.id }),
      ])
      setPhases(trackData.phases || [])
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function saveTask(taskId, status, completedDate, completedBy, notes) {
    setSaving(p => ({ ...p, [taskId]: true }))
    try {
      await callApi('msm_save_client_task', {
        client_id: client.id,
        task_id: taskId,
        status,
        completed_date: completedDate || null,
        completed_by: completedBy || null,
        notes: notes || null,
      })
      setProgress(p => ({ ...p, [taskId]: { ...p[taskId], task_id: taskId, status, completed_date: completedDate, completed_by: completedBy, notes } }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [taskId]: false })) }
  }

  const inputStyle = { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }
  const STATUS_OPTIONS = ['', 'Completed', 'In Progress', 'Confirmed', 'Yes', 'No', 'N/A', 'Pending', 'Scheduled']
  const statusColors = { 'Completed': '#27ae60', 'Confirmed': '#27ae60', 'Yes': '#27ae60', 'In Progress': '#f39c12', 'Scheduled': '#5b9fe6', 'No': '#e74c3c', 'N/A': '#8bacc8', 'Pending': '#f39c12' }

  if (loading) return <div style={{ color: '#8bacc8', fontSize: '13px', padding: '16px' }}>Loading track...</div>

  if (phases.length === 0) return (
    <div style={{ color: '#8bacc8', fontSize: '13px', padding: '16px' }}>
      No client track defined for this program yet.
    </div>
  )

  return (
    <div>
      {phases.map(phase => (
        <div key={phase.id} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#5b9fe6', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</div>
          {(phase.program_client_tasks || []).map(task => {
            const p = progress[task.id] || {}
            const statusColor = statusColors[p.status] || 'transparent'
            return (
              <div key={task.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <span style={{ fontSize: '12px', color: '#8bacc8', marginRight: '6px' }}>{task.task_code}</span>
                  <span style={{ fontSize: '13px', color: '#fff' }}>{task.name}</span>
                </div>
                <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, p.completed_by, p.notes)}
                  disabled={saving[task.id]}
                  style={{ ...inputStyle, background: '#0d2a6e', minWidth: '130px' }}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || '-- Status --'}</option>)}
                </select>
                <input type="date" value={p.completed_date || ''} onChange={e => saveTask(task.id, p.status, e.target.value, p.completed_by, p.notes)}
                  style={{ ...inputStyle, width: '140px' }} />
                <input value={p.notes || ''} onChange={e => saveTask(task.id, p.status, p.completed_date, p.completed_by, e.target.value)}
                  placeholder="Notes" style={{ ...inputStyle, flex: 1, minWidth: '100px' }}
                  onBlur={e => saveTask(task.id, p.status, p.completed_date, p.completed_by, e.target.value)} />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}