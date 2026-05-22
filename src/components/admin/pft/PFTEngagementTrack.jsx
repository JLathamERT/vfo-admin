import { useState, useEffect } from 'react'
import { callApi } from '../../../lib/api'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'

function PFTEngagementTrack({ clientId, programId, readOnly = false, notes = [], onNotesChange }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})

  useEffect(() => { loadTrack() }, [clientId])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData] = await Promise.all([
        callApi('msm_load_client_track', { program_id: programId, track_type: 'partnership_fast_track' }),
        callApi('msm_load_client_progress', { client_id: clientId }),
      ])
      const loadedPhases = trackData.phases || []
      setPhases(loadedPhases)
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)

      const expandState = {}
      loadedPhases.forEach(phase => {
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

  function formatDate(d) {
    if (!d) return ''
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  }

  const pftStatusColors = { Complete: '#27ae60', Completed: '#27ae60', 'Complete - Yes': '#27ae60', 'Complete - No': '#e74c3c', Yes: '#27ae60', No: '#e74c3c', Undecided: '#f39c12', New: '#27ae60', 'Re-Set': '#27ae60', 'VFO FT': '#27ae60', 'VFO Associate': '#27ae60', Stopped: '#e74c3c', 'No show': '#e74c3c', 'Meeting 1 scheduled': '#27ae60', 'Meeting 2 scheduled': '#27ae60', 'Meeting 3 scheduled': '#27ae60', 'Confirmation email sent': '#27ae60', 'Meeting declined': '#e74c3c', 'No response': '#e74c3c', 'Call arranged': '#27ae60', 'VFO FT confirmed': '#27ae60', 'VFO Associate confirmed': '#27ae60', 'No confirmed': '#e74c3c' }
  const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }
  const dateSpanStyle = { fontSize: '11px', color: '#5a8ab5', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>

  const confirmEmailTask = phases.flatMap(p => p.program_client_tasks || []).find(t => t.name === 'Accountant decision confirmation email')
  const confirmEmailStatus = confirmEmailTask ? progress[confirmEmailTask.id]?.status : null

  return (
    <div>
      {phases.map(phase => {
        // Phase 6 visibility based on A23
        const isAssociatePhase = phase.name.includes('VFO-Associate')
        const isFTPhase = phase.name.includes('VFO-FT Accountant')
        const phaseGreyedOut = (isAssociatePhase || isFTPhase) && (!confirmEmailStatus || (isAssociatePhase && confirmEmailStatus !== 'VFO Associate confirmed') || (isFTPhase && confirmEmailStatus !== 'VFO FT confirmed'))

        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto' && !t.status_options?.startsWith('auto_'))
        const doneTasks = nonAutoTasks.filter(t => progress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
        const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
        const titleColor = state === 'active' ? '#5b9fe6' : '#fff'

        return (
          <div key={phase.id} style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden', opacity: phaseGreyedOut ? 0.3 : 1, pointerEvents: phaseGreyedOut ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'PFT').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#8bacc8', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>

            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="PFT" programName="Partnership Fast Track" notes={notes} onNotesChange={onNotesChange} />}

            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {tasks.map(task => {
                  const p = progress[task.id] || {}
                  const isDone = !!p.status
                  const statusColor = pftStatusColors[p.status] || '#8bacc8'

                  // Meeting-scheduled date input (replicates tax 'Date Scheduled for High Level Meeting' pattern)
                  if (['Date scheduled for Meeting 1', 'Date scheduled for Meeting 2', 'Date scheduled for Meeting 3'].includes(task.name)) {
                    const savedDate = p.completed_date || ''
                    const statusValue = (task.status_options || '').split('|')[0]
                    async function saveScheduledDate(value) {
                      setSaving(prev => ({ ...prev, [task.id]: true }))
                      try {
                        const newStatus = value ? statusValue : null
                        await callApi('msm_save_client_task', { client_id: clientId, task_id: task.id, status: newStatus, completed_date: value || null, completed_by: null, notes: null })
                        setProgress(prev => ({ ...prev, [task.id]: { ...prev[task.id], task_id: task.id, status: newStatus, completed_date: value || null } }))
                      } catch (err) { console.error(err) }
                      finally { setSaving(prev => ({ ...prev, [task.id]: false })) }
                    }
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: savedDate ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${savedDate ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: savedDate ? '#8bacc8' : '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
                        {readOnly ? (
                          savedDate && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#27ae6022', color: '#27ae60', border: '1px solid #27ae6044' }}>{savedDate}</span>
                        ) : (
                          <input type="date" value={savedDate} onChange={(e) => saveScheduledDate(e.target.value)} disabled={saving[task.id]} style={{ ...inputStyle, fontFamily: 'DM Sans, sans-serif' }} />
                        )}
                      </div>
                    )
                  }

                  // Read-only mode
                  if (readOnly) {
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                        {isDone
                          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                          : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
                        }
                        <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
                      </div>
                    )
                  }

                  // Skip Right accountant questions — rendered in grouped section
                  if (['Right clients?', 'Right client relationships?', 'Right attitude (to change)?'].includes(task.name)) return null

                  // Right accountant conclusion — render grouped section
                  if (task.status_options === 'auto_pft_a11') {
                    const allTasks2 = phases.flatMap(ph => ph.program_client_tasks || [])
                    const q1 = allTasks2.find(t => t.name === 'Right clients?')
                    const q2 = allTasks2.find(t => t.name === 'Right client relationships?')
                    const q3 = allTasks2.find(t => t.name === 'Right attitude (to change)?')
                    const a11Val = getA11Status()
                    const a11Color = a11Val === 'Yes' ? '#27ae60' : a11Val === 'No' ? '#e74c3c' : '#8bacc8'
                    const questions = [q1, q2, q3].filter(Boolean)
                    return (
                      <div key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
                        <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', fontWeight: '600' }}>Right accountant?</div>
                        <div style={{ marginLeft: '18px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px', paddingBottom: '4px' }}>
                          {questions.map(q => {
                            const qp = progress[q.id] || {}
                            const qDone = !!qp.status
                            const qColor = pftStatusColors[qp.status] || '#8bacc8'
                            return (
                              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: qDone ? qColor : 'transparent', flexShrink: 0, border: `1px solid ${qDone ? qColor : 'rgba(255,255,255,0.2)'}` }} />
                                <span style={{ fontSize: '12px', color: qDone ? '#8bacc8' : '#fff', flex: 1 }}>{q.name}</span>
                                {readOnly
                                  ? (qDone
                                    ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${qColor}22`, color: qColor, border: `1px solid ${qColor}44` }}>{qp.status}</span>
                                    : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>)
                                  : <select value={qp.status || ''} onChange={e => saveTask(q.id, e.target.value, qp.completed_date)} disabled={saving[q.id]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '100px', fontSize: '11px', borderColor: qDone ? `${qColor}66` : 'rgba(255,255,255,0.15)', color: qDone ? qColor : '#fff' }}>
                                      <option value="">-- Select --</option>
                                      {(q.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                }
                                <span style={dateSpanStyle}>{qDone && qp.completed_date ? formatDate(qp.completed_date) : ''}</span>
                              </div>
                            )
                          })}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', marginTop: '4px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: a11Val ? a11Color : 'transparent', flexShrink: 0, border: `1px solid ${a11Val ? a11Color : 'rgba(255,255,255,0.2)'}` }} />
                            <span style={{ fontSize: '12px', color: '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${a11Color}22`, color: a11Color, border: `1px solid ${a11Color}44`, fontWeight: '600' }}>{a11Val || 'Pending'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // Meeting 2 confirmation — two buttons
                  if (task.name === 'Meeting 2 confirmation email (+ discovery form)/declined email') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                        : <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveTask(task.id, 'Confirmation email sent', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Send confirmation email + discovery form to accountant</button>
                            <button onClick={() => saveTask(task.id, 'Meeting declined', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Meeting declined - Email client</button>
                          </div>
                      }
                      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
                    </div>
                  )

                  // Meeting 3 confirmation — two buttons
                  if (task.name === 'Meeting 3 confirmation email') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                        : <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveTask(task.id, 'Confirmation email sent', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Send confirmation email to accountant</button>
                            <button onClick={() => saveTask(task.id, 'Meeting declined', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Meeting declined - Email client</button>
                          </div>
                      }
                      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
                    </div>
                  )

                  // Accountant decision confirmation email — three buttons
                  if (task.name === 'Accountant decision confirmation email') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                        : <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => saveTask(task.id, 'VFO FT confirmed', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Email confirming VFO FT</button>
                            <button onClick={() => saveTask(task.id, 'VFO Associate confirmed', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Email confirming VFO Associate</button>
                            <button onClick={() => saveTask(task.id, 'No confirmed', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Email confirming No</button>
                          </div>
                      }
                      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
                    </div>
                  )

                  // VFO Associate setup — placeholder form
                  if (task.name === 'VFO Associate setup') return (
                    <div key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
                        {isDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Completed</span>}
                      </div>
                      {!isDone && (
                        <div style={{ marginLeft: '18px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                          <div style={{ fontSize: '13px', color: '#5a8ab5', textAlign: 'center', padding: '20px 0' }}>New accountant setup form — coming soon</div>
                        </div>
                      )}
                    </div>
                  )

                  // VFO FT setup — placeholder form
                  if (task.name === 'VFO FT setup (contract and payment complete)') return (
                    <div key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
                        {isDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Completed</span>}
                      </div>
                      {!isDone && (
                        <div style={{ marginLeft: '18px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '8px' }}>
                          <div style={{ fontSize: '13px', color: '#5a8ab5', textAlign: 'center', padding: '20px 0' }}>New accountant setup form — coming soon</div>
                        </div>
                      )}
                    </div>
                  )

                  // Auto badge steps (Team notification, VFO-Liaison)
                  if (task.name === 'Team notification' || task.name === 'VFO-Liaison Introduction' || task.name === 'VFO-Liaison introduction') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: isDone ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: isDone ? '#27ae60' : '#8bacc8', border: `1px solid ${isDone ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.1)'}` }}>{isDone ? 'Completed' : 'Not completed'}</span>
                      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
                    </div>
                  )

                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'rgba(255,255,255,0.15)', color: isDone ? statusColor : '#fff' }}>
                        <option value="">-- Select --</option>
                        {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span style={dateSpanStyle}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
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

export default PFTEngagementTrack