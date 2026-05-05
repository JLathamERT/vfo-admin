import { useState } from 'react'
import { callApi } from "../../../lib/api";

function PFPricingForm({ clientId, serviceLevel, pipelineId, onComplete }) {
  const [grossFee, setGrossFee] = useState('')
  const [memberContribution, setMemberContribution] = useState('')
  const netInvoice = ((parseFloat(grossFee) || 0) - (parseFloat(memberContribution) || 0)).toFixed(2)
  const [memberShare, setMemberShare] = useState('')
  const [vfosShare, setVfosShare] = useState('')
  const [paymentPlan, setPaymentPlan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!grossFee || !paymentPlan) return
    setSubmitting(true)
    try {
      await callApi('automation_PCADMIN_pricing', {
        pipeline_id: pipelineId,
        client_id: clientId,
        service_level: serviceLevel,
        gross_fee: grossFee,
        member_contribution: memberContribution,
        net_invoice: netInvoice,
        member_share: memberShare,
        vfos_share: vfosShare,
        payment_plan: paymentPlan,
      })
      if (onComplete) onComplete()
    } catch (err) { console.error('Pricing save error:', err) }
    finally { setSubmitting(false) }
  }

  const inputStyle = { padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', width: '100%' }
  const labelStyle = { fontSize: '11px', color: '#5a8ab5', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(91,159,230,0.2)', marginTop: '8px', marginBottom: '8px' }}>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#5b9fe6', marginBottom: '12px' }}>Complete Pricing — {serviceLevel} Membership</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>Gross Service Value ($)</label>
          <input value={grossFee} onChange={e => setGrossFee(e.target.value)} style={inputStyle} placeholder="e.g. 5400" />
        </div>
        <div>
          <label style={labelStyle}>Member Contribution ($)</label>
          <input value={memberContribution} onChange={e => setMemberContribution(e.target.value)} style={inputStyle} placeholder="e.g. 0" />
        </div>
        <div>
          <label style={labelStyle}>Net Invoice Value ($)</label>
          <input value={netInvoice} readOnly style={{ ...inputStyle, opacity: 0.6 }} />
        </div>
        <div>
          <label style={labelStyle}>Payment Plan</label>
          <select value={paymentPlan} onChange={e => setPaymentPlan(e.target.value)} style={{ ...inputStyle, background: '#0d2a6e' }}>
            <option value="">-- Select --</option>
            <option value="1 Time Payment">1 Time Payment</option>
            <option value="Quarterly">Quarterly</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Member Share ($)</label>
          <input value={memberShare} onChange={e => setMemberShare(e.target.value)} style={inputStyle} placeholder="e.g. 1200" />
        </div>
        <div>
          <label style={labelStyle}>VFOs Share ($)</label>
          <input value={vfosShare} onChange={e => setVfosShare(e.target.value)} style={inputStyle} placeholder="e.g. 4200" />
        </div>
      </div>
      <button onClick={handleSubmit} disabled={submitting || !grossFee || !paymentPlan}
        style={{ marginTop: '12px', padding: '8px 24px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', border: '1px solid rgba(39,174,96,0.4)', background: 'rgba(39,174,96,0.12)', color: '#27ae60', fontFamily: 'DM Sans, sans-serif' }}>
        {submitting ? 'Saving...' : 'Submit Pricing'}
      </button>
    </div>
  )
}

export default PFPricingForm