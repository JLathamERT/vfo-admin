import { useState } from 'react'
import { callApi } from '../../../lib/api'

const PIP_PRIORITIES = [
  { group: '— Business Advisory —', items: ['Business Growth', 'Business Exit', 'Business Advisory'] },
  { group: '— Tax —', items: ['Tax Planning (Income Tax Focus)', 'Tax Planning (Capital Gain Tax Focus)', 'Tax Planning (Retirement/Estate Tax Focus)', 'Tax Planning (Charitable/Gift Tax Focus)', 'Tax Planning (Business Tax Focus)', 'Tax Planning'] },
  { group: '— Risk Mitigation —', items: ['Long Term Sickness Concern', 'Living too Long Concern', 'Death Impacting Dependents Concern', 'Asset Protection (Personally Sued)', 'Loss of Key Person', 'Asset Protection (Business Sued)', 'Technology Advancements', 'Risk Mitigation'] },
  { group: '— Wealth Planning —', items: ['Wealth Planning (Short Term)', 'Wealth Planning (Long Term)', 'Wealth Planning (Short/Long Term)', 'Wealth Planning (Grow Wealth)', 'Wealth Planning (Retain Wealth)', 'Wealth Planning (Grow/Retain Wealth)', 'Wealth Planning (Young Kids Focus)', 'Wealth Planning (College Planning Focus)', 'Wealth Planning (Retirement Planning Focus)', 'Wealth Planning (Legacy Planning Focus)', 'Wealth Planning (Alternative Investments Focus)', 'Wealth Planning'] },
  { group: '— Legal —', items: ['Family Law', 'Trusts and Wills (Estate Planning)', 'Contract / Corporate Law', 'Structuring Entities', 'Buy / Sell Agreements', 'Joint Venture Agreements', 'Intellectual Property', 'Legal Focus'] },
]

