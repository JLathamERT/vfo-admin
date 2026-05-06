import { useState, useEffect } from 'react'
import { callApi } from '../../../lib/api'
import PFPricingForm from './PFPricingForm'
import PFExtraMeetingForm from './PFExtraMeetingForm'
import PIPDecisionForm from './PIPDecisionForm'
import MeetingCompleteButton from './MeetingCompleteButton'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'

function ClientTrackViewV2({ clientId, programId, readOnly = false, notes = [], onNotesChange }) {
  const [phases, setPhases] = useState([])
  const [progress, setProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [completedPhases, setCompletedPhases] = useState({})
  const [c8ShowDate, setC8ShowDate] = useState(false)
  const [c8Date, setC8Date] = useState('')
  const [c8Triggering, setC8Triggering] = useState(false)
  const [pipelineData, setPipelineData] = useState(null)

  useEffect(() => { loadTrack() }, [clientId])

  async function loadTrack() {
    setLoading(true)
    try {
      const [trackData, progressData] = await Promise.all([
        callApi('msm_load_client_track', { program_id: programId }),
        callApi('msm_load_client_progress', { client_id: clientId }),
      ])
      const loadedPhases = trackData.phases || []
      setPhases(loadedPhases)
      const prog = {}
      ;(progressData.progress || []).forEach(p => { prog[p.task_id] = p })
      setProgress(prog)

      // Auto-expand: first incomplete phase, collapse completed ones
      const expandState = {}
      loadedPhases.forEach(phase => {
        const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
        const allDone = tasks.length === 0 || tasks.every(t => prog[t.id]?.status)
        expandState[phase.id] = !allDone
      })
      setExpanded(expandState)

      // Load pipeline data
      try {
        let clientRow = null
        if (readOnly) {
          const pData = await callApi('member_load_pipeline', { client_id: clientId })
          clientRow = pData.row || null
        } else {
          const pData = await callApi('automation_load_pipeline_data', { table_name: 'pipeline_map1' })
          clientRow = (pData.rows || []).find(r => r.client_id === clientId) || null
        }
        setPipelineData(clientRow || null)
      } catch (e) { console.error('Pipeline load error:', e) }
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

  async function saveDate(taskId, date) {
    const p = progress[taskId] || {}
    setSaving(prev => ({ ...prev, [taskId]: true }))
    try {
      await callApi('msm_save_client_task', { client_id: clientId, task_id: taskId, status: p.status, completed_date: date || null, completed_by: null, notes: null })
      setProgress(prev => ({ ...prev, [taskId]: { ...prev[taskId], completed_date: date } }))
    } catch (err) { console.error(err) }
    finally { setSaving(prev => ({ ...prev, [taskId]: false })) }
  }

  async function triggerC8(taskId, decision, date) {
    setC8Triggering(true)
    try {
      await callApi('automation_PIP1_reconfirmationemail', { client_id: clientId, decision, followup_meeting_date: date || null })
      const status = decision === 'Yes' ? 'Sent confirmation email' : 'Send declined email'
      await callApi('msm_save_client_task', { client_id: clientId, task_id: taskId, status, completed_date: new Date().toISOString().split('T')[0], completed_by: null, notes: null })
      setProgress(p => ({ ...p, [taskId]: { ...p[taskId], task_id: taskId, status, completed_date: new Date().toISOString().split('T')[0] } }))
      setC8ShowDate(false)
      setC8Date('')
    } catch (err) { console.error('C8 trigger error:', err) }
    finally { setC8Triggering(false) }
  }

  async function completePhase(phase) {
    const today = new Date().toISOString().split('T')[0]
    const autoCompleteCodes = {
          'MAP 1 - Initial Contact': ['Call outcome', 'PIP 1 scheduled', 'PIP Follow-Up scheduled'],
          'MAP 1 - PIP 1': ['PIP Initial presentation', 'CIQ complete', 'Prioritization complete'],
          'MAP 1 - PIP Follow Up': ['PIP Follow up presentation', 'Client PIP decision'],
        }
    const allowedCodes = autoCompleteCodes[phase.name] || []
    const tasks = (phase.program_client_tasks || []).filter(t => t.status_options && t.status_options !== 'auto' && allowedCodes.includes(t.name))
    setCompletedPhases(p => ({ ...p, [phase.id]: 'saving' }))
    try {
      await Promise.all(tasks.map(task => {
        const firstOption = task.status_options.split('|')[0]
        return callApi('msm_save_client_task', { client_id: clientId, task_id: task.id, status: firstOption, completed_date: today, completed_by: null, notes: null })
      }))
      const newProgress = { ...progress }
      tasks.forEach(task => {
        newProgress[task.id] = { ...newProgress[task.id], task_id: task.id, status: task.status_options.split('|')[0], completed_date: today }
      })
      setProgress(newProgress)
      setCompletedPhases(p => ({ ...p, [phase.id]: 'done' }))
      setTimeout(() => {
        setCompletedPhases(p => ({ ...p, [phase.id]: null }))
        setExpanded(p => ({ ...p, [phase.id]: false }))
      }, 2000)
    } catch (err) { console.error(err); setCompletedPhases(p => ({ ...p, [phase.id]: null })) }
  }

  const statusColors = { Completed: '#27ae60', Confirmed: '#27ae60', Yes: '#27ae60', 'Call arranged': '#27ae60', 'PIP 1 scheduled': '#27ae60', 'Follow-up scheduled': '#27ae60', 'PIP Follow-up confirmed': '#27ae60', 'Send confirmation email': '#27ae60', 'Sent confirmation email': '#27ae60', 'Regular priorities tab enabled': '#27ae60', 'Tax priorities tab enabled': '#27ae60', 'Completed + N/A': '#27ae60', 'Completed + Risk 1': '#27ae60', 'Completed + Risk 2': '#27ae60', 'Completed + Risk 3': '#27ae60', 'Completed + Risk 4': '#27ae60', 'Completed + Risk 5': '#27ae60', 'Lite': '#27ae60', 'Core': '#27ae60', 'Max': '#27ae60', 'In Progress': '#f39c12', Undecided: '#f39c12', 'No response': '#e74c3c', No: '#e74c3c', 'PIP Follow-up declined': '#e74c3c', 'Send declined email': '#e74c3c', 'Meeting declined': '#e74c3c', 'No show': '#e74c3c', 'Completed - Yes': '#27ae60', 'Completed - No': '#e74c3c', 'Completed - Undecided': '#f39c12' }

  function getPhaseState(phase) {
    const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
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

  const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>

  const totalTasks = phases.reduce((s, p) => s + (p.program_client_tasks || []).filter(t => t.status_options !== 'auto').length, 0)
  const completedTasks = phases.reduce((s, phase) => {
    return s + (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto' && progress[t.id]?.status && progress[t.id].status !== '').length
  }, 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{completedTasks}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>COMPLETED</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: '700', color: '#fff' }}>{totalTasks}</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>TOTAL</div></div>
        <div style={{ textAlign: 'center' }}><div style={{ fontSize: '28px', fontWeight: '700', color: '#27ae60' }}>{totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0}%</div><div style={{ fontSize: '11px', color: '#8bacc8' }}>PROGRESS</div></div>
      </div>

      {/* Phases */}
      {phases.map(phase => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        const doneTasks = nonAutoTasks.filter(t => progress[t.id]?.status && progress[t.id].status !== '').length
        const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
        const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
        const titleColor = state === 'active' ? '#5b9fe6' : '#fff'
        const autoCompletableCodesForCheck = {
          'MAP 1 - PIP 1': ['PIP Initial presentation', 'CIQ complete', 'Prioritization complete'],
          'MAP 1 - PIP Follow Up': ['PIP Follow up presentation', 'Client PIP decision'],
        }
        const autoCodesForPhase = autoCompletableCodesForCheck[phase.name] || []
        const autoTasksAllDone = autoCodesForPhase.length > 0 && (phase.program_client_tasks || [])
          .filter(t => autoCodesForPhase.includes(t.name))
          .every(t => progress[t.id]?.status && progress[t.id].status !== '')
        const hasCompleteButton = ['MAP 1 - PIP 1', 'MAP 1 - PIP Follow Up'].includes(phase.name) && !autoTasksAllDone
        const hasInlineCompleteButton = phase.name === 'MAP 1 - Initial Contact' && state !== 'done'
        const phaseCompleteState = completedPhases[phase.id]

        return (
          <div key={phase.id} style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
            {/* Phase header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'MAP 1').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#8bacc8', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>

            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="MAP 1" programName="VFO Holistic Planning" notes={notes} onNotesChange={onNotesChange} />}

            {/* Phase body */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>

{phase.name === 'MAP 1 - PC Admin' && (() => {
                  const pipDecisionTask = phases.find(ph => ph.name === 'MAP 1 - PIP Follow Up')?.program_client_tasks?.find(t => t.name === 'PIP Follow Up decision')
                  const pipStatus = pipDecisionTask ? (progress[pipDecisionTask.id]?.status || '') : ''
                  const pipDecision = pipStatus.replace('Completed - ', '')

                  if (!pipStatus || !pipStatus.startsWith('Completed')) return (
                    <div style={{ padding: '12px', color: '#8bacc8', fontSize: '13px' }}>Waiting for PIP Follow Up decision</div>
                  )

                  const finalDec = pipelineData?.c15_final_decision
                  const decisionColor = pipDecision === 'Yes' ? '#27ae60' : pipDecision === 'No' ? '#e74c3c' : finalDec === 'Yes' ? '#27ae60' : finalDec === 'No' ? '#e74c3c' : '#f39c12'
                  const decisionLabel = pipDecision === 'Yes' ? 'Yes — proceeding' : pipDecision === 'No' ? 'No — declined' : finalDec === 'Yes' ? `Yes — ${pipelineData?.c15_service_level || 'proceeding'}${pipelineData?.c15_via_extra_meeting ? ' (via extra meeting)' : ''}` : finalDec === 'No' ? `No — declined${pipelineData?.c15_via_extra_meeting ? ' (via extra meeting)' : ''}` : finalDec === 'ExtraMeeting' ? 'Extra meeting requested' : 'Undecided — awaiting client'

                  const autoStep = (label, done = false) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '12px', color: done ? '#27ae60' : '#8bacc8' }}>{label}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: done ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: done ? '#27ae60' : '#8bacc8', marginLeft: 'auto' }}>{done ? 'Done' : 'Not completed'}</span>
                    </div>
                  )

                  const pd_yes = pipelineData
                  const yesSteps = null

                  return (
                    <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: '#8bacc8' }}>Decision:</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>
                      </div>

                      {pipDecision === 'No' && autoStep('Decline email sent to client')}

                      {pipDecision === 'Yes' && (() => {
                        const pd = pd_yes
                        return (
                          <>
                            {autoStep('Agreement sent to client', pd?.c16_sent === 'Yes')}
                            {autoStep('Client signed', pd?.c17_client_signed === 'Yes')}
                            {autoStep('CEO signed', pd?.c18_ceo_signed === 'Yes')}
                            {autoStep('Payment link sent', pd?.c18_ceo_signed === 'Yes')}
                            {autoStep('Payment received', !!pd?.pay1_status)}
                            {autoStep('Invoice/receipt sent', !!pd?.invoice_number)}
                            {autoStep('Revenue share paid', !!pd?.rec1_rev_share)}
                            {autoStep('Member notified of revenue share', pd?.c24_email_sent === 'Yes')}
                          </>
                        )
                      })()}

                      {pipDecision === 'Undecided' && (() => {
                        const pd = pipelineData
                        const emailSent = pd?.c14_email_sent === 'Yes'
                        const finalDec = pd?.c15_final_decision
                        const needsPricing = finalDec === 'Yes' && !pd?.gross_fee

                        return (
                          <>
                            {autoStep('Decision email sent', emailSent)}
                            {autoStep('Client response received', !!finalDec)}
                            {finalDec && (
                              <div style={{ marginLeft: '14px', paddingLeft: '12px', marginTop: '4px', marginBottom: '4px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                                <div style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '8px',
                                  background: finalDec === 'Yes' ? 'rgba(39,174,96,0.15)' : finalDec === 'No' ? 'rgba(231,76,60,0.15)' : 'rgba(91,159,230,0.15)',
                                  color: finalDec === 'Yes' ? '#27ae60' : finalDec === 'No' ? '#e74c3c' : '#5b9fe6',
                                  border: `1px solid ${finalDec === 'Yes' ? 'rgba(39,174,96,0.3)' : finalDec === 'No' ? 'rgba(231,76,60,0.3)' : 'rgba(91,159,230,0.3)'}`
                                }}>
                                  {finalDec === 'Yes' ? `Yes — ${pd?.c15_service_level || ''}` : finalDec === 'No' ? 'No — declined' : 'Extra Meeting requested'}
                                </div>

                                {finalDec === 'No' && autoStep('Decline email sent to client', true)}

                                {finalDec === 'Yes' && (
                                  <>
                                    {needsPricing && !readOnly ? (
                              <PFPricingForm clientId={clientId} serviceLevel={pd?.c15_service_level} pipelineId={pd?.id} onComplete={() => loadTrack()} />
                                    ) : pd?.gross_fee ? (
                                      <>
                                        <div style={{ cursor: 'pointer' }} onClick={() => setExpanded(prev => ({ ...prev, pricing_details: !prev.pricing_details }))}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#27ae60', flexShrink: 0, border: '1px solid #27ae60' }} />
                                            <span style={{ fontSize: '12px', color: '#27ae60' }}>PF completed pricing</span>
                                            <span style={{ fontSize: '10px', color: '#8bacc8', marginLeft: '4px', transform: expanded.pricing_details ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', marginLeft: 'auto' }}>Done</span>
                                          </div>
                                        </div>
                                        {expanded.pricing_details && (
                                          <div style={{ marginLeft: '14px', padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', marginBottom: '4px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Service level</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.service_level || pd?.c15_service_level || '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Gross fee</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>${pd?.gross_fee || '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Member contribution</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.member_contribution ? `$${pd.member_contribution}` : '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Net invoice</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.net_invoice ? `$${pd.net_invoice}` : '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Member share</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.member_share ? `$${pd.member_share}` : '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>VFOs share</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.vfos_share ? `$${pd.vfos_share}` : '—'}</span></div>
                                            <div style={{ display: 'flex', padding: '2px 0' }}><span style={{ fontSize: '11px', color: '#5a8ab5', width: '140px' }}>Payment plan</span><span style={{ fontSize: '11px', color: '#d1dce8' }}>{pd?.payment_plan || '—'}</span></div>
                                          </div>
                                        )}
                                        {autoStep('Agreement sent to client', pd?.c16_sent === 'Yes')}
                                        {autoStep('Client signed', pd?.c17_client_signed === 'Yes')}
                                        {autoStep('CEO signed', pd?.c18_ceo_signed === 'Yes')}
                                        {autoStep('Payment link sent', false)}
                                        {autoStep('Payment received', !!pd?.pay1_status)}
                                        {autoStep('Invoice/receipt sent', !!pd?.invoice_number)}
                                        {autoStep('Revenue share paid', !!pd?.rec1_rev_share)}
                                        {autoStep('Member notified of revenue share', pd?.c24_email_sent === 'Yes')}
                                      </>
                                    ) : null}
                                  </>
                                )}

                                {finalDec === 'ExtraMeeting' && (
                                  <>
                                    {autoStep('Extra meeting requested', true)}
                                    <PFExtraMeetingForm clientId={clientId} pipelineId={pd?.id} onComplete={() => loadTrack()} />
                                  </>
                                )}
                              </div>
                            )}
                            {!finalDec && (
                              <div style={{ marginLeft: '14px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px', marginTop: '4px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '11px', color: '#5a8ab5', marginBottom: '6px' }}>If Yes:</div>
                                {autoStep('Agreement sent to client', pd?.c16_sent === 'Yes')}
                                {autoStep('Client signed', pd?.c17_client_signed === 'Yes')}
                                {autoStep('CEO signed', pd?.c18_ceo_signed === 'Yes')}
                                {autoStep('Payment link sent', pd?.c18_ceo_signed === 'Yes')}
                            {autoStep('Payment received', !!pd?.pay1_status)}
                                {autoStep('Invoice/receipt sent', !!pd?.invoice_number)}
                                {autoStep('Revenue share paid', !!pd?.rec1_rev_share)}
                                {autoStep('Member notified of revenue share', pd?.c24_email_sent === 'Yes')}
                                <div style={{ fontSize: '11px', color: '#5a8ab5', marginBottom: '6px', marginTop: '10px' }}>If No:</div>
                                {autoStep('Decline email sent to client')}
                                <div style={{ fontSize: '11px', color: '#5a8ab5', marginBottom: '6px', marginTop: '10px' }}>If extra meeting:</div>
                                {autoStep('Extra meeting held')}
                                {autoStep('PF submits outcome')}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )
                })()}

                {phase.name !== 'MAP 1 - PC Admin' &&
                tasks.map(task => {
                  const p = progress[task.id] || {}
                  const isDone = !!p.status
                  const statusColor = statusColors[p.status] || '#8bacc8'

                  if (task.status_options === 'auto') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60', flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>{task.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>
                    </div>
                  )

                  // READ-ONLY MODE (member side)
                  if (readOnly) {
                    const isPCAdmin = phase.name === 'MAP 1 - PC Admin'
                    const c10Status2 = progress[phases.find(ph => ph.name === 'MAP 1 - PIP Follow Up')?.program_client_tasks?.find(t => t.name === 'Client PIP decision')?.id]?.status || ''
                    const c14c15Active2 = c10Status2 === 'No' || c10Status2 === 'Undecided'
                    const isGreyedOut2 = isPCAdmin && (task.name === 'Email to Client if "Undecided" or "No" in C12' || task.name === 'Final client decision (if previously "Undecided" or "No")') && !c14c15Active2
                    return (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: isGreyedOut2 ? 0.3 : 1 }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                        {isDone
                          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                          : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
                        }
                        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
                      </div>
                    )
                  }

                  if (task.name === 'PIP Follow-up meeting re-confirmation/declined email') return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      {isDone
                        ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
                        : c8ShowDate
                          ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <input type="date" value={c8Date} onChange={e => setC8Date(e.target.value)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '11px' }} />
                              <button onClick={() => triggerC8(task.id, 'Yes', c8Date)} disabled={c8Triggering || !c8Date} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>{c8Triggering ? '...' : 'Send'}</button>
                              <button onClick={() => setC8ShowDate(false)} style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#8bacc8' }}>Cancel</button>
                            </div>
                          : <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => setC8ShowDate(true)} disabled={c8Triggering} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Send re-confirmation email to client</button>
                              <button onClick={() => triggerC8(task.id, 'No')} disabled={c8Triggering} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>{c8Triggering ? '...' : 'Meeting declined - Email client'}</button>
                            </div>
                      }
                      {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
                    </div>
                  )

                  if (task.name === 'Call arranged with client') return (
                    <div key={task.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                        <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'rgba(255,255,255,0.15)', color: isDone ? statusColor : '#fff' }}>
                          <option value="">-- Select --</option>
                          {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value)} style={{ ...inputStyle, width: '130px' }} />
                      </div>
                    </div>
                  )

                  const isPCAdmin = phase.name === 'MAP 1 - PC Admin'
                  const c10Status = progress[phases.find(ph => ph.name === 'MAP 1 - PIP Follow Up')?.program_client_tasks?.find(t => t.name === 'Client PIP decision')?.id]?.status || ''
                  const c14c15Active = c10Status === 'No' || c10Status === 'Undecided'
                  const isGreyedOut = isPCAdmin && (task.name === 'Email to Client if "Undecided" or "No" in C12' || task.name === 'Final client decision (if previously "Undecided" or "No")') && !c14c15Active

                  if (isPCAdmin) return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', opacity: isGreyedOut ? 0.3 : 1 }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: isDone ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: isDone ? '#27ae60' : '#8bacc8', border: `1px solid ${isDone ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                        {isDone ? 'Completed' : 'Not completed'}
                      </span>
                      {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
                    </div>
                  )

                  if (task.name === 'PIP Follow Up decision' && task.status_options === 'enter_details') {
                    if (readOnly && isDone) {
                      const dl = p.status.replace('Completed - ', '')
                      const dc = dl === 'Yes' ? '#27ae60' : dl === 'No' ? '#e74c3c' : '#f39c12'
                      return (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dc, flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>{task.name}</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${dc}22`, color: dc, border: `1px solid ${dc}44` }}>{dl}</span>
                          {p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
                        </div>
                      )
                    }
                    if (readOnly && !isDone) {
                      return (
                        <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }} />
                          <span style={{ fontSize: '13px', color: '#fff', flex: 1 }}>{task.name}</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
                        </div>
                      )
                    }
                    const dl = isDone ? p.status.replace('Completed - ', '') : ''
                    const dc = dl === 'Yes' ? '#27ae60' : dl === 'No' ? '#e74c3c' : dl === 'Undecided' ? '#f39c12' : '#8bacc8'
                    let formData = null
                    if (isDone) { try { formData = JSON.parse(p.notes || '{}') } catch(e) { formData = {} } }
                    const formExpandKey = `pipform_${task.id}`
                    const isFormShown = isDone ? expanded[formExpandKey] : true
                    return (
                      <div key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isDone ? 'pointer' : 'default' }} onClick={() => isDone && setExpanded(prev => ({ ...prev, [formExpandKey]: !prev[formExpandKey] }))}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? dc : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? dc : 'rgba(255,255,255,0.2)'}` }} />
                          <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
                          {isDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${dc}22`, color: dc, border: `1px solid ${dc}44` }}>{dl}</span>}
                          {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
                          {isDone && <span style={{ color: '#8bacc8', fontSize: '10px', transform: isFormShown ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>}
                        </div>
                        {isFormShown && (
                          <PIPDecisionForm
                            task={task}
                            clientId={clientId}
                            saveTask={saveTask}
                            existingData={formData}
                            onSubmitted={(status, data) => {
                              setProgress(prev => ({ ...prev, [task.id]: { ...prev[task.id], task_id: task.id, status, completed_date: new Date().toISOString().split('T')[0], notes: JSON.stringify(data) } }))
                            }}
                          />
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
                      <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
                      <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date)} disabled={saving[task.id]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'rgba(255,255,255,0.15)', color: isDone ? statusColor : '#fff' }}>
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

export default ClientTrackViewV2