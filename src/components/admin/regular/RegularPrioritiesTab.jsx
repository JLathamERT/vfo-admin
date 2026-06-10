import { useState, useEffect } from 'react'
import { callApi } from '../../../lib/api'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'
import { TaxPlanListSkeleton } from '../../shared/Skeleton'
import { TrackHero, PhaseBadge, ListHeader } from '../../shared/TrackKit'

const REGULAR_PRIORITIES = [
  "Business Growth", "Business Exit", "Business Advisory",
  "Long Term Sickness Concern", "Living too Long Concern", "Death Impacting Dependents Concern",
  "Asset Protection (Personally Sued)", "Loss of Key Person", "Asset Protection (Business Sued)",
  "Technology Advancements", "Risk Mitigation",
  "Wealth Planning (Short Term)", "Wealth Planning (Long Term)", "Wealth Planning (Short/Long Term)",
  "Wealth Planning (Grow Wealth)", "Wealth Planning (Retain Wealth)", "Wealth Planning (Grow/Retain Wealth)",
  "Wealth Planning (Young Kids Focus)", "Wealth Planning (College Planning Focus)",
  "Wealth Planning (Retirement Planning Focus)", "Wealth Planning (Legacy Planning Focus)",
  "Wealth Planning (Alternative Investments Focus)", "Wealth Planning",
  "Family Law", "Trusts and Wills (Estate Planning)", "Contract / Corporate Law",
  "Structuring Entities", "Buy / Sell Agreements", "Joint Venture Agreements",
  "Intellectual Property", "Legal Focus"
]