function PIPDecisionForm({ task, clientId, saveTask, existingData, onSubmitted }) {
  const existing = existingData || {}
  const isViewMode = !!existingData

  const [memberPayingOnBehalf, setMemberPayingOnBehalf] = useState(existing.memberPayingOnBehalf || 'No')
  const [decision, setDecision] = useState(existing.decision || '')
  const [currentPriorities, setCurrentPriorities] = useState(existing.currentPriorities || [])
  const [currentPriorityInput, setCurrentPriorityInput] = useState('')
  const [parkedPriorities, setParkedPriorities] = useState(existing.parkedPriorities || [])
  const [parkedPriorityInput, setParkedPriorityInput] = useState('')
  const [clientService, setClientService] = useState(existing.clientService || '')
  const [grossServiceValue, setGrossServiceValue] = useState(existing.grossServiceValue || '')
  const [memberContribution, setMemberContribution] = useState(existing.memberContribution || '')
  const netInvoiceValue = ((parseFloat(grossServiceValue) || 0) - (parseFloat(memberContribution) || 0)).toFixed(2)
  const [memberShare, setMemberShare] = useState(existing.memberShare || '')
  const [vfosShare, setVfosShare] = useState(existing.vfosShare || '')
  const [paymentPlan, setPaymentPlan] = useState(existing.paymentPlan || '')
  const [pipMeetingCount, setPipMeetingCount] = useState(existing.pipMeetingCount || '')
  const [undecidedReasons, setUndecidedReasons] = useState(existing.undecidedReasons || [])
  const [liteCost, setLiteCost] = useState(existing.liteCost || '')
  const [coreCost, setCoreCost] = useState(existing.coreCost || '')
  const [maxCost, setMaxCost] = useState(existing.maxCost || '')
  const [maxNA, setMaxNA] = useState(existing.maxNA || false)
  const [ccRecipients, setCcRecipients] = useState(existing.ccRecipients || [])
  const [ccInput, setCcInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'DM Sans, sans-serif' }
  const labelStyle = { fontSize: '11px', color: '#8bacc8', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: 'rgba(0,0,0,0.15)', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid rgba(255,255,255,0.06)' }
  const readOnlyInput = { ...inputStyle, opacity: 0.6, pointerEvents: 'none' }

  function addCc() {
    if (ccInput && ccInput.includes('@')) { setCcRecipients([...ccRecipients, ccInput]); setCcInput('') }
  }
  function removeCc(i) { if (!isViewMode) setCcRecipients(ccRecipients.filter((_, idx) => idx !== i)) }
  function addCurrentPriority() {
    if (currentPriorityInput && !currentPriorities.includes(currentPriorityInput)) { setCurrentPriorities([...currentPriorities, currentPriorityInput]); setCurrentPriorityInput('') }
  }
  function addParkedPriority() {
    if (parkedPriorityInput && !parkedPriorities.includes(parkedPriorityInput)) { setParkedPriorities([...parkedPriorities, parkedPriorityInput]); setParkedPriorityInput('') }
  }
  function toggleUndecidedReason(reason) {
    if (isViewMode) return
    setUndecidedReasons(prev => prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason])
  }

  const [submitError, setSubmitError] = useState('')

  async function handleSubmit() {
    if (!decision) return
    if (decision === 'Yes') {
      if (currentPriorities.length === 0) { setSubmitError('Please add at least one current priority'); return }
      if (!clientService) { setSubmitError('Please select a client service'); return }
      if (!grossServiceValue) { setSubmitError('Please enter gross service value'); return }
      if (!paymentPlan) { setSubmitError('Please select a payment plan'); return }
      if (clientService === 'Max' && !pipMeetingCount) { setSubmitError('Please enter PIP meeting count for Max'); return }
      const splitTotal = (parseFloat(memberShare) || 0) + (parseFloat(vfosShare) || 0)
      const netVal = parseFloat(netInvoiceValue) || 0
      if (Math.abs(splitTotal - netVal) > 0.01) {
        setSubmitError(`Revenue split ($${splitTotal.toFixed(2)}) must equal Net Invoice Value ($${netVal.toFixed(2)})`)
        return
      }
    }
    if (decision === 'Undecided') {
      if (undecidedReasons.length === 0) { setSubmitError('Please select at least one reason for being undecided'); return }
      if (currentPriorities.length === 0) { setSubmitError('Please add at least one current priority'); return }
      if (!liteCost) { setSubmitError('Please enter Lite cost'); return }
      if (!coreCost) { setSubmitError('Please enter Core cost'); return }
      if (!maxNA && !maxCost) { setSubmitError('Please enter Max cost or check N/A'); return }
    }
    setSubmitError('')
    setSubmitting(true)
    const formData = { decision, ccRecipients, memberPayingOnBehalf }
    if (decision === 'Yes') {
      formData.currentPriorities = currentPriorities
      formData.parkedPriorities = parkedPriorities
      formData.clientService = clientService
      formData.grossServiceValue = grossServiceValue
      formData.memberContribution = memberContribution
      formData.netInvoiceValue = netInvoiceValue.toString()
      formData.memberShare = memberShare
      formData.vfosShare = vfosShare
      formData.paymentPlan = paymentPlan
      formData.pipMeetingCount = clientService === 'Max' ? pipMeetingCount : null
    } else if (decision === 'Undecided') {
      formData.undecidedReasons = undecidedReasons
      formData.currentPriorities = currentPriorities
      formData.parkedPriorities = parkedPriorities
      formData.liteCost = liteCost
      formData.coreCost = coreCost
      formData.maxCost = maxCost
      formData.maxNA = maxNA
    }
    try {
      await callApi('msm_save_client_task', { client_id: clientId, task_id: task.id, status: `Completed - ${decision}`, completed_date: new Date().toISOString().split('T')[0], completed_by: null, notes: JSON.stringify(formData) })
      await callApi('automation_PIPFU_decision', { client_id: clientId, decision, form_data: formData }).catch(err => console.error('Pipeline update error:', err))
      if (onSubmitted) onSubmitted(`Completed - ${decision}`, formData)
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const priorityDropdown = (value, onChange) => (
    <select value={value} onChange={onChange} style={{ ...inputStyle, background: '#0d2a6e', flex: 1 }}>
      <option value="">-- Select Priority --</option>
      {PIP_PRIORITIES.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.items.map(item => <option key={item} value={item}>{item}</option>)}
        </optgroup>
      ))}
    </select>
  )

  const tagList = (items, onRemove) => items.map((item, i) => (
    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '4px', background: 'rgba(91,159,230,0.15)', color: '#5b9fe6', fontSize: '12px', marginRight: '6px', marginBottom: '4px' }}>
      {item}
      {!isViewMode && <span onClick={() => onRemove(i)} style={{ cursor: 'pointer', color: '#e74c3c', fontSize: '14px' }}>×</span>}
    </div>
  ))

  return (
    <div style={{ marginLeft: '18px', padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', marginBottom: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Is the member paying on behalf of the client?</label>
        {isViewMode
          ? <div style={{ ...inputStyle, opacity: 0.6 }}>{memberPayingOnBehalf}</div>
          : <select value={memberPayingOnBehalf} onChange={e => setMemberPayingOnBehalf(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
        }
        {memberPayingOnBehalf === 'Yes' && !isViewMode && (
          <div style={{ fontSize: '12px', color: '#f39c12', marginTop: '6px' }}>
            The member-paid agreement &amp; emails will be used: addressed to the member, with the client CC'd, and the member signs &amp; pays.
          </div>
        )}
      </div>

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

      {/* === YES FIELDS === */}
      {decision === 'Yes' && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Current priorities</label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {priorityDropdown(currentPriorityInput, e => setCurrentPriorityInput(e.target.value))}
                <button onClick={addCurrentPriority} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {currentPriorities.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#5a8ab5' }}>None</div>}
            <div>{tagList(currentPriorities, i => setCurrentPriorities(currentPriorities.filter((_, idx) => idx !== i)))}</div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Parked priorities</label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {priorityDropdown(parkedPriorityInput, e => setParkedPriorityInput(e.target.value))}
                <button onClick={addParkedPriority} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {parkedPriorities.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#5a8ab5' }}>None</div>}
            <div>{tagList(parkedPriorities, i => setParkedPriorities(parkedPriorities.filter((_, idx) => idx !== i)))}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Client service</label>
            {isViewMode
              ? <div style={readOnlyInput}>{clientService || '—'}</div>
              : <select value={clientService} onChange={e => setClientService(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  <option value="Lite">Lite</option>
                  <option value="Core">Core</option>
                  <option value="Max">Max</option>
                </select>
            }
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Pricing</div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Gross service value</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={grossServiceValue} onChange={e => setGrossServiceValue(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Member contribution <span style={{ textTransform: 'none', opacity: 0.6 }}>(if applicable)</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={memberContribution} onChange={e => setMemberContribution(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Net invoice value</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={isViewMode ? (existing.netInvoiceValue || '0.00') : netInvoiceValue} readOnly style={{ ...readOnlyInput, paddingLeft: '28px', background: 'rgba(39,174,96,0.08)', borderColor: 'rgba(39,174,96,0.2)' }} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Revenue split</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Member share</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                  <input value={memberShare} onChange={e => setMemberShare(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>VFOS share</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                  <input value={vfosShare} onChange={e => setVfosShare(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Payment plan</label>
            {isViewMode
              ? <div style={readOnlyInput}>{paymentPlan || '—'}</div>
              : <select value={paymentPlan} onChange={e => setPaymentPlan(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
                  <option value="">-- Select --</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="1 Time Payment">1 Time Payment</option>
                </select>
            }
          </div>
          {clientService === 'Max' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>PIP Meeting Count</label>
              {isViewMode
                ? <div style={readOnlyInput}>{pipMeetingCount || '—'}</div>
                : <input value={pipMeetingCount} onChange={e => setPipMeetingCount(e.target.value)} style={inputStyle} placeholder="e.g. 4" />
              }
            </div>
          )}
        </>
      )}

      {/* === UNDECIDED FIELDS === */}
      {decision === 'Undecided' && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Reason for being undecided</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {['Undecided whether to continue the process / unsure if would benefit from the service', 'Undecided on which service level to choose'].map(reason => (
                <label key={reason} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: isViewMode ? 'default' : 'pointer', fontSize: '13px', color: '#fff' }}>
                  <input type="checkbox" checked={undecidedReasons.includes(reason)} onChange={() => toggleUndecidedReason(reason)} disabled={isViewMode} style={{ marginTop: '3px', accentColor: '#5b9fe6' }} />
                  {reason}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Current priorities</label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {priorityDropdown(currentPriorityInput, e => setCurrentPriorityInput(e.target.value))}
                <button onClick={addCurrentPriority} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {currentPriorities.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#5a8ab5' }}>None</div>}
            <div>{tagList(currentPriorities, i => setCurrentPriorities(currentPriorities.filter((_, idx) => idx !== i)))}</div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Parked priorities</label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {priorityDropdown(parkedPriorityInput, e => setParkedPriorityInput(e.target.value))}
                <button onClick={addParkedPriority} style={{ padding: '8px 16px', borderRadius: '8px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {parkedPriorities.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#5a8ab5' }}>None</div>}
            <div>{tagList(parkedPriorities, i => setParkedPriorities(parkedPriorities.filter((_, idx) => idx !== i)))}</div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#5b9fe6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Membership options outlined</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600', width: '40px' }}>Lite</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={liteCost} onChange={e => setLiteCost(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', color: '#5b9fe6', fontWeight: '600', width: '40px' }}>Core</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={coreCost} onChange={e => setCoreCost(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', color: '#f39c12', fontWeight: '600', width: '40px' }}>Max</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8bacc8', fontSize: '14px' }}>$</span>
                <input value={maxNA ? '' : maxCost} onChange={e => setMaxCost(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px', opacity: maxNA ? 0.3 : 1 }} readOnly={isViewMode || maxNA} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#8bacc8', cursor: isViewMode ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={maxNA} onChange={e => { if (!isViewMode) setMaxNA(e.target.checked) }} disabled={isViewMode} style={{ accentColor: '#5b9fe6' }} />
                N/A
              </label>
            </div>
          </div>
        </>
      )}

      {/* === SHARED FIELDS (all decisions) === */}
      {decision && (
        <>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Additional CC recipients <span style={{ textTransform: 'none', opacity: 0.6 }}>(optional — these email addresses will be CC'd on all client emails)</span></label>
            {!isViewMode && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <input value={ccInput} onChange={e => setCcInput(e.target.value)} placeholder="Enter email address" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCc())} style={{ ...inputStyle, flex: 1 }} />
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

          {!isViewMode && (
            <>
              {submitError && <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '8px' }}>{submitError}</div>}
              <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: submitting ? '#1a4a9e' : '#2563eb', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {submitting ? 'Submitting...' : 'Submit Outcome'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default PIPDecisionForm