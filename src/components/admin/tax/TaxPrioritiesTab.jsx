import { useState, useEffect } from 'react'
import { callApi, loadCachedAction } from '../../../lib/api'
import { TaxPlanListSkeleton } from '../../shared/Skeleton'
import { PhaseNotesButton, PhaseNotesPanel } from '../../shared/PhaseNotes'

function TaxDecisionForm({ task, plan, saveTask, taxSpecialistId, existingData, onSubmitted }) {
  const existing = existingData || {}
  const isViewMode = !!existingData

  const [decision, setDecision] = useState(existing.decision || '')
  const [memberPayingOnBehalf, setMemberPayingOnBehalf] = useState(existing.memberPayingOnBehalf || 'No')
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

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '11px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: '#eef2f9', borderRadius: '8px', padding: '16px', marginBottom: '12px', border: '1px solid #f2f5fa' }
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
    const formData = { decision, presentationLink, ccRecipients, memberPayingOnBehalf }
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
      await callApi('automation_TAX_decision', {
        tax_plan_id: plan.id,
        decision,
        form_data: formData,
      })
      if (onSubmitted) onSubmitted(`Completed - ${decision}`, formData)
    } catch (err) {
      console.error(err)
      alert('Submit failed: ' + (err?.message || 'unknown error'))
    }
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
    <div style={{ marginLeft: '18px', padding: '16px', background: '#eef2f9', borderRadius: '10px', border: '1px solid #ebf0f8', marginTop: '4px', marginBottom: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Is the member signing and paying on behalf of the client?</label>
        {isViewMode
          ? <div style={{ ...inputStyle, opacity: 0.6 }}>{memberPayingOnBehalf}</div>
          : <select value={memberPayingOnBehalf} onChange={e => setMemberPayingOnBehalf(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </select>
        }
        {memberPayingOnBehalf === 'Yes' && !isViewMode && (
          <div style={{ fontSize: '12px', color: '#e06717', fontWeight: 600, marginTop: '6px' }}>
            The member-paid agreement &amp; emails will be used: addressed to the member, with the client CC'd, and the member signs &amp; pays.
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Client decision</label>
        {isViewMode
          ? <div style={{ ...inputStyle, opacity: 0.6 }}>{decision}</div>
          : <select value={decision} onChange={e => setDecision(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
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
              : <select value={taxRiskMindset} onChange={e => setTaxRiskMindset(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
                  <option value="">-- Select --</option>
                  {riskOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
            }
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Fee details</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Retainer payment</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                  <input value={retainerPayment} onChange={e => setRetainerPayment(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Implementation fee</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                  <input value={implementationFee} onChange={e => setImplementationFee(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
                </div>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Total fee</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                <input value={isViewMode ? (existing.totalFee || '0.00') : totalFee.toFixed(2)} readOnly style={{ ...readOnlyInput, paddingLeft: '28px', background: 'rgba(27,146,84,0.08)', borderColor: 'rgba(27,146,84,0.2)' }} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Revenue split</div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Split type</label>
              {isViewMode
                ? <div style={readOnlyInput}>{splitType || '—'}</div>
                : <select value={splitType} onChange={e => setSplitType(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
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
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                    <input value={memberShare} onChange={e => handleMemberShareChange(e.target.value)} placeholder="0.00" readOnly={isViewMode || isPresetSplit} style={{ ...(isViewMode || isPresetSplit ? readOnlyInput : inputStyle), paddingLeft: '28px' }} />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={labelStyle}>VFOS share</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
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
          <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Meeting figures</div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>Potential tax savings</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                <input value={potentialTaxSavings} onChange={e => setPotentialTaxSavings(e.target.value)} placeholder="0.00" style={{ ...(isViewMode ? readOnlyInput : inputStyle), paddingLeft: '28px' }} readOnly={isViewMode} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>Initial retainer</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
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
                <button onClick={addCc} style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
              </div>
            )}
            {ccRecipients.length === 0 && isViewMode && <div style={{ fontSize: '13px', color: '#697a9c' }}>None</div>}
            {ccRecipients.map((email, i) => (
              <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, fontSize: '12px', marginRight: '6px', marginBottom: '4px' }}>
                {email}
                {!isViewMode && <span onClick={() => removeCc(i)} style={{ cursor: 'pointer', color: '#e74c3c', fontWeight: 500, fontSize: '14px' }}>×</span>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Presentation link</label>
            <input value={presentationLink} onChange={e => setPresentationLink(e.target.value)} placeholder="Paste Google Drive link to presentation..." style={isViewMode ? readOnlyInput : inputStyle} readOnly={isViewMode} />
            {!isViewMode && <div style={{ fontSize: '11px', color: '#697a9c', marginTop: '4px' }}>Export your presentation slides as a PDF, upload to Google Drive, then set sharing to "Anyone with the link can view" and paste the link here</div>}
          </div>


          {!isViewMode && (
            <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: submitting ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '15px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {submitting ? 'Submitting...' : 'Submit Outcome'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Compact pricing form for Phase 4c: admin completes pricing after the client
// picked Yes (or Yes-via-extra-meeting). Mirrors the Yes-branch fields of
// TaxDecisionForm but with no decision dropdown and a configurable submit
// handler so the same component can fire either automation_TAX_pricing or
// automation_TAX_extrameeting.
function TaxPricingForm({ submitLabel = 'Submit', onSubmit, onCancel }) {
  const [taxRiskMindset, setTaxRiskMindset] = useState('')
  const [retainerPayment, setRetainerPayment] = useState('')
  const [implementationFee, setImplementationFee] = useState('')
  const [splitType, setSplitType] = useState('')
  const [memberShare, setMemberShare] = useState('')
  const [vfosShare, setVfosShare] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalFee = (parseFloat(retainerPayment) || 0) + (parseFloat(implementationFee) || 0)

  useEffect(() => {
    if (splitType === '1/3 Member, 2/3 VFOS') {
      const ms = (totalFee / 3).toFixed(2)
      const vs = (totalFee - parseFloat(ms)).toFixed(2)
      setMemberShare(ms); setVfosShare(vs)
    } else if (splitType === '50/50') {
      const half = (totalFee / 2).toFixed(2)
      setMemberShare(half); setVfosShare(half)
    }
  }, [splitType, totalFee])

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
  const labelStyle = { fontSize: '11px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }
  const sectionStyle = { background: '#eef2f9', borderRadius: '8px', padding: '14px', marginBottom: '10px', border: '1px solid #f2f5fa' }
  const riskOptions = ['Yes — Risk 1 — Very Conservative Mindset','Yes — Risk 2 - Moderately Conservative Mindset','Yes — Risk 3 — Average Risk Mindset','Yes — Risk 4 — Moderately Aggressive Mindset','Yes — Risk 5 — Very Aggressive Mindset']
  const splitOptions = ['1/3 Member, 2/3 VFOS', '50/50', 'Custom']
  const isPresetSplit = splitType && splitType !== 'Custom'

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

  async function handle() {
    if (!taxRiskMindset || !retainerPayment || !implementationFee || !splitType) return
    setSubmitting(true)
    try {
      await onSubmit({
        taxRiskMindset,
        retainerPayment,
        implementationFee,
        totalFee: totalFee.toFixed(2),
        splitType,
        memberShare,
        vfosShare,
      })
    } catch (err) {
      console.error(err)
      alert('Submit failed: ' + (err?.message || 'unknown'))
    } finally { setSubmitting(false) }
  }

  return (
    <div style={{ marginLeft: '18px', marginTop: '8px', marginBottom: '8px', padding: '14px 16px', background: '#eef2f9', borderRadius: '10px', border: '1px solid #ebf0f8', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '11px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Complete pricing &amp; send agreement</div>

      <div style={{ marginBottom: '10px' }}>
        <label style={labelStyle}>Tax risk mindset</label>
        <select value={taxRiskMindset} onChange={e => setTaxRiskMindset(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
          <option value="">-- Select --</option>
          {riskOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Fee details</div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={labelStyle}>Retainer payment</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
              <input value={retainerPayment} onChange={e => setRetainerPayment(e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: '28px' }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label style={labelStyle}>Implementation fee</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
              <input value={implementationFee} onChange={e => setImplementationFee(e.target.value)} placeholder="0.00" style={{ ...inputStyle, paddingLeft: '28px' }} />
            </div>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Total fee</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
            <input value={totalFee.toFixed(2)} readOnly style={{ ...inputStyle, paddingLeft: '28px', background: 'rgba(27,146,84,0.08)', borderColor: 'rgba(27,146,84,0.2)' }} />
          </div>
        </div>
      </div>

      <div style={sectionStyle}>
        <div style={{ fontSize: '12px', color: '#0095ff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Revenue split</div>
        <div style={{ marginBottom: '10px' }}>
          <label style={labelStyle}>Split type</label>
          <select value={splitType} onChange={e => setSplitType(e.target.value)} style={{ ...inputStyle, background: '#ffffff' }}>
            <option value="">-- Select --</option>
            {splitOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {splitType && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>Member share</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                <input value={memberShare} onChange={e => handleMemberShareChange(e.target.value)} placeholder="0.00" readOnly={isPresetSplit} style={{ ...inputStyle, paddingLeft: '28px', ...(isPresetSplit ? { opacity: 0.6 } : {}) }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: '120px' }}>
              <label style={labelStyle}>VFOS share</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4e6087', fontSize: '14px' }}>$</span>
                <input value={vfosShare} onChange={e => handleVfosShareChange(e.target.value)} placeholder="0.00" readOnly={isPresetSplit} style={{ ...inputStyle, paddingLeft: '28px', ...(isPresetSplit ? { opacity: 0.6 } : {}) }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px' }}>
        {onCancel && <button disabled={submitting} onClick={onCancel} style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid #d6e0ee', background: 'transparent', color: '#4e6087' }}>Cancel</button>}
        <button disabled={submitting} onClick={handle} style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: submitting ? 'not-allowed' : 'pointer', border: 'none', background: submitting ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', color: '#fff' }}>{submitting ? 'Submitting…' : submitLabel}</button>
      </div>
    </div>
  )
}

function TaxPlanTrackView({ plan, phases, progress: initialProgress, specialists, onBack, readOnly = false, notes = [], onNotesChange, clientId, programName, client }) {
  const [localProgress, setLocalProgress] = useState(initialProgress)
  const [saving, setSaving] = useState({})
  const [expanded, setExpanded] = useState({})
  const [taxSpecialists, setTaxSpecialists] = useState([])
  const [showAddSpec, setShowAddSpec] = useState(false)
  const [newSpecId, setNewSpecId] = useState('')
  const [loadingSpecs, setLoadingSpecs] = useState(true)
  const [declineDrafts, setDeclineDrafts] = useState({})
  const [livePlan, setLivePlan] = useState(plan)
  const [extraMeetingPricingOpen, setExtraMeetingPricingOpen] = useState(false)
  const [submittingExtraNo, setSubmittingExtraNo] = useState(false)
  const [depositPiDrafts, setDepositPiDrafts] = useState({})

  async function refreshLivePlan() {
    try {
      const res = await callApi('tax_load_plans', { client_id: clientId })
      const fresh = (res.plans || []).find(p => p.id === plan.id)
      if (fresh) setLivePlan(fresh)
    } catch (err) { console.error('refreshLivePlan failed', err) }
  }

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
      const specData = await callApi('tax_load_specialists', { tax_plan_id: plan.id })
      setTaxSpecialists(specData.specialists || [])
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
      refreshLivePlan()
    } catch (err) { console.error(err) }
    finally { setSaving(p => ({ ...p, [key]: false })) }
  }

  async function fireReadyForTax3(taskId, decision, opts = {}) {
    const { declineReason, date, time, tz, existingDate } = opts
    const status = decision === 'declined' ? 'No - Declined email to client'
      : decision === 'confirm_no_date' ? 'Yes - Confirmation email (date TBC)'
      : 'Yes - Confirmation email to client'
    setDeclineDrafts(d => ({ ...d, [taskId]: { ...(d[taskId] || {}), sending: true } }))
    try {
      await callApi('automation_TAX_readyfortax3', {
        tax_plan_id: plan.id,
        decision,
        decline_reason: declineReason || null,
        meeting_date: date || null,
        meeting_time: time || null,
        meeting_tz: tz || null,
      })
      await saveTask(taskId, status, existingDate)
      setDeclineDrafts(d => { const next = { ...d }; delete next[taskId]; return next })
    } catch (err) {
      console.error(err)
      alert('Failed to send email: ' + (err?.message || 'unknown error'))
      setDeclineDrafts(d => ({ ...d, [taskId]: { ...(d[taskId] || {}), sending: false } }))
    }
  }

  async function fireHlmConfirm(taskId, opts = {}) {
    const { date, time, tz } = opts
    setDeclineDrafts(d => ({ ...d, [taskId]: { ...(d[taskId] || {}), sending: true } }))
    try {
      const res = await callApi('automation_TAX_highlevelmeeting_confirm', {
        tax_plan_id: plan.id,
        meeting_date: date || null,
        meeting_time: time || null,
        meeting_tz: tz || null,
      })
      if (res?.error) {
        alert('Error: ' + res.error)
        setDeclineDrafts(d => ({ ...d, [taskId]: { ...(d[taskId] || {}), sending: false } }))
        return
      }
      await refreshLivePlan()
      setDeclineDrafts(d => { const next = { ...d }; delete next[taskId]; return next })
    } catch (err) {
      console.error(err)
      alert('Failed to send email: ' + (err?.message || 'unknown error'))
      setDeclineDrafts(d => ({ ...d, [taskId]: { ...(d[taskId] || {}), sending: false } }))
    }
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
    Completed: '#1b9254', Yes: '#1b9254', 'No additional info required': '#1b9254',
    'Introductions Completed': '#1b9254', 'Combo Tax Plan': '#1b9254', 'ROI Plan': '#1b9254',
    'Continue Process': '#1b9254', 'Move to Implementation': '#1b9254', 'Refund Completed': '#1b9254',
    'Schedule Tax 3': '#1b9254', 'Paid': '#1b9254',
    'Yes - Confirmation email to client': '#1b9254', 'No - Declined email to client': '#e74c3c',
    'Tim Gacsy': '#1b9254', 'Steven Cox': '#1b9254',
    'Yes — Risk 1 — Very Conservative Mindset': '#1b9254', 'Yes — Risk 2 - Moderately Conservative Mindset': '#1b9254',
    'Yes — Risk 3 — Average Risk Mindset': '#1b9254', 'Yes — Risk 4 — Moderately Aggressive Mindset': '#1b9254',
    'Yes — Risk 5 — Very Aggressive Mindset': '#1b9254',
    No: '#e74c3c', 'Stop Process': '#e74c3c', 'Stopped': '#e74c3c',
    'Additional info required': '#1b9254', Undecided: '#e06717',
    'Continue DD': '#1b9254', 'Continue - Revenue Share': '#1b9254', 'Stop - Refund': '#e74c3c', 'N/A': '#4e6087',
    'Proceed with Implementation': '#1b9254', 'Not Implementing': '#e74c3c',
    'Pending Completion': '#e06717',
    'Go': '#1b9254',
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
  // Phase 7: Tax 5b unlocks when ANY specialist has 'Confirm ready for
  // implementation' set to any value (Yes / Undecided / No), OR when Client
  // decision 2 = 'Move to Implementation' (the shortcut that greys/bypasses the
  // per-specialist confirm step — without this, that path leaves Tax 5b locked).
  const confirmReadyTask = phases.find(p => p.name === 'Tax 5 - Education & DD (Specialist Allocation)')?.program_client_tasks?.find(t => t.name === 'Confirm ready for implementation')
  const tax5bUnlocked = (confirmReadyTask && taxSpecialists.some(spec => {
    const k = `${confirmReadyTask.id}_${spec.id}`
    return !!localProgress[k]?.status
  })) || decision2Status === 'Move to Implementation'

  function getPhaseState(phase) {
    let tasks = (phase.program_client_tasks || []).filter(t => t.status_options !== 'auto')
    if (phase.name === 'Tax 1 - Diagnostic' && !additionalInfoRequired) {
      tasks = tasks.filter(t => !['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(t.name))
    }
    if (phase.name === 'Set Up') {
      // tax_refund only applies when greenlight === 'Stop'; otherwise it's greyed and shouldn't block 'done'
      const greenlightTask = (phase.program_client_tasks || []).find(t => t.status_options === 'tax_greenlight')
      const greenlightStatus = greenlightTask ? localProgress[greenlightTask.id]?.status : ''
      if (greenlightStatus !== 'Stop') {
        tasks = tasks.filter(t => t.status_options !== 'tax_refund')
      }
    }

    // Phases that contain an AI-PC-Admin cascade aren't really "done" just
    // because the decision form was submitted — the cascade has to finish.
    // Gate Done on a phase-specific cascade endpoint and treat any progress
    // as Active until then.
    if (phase.name === 'Tax 3 - ROI Meeting') {
      const decline = livePlan?.tax_decision === 'No' || livePlan?.tax_final_decision === 'No'
      const fullyDone = livePlan?.retainer_invoice_email_sent === true
      if (decline || fullyDone) return 'done'
      if (tasks.some(t => localProgress[t.id]?.status)) return 'active'
      return 'pending'
    }
    if (phase.name === 'Tax 5 - Education & DD (Post Allocation)') {
      const impl = livePlan?.implementation_decision
      const finalDec = livePlan?.implementation_final_decision
      const decline = impl === 'Not Implementing' || (impl === 'Undecided' && finalDec === 'No')
      const fullyDone = livePlan?.implementation_rev_email_sent === true
      if (decline || fullyDone) return 'done'
      if (impl) return 'active'
      return 'pending'
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

  const inputStyle = { padding: '4px 8px', borderRadius: '6px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '12px', fontFamily: 'Inter, sans-serif' }

  const tax5aPhase = phases.find(p => p.name === 'Tax 5 - Education & DD (Specialist Allocation)')
  const tax5bPhase = phases.find(p => p.name === 'Tax 5 - Education & DD (Post Allocation)')
  const tax5aTasks = tax5aPhase?.program_client_tasks || []
  const phasesBeforeSpec = phases.filter(p => ['Set Up', 'Tax 1 - Diagnostic', 'Tax 2 - Deeper Dive', 'Tax 3 - ROI Meeting', 'Tax 4 - Tax Plan Review'].includes(p.name))
  const phasesAfterSpec = phases.filter(p => p.name === 'Tax 6 - Implementation')

  function renderTask(task, phase, taxSpecialistId = null) {
    const key = taxSpecialistId ? `${task.id}_${taxSpecialistId}` : task.id
    const p = localProgress[key] || {}
    const isDone = !!p.status
    const statusColor = statusColors[p.status] || '#4e6087'

    if (task.name === 'Client tax planning decision' && task.status_options === 'enter_details') {
      const enterPhase = phases.find(p => p.name === 'Tax 3 - ROI Meeting')
      const isInTax3 = enterPhase?.program_client_tasks?.some(pt => pt.id === task.id)
      if (isInTax3) {
        if (readOnly && isDone) {
          const decisionLabel = p.status.replace('Completed - ', '')
          const decisionColor = decisionLabel === 'Yes' ? '#1b9254' : decisionLabel === 'No' ? '#e74c3c' : '#e06717'
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: decisionColor, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#4e6087', flex: 1 }}>{task.name}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>
              <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{p.completed_date ? formatDate(p.completed_date) : ''}</span>
            </div>
          )
        }
        if (readOnly && !isDone) {
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid #c7d4e8' }} />
              <span style={{ fontSize: '13px', color: '#16264a', flex: 1 }}>{task.name}</span>
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>
              <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}></span>
            </div>
          )
        }
        const decisionLabel = isDone ? p.status.replace('Completed - ', '') : ''
        const decisionColor = decisionLabel === 'Yes' ? '#1b9254' : decisionLabel === 'No' ? '#e74c3c' : decisionLabel === 'Undecided' ? '#e06717' : '#4e6087'
        let formData = null
        if (isDone) { try { formData = JSON.parse(p.notes || '{}') } catch(e) { formData = {} } }
        const formExpandKey = `taxform_${task.id}`
        const isFormShown = isDone ? expanded[formExpandKey] : true
        return (
          <div key={key} style={{ borderBottom: '1px solid #f2f5fa', padding: '7px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isDone ? 'pointer' : 'default' }} onClick={() => isDone && setExpanded(prev => ({ ...prev, [formExpandKey]: !prev[formExpandKey] }))}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? decisionColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? decisionColor : '#c7d4e8'}` }} />
              <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
              {isDone && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>}
              <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
              {isDone && <span style={{ color: '#4e6087', fontSize: '10px', transform: isFormShown ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>}
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
                  refreshLivePlan()
                }}
              />
            )}
          </div>
        )
      }
    }

    if (task.name === 'AI PC Admin' && phase?.name === 'Tax 3 - ROI Meeting') {
      const enterDetailsTask = allTasks.find(t => t.name === 'Client tax planning decision')
      const enterDetailsStatus = enterDetailsTask ? (localProgress[enterDetailsTask.id]?.status || '') : ''
      if (!enterDetailsStatus || !enterDetailsStatus.startsWith('Completed')) return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid #c7d4e8' }} />
          <span style={{ fontSize: '13px', color: '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087', border: '1px solid #e3eaf5' }}>Waiting for details</span>
          <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}></span>
        </div>
      )
      // Cascade is done when invoice/receipt sent (Yes path) OR decline state
      const tax3Decline = livePlan?.tax_decision === 'No' || livePlan?.tax_final_decision === 'No'
      const tax3FullyDone = livePlan?.retainer_invoice_email_sent === true
      const aipcDone = tax3Decline || tax3FullyDone
      const decision = enterDetailsStatus.replace('Completed - ', '')
      let aiState = {}
      try { aiState = JSON.parse(localProgress[key]?.notes || '{}') } catch(e) { aiState = {} }
      const autoStep = (label, done) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f7f9fc' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '12px', color: done ? '#1b9254' : '#4e6087' }}>{label}</span>
          {done && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, marginLeft: 'auto' }}>Done</span>}
        </div>
      )
      const sharedSteps = [
        { label: 'Engagement agreement created and sent for signing', done: !!livePlan?.boldsign_doc_id },
        { label: 'Engagement agreement signed by client',             done: livePlan?.client_signed === 'Yes' },
        { label: 'Engagement agreement signed by Anton',              done: livePlan?.ceo_signed === 'Yes' },
        { label: 'Payment link sent to client (ACH or Card choice)',  done: !!livePlan?.checkout_token },
        { label: 'Retainer payment collected and confirmation email sent', done: livePlan?.retainer_confirmation_status === 'Sent' },
        { label: 'Invoice and receipt created and emailed to client', done: livePlan?.retainer_invoice_email_sent === true },
      ]
      const signingEmailSent = livePlan?.agreement_sent === 'Yes'
      // Reflect client's final decision when Undecided path resolved
      const finalDecResolved = livePlan?.tax_final_decision
      const effectiveDecision = decision === 'Undecided' && finalDecResolved ? finalDecResolved : decision
      const decisionColor = effectiveDecision === 'Yes' ? '#1b9254' : effectiveDecision === 'No' ? '#e74c3c' : effectiveDecision === 'ExtraMeeting' ? '#0095ff' : '#e06717'
      const decisionLabel = effectiveDecision === 'Yes' ? (decision === 'Undecided' ? 'Undecided → Yes' : 'Yes — proceeding') : effectiveDecision === 'No' ? (decision === 'Undecided' ? 'Undecided → No' : 'No — declined') : effectiveDecision === 'ExtraMeeting' ? 'Undecided → Extra meeting' : 'Undecided — awaiting client'
      const clientResponse = aiState.client_response || ''
      const pfResponse = aiState.pf_response || ''

      function saveAiState(newState, status) {
        callApi('tax_save_task', { tax_plan_id: plan.id, task_id: task.id, status, notes: JSON.stringify(newState) })
        setLocalProgress(prev => ({ ...prev, [key]: { ...prev[key], task_id: task.id, status, notes: JSON.stringify(newState) } }))
      }

      const pricingFoldKey = `pricing_${task.id}`
      const pricingExpanded = !!expanded[pricingFoldKey]
      const pricingStep = (done) => {
        if (!done) return autoStep('Pricing submitted by admin', false)
        return (
          <div style={{ borderBottom: '1px solid #f7f9fc' }}>
            <div onClick={() => setExpanded(p => ({ ...p, [pricingFoldKey]: !pricingExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', cursor: 'pointer' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1b9254', flexShrink: 0, border: '1px solid #1b9254' }} />
              <span style={{ fontSize: '12px', color: '#1b9254', fontWeight: 600 }}>Pricing submitted by admin</span>
              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, marginLeft: 'auto' }}>Done</span>
              <span style={{ color: '#4e6087', fontSize: '9px', transform: pricingExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
            </div>
            {pricingExpanded && (
              <div style={{ padding: '8px 12px 10px 16px', background: 'rgba(0,149,255,0.06)', border: '1px solid rgba(0,149,255,0.15)', borderRadius: '6px', margin: '4px 0 8px 14px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0095ff', marginBottom: '6px' }}>Entered values</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '12px' }}>
                  <span style={{ color: '#4e6087' }}>Retainer:</span><span style={{ color: '#16264a' }}>${Number(livePlan?.retainer_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: '#4e6087' }}>Implementation:</span><span style={{ color: '#16264a' }}>${Number(livePlan?.implementation_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <span style={{ color: '#4e6087' }}>Total fee:</span><span style={{ color: '#16264a' }}>${Number(livePlan?.total_fee || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  {livePlan?.split_type && (<><span style={{ color: '#4e6087' }}>Split:</span><span style={{ color: '#16264a' }}>{livePlan.split_type}</span></>)}
                  {livePlan?.member_share && (<><span style={{ color: '#4e6087' }}>Member share:</span><span style={{ color: '#16264a' }}>${Number(livePlan.member_share).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></>)}
                  {livePlan?.vfos_share && (<><span style={{ color: '#4e6087' }}>VFOS share:</span><span style={{ color: '#16264a' }}>${Number(livePlan.vfos_share).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></>)}
                  {livePlan?.risk_mindset && (<><span style={{ color: '#4e6087' }}>Risk mindset:</span><span style={{ color: '#16264a' }}>{livePlan.risk_mindset}</span></>)}
                  {livePlan?.presentation_link && (<><span style={{ color: '#4e6087' }}>Presentation:</span><span style={{ color: '#16264a', wordBreak: 'break-all' }}>{livePlan.presentation_link}</span></>)}
                </div>
              </div>
            )}
          </div>
        )
      }

      return (
        <div key={key} style={{ padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aipcDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${aipcDone ? '#1b9254' : '#c7d4e8'}` }} />
            <span style={{ fontSize: '13px', color: '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
          </div>
          <div style={{ marginLeft: '18px', padding: '8px 14px', background: '#eef2f9', borderRadius: '8px', border: '1px solid #f2f5fa' }}>
            {decision === 'No' && autoStep('Decline email sent to client', true)}
            {decision === 'Yes' && (
              <>
                {autoStep('Signing link and next steps email sent', signingEmailSent)}
                {sharedSteps.map((s, i) => <div key={i}>{autoStep(s.label, s.done)}</div>)}
              </>
            )}
            {decision === 'Undecided' && (() => {
              const finalDec = livePlan?.tax_final_decision
              const hasPricing = !!livePlan?.retainer_amount
              const viaExtra = !!livePlan?.tax_via_extra_meeting
              return (
                <>
                  {autoStep('Decision email sent with agreement PDF', livePlan?.tax_decision_email_sent === 'Yes')}
                  {!finalDec && autoStep('Waiting for client to respond via email', false)}

                  {finalDec === 'Yes' && !viaExtra && (
                    <>
                      {autoStep('Client confirmed — Yes', true)}
                      {!hasPricing && !readOnly && (
                        <TaxPricingForm
                          submitLabel="Submit Pricing & Send Agreement"
                          onSubmit={async (data) => {
                            await callApi('automation_TAX_pricing', { tax_plan_id: plan.id, form_data: data })
                            refreshLivePlan()
                          }}
                        />
                      )}
                      {hasPricing && pricingStep(true)}
                      {autoStep('Signing link and next steps email sent', signingEmailSent)}
                      {sharedSteps.map((s, i) => <div key={i}>{autoStep(s.label, s.done)}</div>)}
                    </>
                  )}

                  {finalDec === 'No' && (
                    <>
                      {autoStep(viaExtra ? 'PF confirmed — No after extra meeting' : 'Client confirmed — Stop', true)}
                      {autoStep('Decline email sent to client', true)}
                    </>
                  )}

                  {finalDec === 'ExtraMeeting' && (
                    <>
                      {autoStep('Client requested extra meeting', true)}
                      {autoStep('Extra meeting held', viaExtra)}
                      {!viaExtra && !extraMeetingPricingOpen && !readOnly && (
                        <div style={{ padding: '10px 0', borderBottom: '1px solid #f7f9fc' }}>
                          <div style={{ fontSize: '12px', color: '#16264a', marginBottom: '8px' }}>PF outcome after extra meeting:</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button disabled={submittingExtraNo} onClick={() => setExtraMeetingPricingOpen(true)} style={{ padding: '6px 14px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Yes — proceed with pricing</button>
                            <button disabled={submittingExtraNo} onClick={async () => {
                              setSubmittingExtraNo(true)
                              try {
                                await callApi('automation_TAX_extrameeting', { tax_plan_id: plan.id, outcome: 'No' })
                                refreshLivePlan()
                              } catch (err) {
                                alert('Submit failed: ' + (err?.message || 'unknown'))
                              } finally { setSubmittingExtraNo(false) }
                            }} style={{ padding: '6px 14px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }}>{submittingExtraNo ? 'Sending…' : 'No — decline'}</button>
                          </div>
                        </div>
                      )}
                      {!viaExtra && extraMeetingPricingOpen && (
                        <TaxPricingForm
                          submitLabel="Submit Pricing & Send Agreement"
                          onCancel={() => setExtraMeetingPricingOpen(false)}
                          onSubmit={async (data) => {
                            await callApi('automation_TAX_extrameeting', { tax_plan_id: plan.id, outcome: 'Yes', form_data: data })
                            setExtraMeetingPricingOpen(false)
                            refreshLivePlan()
                          }}
                        />
                      )}
                      {viaExtra && hasPricing && (
                        <>
                          {autoStep('PF confirmed — Yes with pricing', true)}
                          {pricingStep(true)}
                          {autoStep('Signing link and next steps email sent', signingEmailSent)}
                          {sharedSteps.map((s, i) => <div key={i}>{autoStep(s.label, s.done)}</div>)}
                        </>
                      )}
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      )
    }

    if (task.name === 'Refund initial 50%' || task.name === 'Revenue share for initial 50%') return null

    if (task.status_options === 'tax_hlm_confirm') {
      const savedDate = livePlan?.tax4_meeting_date || ''
      const draft = declineDrafts[task.id] || {}
      const formOpen = !!draft.dateOpen
      const sending = !!draft.sending
      const setDraft = (patch) => setDeclineDrafts(d => ({ ...d, [task.id]: { ...(d[task.id] || {}), ...patch } }))
      const tdInput = { padding: '4px 8px', borderRadius: '5px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '11px' }
      const tdGreen = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: sending ? 'not-allowed' : 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }
      const tdCancel = { padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid #d6e0ee', background: 'transparent', color: '#4e6087' }
      const confirmedLabel = savedDate
        ? `${savedDate}${livePlan?.tax4_meeting_time ? ' ' + livePlan.tax4_meeting_time : ''}${livePlan?.tax4_meeting_timezone ? ' ' + livePlan.tax4_meeting_timezone : ''}`
        : ''
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: savedDate ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${savedDate ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '13px', color: savedDate ? '#4e6087' : '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
          {savedDate ? (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#1b925422', color: '#1b9254', fontWeight: 600, border: '1px solid #1b925444' }}>Confirmation sent — {confirmedLabel}</span>
          ) : readOnly ? null : formOpen ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="date" value={draft.date || ''} onChange={e => setDraft({ date: e.target.value })} style={tdInput} />
              <input type="time" value={draft.time || ''} onChange={e => setDraft({ time: e.target.value })} style={tdInput} />
              <select value={draft.tz || 'ET'} onChange={e => setDraft({ tz: e.target.value })} style={{ ...tdInput, background: '#ffffff' }}>
                <option value="ET">Eastern (ET)</option>
                <option value="CT">Central (CT)</option>
                <option value="MT">Mountain (MT)</option>
                <option value="PT">Pacific (PT)</option>
                <option value="AKT">Alaska (AKT)</option>
                <option value="HT">Hawaii (HT)</option>
              </select>
              <button disabled={sending || !draft.date} onClick={() => fireHlmConfirm(task.id, { date: draft.date, time: draft.time, tz: draft.tz || 'ET' })} style={{ ...tdGreen, opacity: (sending || !draft.date) ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send'}</button>
              <button disabled={sending} onClick={() => setDeclineDrafts(d => { const next = { ...d }; delete next[task.id]; return next })} style={tdCancel}>Cancel</button>
            </div>
          ) : (
            <button disabled={sending} onClick={() => setDraft({ dateOpen: true, tz: draft.tz || 'ET' })} style={tdGreen} title="Enter the High Level Meeting date/time/timezone and send the confirmation email. The day after this date, Tim and Tracy get an action-required reminder to record the Client decision 1.">Send email (with date)</button>
          )}
          <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{savedDate ? formatDate(savedDate) : ''}</span>
        </div>
      )
    }

    if (task.status_options === 'tax_implement_decision') {
      const implDecision = livePlan?.implementation_decision
      const decisionColor = implDecision === 'Proceed' ? '#1b9254' : implDecision === 'Not Implementing' ? '#e74c3c' : implDecision === 'Undecided' ? '#e06717' : '#4e6087'
      const decisionLabel = implDecision === 'Undecided' ? 'Email sent - awaiting client decision' : implDecision === 'Proceed' ? 'Proceed with Implementation' : implDecision || ''

      async function handleSend() {
        if (!confirm("Send the client the implementation decision email?\n\nThey'll get two buttons:\n  Yes - Proceed: the implementation fee is charged immediately to their saved payment method.\n  No - Do not proceed: the engagement closes, no charge.\n\nIf they don't respond, a reminder is sent at 48h and you're notified at 96h.")) return
        await saveTask(task.id, 'Undecided', new Date().toISOString().slice(0, 10))
        const res = await callApi('automation_TAX_implementdecision', { tax_plan_id: plan.id, decision: 'Undecided' })
        if (res?.error) alert(`Error: ${res.error}`)
        await refreshLivePlan()
      }

      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: implDecision ? decisionColor : 'transparent', flexShrink: 0, border: `1.5px solid ${implDecision ? decisionColor : '#c7d4e8'}` }} />
          <span style={{ fontSize: '13px', color: implDecision ? '#4e6087' : '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
          {implDecision ? (
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{decisionLabel}</span>
          ) : (
            !readOnly && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={handleSend} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Send implementation decision email</button>
              </div>
            )
          )}
          <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{implDecision && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        </div>
      )
    }

    if (task.name === 'AI PC Admin' && phase?.name === 'Tax 5 - Education & DD (Post Allocation)') {
      const implDecision = livePlan?.implementation_decision
      let implFinal = livePlan?.implementation_final_decision
      // Backwards compat: legacy 'Yes'/'No' values map to Proceed/Decline
      if (implFinal === 'Yes') implFinal = 'Proceed'
      if (implFinal === 'No') implFinal = 'Decline'
      const reminderSentAt = livePlan?.implementation_reminder_sent_at
      const pfNotifiedAt = livePlan?.implementation_pf_notified_at
      const emailSentFor = livePlan?.implementation_decision_email_sent
      const emailSentAt = livePlan?.implementation_decision_email_sent_at
      const chargeStatus = livePlan?.implementation_charge_status
      const confStatus = livePlan?.implementation_confirmation_status
      const recStatus = livePlan?.implementation_receipt_status
      const revEmailSent = livePlan?.implementation_rev_email_sent

      // No decision yet → waiting for admin
      if (!implDecision) {
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', flexShrink: 0, border: '1.5px solid #c7d4e8' }} />
            <span style={{ fontSize: '13px', color: '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087', border: '1px solid #e3eaf5' }}>Waiting for decision</span>
          </div>
        )
      }

      // Cascade done state for the bullet/pill
      const declined = implDecision === 'Not Implementing'
        || ((implDecision === 'Proceed' || implDecision === 'Undecided') && implFinal === 'Decline')
      const fullyDone = revEmailSent === true
      const aipcDone = declined || fullyDone

      const autoStep = (label, done) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f7f9fc' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: done ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${done ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '12px', color: done ? '#1b9254' : '#4e6087' }}>{label}</span>
          {done && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, marginLeft: 'auto' }}>Done</span>}
          {!done && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: '#f2f5fa', color: '#4e6087', marginLeft: 'auto' }}>Not completed</span>}
        </div>
      )

      const chargeCascade = (
        <>
          {autoStep('Implementation fee auto-charged using saved payment method', chargeStatus === 'succeeded')}
          {autoStep('Implementation fee confirmation email sent', confStatus === 'Sent')}
          {autoStep('Implementation fee receipt created and emailed to client', recStatus === 'Sent')}
          {autoStep('Implementation fee revenue share verified, member paid, member emailed', revEmailSent === true)}
        </>
      )

      return (
        <div key={key} style={{ padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: aipcDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${aipcDone ? '#1b9254' : '#c7d4e8'}` }} />
            <span style={{ fontSize: '13px', color: '#16264a', flex: 1, fontWeight: '600' }}>{task.name}</span>
          </div>
          <div style={{ marginLeft: '18px', padding: '8px 14px', background: '#eef2f9', borderRadius: '8px', border: '1px solid #f2f5fa' }}>
            {implDecision === 'Not Implementing' && autoStep('Decline email sent to client', emailSentFor === 'Not Implementing')}

            {implDecision === 'Proceed' && (
              <>
                {autoStep('Email sent to client with decline button + 24h window', !!emailSentAt)}
                {!implFinal && autoStep('Waiting for client (auto-charges after 24h)', false)}
                {implFinal === 'Decline' && (
                  <>
                    {autoStep('Client clicked Decline within 24h', true)}
                    {autoStep('Decline email sent to client', true)}
                  </>
                )}
                {implFinal === 'Auto-Locked' && (
                  <>
                    {autoStep('24h passed — decision locked in', true)}
                    {chargeCascade}
                  </>
                )}
                {implFinal === 'Confirmed' && (
                  <>
                    {autoStep('Client confirmed Proceed (clicked "Proceed now")', true)}
                    {chargeCascade}
                  </>
                )}
                {implFinal === 'Proceed' && chargeCascade}
              </>
            )}

            {implDecision === 'Undecided' && (
              <>
                {autoStep('Email sent to client with two decision buttons', !!emailSentAt)}
                {!implFinal && !reminderSentAt && autoStep('Waiting for client decision', false)}
                {reminderSentAt && autoStep('48h reminder email sent to client', true)}
                {pfNotifiedAt && autoStep('96h passed — PF notified to contact client', true)}
                {implFinal === 'Proceed' && (
                  <>
                    {autoStep('Client clicked Yes (proceed)', true)}
                    {chargeCascade}
                  </>
                )}
                {implFinal === 'Decline' && (
                  <>
                    {autoStep('Client clicked No (do not proceed)', true)}
                    {autoStep('Decline email sent to client', true)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )
    }
    if (['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(task.name)) return null

    if (task.status_options === 'auto') {
      // AI PC Admin should auto-derive its done state from the cascade for
      // its containing phase, since admins never manually mark it Completed.
      let autoIsDone = isDone
      if (task.name === 'AI PC Admin' && phase?.name === 'Tax 3 - ROI Meeting') {
        const decline = livePlan?.tax_decision === 'No' || livePlan?.tax_final_decision === 'No'
        const fullyDone = livePlan?.retainer_invoice_email_sent === true
        autoIsDone = decline || fullyDone
      }
      if (task.name === 'AI PC Admin' && phase?.name === 'Tax 5 - Education & DD (Post Allocation)') {
        const impl = livePlan?.implementation_decision
        const finalDec = livePlan?.implementation_final_decision
        const decline = impl === 'Not Implementing' || (impl === 'Undecided' && finalDec === 'No')
        const fullyDone = livePlan?.implementation_rev_email_sent === true
        autoIsDone = decline || fullyDone
      }
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: autoIsDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${autoIsDone ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '13px', color: '#4e6087', flex: 1 }}>{task.name}</span>
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: autoIsDone ? 'rgba(27,146,84,0.15)' : '#f2f5fa', color: autoIsDone ? '#1b9254' : '#4e6087', border: `1px solid ${autoIsDone ? 'rgba(27,146,84,0.3)' : '#e3eaf5'}` }}>{autoIsDone ? 'Completed' : 'Not completed'}</span>
          <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{autoIsDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        </div>
      )
    }

    if (readOnly) return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>
        }
        <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
      </div>
    )


    if (task.status_options === 'enter_details') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? '#1b9254' : '#c7d4e8'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Completed</span>
          : <button onClick={() => saveTask(task.id, 'Completed', p.completed_date, taxSpecialistId)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600 }}>Enter details</button>
        }
        <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{p.completed_date ? formatDate(p.completed_date) : ''}</span>
      </div>
    )

    if (task.status_options === 'tax_greenlight') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => saveTask(task.id, 'Go', p.completed_date, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Go</button>
              <button onClick={() => saveTask(task.id, 'Stop', p.completed_date, taxSpecialistId)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }}>Stop</button>
            </div>
        }
        <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
      </div>
    )

    if (task.status_options === 'tax_deposit_pi') {
      const savedPi = livePlan?.deposit_payment_intent_id || ''
      const draftVal = depositPiDrafts[task.id]
      const inputVal = draftVal !== undefined ? draftVal : savedPi
      async function saveDepositPi() {
        if (!inputVal || !inputVal.trim()) { alert('Enter a Stripe PaymentIntent ID (pi_...) or payment URL'); return }
        const res = await callApi('tax_save_deposit_pi', { tax_plan_id: plan.id, payment_intent_id: inputVal.trim(), task_id: task.id })
        if (res?.error) { alert(`Error: ${res.error}`); return }
        await refreshLivePlan()
        const pd = await callApi('tax_load_progress', { tax_plan_id: plan.id })
        const map = {}
        ;(pd.progress || []).forEach(pr => {
          const k = pr.tax_specialist_id ? `${pr.task_id}_${pr.tax_specialist_id}` : pr.task_id
          map[k] = pr
        })
        setLocalProgress(map)
        setDepositPiDrafts(p => { const c = { ...p }; delete c[task.id]; return c })
      }
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone && savedPi ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone && savedPi ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
          {readOnly ? (
            savedPi && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#1b925422', color: '#1b9254', fontWeight: 600, border: '1px solid #1b925444', fontFamily: 'monospace' }}>{savedPi}</span>
          ) : (
            <>
              <input
                type="text"
                value={inputVal}
                placeholder="pi_..."
                onChange={(e) => setDepositPiDrafts(p => ({ ...p, [task.id]: e.target.value }))}
                style={{ ...inputStyle, fontFamily: 'monospace', minWidth: '240px' }}
                title="Paste the Stripe PaymentIntent ID (pi_...) or a payment URL from the Stripe dashboard"
              />
              <button onClick={saveDepositPi} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600 }}>Save</button>
            </>
          )}
          <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
        </div>
      )
    }

    if (task.status_options === 'tax_refund') {
      const greenlightTask = allTasks.find(t => t.name === 'Tax Plan Greenlight')
      const greenlightStatus = greenlightTask ? (localProgress[greenlightTask.id]?.status || '') : ''
      const hasPi = !!livePlan?.deposit_payment_intent_id
      const refunded = livePlan?.deposit_refund_status === 'succeeded'
      const greyed = greenlightStatus !== 'Stop' || !hasPi
      async function sendDepositRefund() {
        if (!confirm(`Refund the deposit ($${livePlan?.deposit_refund_amount || 'full PI amount'}) via Stripe?\n\nThis will refund the saved PaymentIntent in full and draft a confirmation email to the client. Cannot be undone.`)) return
        const res = await callApi('automation_TAX_depositrefund', { tax_plan_id: plan.id })
        if (res?.error) { alert(`Refund failed: ${res.error}`); return }
        // Mark task as completed
        await saveTask(task.id, 'Completed', new Date().toISOString().slice(0, 10), taxSpecialistId)
        await refreshLivePlan()
      }
      return (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap', opacity: greyed && !refunded ? 0.3 : 1 }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: refunded ? '#1b9254' : 'transparent', flexShrink: 0, border: `1.5px solid ${refunded ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '13px', color: refunded ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
          {refunded
            ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#1b925422', color: '#1b9254', fontWeight: 600, border: '1px solid #1b925444' }}>Refunded ${livePlan?.deposit_refund_amount}</span>
            : <button disabled={greyed || readOnly} onClick={sendDepositRefund} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: greyed ? 'not-allowed' : 'pointer', border: '1px solid rgba(0,149,255,0.4)', background: 'rgba(0,149,255,0.12)', color: '#0095ff', fontWeight: 600 }} title={!hasPi ? 'Enter the Deposit PaymentIntent ID first' : (greenlightStatus !== 'Stop' ? 'Available once Tax Plan Greenlight = Stop' : '')}>Send refund</button>
          }
          <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{refunded && livePlan?.deposit_refund_date ? formatDate(livePlan.deposit_refund_date) : (isDone && p.completed_date ? formatDate(p.completed_date) : '')}</span>
        </div>
      )
    }

    if (task.status_options === 'tax_3_decision') {
      const draft = declineDrafts[task.id] || {}
      const declineOpen = !!draft.open
      const dateOpen = !!draft.dateOpen
      const sending = !!draft.sending
      const tdInput = { padding: '4px 8px', borderRadius: '5px', border: '1px solid #d6e0ee', background: '#f2f5fa', color: '#16264a', fontSize: '11px' }
      const tdGreen = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: sending ? 'not-allowed' : 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }
      const tdRed = { padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: sending ? 'not-allowed' : 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }
      const tdCancel = { padding: '4px 8px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid #d6e0ee', background: 'transparent', color: '#4e6087' }
      const setDraft = (patch) => setDeclineDrafts(d => ({ ...d, [task.id]: { ...(d[task.id] || {}), ...patch } }))
      return (
        <div key={key} style={{ borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
            <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
            {isDone
              ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
              : dateOpen
                ? <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input type="date" value={draft.date || ''} onChange={e => setDraft({ date: e.target.value })} style={tdInput} />
                    <input type="time" value={draft.time || ''} onChange={e => setDraft({ time: e.target.value })} style={tdInput} />
                    <select value={draft.tz || 'ET'} onChange={e => setDraft({ tz: e.target.value })} style={{ ...tdInput, background: '#ffffff' }}>
                      <option value="ET">Eastern (ET)</option>
                      <option value="CT">Central (CT)</option>
                      <option value="MT">Mountain (MT)</option>
                      <option value="PT">Pacific (PT)</option>
                      <option value="AKT">Alaska (AKT)</option>
                      <option value="HT">Hawaii (HT)</option>
                    </select>
                    <button disabled={sending || !draft.date} onClick={() => fireReadyForTax3(task.id, 'confirm_date', { date: draft.date, time: draft.time, tz: draft.tz || 'ET', existingDate: p.completed_date })} style={{ ...tdGreen, opacity: (sending || !draft.date) ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send'}</button>
                    <button disabled={sending} onClick={() => setDeclineDrafts(d => { const next = { ...d }; delete next[task.id]; return next })} style={tdCancel}>Cancel</button>
                  </div>
                : !declineOpen && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button disabled={sending} onClick={() => setDraft({ dateOpen: true, tz: draft.tz || 'ET' })} style={tdGreen}>Send email (with date)</button>
                      <button disabled={sending} onClick={() => fireReadyForTax3(task.id, 'confirm_no_date', { existingDate: p.completed_date })} style={{ ...tdGreen, opacity: sending ? 0.6 : 1 }}>{sending ? 'Sending...' : 'Send email - date not confirmed'}</button>
                      <button disabled={sending} onClick={() => setDeclineDrafts(d => ({ ...d, [task.id]: { open: true, reason: '', sending: false } }))} style={tdRed}>No - Declined email to client</button>
                    </div>
                  )
            }
            <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
          </div>
          {declineOpen && !isDone && (
            <div style={{ marginLeft: '18px', marginBottom: '8px', padding: '14px 16px', background: '#eef2f9', borderRadius: '10px', border: '1px solid #ebf0f8', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontSize: '11px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                Subject: Tax Planning Priority Assessment — {client?.first_name ? `${client.first_name} ${client.last_name || ''}`.trim() : '[Client Name]'}
              </div>
              <div style={{ fontSize: '13px', color: '#44557a', lineHeight: '1.6' }}>
                <p style={{ margin: '0 0 12px' }}>Dear {client?.first_name || '[Client First]'},</p>
                <p style={{ margin: '0 0 12px' }}>Thank you for providing the information for assessing your Tax Planning Priority. Unfortunately, at this time, we are not going to be able to move forward.</p>
                <textarea
                  value={draft.reason || ''}
                  onChange={e => setDeclineDrafts(d => ({ ...d, [task.id]: { ...(d[task.id] || {}), reason: e.target.value } }))}
                  placeholder="Type the decline reason here — written as if speaking directly to the client."
                  disabled={sending}
                  style={{ width: '100%', minHeight: '90px', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.06)', color: '#16264a', fontFamily: 'Inter, sans-serif', fontSize: '13px', lineHeight: '1.55', boxSizing: 'border-box', resize: 'vertical', marginBottom: '12px' }}
                />
                <p style={{ margin: 0 }}>Regards,</p>
              </div>
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button disabled={sending} onClick={() => setDeclineDrafts(d => { const next = { ...d }; delete next[task.id]; return next })} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: sending ? 'not-allowed' : 'pointer', border: '1px solid #d6e0ee', background: 'transparent', color: '#4e6087' }}>Cancel</button>
                <button disabled={sending || !(draft.reason || '').trim()} onClick={() => fireReadyForTax3(task.id, 'declined', { declineReason: draft.reason, existingDate: p.completed_date })} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: (sending || !(draft.reason || '').trim()) ? 'not-allowed' : 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: (sending || !(draft.reason || '').trim()) ? 'rgba(231,76,60,0.06)' : 'rgba(231,76,60,0.18)', color: '#e74c3c', fontWeight: '600' }}>{sending ? 'Sending...' : 'Send Decline Email'}</button>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (task.status_options === 'tax_continue_stop') {
      const adminDecision = livePlan?.post_review_decision
      const emailSentAt = livePlan?.post_review_decision_email_sent_at
      const clientDecision = livePlan?.post_review_client_decision
      const reminderSentAt = livePlan?.post_review_reminder_sent_at
      const pfNotifiedAt = livePlan?.post_review_pf_notified_at
      const refundStatus = livePlan?.refund_status
      const revPaid = livePlan?.retainer_rev_paid
      // Revenue share is N/A (still green) when member share is $0 — mirrors MAP 1.
      // Tax stores a $0 member share as NULL (decision.ts: parseFloat(...) || null),
      // so treat null/empty as zero-share too.
      const isZeroShare = (v) => parseFloat(String(v ?? '').replace(/[$,]/g, '')) === 0
      const zeroShare = livePlan?.member_share == null || isZeroShare(livePlan?.member_share)

      const decisionColor = adminDecision === 'Continue - Revenue Share' ? '#1b9254'
        : adminDecision === 'Stop - Refund' ? '#e74c3c'
        : adminDecision === 'Undecided' ? '#e06717'
        : '#4e6087'

      async function handlePick(value) {
        if (!value) return
        if (value === 'Continue - Revenue Share' && !confirm("Mark client as Continue?\n\nThis sends them an email with a refund button + a 24h grace window. After 24h with no click the revenue share is auto-fired.")) return
        if (value === 'Stop - Refund' && !confirm("Stop - Refund? This will IMMEDIATELY fire a Stripe refund of the retainer and draft a refund confirmation email to the client.")) return
        if (value === 'Undecided' && !confirm("Mark client as Undecided?\n\nThey'll get an email with two buttons (Proceed / Refund). After 48h with no click we send a reminder, after 96h we notify you to call the client.")) return
        await saveTask(task.id, value, new Date().toISOString().slice(0, 10))
        let res
        try {
          res = await callApi('automation_TAX_postreviewdecision', { tax_plan_id: plan.id, decision: value })
        } catch (err) {
          alert(`Post-review request failed: ${err.message || err}`)
          return
        }
        if (res?.error) alert(`Error: ${res.error}`)
        else if (res?.refund_result?.error) alert(`Refund failed: ${res.refund_result.error}`)
        await refreshLivePlan()
      }

      const autoStep = (label, done, opts = {}) => {
        const na = !!opts.na
        return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f7f9fc' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: (done || na) ? '#1b9254' : 'transparent', flexShrink: 0, border: `1px solid ${(done || na) ? '#1b9254' : '#c7d4e8'}` }} />
          <span style={{ fontSize: '12px', color: (done || na) ? '#1b9254' : '#4e6087' }}>{label}</span>
          {(done || na) && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, marginLeft: 'auto' }}>{na ? 'N/A' : 'Done'}</span>}
          {!(done || na) && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: '#f2f5fa', color: '#4e6087', marginLeft: 'auto' }}>{opts.pendingLabel || 'Not completed'}</span>}
        </div>
        )
      }

      return (
        <div key={key} style={{ borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: adminDecision ? decisionColor : 'transparent', flexShrink: 0, border: `1.5px solid ${adminDecision ? decisionColor : '#c7d4e8'}` }} />
            <span style={{ fontSize: '13px', color: adminDecision ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
            {adminDecision ? (
              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${decisionColor}22`, color: decisionColor, border: `1px solid ${decisionColor}44` }}>{adminDecision}</span>
            ) : (
              !readOnly && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => handlePick('Continue - Revenue Share')} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Continue - Revenue Share</button>
                  <button onClick={() => handlePick('Undecided')} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(251,137,90,0.4)', background: 'rgba(251,137,90,0.12)', color: '#e06717', fontWeight: 600 }}>Undecided</button>
                  <button onClick={() => handlePick('Stop - Refund')} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.12)', color: '#e74c3c', fontWeight: 600 }}>Stop - Refund</button>
                </div>
              )
            )}
            <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{adminDecision && p.completed_date ? formatDate(p.completed_date) : ''}</span>
          </div>
          {adminDecision && (
            <div style={{ marginLeft: '18px', padding: '8px 14px', background: '#eef2f9', borderRadius: '8px', border: '1px solid #f2f5fa', marginBottom: '8px' }}>
              {adminDecision === 'Stop - Refund' && (
                <>
                  {autoStep('Refund processed and confirmation email drafted', refundStatus === 'succeeded')}
                </>
              )}
              {adminDecision === 'Continue - Revenue Share' && (
                <>
                  {autoStep('Email sent to client with refund button + 24h window', !!emailSentAt)}
                  {!clientDecision && autoStep('Waiting for client (auto-locks after 24h)', false)}
                  {clientDecision === 'Refund' && (
                    <>
                      {autoStep('Client clicked Refund within 24h', true)}
                      {autoStep('Refund issued', refundStatus === 'succeeded')}
                    </>
                  )}
                  {clientDecision === 'Auto-Locked' && (
                    <>
                      {autoStep('24h passed — decision locked in', true)}
                      {autoStep('Revenue share verified, member paid, member emailed', revPaid === 'Yes', { na: zeroShare })}
                    </>
                  )}
                  {clientDecision === 'Confirmed' && (
                    <>
                      {autoStep('Client confirmed Continue (clicked "Continue now")', true)}
                      {autoStep('Revenue share verified, member paid, member emailed', revPaid === 'Yes', { na: zeroShare })}
                    </>
                  )}
                </>
              )}
              {adminDecision === 'Undecided' && (
                <>
                  {autoStep('Email sent to client with two decision buttons', !!emailSentAt)}
                  {!clientDecision && !reminderSentAt && autoStep('Waiting for client (48h before reminder)', false)}
                  {reminderSentAt && autoStep('48h reminder email sent to client', true)}
                  {pfNotifiedAt && autoStep('96h passed — PF notified to contact client', true)}
                  {clientDecision === 'Proceed' && (
                    <>
                      {autoStep('Client clicked Proceed', true)}
                      {autoStep('Revenue share verified, member paid, member emailed', revPaid === 'Yes', { na: zeroShare })}
                    </>
                  )}
                  {clientDecision === 'Refund' && (
                    <>
                      {autoStep('Client clicked Refund', true)}
                      {autoStep('Refund issued', refundStatus === 'succeeded')}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )
    }

    if (task.status_options === 'tax_dd_implementation') return (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
        {isDone
          ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{p.status}</span>
          : <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => saveTask(task.id, 'Continue DD', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Continue DD</button>
              <button onClick={() => saveTask(task.id, 'Move to Implementation', p.completed_date)} style={{ padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer', border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.12)', color: '#1b9254', fontWeight: 600 }}>Move to Implementation</button>
            </div>
        }
        <span style={{ fontSize: '11px', color: '#4e6087', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{isDone && p.completed_date ? formatDate(p.completed_date) : ''}</span>
      </div>
    )

    if (task.status_options === 'specialist_select') return null

    if (task.name === 'Additional information required') {
      const childTaskNames = ['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L']
      const childTasks = allTasks.filter(t => childTaskNames.includes(t.name))
      const greyed = !additionalInfoRequired
      return (
        <div key={key} style={{ borderBottom: '1px solid #f2f5fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', flexWrap: 'wrap' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
            <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}</span>
            <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, taxSpecialistId)} disabled={saving[key]} style={{ ...inputStyle, background: '#ffffff', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : '#d6e0ee', color: isDone ? statusColor : '#16264a' }}>
              <option value="">-- Select --</option>
              {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{p.completed_date ? formatDate(p.completed_date) : ''}</span>
          </div>
          <div style={{ marginLeft: '18px', borderLeft: '1px solid #ebf0f8', paddingLeft: '12px', paddingBottom: '4px', opacity: greyed ? 0.3 : 1, pointerEvents: greyed ? 'none' : 'auto' }}>
            {childTasks.map(ct => {
              const ck = taxSpecialistId ? `${ct.id}_${taxSpecialistId}` : ct.id
              const cp = localProgress[ck] || {}
              const cDone = !!cp.status
              const cColor = statusColors[cp.status] || '#4e6087'
              return (
                <div key={ck} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f7f9fc', flexWrap: 'wrap' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cDone ? cColor : 'transparent', flexShrink: 0, border: `1px solid ${cDone ? cColor : '#c7d4e8'}` }} />
                  <span style={{ fontSize: '12px', color: cDone ? '#4e6087' : '#16264a', flex: 1 }}>{ct.name}</span>
                  <select value={cp.status || ''} onChange={e => saveTask(ct.id, e.target.value, cp.completed_date, taxSpecialistId)} style={{ ...inputStyle, background: '#ffffff', minWidth: '120px', fontSize: '11px', borderColor: cDone ? `${cColor}66` : '#d6e0ee', color: cDone ? cColor : '#16264a' }}>
                    <option value="">-- Select --</option>
                    {(ct.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{cp.completed_date ? formatDate(cp.completed_date) : ''}</span>
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
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa', flexWrap: 'wrap', opacity: isGreyedOut ? 0.3 : 1, pointerEvents: isGreyedOut ? 'none' : 'auto' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isDone ? statusColor : 'transparent', flexShrink: 0, border: `1.5px solid ${isDone ? statusColor : '#c7d4e8'}` }} />
        <span style={{ fontSize: '13px', color: isDone ? '#4e6087' : '#16264a', flex: 1 }}>{task.name}{greyNote && <span style={{ fontSize: '11px', color: '#e06717', fontWeight: 600, marginLeft: '8px' }}>({greyNote})</span>}</span>
        <select value={p.status || ''} onChange={e => saveTask(task.id, e.target.value, p.completed_date, taxSpecialistId)} disabled={saving[key]} style={{ ...inputStyle, background: '#ffffff', minWidth: '150px', borderColor: isDone ? `${statusColor}66` : '#d6e0ee', color: isDone ? statusColor : '#16264a' }}>
          <option value="">-- Select --</option>
          {(task.status_options || '').split('|').map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: '11px', color: '#697a9c', display: 'inline-block', width: '55px', textAlign: 'right', flexShrink: 0 }}>{p.completed_date ? formatDate(p.completed_date) : ''}</span>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#0095ff', fontWeight: 500, fontSize: '13px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>← Back to Tax Plans</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '22px', color: '#16264a' }}>Tax Plan</div>
        <div style={{ fontSize: '12px', color: '#4e6087' }}>Started {plan.created_at?.split('T')[0]}</div>
      </div>

      {phasesBeforeSpec.map(phase => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id] !== undefined ? expanded[phase.id] : (state === 'active')
        const tasks = phase.program_client_tasks || []
        let nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        if (phase.name === 'Tax 1 - Diagnostic' && !additionalInfoRequired) {
          nonAutoTasks = nonAutoTasks.filter(t => !['Email to obtain information required sent', 'Information received', 'Information passed to VFO-L'].includes(t.name))
        }
        if (phase.name === 'Set Up') {
          // tax_refund task only counts when greenlight === 'Stop' (otherwise it's greyed in the UI)
          const greenlightTask = tasks.find(t => t.status_options === 'tax_greenlight')
          const greenlightStatus = greenlightTask ? localProgress[greenlightTask.id]?.status : ''
          if (greenlightStatus !== 'Stop') {
            nonAutoTasks = nonAutoTasks.filter(t => t.status_options !== 'tax_refund')
          }
        }
        const doneTasks = nonAutoTasks.filter(t => {
          // tax_hlm_confirm writes to client_tax_plans.tax4_meeting_date, not client_tax_progress
          if (t.status_options === 'tax_hlm_confirm') return !!livePlan?.tax4_meeting_date
          return !!localProgress[t.id]?.status
        }).length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = state === 'active' ? '#125ecc' : '#16264a'
        return (
          <div key={phase.id} style={{ background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !isExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? '#c7d4e8' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'Tax Priorities').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress{doneTasks < nonAutoTasks.length ? ` · ${doneTasks}/${nonAutoTasks.length}` : ''}</span>}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !isExpanded }))} style={{ color: '#4e6087', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
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
        <div style={{ background: '#ffffff', border: '1px solid rgba(0,149,255,0.4)', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#0095ff', border: '1.5px solid #0095ff', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0095ff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax 5 - Education & DD (Specialist Allocation)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === 'Tax 5 - Education & DD (Specialist Allocation)' && n.tab_name === 'Tax Priorities').length} isOpen={expanded['notes_tax5a']} onClick={() => setExpanded(p => ({ ...p, ['notes_tax5a']: !p['notes_tax5a'] }))} />}
              {taxSpecialists.length > 0 && taxSpecialists.every(spec => tax5aTasks.filter(t => t.status_options !== 'specialist_select').every(t => localProgress[`${t.id}_${spec.id}`]?.status))
                ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>
                : taxSpecialists.length > 0 && taxSpecialists.some(spec => tax5aTasks.filter(t => t.status_options !== 'specialist_select').some(t => localProgress[`${t.id}_${spec.id}`]?.status))
                  ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>
                  : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>
              }
              {!readOnly && (
                <button onClick={() => setShowAddSpec(!showAddSpec)} style={{ padding: '5px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff' }}>+ Add Specialist</button>
              )}
            </div>
          </div>
          {!readOnly && expanded['notes_tax5a'] && <PhaseNotesPanel clientId={clientId} phaseName="Tax 5 - Education & DD (Specialist Allocation)" tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
          <div style={{ borderTop: '1px solid rgba(0,149,255,0.2)', padding: '12px 18px' }}>
            {showAddSpec && (
              <div style={{ padding: '12px', background: '#eef2f9', borderRadius: '8px', marginBottom: '12px' }}>
                <select value={newSpecId} onChange={e => setNewSpecId(e.target.value)} style={{ ...inputStyle, background: '#ffffff', width: '100%', marginBottom: '8px', padding: '8px 12px' }}>
                  <option value="">-- Select Specialist --</option>
                  {specialists.filter(s => !taxSpecialists.some(ts => ts.expert_id === s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={addSpecialist} style={{ padding: '6px 16px', borderRadius: '6px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Add</button>
                  <button onClick={() => setShowAddSpec(false)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #c7d4e8', background: 'transparent', color: '#4e6087', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {taxSpecialists.length === 0 && !showAddSpec && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#4e6087', fontSize: '13px' }}>No specialists allocated yet.</div>
            )}
            {taxSpecialists.map(spec => {
              const allocateTask = tax5aTasks.find(t => t.status_options === 'specialist_select')
              const specTasks = tax5aTasks.filter(t => t.status_options !== 'specialist_select')
              const specExpKey = `spec_${spec.id}`
              const allSpecDone = specTasks.every(t => localProgress[`${t.id}_${spec.id}`]?.status)
              const isSpecExpanded = expanded[specExpKey] !== undefined ? expanded[specExpKey] : !allSpecDone
              return (
                <div key={spec.id} style={{ background: '#f7f9fc', border: '1px solid #ebf0f8', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
                  <div onClick={() => setExpanded(p => ({ ...p, [specExpKey]: !isSpecExpanded }))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#16264a' }}>{spec.specialist_name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: spec.status === 'stopped' ? 'rgba(231,76,60,0.15)' : 'rgba(27,146,84,0.15)', color: spec.status === 'stopped' ? '#e74c3c' : '#1b9254', border: `1px solid ${spec.status === 'stopped' ? 'rgba(231,76,60,0.3)' : 'rgba(27,146,84,0.3)'}` }}>{spec.status === 'stopped' ? 'Stopped' : 'Live'}</span>
                    </div>
                    <span style={{ color: '#4e6087', fontSize: '10px', transform: isSpecExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                  {isSpecExpanded && (
                    <div style={{ borderTop: '1px solid #f2f5fa', padding: '8px 14px' }}>
                      {allocateTask && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid #f2f5fa' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#1b9254', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#4e6087', flex: 1 }}>Allocate to VFO Specialist</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>
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

      {tax5bPhase && (() => {
        const tax5bState = getPhaseState(tax5bPhase)
        const tax5bDotColor = tax5bState === 'done' ? '#1b9254' : tax5bState === 'active' ? '#0095ff' : 'transparent'
        const tax5bBorderColor = tax5bState === 'done' ? 'rgba(27,146,84,0.3)' : tax5bState === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
        return (
        <div style={{ background: '#ffffff', border: `1px solid ${tax5bBorderColor}`, borderRadius: '12px', marginBottom: '10px', overflow: 'hidden', opacity: tax5bUnlocked ? 1 : 0.3, pointerEvents: tax5bUnlocked ? 'auto' : 'none' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: tax5bDotColor, border: `1.5px solid ${tax5bState === 'pending' ? '#c7d4e8' : tax5bDotColor}`, flexShrink: 0 }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: tax5bState === 'active' ? '#0095ff' : '#16264a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax 5 - Education & DD (Post Allocation)</span>
              {!tax5bUnlocked && <span style={{ fontSize: '11px', color: '#e06717', fontWeight: 600 }}>(Unlocks when "Confirm ready for implementation" is set on any specialist)</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!readOnly && tax5bUnlocked && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === 'Tax 5 - Education & DD (Post Allocation)' && n.tab_name === 'Tax Priorities').length} isOpen={expanded['notes_tax5b']} onClick={() => setExpanded(p => ({ ...p, ['notes_tax5b']: !p['notes_tax5b'] }))} />}
              {tax5bUnlocked && tax5bState === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
              {tax5bUnlocked && tax5bState === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress</span>}
              {tax5bUnlocked && tax5bState === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>}
            </div>
          </div>
          {!readOnly && expanded['notes_tax5b'] && <PhaseNotesPanel clientId={clientId} phaseName="Tax 5 - Education & DD (Post Allocation)" tabName="Tax Priorities" programName={programName} notes={notes} onNotesChange={onNotesChange} />}
          {tax5bUnlocked && (
            <div style={{ borderTop: '1px solid #e3eaf5', padding: '12px 18px' }}>
              {(tax5bPhase.program_client_tasks || []).map(task => renderTask(task, tax5bPhase))}
            </div>
          )}
        </div>
        )
      })()}

      {phasesAfterSpec.map(phase => {
        const state = getPhaseState(phase)
        const isExpanded = expanded[phase.id] !== undefined ? expanded[phase.id] : (state === 'active')
        const tasks = phase.program_client_tasks || []
        const nonAutoTasks = tasks.filter(t => t.status_options !== 'auto')
        const doneTasks = nonAutoTasks.filter(t => {
          // tax_hlm_confirm writes to client_tax_plans.tax4_meeting_date, not client_tax_progress
          if (t.status_options === 'tax_hlm_confirm') return !!livePlan?.tax4_meeting_date
          return !!localProgress[t.id]?.status
        }).length
        const borderColor = state === 'done' ? 'rgba(27,146,84,0.3)' : state === 'active' ? 'rgba(0,149,255,0.4)' : '#e3eaf5'
        const dotColor = state === 'done' ? '#1b9254' : state === 'active' ? '#0095ff' : 'transparent'
        const titleColor = state === 'active' ? '#125ecc' : '#16264a'
        return (
          <div key={phase.id} style={{ background: '#ffffff', border: `1px solid ${borderColor}`, borderRadius: '14px', boxShadow: '0 3px 12px rgba(20,45,95,0.05)', marginBottom: '10px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
              <div onClick={() => setExpanded(p => ({ ...p, [phase.id]: !isExpanded }))} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColor, border: `1.5px solid ${state === 'pending' ? '#c7d4e8' : dotColor}`, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: '600', color: titleColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{phase.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {state === 'done' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(27,146,84,0.15)', color: '#1b9254', fontWeight: 600, border: '1px solid rgba(27,146,84,0.3)' }}>Done</span>}
                {state === 'active' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,149,255,0.15)', color: '#0095ff', fontWeight: 600, border: '1px solid rgba(0,149,255,0.3)' }}>In progress{doneTasks < nonAutoTasks.length ? ` · ${doneTasks}/${nonAutoTasks.length}` : ''}</span>}
                {!readOnly && <PhaseNotesButton count={(notes || []).filter(n => n.phase_name === phase.name && n.tab_name === 'Tax Priorities').length} isOpen={expanded[`notes_${phase.id}`]} onClick={() => setExpanded(p => ({ ...p, [`notes_${phase.id}`]: !p[`notes_${phase.id}`] }))} />}
                {state === 'pending' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f2f5fa', color: '#4e6087' }}>Not started</span>}
                <span onClick={() => setExpanded(p => ({ ...p, [phase.id]: !isExpanded }))} style={{ color: '#4e6087', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', cursor: 'pointer' }}>▼</span>
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

function TaxPrioritiesTab({ clientId, programId, programName, client, specialists, readOnly = false, notes = [], onNotesChange }) {
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
        loadCachedAction('msm_load_client_track', { program_id: programId, track_type: 'tax' }),
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
      await callApi('tax_start_plan', { client_id: clientId, program_id: programId })
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

  const sectionStyle = { background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '24px', marginBottom: '16px' }
  const stateColors = { 'not started': '#4e6087', 'in progress': '#0095ff', 'completed': '#1b9254' }

  if (loading) return <TaxPlanListSkeleton />

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
        client={client}
        programName={programName === 'VFO Tax Planning' ? 'VFO Tax Planning' : 'VFO Holistic Planning'}
      />
    )
  }

  return (
    <div>
      {!taxEnabled && (
        <div style={{ ...sectionStyle, borderColor: 'rgba(231,76,60,0.3)', textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '15px', color: '#4e6087' }}>Tax Priorities is not yet enabled for this client.</div>
          <div style={{ fontSize: '13px', color: '#697a9c', marginTop: '8px' }}>Set C26 to "Tax priorities tab enabled" in MAP 1 first.</div>
        </div>
      )}
      {taxEnabled && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '13px', color: '#4e6087', textTransform: 'uppercase', letterSpacing: '1px' }}>{taxPlans.length} {taxPlans.length === 1 ? 'Tax Plan' : 'Tax Plans'}</div>
            {!readOnly && <button onClick={startPlan} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', boxShadow: '0 2px 8px rgba(18,94,204,0.28)', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>+ Start Tax Plan</button>}
          </div>
          {taxPlans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>No tax plans started yet.</div>
          )}
          {taxPlans.map(plan => {
            const state = getPlanState(plan)
            const stateColor = stateColors[state]
            return (
              <div key={plan.id} onClick={() => setSelectedPlan(plan)}
                style={{ ...sectionStyle, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f2f5fa'}
                onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#16264a', marginBottom: '4px' }}>Tax Plan</div>
                  <div style={{ fontSize: '12px', color: '#4e6087' }}>{plan.created_at?.split('T')[0]}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: plan.status === 'stopped' ? 'rgba(231,76,60,0.15)' : 'rgba(27,146,84,0.15)', color: plan.status === 'stopped' ? '#e74c3c' : '#1b9254', border: `1px solid ${plan.status === 'stopped' ? 'rgba(231,76,60,0.3)' : 'rgba(27,146,84,0.3)'}` }}>{plan.status === 'stopped' ? 'Stopped' : 'Live'}</span>
                  {plan.status !== 'stopped' && <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: `${stateColor}22`, color: stateColor, border: `1px solid ${stateColor}44`, textTransform: 'capitalize' }}>{state}</span>}
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

export default TaxPrioritiesTab