function PriorityTrackView({ track, phases, progress, specialists, onBack, onProgressChange, readOnly = false, onTrackUpdate, notes = [], onNotesChange, clientId }) {
  const [localProgress, setLocalProgress] = useState(() => {
    // Auto-fill C25.1 with track's specialist if not already set
    if (track.specialist_name) {
      const c251Task = phases.flatMap(p => p.program_client_tasks || []).find(t => t.name === 'Allocate to VFO Specialist')
      if (c251Task && !progress[c251Task.id]?.status) {
        return { ...progress, [c251Task.id]: { ...progress[c251Task.id], task_id: c251Task.id, status: track.specialist_name } }
      }
    }
    return progress
  })
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [completedPhases, setCompletedPhases] = useState({})
  const [trackStatus, setTrackStatus] = useState(track.status || 'live')
  const [togglingStatus, setTogglingStatus] = useState(false)

  async function toggleTrackStatus() {
    const newStatus = trackStatus === 'live' ? 'stopped' : 'live'
    setTogglingStatus(true)
    try {
      await callApi('msm_update_priority_status', { priority_track_id: track.id, status: newStatus })
      setTrackStatus(newStatus)
    } catch (err) { console.error(err) }
    finally { setTogglingStatus(false) }
  }

  useEffect(() => {
    const expandState = {}
    phases.forEach(phase => {
      const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
      const allDone = tasks.length > 0 && tasks.every(t => localProgress[t.id]?.status)
      expandState[phase.id] = !allDone
    })
    setExpanded(expandState)
  }, [])

  async function saveTask(taskId, status, existingDate) {
    const today = new Date().toISOString().split('T')[0]
    const date = existingDate || (status ? today : null)
    setSaving(p => ({ ...p, [taskId]: true }))
    try {
      await callApi('msm_save_priority_task', { priority_track_id: track.id, task_id: taskId, status, completed_date: date || null })
      const updated = { ...localProgress[taskId], task_id: taskId, status, completed_date: date }
      setLocalProgress(p => ({ ...p, [taskId]: updated }))
      onProgressChange(taskId, updated)
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [taskId]: false })) }
  }

  async function saveDate(taskId, date) {
    const p = localProgress[taskId] || {}
    setSaving(prev => ({ ...prev, [taskId]: true }))
    try {
      await callApi('msm_save_priority_task', { priority_track_id: track.id, task_id: taskId, status: p.status, completed_date: date || null })
      setLocalProgress(prev => ({ ...prev, [taskId]: { ...prev[taskId], completed_date: date } }))
    } catch (err) { console.error(err) }
    finally { setSaving(prev => ({ ...prev, [taskId]: false })) }
  }

  async function completePhase(phase) {
    const today = new Date().toISOString().split('T')[0]
    const autoCompleteCodes = { 'MAP 4 - Educate': ['MAP 4 meeting'] }
    const allowedCodes = autoCompleteCodes[phase.name] || []
    const tasks = (phase.program_client_tasks || []).filter(t => allowedCodes.includes(t.name))
    setCompletedPhases(p => ({ ...p, [phase.id]: 'saving' }))
    try {
      await Promise.all(tasks.map(task => callApi('msm_save_priority_task', { priority_track_id: track.id, task_id: task.id, status: task.status_options.split('|')[0], completed_date: today })))
      const newProgress = { ...localProgress }
      tasks.forEach(task => { newProgress[task.id] = { task_id: task.id, status: task.status_options.split('|')[0], completed_date: today } })
      setLocalProgress(newProgress)
      setCompletedPhases(p => ({ ...p, [phase.id]: 'done' }))
      setTimeout(() => { setCompletedPhases(p => ({ ...p, [phase.id]: null })); setExpanded(p => ({ ...p, [phase.id]: false })) }, 2000)
    } catch (err) { console.error(err); setCompletedPhases(p => ({ ...p, [phase.id]: null })) }
  }

  const statusColors = { Completed: '#1b9254', Yes: '#1b9254', 'No additional info required': '#1b9254', 'MAP 4 scheduled': '#1b9254', 'MAP 4 Scheduled': '#1b9254', No: '#e74c3c', 'No show': '#e74c3c', 'Additional info required': '#1b9254' }
  const inputStyle = { padding: '6px 10px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '13px', fontFamily: 'Inter, sans-serif' }

  function getPhaseState(phase) {
    const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (tasks.length === 0) {
      const autoTasks = phase.program_client_tasks || []
      const allAutoDone = autoTasks.length > 0 && autoTasks.every(t => localProgress[t.id]?.status)
      return allAutoDone ? 'done' : 'pending'
    }
    if (tasks.every(t => localProgress[t.id]?.status)) return 'done'
    if (tasks.some(t => localProgress[t.id]?.status)) return 'active'
    return 'pending'
  }

  const c253TaskId = phases.flatMap(p => p.program_client_tasks || []).find(t => t.name === 'Additional information required')?.id
  const c253Status = localProgress[c253TaskId]?.status || ''
  const additionalInfoRequired = c253Status === 'Additional info required'

  function formatDate(d) {
    if (!d) return ''
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  }

  const totalTasks = phases.reduce((s, p) => s + (p.program_client_tasks || []).filter(t => t.status_options !== 'auto').length, 0)
  const completedTasks = phases.reduce((s, phase) => s + (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto' && localProgress[t.id]?.status).length, 0)

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to Priorities</button>
      <TrackHero
        eyebrow="Regular Priority"
        title={track.priority_name}
        meta={track.specialist_name ? `Specialist: ${track.specialist_name}` : null}
        completed={completedTasks}
        total={totalTasks}
        steps={phases.map(ph => ({ label: ph.name, state: getPhaseState(ph) }))}
        action={!readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: '#16264a', fontWeight: '600' }}>{trackStatus === 'live' ? 'Live' : 'Stopped'}</span>
            <div onClick={() => !togglingStatus && toggleTrackStatus()}
              style={{ width: '44px', height: '24px', borderRadius: '12px', background: trackStatus === 'live' ? '#1b9254' : '#e74c3c', cursor: 'pointer', position: 'relative', opacity: togglingStatus ? 0.5 : 1 }}>
              <div style={{ position: 'absolute', top: '2px', left: trackStatus === 'live' ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        )}
      />

      {phases.map((phase, phaseIdx) => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        const doneTasks = nonAutoTasks.filter(t => localProgress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = state === 'active' ? '#125ecc' : '#002973'
        const showCompleteBtn = false
        const phaseCompleteState = completedPhases[phase.id]

        return (
          <div key={phase.id} style={{ background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}>
                <PhaseBadge number={phaseIdx + 1} state={state} />
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12.5px', fontWeight: 800, color: titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {showCompleteBtn && (
                  <button onClick={e => { e.stopPropagation(); completePhase(phase) }} disabled={phaseCompleteState === 'saving'}
                    style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', background: phaseCompleteState === 'done' ? 'rgba(27,146,84,0.15)' : 'rgba(0,149,255,0.15)', border: `1px solid ${phaseCompleteState === 'done' ? 'rgba(27,146,84,0.4)' : 'rgba(0,149,255,0.4)'}`, color: phaseCompleteState === 'done' ? '#1b9254' : '#0095ff', whiteSpace: 'nowrap' }}>
                    {phaseCompleteState === 'saving' ? 'Saving...' : '✓ Auto complete — all completed and confirmed'}
                  </button>
                )}
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'Regular Priorities').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'done' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#4e6087', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>

            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="Regular Priorities" programName="VFO Holistic Planning" notes={notes} onNotesChange={onNotesChange} />}

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {tasks.map(task => {
                  const p = localProgress[task.id] || {}
                  const isDone = !!p.status
                  const statusColor = statusColors[p.status] || '#4e6087'

                  if (task.status_options === 'auto') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#1b9254' : '#c7d4e8'}` }} />
                      <span style={{ fontSize: '13px', color: '#4e6087', flex: 1 }}>{task.name}</span>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: isDone ? 'rgba(27,146,84,0.15)' : '#eef2f9', color: isDone ? '#1b9254' : '#4e6087', border: `1px solid ${isDone ? 'rgba(27,146,84,0.3)' : '#e3eaf5'}` }}>{isDone ? 'Completed' : 'Not completed'}</span>
                      {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#697a9c' }}>{formatDate(p.completed_date)}</span>}
                    </div>
                  )

                  if (readOnly) return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                        : <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>Not started</span>
                      }
                      {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#697a9c' }}>{formatDate(p.completed_date)}</span>}
                    </div>
                  )

                  if (task.status_options === 'specialist_select') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#1b9254' : '#c7d4e8'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
                      <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#ffffff', minWidth: '200px', color: isDone ? '#1b9254' : '#16264a', borderColor: isDone ? 'rgba(27,146,84,0.4)' : '#d6e0ee' }}>
                        <option value="">-- Select Specialist --</option>
                        {specialists.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                      <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value)} style={{ ...inputStyle, width: '130px' }} />
                    </div>
                  )

                  if (task.status_options === 'enter_details') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#1b9254' : '#c7d4e8'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Completed</span>
                        : <button onClick={() => saveTask(task.id, 'Completed', p.completed_date)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600 }}>Enter details</button>
                      }
                      <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value)} style={{ ...inputStyle, width: '130px' }} />
                    </div>
                  )

                  // Skip tasks rendered as children inside Additional info handler
                  if (['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(task.name)) return null

                  // Additional information required — render with indented children
                  if (task.name === 'Additional information required') {
                    const childTaskNames = ['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L']
                    const allPhaseTasks = phases.flatMap(p => p.program_client_tasks || [])
                    const childTasks = allPhaseTasks.filter(t => childTaskNames.includes(t.name))
                    const greyed = !additionalInfoRequired
                    return (
                      <div key={task.id} style={{ borderBottom: '1px solid #e9eef8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
                          <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
                          <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#ffffff', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : '#d6e0ee', color: isDone ? statusColor : '#16264a' }}>
                            <option value="">-- Select --</option>
                            {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value)} style={{ ...inputStyle, width: '130px' }} />
                        </div>
                        <div style={{ marginLeft: '18px', borderLeft: '1px solid #ebf0f8', paddingLeft: '12px', paddingBottom: '4px', opacity: greyed ? 0.3 : 1, pointerEvents: greyed ? 'none' : 'auto' }}>
                          {childTasks.map(ct => {
                            const cp = localProgress[ct.id] || {}
                            const cDone = !!cp.status
                            const cColor = statusColors[cp.status] || '#4e6087'
                            return (
                              <div key={ct.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cDone ? cColor : 'transparent', flexShrink: 0, border: `1px solid ${cDone ? cColor : '#c7d4e8'}` }} />
                                <span style={{ fontSize: '12px', color: cDone ? '#4e6087' : '#16264a', flex: 1 }}>{ct.name}</span>
                                <select value={cp.status || ''} onChange={e => saveTask(ct.id, e.target.value, cp.completed_date)} style={{ ...inputStyle, background: '#ffffff', minWidth: '120px', fontSize: '11px', borderColor: cDone ? `${cColor}66` : '#d6e0ee', color: cDone ? cColor : '#16264a' }}>
                                  <option value="">-- Select --</option>
                                  {(ct.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <input type="date" value={cp.completed_date || ''} onChange={e => saveDate(ct.id, e.target.value)} style={{ ...inputStyle, width: '120px', fontSize: '11px' }} />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  const isGreyedOut = false
                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #e9eef8', flexWrap: 'wrap', opacity: isGreyedOut ? 0.3 : 1, pointerEvents: isGreyedOut ? 'none' : 'auto' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
                      <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#ffffff', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : '#d6e0ee', color: isDone ? statusColor : '#16264a' }}>
                        <option value="">-- Select --</option>
                        {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value)} style={{ ...inputStyle, width: '130px' }} />
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

function RegularPrioritiesTab({ clientId, programId, client, specialists, readOnly = false, notes = [], onNotesChange }) {
  const [priorityTracks, setPriorityTracks] = useState([])
  const [phases, setPhases] = useState([])
  const [allProgress, setAllProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newPriority, setNewPriority] = useState('')
  const [newSpecialist, setNewSpecialist] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [regularEnabled, setRegularEnabled] = useState(false)

  useEffect(() => { loadData() }, [clientId])

  async function loadData() {
    setLoading(true)
    try {
      const [tracksData, phasesData, map1Progress] = await Promise.all([
        callApi('msm_load_priority_tracks', { client_id: clientId }),
        callApi('msm_load_regular_phases', { program_id: programId }),
        callApi('msm_load_client_progress', { client_id: clientId }),
      ])
      setPriorityTracks((tracksData.tracks || []).filter(t => t.track_type !== 'pip'))
      setPhases(phasesData.phases || [])

      // Check if C25 is enabled
      const enabled = (map1Progress.progress || []).some(p => p.status === 'Regular priorities tab enabled')
      setRegularEnabled(enabled)

      // Load progress for all priority tracks
      const progressMap = {}
      await Promise.all((tracksData.tracks || []).map(async track => {
        const pd = await callApi('msm_load_priority_progress', { priority_track_id: track.id })
        progressMap[track.id] = {}
        ;(pd.progress || []).forEach(p => { progressMap[track.id][p.task_id] = p })
      }))
      setAllProgress(progressMap)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function addPriority() {
    if (!newPriority) { setAddStatus('Select a priority.'); return }
    if (!newSpecialist) { setAddStatus('Select a specialist.'); return }
    try {
      await callApi('msm_add_priority_track', { client_id: clientId, priority_name: newPriority, track_type: 'regular', specialist_name: newSpecialist })
      setNewPriority(''); setNewSpecialist(''); setShowAdd(false); setAddStatus('')
      loadData()
    } catch (err) { setAddStatus(err.message) }
  }

  function getTrackState(track) {
    const prog = allProgress[track.id] || {}
    const allTasks = phases.flatMap(p => p.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (allTasks.length === 0) return 'not started'
    if (allTasks.every(t => prog[t.id]?.status)) return 'completed'
    if (allTasks.some(t => prog[t.id]?.status)) return 'in progress'
    return 'not started'
  }

  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '16px' }
  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const stateColors = { 'not started': '#4e6087', 'in progress': '#0095ff', 'completed': '#1b9254' }

  if (loading) return <TaxPlanListSkeleton />


  if (selectedTrack) {
    return (
      <PriorityTrackView
        track={selectedTrack}
        phases={phases}
        progress={allProgress[selectedTrack.id] || {}}
        specialists={specialists}
        onBack={() => { setSelectedTrack(null); loadData() }}
        onProgressChange={(taskId, p) => setAllProgress(prev => ({ ...prev, [selectedTrack.id]: { ...prev[selectedTrack.id], [taskId]: p } }))}
        readOnly={readOnly}
        onTrackUpdate={loadData}
        notes={notes}
        onNotesChange={onNotesChange}
        clientId={clientId}
      />
    )
  }

  return (
    <div>
      {!regularEnabled && (
        <div style={{ ...sectionStyle, borderColor: 'rgba(231,76,60,0.3)', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '15px', color: '#4e6087' }}>Regular Priorities is not yet enabled for this client.</div>
          <div style={{ fontSize: '13px', color: '#697a9c', marginTop: '8px' }}>Set C25 to "Regular priorities tab enabled" in MAP 1 first.</div>
        </div>
      )}

      {regularEnabled && (
        <>
          <ListHeader
            title="Regular Priorities"
            count={priorityTracks.length}
            action={!readOnly && <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>+ Add Priority</button>}
          />


          {showAdd && (
            <div style={{ ...sectionStyle, marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Add Regular Priority</div>
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ ...inputStyle, background: '#ffffff', marginBottom: '12px' }}>
                <option value="">-- Select Priority --</option>
                {REGULAR_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={newSpecialist} onChange={e => setNewSpecialist(e.target.value)} style={{ ...inputStyle, background: '#ffffff', marginBottom: '12px' }}>
                <option value="">-- Select Specialist --</option>
                {specialists.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={addPriority} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>Add</button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              </div>
              {addStatus && <p style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginTop: '8px' }}>{addStatus}</p>}
            </div>
          )}

          {priorityTracks.length === 0 && !showAdd && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>No priorities added yet.</div>
          )}

          {priorityTracks.map(track => {
            const state = getTrackState(track)
            const stateColor = stateColors[state]
            return (
              <div key={track.id} onClick={() => setSelectedTrack(track)}
                style={{ ...sectionStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#eef2f9'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#16264a', marginBottom: '4px' }}>{track.priority_name}{track.specialist_name ? ` (${track.specialist_name})` : ''}</div>
                  <div style={{ fontSize: '12px', color: '#4e6087' }}>{new Date(track.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: track.status === 'stopped' ? 'rgba(231,76,60,0.15)' : 'rgba(27,146,84,0.15)', color: track.status === 'stopped' ? '#e74c3c' : '#1b9254', border: `1px solid ${track.status === 'stopped' ? 'rgba(231,76,60,0.3)' : 'rgba(27,146,84,0.3)'}` }}>{track.status === 'stopped' ? 'Stopped' : 'Live'}</span>
                  {track.status !== 'stopped' && <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: `${stateColor}22`, color: stateColor, border: `1px solid ${stateColor}44`, textTransform: 'capitalize' }}>{state}</span>}
                  <span style={{ color: '#0095ff', fontWeight: 500, fontSize: '13px' }}>View →</span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

export default RegularPrioritiesTab