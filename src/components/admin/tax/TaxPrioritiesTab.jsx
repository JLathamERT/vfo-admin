import { useState, useEffect } from 'react'
import { callApi } from '../../../lib/api'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'

function TaxDecisionForm({ task, plan, saveTask, taxSpecialistId, existingData, onSubmitted }) {
  const existing = existingData || {}
  const isViewMode = !!existingData

  const [decision, setDecision] = useState(existing.decision || '')
  const [taxRiskMindset, setTaxRiskMindset] = useState(existing.taxRiskMindset || '')
  const [retainerPayment, setRetainerPayment] = useState(existing.retainerPayment || '')
  const [implementationFee, setImplementationFee] = useState(existing.implementationFee || '')
  const [splitType, setSplitType] = useState(existing.splitType || '')
  const [memberShare, setMemberShare] = useState(existing.memberShare || '')
  const [vfosShare, setVfosShare] = useState(existing.vfosShare || '')
  const [potentialTaxSavings, setPotentialTaxSavings] = useState(existing.potentialTaxSavings || '')
  const [initialRetainer, setInitialRetainer] = useState(existing.initialRetainer || '')
  const [ccRecipients, setCcRecipients] = useState(existing.ccRecipients || [])
  const [ccInput, setCcInput] = useState('')
  const [presentationLink, setPresentationLink] = useState(existing.presentationLink || '')
  const [meetingNotes, setMeetingNotes] = useState(existing.meetingNotes || '')
  const [submitting, setSubmitting] = useState(false)

  const totalFee = (parseFloat(retainerPayment) || 0) + (parseFloat(implementationFee) || 0)

  useEffect(() => {
    if (isViewMode) return
    if (splitType === '1/3 Member, 2/3 VFOS') {
      const ms = (totalFee / 3).toFixed(2)
      const vs = (totalFee - parseFloat(ms)).toFixed(2)
      setMemberShare(ms)
      setVfosShare(vs)
    } else if (splitType === '50/50') {
      const half = (totalFee / 2).toFixed(2)
      setMemberShare(half)
      setVfosShare(half)
    }
  }, [splitType, totalFee])

  function handleMemberShareChange(val) {
    setMemberShare(val)
    if (splitType === 'Custom') {
      const remaining = (totalFee - (parseFloat(val) || 0)).toFixed(2)
      setVfosShare(remaining >= 0 ? remaining : '0.00')
    }
  }
  function handleVfosShareChange(val) {
    setVfosShare(val)
    if (splitType === 'Custom') {
      const remaining = (totalFee - (parseFloat(val) || 0)).toFixed(2)
      setMemberShare(remaining >= 0 ? remaining : '0.00')
    }
  }

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: '11px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)' }
  const readOnlyInput = { ...inputStyle, opacity: 0.6, pointerEvents: 'none' }

  function addCc() {
    if (ccInput && ccInput.includes('@')) { setCcRecipients([...ccRecipients, ccInput]); setCcInput('') }
  }
  function removeCc(i) {
    if (isViewMode) return
    setCcRecipients(ccRecipients.filter((_, idx) => idx !== i))
  }

  async function handleSubmit() {
    if (!decision) return
    setSubmitting(true)
    const formData = { decision, presentationLink, meetingNotes, ccRecipients }
    if (decision === 'Yes') {
      formData.taxRiskMindset = taxRiskMindset
      formData.retainerPayment = retainerPayment
      formData.implementationFee = implementationFee
      formData.totalFee = totalFee.toFixed(2)
      formData.splitType = splitType
      formData.memberShare = memberShare
      formData.vfosShare = vfosShare
    } else if (decision === 'Undecided') {
      formData.potentialTaxSavings = potentialTaxSavings
      formData.initialRetainer = initialRetainer
    }
    try {
      await callApi('tax_save_task', {
        tax_plan_id: plan.id,
        task_id: task.id,
        status: `Completed - ${decision}`,
        completed_date: new Date().toISOString().split('T')[0],
        notes: JSON.stringify(formData),
        tax_specialist_id: taxSpecialistId || null
      })
      if (onSubmitted) onSubmitted(`Completed - ${decision}`, formData)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const riskOptions = [
    'Yes — Risk 1 — Very Conservative Mindset',
    'Yes — Risk 2 - Moderately Conservative Mindset',
    'Yes — Risk 3 — Average Risk Mindset',
    'Yes — Risk 4 — Moderately Aggressive Mindset',
    'Yes — Risk 5 — Very Aggressive Mindset',
  ]
  const splitOptions = ['1/3 Member, 2/3 VFOS', '50/50', 'Custom']
  const isCustomSplit = splitType === 'Custom'
  const isPresetSplit = splitType && !isCustomSplit

  return (
    <div style={{ marginLeft: '18px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', marginBottom: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Client decision</label>
        {isViewMode
          ? <div style={{ ...inputStyle, opacity: 0.6 }}>{decision}</div>
          : <select value={decision} onChange={e => setDecision(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
              <option value="">-- Select --</option>
              <option value="Yes">Yes</option>
              <option value="Undecided">Undecided</option>
              <option value="No">No</option>
            </select>
        }
      </div>

      {decision === 'Yes' && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Tax risk mindset</label>
            {isViewMode
              ? <div style={readOnlyInput}>{taxRiskMindset || '—'}</div>
              : <select value={taxRiskMindset} onChange={e => setTaxRiskMindset(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  {riskOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            }
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Fee details</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Retainer payment</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                  <input value={retainerPayment} onChange={e => setRetainerPayment(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Implementation fee</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                  <input value={implementationFee} onChange={e => setImplementationFee(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Total fee</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={isViewMode ? (existing.totalFee || '0.00') : totalFee.toFixed(2)} readOnly style={{ ...readOnlyInput, paddingLeft: '28px', background: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.2)' }} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Revenue split</div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Split type</label>
              {isViewMode
                ? <div style={readOnlyInput}>{splitType || '—'}</div>
                : <select value={splitType} onChange={e => setSplitType(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                    <option value="">-- Select --</option>
                    {splitOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              }
            </div>
            {splitType && (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={labelStyle}>Member share</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                    <input value={memberShare} onChange={e => handleMemberShareChange(e.target.value)} placeholder="0.00" readOnly={isViewMode || isPresetSplit} style={{ ...(isViewMode || isPresetSplit ? readOnlyInput : inputStyle), paddingLeft: '28px' }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={labelStyle}>VFOS share</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                    <input value={vfosShare} onChange={e => handleVfosShareChange(e.target.value)} placeholder="0.00" readOnly={isViewMode || isPresetSplit} style={{ ...(isViewMode || isPresetSplit ? readOnlyInput : inputStyle), paddingLeft: '28px' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {decision === 'Undecided' && (
        <div style={sectionStyle}>
          <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Meeting figures</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>Potential tax savings</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={potentialTaxSavings} onChange={e => setPotentialTaxSavings(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>Initial retainer</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={initialRetainer} onChange={e => setInitialRetainer(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
          </div>
        </div>
      )}

      {decision && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Additional CC recipients <span style={{ textTransform: 'none', opacity: 0.6 }}>(optional)</span></label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <input value={ccInput} onChange={e => setCcInput(e.target.value)} placeholder="email@example.com" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCc())} style={{ ...inputStyle, flex: 1 }} />
                <button onClick={addCc} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {ccRecipients.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#5a8ab5' }}>None</div>}
            {ccRecipients.map((email, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', fontSize: '12px', marginRight: '6px', marginBottom: '4px' }}>
                {email}
                {!isViewMode && <span onClick={() => removeCc(i)} style={{ cursor: 'pointer', color: '#e74c3c', fontSize: '14px' }}>×</span>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Presentation link</label>
            <input value={presentationLink} onChange={e => setPresentationLink(e.target.value)} placeholder="Paste Google Drive link to presentation..." style={isViewMode ? readOnlyInput : inputStyle} readOnly={isViewMode} />
            {!isViewMode && <div style={{ fontSize: '11px', color: '#5a8ab5', marginTop: '4px' }}>Export your presentation slides as a PDF, upload to Google Drive, then set sharing to "Anyone with the link can view" and paste the link here</div>}
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Meeting notes</label>
            <textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)} placeholder="Enter any additional notes from the meeting..." rows={4} style={isViewMode ? { ...readOnlyInput, resize: 'none' } : { ...inputStyle, resize: 'vertical' }} readOnly={isViewMode} />
          </div>

          {!isViewMode && (
            <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: submitting ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {submitting ? 'Submitting...' : 'Submit Outcome'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function TaxPlanTrackView({ plan, phases, progress: initialProgress, specialists, onBack, readOnly = false, notes = [], onNotesChange, clientId, programName }) {
  const [localProgress, setLocalProgress] = useState(initialProgress)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [taxSpecialists, setTaxSpecialists] = useState([])
  const [showAddSpec, setShowAddSpec] = useState(false)
  const [newSpecId, setNewSpecId] = useState('')
  const [loadingSpecs, setLoadingSpecs] = useState(true)

  useEffect(() => {
    const expandState = {}
    phases.forEach(phase => {
      if (phase.name === 'Tax 5 - Education & DD (Specialist Allocation)' || phase.name === 'Tax 5 - Education & DD (Post Allocation)') return
      const tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
      const allDone = tasks.length > 0 && tasks.every(t => localProgress[t.id]?.status)
      expandState[phase.id] = !allDone
    })
    setExpanded(expandState)
    loadSpecialists()
  }, [])

  async function loadSpecialists() {
    setLoadingSpecs(true)
    try {
      const [specData, progData] = await Promise.all([
        callApi('tax_load_specialists', { tax_plan_id: plan.id }),
        callApi('tax_load_progress', { tax_plan_id: plan.id }),
      ])
      setTaxSpecialists(specData.specialists || [])
      const prog = {}
      ;(progData.progress || []).forEach(p => {
        const key = p.tax_specialist_id ? `${p.task_id}_${p.tax_specialist_id}` : p.task_id
        prog[key] = p
      })
      setLocalProgress(prog)
    } catch (err) { console.error(err) }
    finally { setLoadingSpecs(false) }
  }

  async function addSpecialist() {
    if (!newSpecId) return
    const expert = specialists.find(s => s.id === parseInt(newSpecId))
    if (!expert) return
    try {
      await callApi('tax_add_specialist', { tax_plan_id: plan.id, expert_id: expert.id, specialist_name: expert.name })
      setNewSpecId('')
      setShowAddSpec(false)
      loadSpecialists()
    } catch (err) { console.error(err) }
  }

  async function saveTask(taskId, status, existingDate, taxSpecialistId = null) {
    const today = new Date().toISOString().split('T')[0]
    const date = existingDate || (status ? today : null)
    const key = taxSpecialistId ? `${taskId}_${taxSpecialistId}` : taskId
    setSaving(p => ({ ...p, [key]: true }))
    try {
      await callApi('tax_save_task', { tax_plan_id: plan.id, task_id: taskId, status, completed_date: date || null, tax_specialist_id: taxSpecialistId || null })
      setLocalProgress(p => ({ ...p, [key]: { ...p[key], task_id: taskId, status, completed_date: date, tax_specialist_id: taxSpecialistId } }))
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function saveDate(taskId, date, taxSpecialistId = null) {
    const key = taxSpecialistId ? `${taskId}_${taxSpecialistId}` : taskId
    const p = localProgress[key] || {}
    setSaving(prev => ({ ...prev, [key]: true }))
    try {
      await callApi('tax_save_task', { tax_plan_id: plan.id, task_id: taskId, status: p.status, completed_date: date || null, tax_specialist_id: taxSpecialistId || null })
      setLocalProgress(prev => ({ ...prev, [key]: { ...prev[key], completed_date: date } }))
    } catch (err) { console.error(err) }
    finally { setSaving(prev => ({ ...prev, [key]: false })) }
  }

  const statusColors = {
    Completed: '#27ae60', Yes: '#27ae60', 'No additional info required': '#27ae60',
    'Introductions Completed': '#27ae60', 'Combo Tax Plan': '#27ae60', 'ROI Plan': '#27ae60',
    'Continue Process': '#27ae60', 'Move to Implementation': '#27ae60', 'Refund Completed': '#27ae60',
    'Schedule Tax 3': '#27ae60', 'Paid': '#27ae60',
    'Yes - Confirmation email to client': '#27ae60', 'No - Declined email to client': '#e74c3c',
    'Tim Gacsy': '#27ae60', 'Steven Cox': '#27ae60',
    'Yes — Risk 1 — Very Conservative Mindset': '#27ae60', 'Yes — Risk 2 - Moderately Conservative Mindset': '#27ae60',
    'Yes — Risk 3 — Average Risk Mindset': '#27ae60', 'Yes — Risk 4 — Moderately Aggressive Mindset': '#27ae60',
    'Yes — Risk 5 — Very Aggressive Mindset': '#27ae60',
    No: '#e74c3c', 'Stop Process': '#e74c3c', 'Stopped': '#e74c3c',
    'Additional info required': '#27ae60', Undecided: '#f39c12',
    'Continue DD': '#27ae60', 'Continue - Revenue Share': '#27ae60', 'Stop - Refund': '#e74c3c', 'N/A': '#8bacc8',
    'Proceed with Implementation': '#27ae60', 'Not Implementing': '#e74c3c',
    'Pending Completion': '#f39c12',
    'Go': '#27ae60',
    'Stop': '#e74c3c',
  }

  function formatDate(d) {
    if (!d) return ''
    const parts = d.split('-')
    return `${parts[1]}/${parts[2]}`
  }

  const allTasks = phases.flatMap(p => p.program_client_tasks || [])
  const addInfoTask = allTasks.find(t => t.name === 'Additional information required')
  const addInfoStatus = addInfoTask ? localProgress[addInfoTask.id]?.status : ''
  const additionalInfoRequired = addInfoStatus === 'Additional info required'
  const decision1Task = allTasks.find(t => t.name === 'Client decision 1')
  const decision1Status = decision1Task ? localProgress[decision1Task.id]?.status : ''
  const decision2Task = allTasks.find(t => t.name === 'Client decision 2')
  const decision2Status = decision2Task ? localProgress[decision2Task.id]?.status : ''
  const updatePcTask = allTasks.find(t => t.name === 'Implementing?' && phases.find(p => p.name === 'Tax 5 - Education & DD (Specialist Allocation)')?.program_client_tasks?.some(pt => pt.id === t.id))
  const anySpecialistUpdateDone = updatePcTask && taxSpecialists.some(spec => {
    const key = `${updatePcTask.id}_${spec.id}`
    return localProgress[key]?.status
  })

  function getPhaseState(phase) {
    let tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (phase.name === 'Tax 1 - Diagnostic' && !additionalInfoRequired) {
      tasks = tasks.filter(t => !['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(t.name))
    }
    if (tasks.length === 0) {
      const autoTasks = phase.program_client_tasks || []
      const allAutoDone = autoTasks.length > 0 && autoTasks.every(t => localProgress[t.id]?.status)
      return allAutoDone ? 'done' : 'pending'
    }
    if (tasks.every(t => localProgress[t.id]?.status)) return 'done'
    if (tasks.some(t => localProgress[t.id]?.status)) return 'active'
    return 'pending'
  }

  const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' }

  const tax5aPhase = phases.find(p => p.name === 'Tax 5 - Education & DD (Specialist Allocation)')
  const tax5bPhase = phases.find(p => p.name === 'Tax 5 - Education & DD (Post Allocation)')
  const tax5aTasks = tax5aPhase?.program_client_tasks || []
  const phasesBeforeSpec = phases.filter(p => ['Set Up', 'Tax 1 - Diagnostic', 'Tax 2 - Deeper Dive', 'Tax 3 - ROI Meeting', 'Tax 4 - Tax Plan Review'].includes(p.name))
  const phasesAfterSpec = phases.filter(p => p.name === 'Tax 6 - Implementation')

  function renderTask(task, phase, taxSpecialistId = null) {
    const key = taxSpecialistId ? `${task.id}_${taxSpecialistId}` : task.id
    const p = localProgress[key] || {}
    const isDone = !!p.status
    const statusColor = statusColors[p.status] || '#8bacc8'

    if (task.name === 'Client tax planning decision' && task.status_options === 'enter_details') {
      const enterPhase = phases.find(p => p.name === 'Tax 3 - ROI Meeting')
      const isInTax3 = enterPhase?.program_client_tasks?.some(pt => pt.id === task.id)
      if (isInTax3) {
        if (readOnly && isDone) {
          const decisionLabel = p.status.replace('Completed - ', '')
          const decisionColor = decisionLabel === 'Yes' ? '#27ae60' : decisionLabel === 'No' ? '#e74c3c' : '#f39c12'
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: decisionColor, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>{task.name}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>
              {p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
            </div>
          )
        }
        if (readOnly && !isDone) {
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }} />
              <span style={{ fontSize: '13px', color: '#fff', flex: 1 }}>{task.name}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
            </div>
          )
        }
        const decisionLabel = isDone ? p.status.replace('Completed - ', '') : ''
        const decisionColor = decisionLabel === 'Yes' ? '#27ae60' : decisionLabel === 'No' ? '#e74c3c' : decisionLabel === 'Undecided' ? '#f39c12' : '#8bacc8'
        let formData = null
        if (isDone) { try { formData = JSON.parse(p.notes || '{}') } catch(e) { formData = {} } }
        const formExpandKey = `taxform_${task.id}`
        const isFormShown = isDone ? expanded[formExpandKey] : true
        return (
          <div key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isDone ? 'pointer' : 'default' }} onClick={() => isDone && setExpanded(prev => ({ ...prev, [formExpandKey]: !prev[formExpandKey] }))}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? decisionColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? decisionColor : 'rgba(255,255,255,0.2)'}` }} />
              <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
              {isDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>}
              {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
              {isDone && <span style={{ color: '#8bacc8', fontSize: '10px', transform: isFormShown ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>}
            </div>
            {isFormShown && (
              <TaxDecisionForm
                task={task}
                plan={plan}
                saveTask={saveTask}
                taxSpecialistId={taxSpecialistId}
                existingData={formData}
                onSubmitted={(status, data) => {
                  setLocalProgress(prev => ({ ...prev, [key]: { ...prev[key], task_id: task.id, status, completed_date: new Date().toISOString().split('T')[0], notes: JSON.stringify(data) } }))
                }}
              />
            )}
          </div>
        )
      }
    }

    if (task.name === 'AI PC Admin') {
      const enterDetailsTask = allTasks.find(t => t.name === 'Client tax planning decision')
      const enterDetailsStatus = enterDetailsTask ? (localProgress[enterDetailsTask.id]?.status || '') : ''
      if (!enterDetailsStatus || !enterDetailsStatus.startsWith('Completed')) return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize: '13px', color: '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8', border: '1px solid rgba(255,255,255,0.1)' }}>Waiting for details</span>
        </div>
      )
      const decision = enterDetailsStatus.replace('Completed - ', '')
      let aiState = {}
      try { aiState = JSON.parse(localProgress[key]?.notes || '{}') } catch(e) { aiState = {} }
      const autoStep = (label, done) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
          <span style={{ fontSize: '12px', color: done ? '#27ae60' : '#8bacc8' }}>{label}</span>
          {done && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', marginLeft: 'auto' }}>Done</span>}
        </div>
      )
      const sharedSteps = [
        'Engagement agreement created and sent for signing',
        'Engagement agreement signed by client',
        'Engagement agreement signed by Anton',
        'Payment link sent to client (ACH or Card choice)',
        'Retainer payment collected and confirmation email sent',
        'Invoice and receipt created and emailed to client',
      ]
      const decisionColor = decision === 'Yes' ? '#27ae60' : decision === 'No' ? '#e74c3c' : '#f39c12'
      const decisionLabel = decision === 'Yes' ? 'Yes — proceeding' : decision === 'No' ? 'No — declined' : 'Undecided — awaiting client'
      const clientResponse = aiState.client_response || ''
      const pfResponse = aiState.pf_response || ''

      function saveAiState(newState, status) {
        callApi('tax_save_task', { tax_plan_id: plan.id, task_id: task.id, status, notes: JSON.stringify(newState) })
        setLocalProgress(prev => ({ ...prev, [key]: { ...prev[key], task_id: task.id, status, notes: JSON.stringify(newState) } }))
      }

      return (
        <div key={key} style={{ padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
            <span style={{ fontSize: '13px', color: '#fff', flex: 1, fontWeight: '600' }}>{task.name}</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>
          </div>
          <div style={{ marginLeft: '18px', padding: '8px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {decision === 'No' && autoStep('Decline email sent to client', true)}
            {decision === 'Yes' && (
              <>
                {autoStep('Signing link and next steps email sent', false)}
                {sharedSteps.map((s, i) => <div key={i}>{autoStep(s, false)}</div>)}
              </>
            )}
            {decision === 'Undecided' && (
              <>
                {autoStep('Decision email sent with agreement PDF', true)}
                {!clientResponse && !readOnly && (
                  <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize: '12px', color: '#fff', marginBottom: '8px' }}>Client decision:</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button onClick={() => saveAiState({ ...aiState, client_response: 'yes' }, 'Undecided - Client Yes')} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Continue (Yes)</button>
                      <button onClick={() => saveAiState({ ...aiState, client_response: 'no' }, 'Undecided - Client No')} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Stop (No)</button>
                      <button onClick={() => saveAiState({ ...aiState, client_response: 'extra_meeting' }, 'Undecided - Extra Meeting')} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6' }}>Request extra meeting</button>
                    </div>
                  </div>
                )}
                {clientResponse === 'yes' && (
                  <>
                    {autoStep('Client confirmed — Yes', true)}
                    {autoStep('Signing link and next steps email sent', false)}
                    {sharedSteps.map((s, i) => <div key={i}>{autoStep(s, false)}</div>)}
                  </>
                )}
                {clientResponse === 'no' && (
                  <>
                    {autoStep('Client confirmed — Stop', true)}
                    {autoStep('Decline email sent to client', true)}
                  </>
                )}
                {clientResponse === 'extra_meeting' && (
                  <>
                    {autoStep('Client requested extra meeting', true)}
                    {autoStep('Extra meeting held', false)}
                    {!pfResponse && !readOnly && (
                      <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <div style={{ fontSize: '12px', color: '#fff', marginBottom: '8px' }}>PF decision after extra meeting:</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => saveAiState({ ...aiState, pf_response: 'yes' }, 'Undecided - Extra Meeting - Yes')} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Yes — proceed with pricing</button>
                          <button onClick={() => saveAiState({ ...aiState, pf_response: 'no' }, 'Undecided - Extra Meeting - No')} style={{ padding: '5px 12px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>No — decline</button>
                        </div>
                      </div>
                    )}
                    {pfResponse === 'yes' && (
                      <>
                        {autoStep('PF confirmed — Yes with pricing', true)}
                        {autoStep('PF completed pricing', false)}
                        {sharedSteps.map((s, i) => <div key={i}>{autoStep(s, false)}</div>)}
                      </>
                    )}
                    {pfResponse === 'no' && (
                      <>
                        {autoStep('PF confirmed — No', true)}
                        {autoStep('Decline email sent to client', true)}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )
    }

    if (task.name === 'Refund initial 50%' || task.name === 'Revenue share for initial 50%') return null
    if (['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(task.name)) return null

    if (task.status_options === 'auto') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>{task.name}</span>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: isDone ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: isDone ? '#27ae60' : '#8bacc8', border: `1px solid ${isDone ? 'rgba(39,174,96,0.3)' : 'rgba(255,255,255,0.1)'}` }}>{isDone ? 'Completed' : 'Not completed'}</span>
        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
      </div>
    )

    if (readOnly) return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
        }
        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
      </div>
    )

    if (task.name === 'Implementing?') {
      const implColor = p.status === 'Proceed with Implementation' ? '#27ae60' : p.status === 'Not Implementing' ? '#e74c3c' : p.status === 'Undecided' ? '#f39c12' : '#8bacc8'
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? implColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? implColor : 'rgba(255,255,255,0.2)'}` }} />
          <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
          {isDone
            ? <>
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${implColor}22`, color: implColor, border: `1px solid ${implColor}44` }}>{p.status}</span>
                {p.completed_date && <span style={{ fontSize: '11px', color: '#5a8ab5' }}>{formatDate(p.completed_date)}</span>}
              </>
            : <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => saveTask(task.id, 'Proceed with Implementation', null, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Proceed with Implementation</button>
                <button onClick={() => saveTask(task.id, 'Not Implementing', null, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Not Implementing</button>
                <button onClick={() => saveTask(task.id, 'Undecided', null, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(243,156,18,0.4)', background: 'rgba(243,156,18,0.12)', color: '#f39c12' }}>Undecided</button>
              </div>
          }
        </div>
      )
    }

    if (task.status_options === 'enter_details') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Completed</span>
          : <button onClick={() => saveTask(task.id, 'Completed', p.completed_date, taxSpecialistId)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6' }}>Enter details</button>
        }
        <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value, taxSpecialistId)} style={{ ...inputStyle, width: '130px' }} />
      </div>
    )

    if (task.status_options === 'tax_greenlight') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => saveTask(task.id, 'Go', p.completed_date, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Go</button>
              <button onClick={() => saveTask(task.id, 'Stop', p.completed_date, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Stop</button>
            </div>
        }
        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
      </div>
    )

    if (task.status_options === 'tax_refund') {
      const greenlightTask = allTasks.find(t => t.name === 'Tax Plan Greenlight')
      const greenlightStatus = greenlightTask ? (localProgress[greenlightTask.id]?.status || '') : ''
      const greyed = greenlightStatus !== 'Stop'
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', opacity: greyed ? 0.3 : 1, pointerEvents: greyed ? 'none' : 'auto' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
          <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
          {isDone
            ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
            : <button onClick={() => saveTask(task.id, 'Completed', p.completed_date, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(91,159,230,0.4)', background: 'rgba(91,159,230,0.12)', color: '#5b9fe6' }}>Send refund</button>
          }
          {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
        </div>
      )
    }

    if (task.status_options === 'tax_3_decision') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => saveTask(task.id, 'Yes - Confirmation email to client', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Yes - Confirmation email to client</button>
              <button onClick={() => saveTask(task.id, 'No - Declined email to client', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>No - Declined email to client</button>
            </div>
        }
        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
      </div>
    )

    if (task.status_options === 'tax_continue_stop') {
      const refundTask = allTasks.find(t => t.name === 'Refund initial 50%')
      const revShareTask = allTasks.find(t => t.name === 'Revenue share for initial 50%')
      const refundDone = refundTask ? !!localProgress[refundTask.id]?.status : false
      const revShareDone = revShareTask ? !!localProgress[revShareTask.id]?.status : false
      const refundGreyed = decision1Status !== 'Stop - Refund'
      const revShareGreyed = decision1Status !== 'Continue - Revenue Share'
      return (
        <div key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
            <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
            {isDone
              ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
              : <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => saveTask(task.id, 'Continue - Revenue Share', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Continue - Revenue Share</button>
                  <button onClick={() => saveTask(task.id, 'Stop - Refund', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }}>Stop - Refund</button>
                </div>
            }
            {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
          </div>
          <div style={{ marginLeft: '18px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px', paddingBottom: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', opacity: refundGreyed ? 0.15 : 1 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: refundDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${refundDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
              <span style={{ fontSize: '12px', color: '#8bacc8', flex: 1 }}>Refund initial 50%</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: refundDone ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: refundDone ? '#27ae60' : '#8bacc8' }}>{refundDone ? 'Completed' : 'Not completed'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', opacity: revShareGreyed ? 0.15 : 1 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: revShareDone ? '#27ae60' : 'transparent', flexShrink: 0, border: `1px solid ${revShareDone ? '#27ae60' : 'rgba(255,255,255,0.2)'}` }} />
              <span style={{ fontSize: '12px', color: '#8bacc8', flex: 1 }}>Revenue share for initial 50%</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: revShareDone ? 'rgba(39,174,96,0.15)' : 'rgba(255,255,255,0.06)', color: revShareDone ? '#27ae60' : '#8bacc8' }}>{revShareDone ? 'Completed' : 'Not completed'}</span>
            </div>
          </div>
        </div>
      )
    }

    if (task.status_options === 'tax_dd_implementation') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => saveTask(task.id, 'Continue DD', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Continue DD</button>
              <button onClick={() => saveTask(task.id, 'Move to Implementation', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>Move to Implementation</button>
            </div>
        }
        {isDone && p.completed_date && <span style={{ fontSize: '11px', color: '#8bacc8' }}>{formatDate(p.completed_date)}</span>}
      </div>
    )

    if (task.status_options === 'specialist_select') return null

    if (task.name === 'Additional information required') {
      const childTaskNames = ['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L']
      const childTasks = allTasks.filter(t => childTaskNames.includes(t.name))
      const greyed = !additionalInfoRequired
      return (
        <div key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
            <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}</span>
            <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, taxSpecialistId)} disabled={saving[key]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'rgba(255,255,255,0.15)', color: isDone ? statusColor : '#fff' }}>
              <option value="">-- Select --</option>
              {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value, taxSpecialistId)} style={{ ...inputStyle, width: '130px' }} />
          </div>
          <div style={{ marginLeft: '18px', borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '12px', paddingBottom: '4px', opacity: greyed ? 0.3 : 1, pointerEvents: greyed ? 'none' : 'auto' }}>
            {childTasks.map(ct => {
              const ck = taxSpecialistId ? `${ct.id}_${taxSpecialistId}` : ct.id
              const cp = localProgress[ck] || {}
              const cDone = !!cp.status
              const cColor = statusColors[cp.status] || '#8bacc8'
              return (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cDone ? cColor : 'transparent', flexShrink: 0, border: `1px solid ${cDone ? cColor : 'rgba(255,255,255,0.2)'}` }} />
                  <span style={{ fontSize: '12px', color: cDone ? '#8bacc8' : '#fff', flex: 1 }}>{ct.name}</span>
                  <select value={cp.status || ''} onChange={e => saveTask(ct.id, e.target.value, cp.completed_date, taxSpecialistId)} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '120px', fontSize: '11px', borderColor: cDone ? `${cColor}66` : 'rgba(255,255,255,0.15)', color: cDone ? cColor : '#fff' }}>
                    <option value="">-- Select --</option>
                    {(ct.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input type="date" value={cp.completed_date || ''} onChange={e => saveDate(ct.id, e.target.value, taxSpecialistId)} style={{ ...inputStyle, width: '120px', fontSize: '11px' }} />
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    const isSpecIntroTask = task.name === 'VFO specialist introductions / discussions'
    const isConfirmReadyImplTask = task.name === 'Confirm ready for implementation'
    let isGreyedOut = false
    let greyNote = ''
    if ((isSpecIntroTask || isConfirmReadyImplTask) && decision2Status === 'Move to Implementation') {
      isGreyedOut = true
      greyNote = 'Moved to implementation'
    }

    return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', opacity: isGreyedOut ? 0.3 : 1, pointerEvents: isGreyedOut ? 'none' : 'auto' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : 'rgba(255,255,255,0.2)'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#8bacc8' : '#fff', flex: 1 }}>{task.name}{greyNote && <span style={{ fontSize: '11px', color: '#f39c12', marginLeft: '8px' }}>({greyNote})</span>}</span>
        <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, taxSpecialistId)} disabled={saving[key]} style={{ ...inputStyle, background: '#0d2a6e', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : 'rgba(255,255,255,0.15)', color: isDone ? statusColor : '#fff' }}>
          <option value="">-- Select --</option>
          {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" value={p.completed_date || ''} onChange={e => saveDate(task.id, e.target.value, taxSpecialistId)} style={{ ...inputStyle, width: '130px' }} />
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#5b9fe6', fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to Tax Plans</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff' }}>Tax Plan</div>
        <div style={{ fontSize: '12px', color: '#8bacc8' }}>Started {plan.created_at?.split('T')[0]}</div>
      </div>

      {phasesBeforeSpec.map(phase => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        let nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        if (phase.name === 'Tax 1 - Diagnostic' && !additionalInfoRequired) {
          nonAutoTasks = nonAutoTasks.filter(t => !['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(t.name))
        }
        const doneTasks = nonAutoTasks.filter(t => localProgress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
        const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
        const titleColor = state === 'active' ? '#5b9fe6' : '#fff'
        return (
          <div key={phase.id} style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'Tax Priorities').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#8bacc8', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>
            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {tasks.map(task => renderTask(task, phase))}
              </div>
            )}
          </div>
        )
      })}

      {tax5aPhase && (
        <div style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(91,159,230,0.4)', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#5b9fe6', border: '1.5px solid #5b9fe6', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax 5 - Education & DD (Specialist Allocation)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === 'Tax 5 - Education & DD (Specialist Allocation)' && n.tab_name === 'Tax Priorities').length} isOpen={expanded['notes_tax5a']} onClick={() => setExpanded(p => ({ ...p, ['notes_tax5a']: !p['notes_tax5a'] }))} />}
              {taxSpecialists.length > 0 && taxSpecialists.every(spec => tax5aTasks.filter(t => t.status_options !== 'specialist_select').every(t => localProgress[`${t.id}_${spec.id}`]?.status))
                ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>
                : taxSpecialists.length > 0 && taxSpecialists.some(spec => tax5aTasks.filter(t => t.status_options !== 'specialist_select').some(t => localProgress[`${t.id}_${spec.id}`]?.status))
                  ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress</span>
                  : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>
              }
              {!readOnly && (
                <button onClick={() => setShowAddSpec(!showAddSpec)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: '#2563eb', border: 'none', color: '#fff' }}>+ Add Specialist</button>
              )}
            </div>
          </div>
          {!readOnly && expanded['notes_tax5a'] && <PhaseNotesPanel clientId={clientId} phaseName="Tax 5 - Education & DD (Specialist Allocation)" tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
          <div style={{ borderTop: '1px solid rgba(91,159,230,0.2)', padding: '12px 18px' }}>
            {showAddSpec && (
              <div style={{ padding: '12px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', marginBottom: '12px' }}>
                <select value={newSpecId} onChange={e => setNewSpecId(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e', width: '100%', marginBottom: '8px', padding: '8px 12px' }}>
                  <option value="">-- Select Specialist --</option>
                  {specialists.filter(s => !taxSpecialists.some(ts => ts.expert_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={addSpecialist} style={{ padding: '6px 16px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setShowAddSpec(false)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#8bacc8', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {taxSpecialists.length === 0 && !showAddSpec && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#8bacc8', fontSize: '13px' }}>No specialists allocated yet.</div>
            )}
            {taxSpecialists.map(spec => {
              const allocateTask = tax5aTasks.find(t => t.status_options === 'specialist_select')
              const specTasks = tax5aTasks.filter(t => t.status_options !== 'specialist_select')
              const specExpKey = `spec_${spec.id}`
              const allSpecDone = specTasks.every(t => localProgress[`${t.id}_${spec.id}`]?.status)
              const isSpecExpanded = expanded[specExpKey] !== undefined ? expanded[specExpKey] : !allSpecDone
              return (
                <div key={spec.id} style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(p => ({ ...p, [specExpKey]: !isSpecExpanded }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{spec.specialist_name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: spec.status === 'stopped' ? 'rgba(231,76,60,0.15)' : 'rgba(39,174,96,0.15)', color: spec.status === 'stopped' ? '#e74c3c' : '#27ae60', border: `1px solid ${spec.status === 'stopped' ? 'rgba(231,76,60,0.3)' : 'rgba(39,174,96,0.3)'}` }}>{spec.status === 'stopped' ? 'Stopped' : 'Live'}</span>
                    </div>
                    <span style={{ color: '#8bacc8', fontSize: '10px', transform: isSpecExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isSpecExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px' }}>
                      {allocateTask && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27ae60', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#8bacc8', flex: 1 }}>Allocate to VFO Specialist</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>
                        </div>
                      )}
                      {specTasks.map(task => renderTask(task, tax5aPhase, spec.id))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tax5bPhase && (
        <div style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden', opacity: anySpecialistUpdateDone ? 1 : 0.3, pointerEvents: anySpecialistUpdateDone ? 'auto' : 'none' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'transparent', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax 5 - Education & DD (Post Allocation)</span>
              {!anySpecialistUpdateDone && <span style={{ fontSize: '11px', color: '#f39c12' }}>(Unlocks when Implementing? is completed for any specialist)</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!readOnly && anySpecialistUpdateDone && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === 'Tax 5 - Education & DD (Post Allocation)' && n.tab_name === 'Tax Priorities').length} isOpen={expanded['notes_tax5b']} onClick={() => setExpanded(p => ({ ...p, ['notes_tax5b']: !p['notes_tax5b'] }))} />}
              {anySpecialistUpdateDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
            </div>
          </div>
          {!readOnly && expanded['notes_tax5b'] && <PhaseNotesPanel clientId={clientId} phaseName="Tax 5 - Education & DD (Post Allocation)" tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
          {anySpecialistUpdateDone && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '12px 18px' }}>
              {(tax5bPhase.program_client_tasks || []).map(task => renderTask(task, tax5bPhase))}
            </div>
          )}
        </div>
      )}

      {phasesAfterSpec.map(phase => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id]
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        const doneTasks = nonAutoTasks.filter(t => localProgress[t.id]?.status).length
        const borderColor = state === 'done' ? 'rgba(39,174,96,0.3)' : state === 'active' ? 'rgba(91,159,230,0.4)' : 'rgba(255,255,255,0.1)'
        const dotColor = state === 'done' ? '#27ae60' : state === 'active' ? '#5b9fe6' : 'transparent'
        const titleColor = state === 'active' ? '#5b9fe6' : '#fff'
        return (
          <div key={phase.id} style={{ background: 'rgba(0,0,0,0.12)', border: `1px solid ${borderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? 'rgba(255,255,255,0.2)' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(39,174,96,0.15)', color: '#27ae60', border: '1px solid rgba(39,174,96,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', border: '1px solid rgba(91,159,230,0.3)' }}>In progress · {doneTasks}/{nonAutoTasks.length}</span>}
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'Tax Priorities').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#8bacc8' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !p[phase.id] }))} style={{ color: '#8bacc8', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
              </div>
            </div>
            {!readOnly && expanded[`notes_${phase.id}`] && <PhaseNotesPanel clientId={clientId} phaseName={phase.name} tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${borderColor}`, padding: '12px 18px' }}>
                {tasks.map(task => renderTask(task, phase))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function TaxPrioritiesTab({ clientId, programId, programName, specialists, readOnly = false, notes = [], onNotesChange }) {
  const [taxPlans, setTaxPlans] = useState([])
  const [phases, setPhases] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [taxEnabled, setTaxEnabled] = useState(false)
  const [allProgress, setAllProgress] = useState({})

  useEffect(() => { loadData() }, [clientId])

  async function loadData() {
    setLoading(true)
    try {
      const [plansData, phasesData, map1Progress] = await Promise.all([
        callApi('tax_load_plans', { client_id: clientId }),
        callApi('msm_load_client_track', { program_id: programId, track_type: 'tax' }),
        callApi('msm_load_client_progress', { client_id: clientId }),
      ])
      setTaxPlans(plansData.plans || [])
      const loadedPhases = phasesData.phases || []
      loadedPhases.forEach(p => p.program_client_tasks?.sort((a, b) => a.task_order - b.task_order))
      setPhases(loadedPhases)
      const enabled = programName === 'VFO Tax Planning' || (map1Progress.progress || []).some(p => p.status === 'Tax priorities tab enabled')
      setTaxEnabled(enabled)
      const progressMap = {}
      await Promise.all((plansData.plans || []).map(async plan => {
        const pd = await callApi('tax_load_progress', { tax_plan_id: plan.id })
        progressMap[plan.id] = {}
        ;(pd.progress || []).forEach(p => {
          const key = p.tax_specialist_id ? `${p.task_id}_${p.tax_specialist_id}` : p.task_id
          progressMap[plan.id][key] = p
        })
      }))
      setAllProgress(progressMap)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function startPlan() {
    try {
      await callApi('tax_start_plan', { client_id: clientId })
      loadData()
    } catch (err) { console.error(err) }
  }

  function getPlanState(plan) {
    const prog = allProgress[plan.id] || {}
    const allTasks = phases.filter(p => p.name !== 'Tax 5 - Education & DD (Specialist Allocation)' && p.name !== 'Tax 5 - Education & DD (Post Allocation)').flatMap(p => p.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (allTasks.length === 0) return 'not started'
    if (allTasks.every(t => prog[t.id]?.status)) return 'completed'
    if (allTasks.some(t => prog[t.id]?.status)) return 'in progress'
    return 'not started'
  }

  const sectionStyle = { background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }
  const stateColors = { 'not started': '#8bacc8', 'in progress': '#5b9fe6', 'completed': '#27ae60' }

  if (loading) return <div style={{ padding: '40px', color: '#8bacc8', textAlign: 'center' }}>Loading...</div>

  if (selectedPlan) {
    return (
      <TaxPlanTrackView
        plan={selectedPlan}
        phases={phases}
        progress={allProgress[selectedPlan.id] || {}}
        specialists={specialists}
        onBack={() => { setSelectedPlan(null); loadData() }}
        readOnly={readOnly}
        notes={notes}
        onNotesChange={onNotesChange}
        clientId={clientId}
        programName={programName === 'VFO Tax Planning' ? 'VFO Tax Planning' : 'VFO Holistic Planning'}
      />
    )
  }

  return (
    <div>
      {!taxEnabled && (
        <div style={{ ...sectionStyle, borderColor: 'rgba(231,76,60,0.3)', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '15px', color: '#8bacc8' }}>Tax Priorities is not yet enabled for this client.</div>
          <div style={{ fontSize: '13px', color: '#5a8ab5', marginTop: '8px' }}>Set C26 to "Tax priorities tab enabled" in MAP 1 first.</div>
        </div>
      )}
      {taxEnabled && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '1px' }}>{taxPlans.length} {taxPlans.length === 1 ? 'Tax Plan' : 'Tax Plans'}</div>
            {!readOnly && <button onClick={startPlan} style={{ padding: '8px 20px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>+ Start Tax Plan</button>}
          </div>
          {taxPlans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#8bacc8' }}>No tax plans started yet.</div>
          )}
          {taxPlans.map(plan => {
            const state = getPlanState(plan)
            const stateColor = stateColors[state]
            return (
              <div key={plan.id} onClick={() => setSelectedPlan(plan)}
                style={{ ...sectionStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>Tax Plan</div>
                  <div style={{ fontSize: '12px', color: '#8bacc8' }}>{plan.created_at?.split('T')[0]}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: plan.status === 'stopped' ? 'rgba(231,76,60,0.15)' : 'rgba(39,174,96,0.15)', color: plan.status === 'stopped' ? '#e74c3c' : '#27ae60', border: `1px solid ${plan.status === 'stopped' ? 'rgba(231,76,60,0.3)' : 'rgba(39,174,96,0.3)'}` }}>{plan.status === 'stopped' ? 'Stopped' : 'Live'}</span>
                  {plan.status !== 'stopped' && <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: `${stateColor}22`, color: stateColor, border: `1px solid ${stateColor}44`, textTransform: 'capitalize' }}>{state}</span>}
                  <span style={{ color: '#5b9fe6', fontSize: '13px' }}>View →</span>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

export default TaxPrioritiesTab