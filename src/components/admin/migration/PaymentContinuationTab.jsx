import { useState, useEffect } from 'react'
import { callApi } from '../../../lib/api'

// Jake-only per-client migration tool: backfill an in-flight MAP 1 / Tax plan from the
// old system so the native engine resumes charging the rest. Two Stripe modes:
//   existing    — client already on Stripe; look up + reference their saved card.
//   setup_link  — client not on Stripe (QBO); save dormant + email a /connect-card link.
// Nothing is charged here. Preview shows the exact row before any write.

const PLAN_OPTIONS = [
  { key: 'map1', label: 'MAP 1 (Holistic — quarterly)', action: 'migration_backfill_map1', sbPipeline: 'MAP 1', pipeline: 'MAP 1' },
  { key: 'tax1', label: 'Tax Priorities (Holistic)', action: 'migration_backfill_tax', program_id: 1, sbPipeline: 'TAX', pipeline: 'TAX' },
  { key: 'tax4', label: 'Tax Planning', action: 'migration_backfill_tax', program_id: 4, sbPipeline: 'TAX', pipeline: 'TAX' },
]

const sectionStyle = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }
const sectionTitle = { fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px', fontWeight: 700 }
const labelStyle = { fontSize: '12px', color: 'var(--vfo-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }
const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }
const readonlyInput = { ...inputStyle, background: 'var(--vfo-tint)', opacity: 0.85, cursor: 'not-allowed' }
const primaryBtn = (disabled) => ({ padding: '10px 24px', borderRadius: '8px', background: disabled ? '#93b4e8' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', border: 'none', color: '#fff', fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600 })
const ghostBtn = { padding: '10px 22px', borderRadius: '8px', border: '1px solid var(--vfo-border-mid)', background: 'transparent', color: 'var(--vfo-muted)', fontSize: '14px', cursor: 'pointer', fontWeight: 600 }

function Field({ label, children }) {
  return <div style={{ flex: 1, minWidth: '150px' }}><label style={labelStyle}>{label}</label>{children}</div>
}

function ModeChip({ active, onClick, title, sub }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: '220px', textAlign: 'left', padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', border: `1.5px solid ${active ? '#125ecc' : 'var(--vfo-border-strong)'}`, background: active ? 'rgba(18,94,204,0.06)' : '#fff' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: active ? '#125ecc' : 'var(--vfo-ink)' }}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '3px' }}>{sub}</div>
    </button>
  )
}

export default function PaymentContinuationTab({ clientId, client }) {
  const [planKey, setPlanKey] = useState('map1')
  const plan = PLAN_OPTIONS.find(p => p.key === planKey)
  const isMap1 = planKey === 'map1'
  const [stripeMode, setStripeMode] = useState('existing')

  // pricing
  const [netInvoice, setNetInvoice] = useState('')
  const [memberShare, setMemberShare] = useState('')
  const [vfosShare, setVfosShare] = useState('')
  const [serviceLevel, setServiceLevel] = useState('')
  const [retainerAmount, setRetainerAmount] = useState('')
  const [implementationAmount, setImplementationAmount] = useState('')
  const [splitType, setSplitType] = useState('')
  const [atpName, setAtpName] = useState('')

  // MAP 1 history
  const [numPaid, setNumPaid] = useState(1)
  const [rows, setRows] = useState([0, 1, 2, 3].map(() => ({ date: '', receipt_number: '' })))
  const [invoiceNumber, setInvoiceNumber] = useState('')
  // Tax retainer
  const [retDate, setRetDate] = useState('')
  const [retReceipt, setRetReceipt] = useState('')
  const [retInvoice, setRetInvoice] = useState('')

  // Stripe (existing mode)
  const [custId, setCustId] = useState('')
  const [lookup, setLookup] = useState(null)
  const [lookupErr, setLookupErr] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [chosenPm, setChosenPm] = useState(null)

  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  function setRow(i, patch) { setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function resetOutputs() { setPreview(null); setResult(null); setErr('') }

  async function doLookup() {
    setLookingUp(true); setLookupErr(''); setLookup(null); setChosenPm(null)
    try {
      const d = await callApi('migration_stripe_lookup', { stripe_customer_id: custId.trim(), pipeline: plan.sbPipeline })
      if (d.error) { setLookupErr(d.error); return }
      setLookup(d)
      setChosenPm(d.default_payment_method || (d.payment_methods?.length === 1 ? d.payment_methods[0] : null))
    } catch { setLookupErr('Lookup failed.') }
    finally { setLookingUp(false) }
  }

  function pmLabel(pm) {
    if (!pm) return ''
    if (pm.kind === 'card') return `${(pm.brand || 'Card')} ending ${pm.last4}${pm.exp_month ? ` (exp ${pm.exp_month}/${String(pm.exp_year).slice(-2)})` : ''}`
    if (pm.kind === 'ach') return `${pm.bank || 'Bank'} ending ${pm.last4}`
    return pm.id
  }

  function buildPayload(isPreview) {
    const stripe = stripeMode === 'existing'
      ? { stripe_customer_id: custId.trim(), default_payment_method_id: chosenPm?.id || '', payment_method_type: chosenPm?.kind || '', acct_last4: chosenPm?.last4 || '' }
      : {}
    const base = { client_id: clientId, preview: isPreview, stripe_mode: stripeMode, stripe }
    if (isMap1) {
      const payments = rows.map((r, i) => i < numPaid
        ? { paid: true, date: r.date, receipt_number: r.receipt_number }
        : { paid: false, date: r.date })
      return { ...base, pricing: { net_invoice: netInvoice, member_share: memberShare, vfos_share: vfosShare, service_level: serviceLevel, payment_plan: 'Quarterly' }, invoice_number: invoiceNumber, payments }
    }
    return { ...base, program_id: plan.program_id, pricing: { retainer_amount: retainerAmount, implementation_amount: implementationAmount, total_fee: taxTotal ? taxTotal.toFixed(2) : '', member_share: memberShare, vfos_share: vfosShare, split_type: splitType, atp_name: atpName }, retainer: { date: retDate, receipt_number: retReceipt, invoice_number: retInvoice } }
  }

  async function run(isPreview) {
    setBusy(true); setErr(''); setResult(null); setPreview(null)
    try {
      const d = await callApi(plan.action, buildPayload(isPreview))
      if (d.error) { setErr(d.error + (d.errors ? ' — ' + d.errors.join(' ') : '')); return }
      if (isPreview) { setPreview(d); return }
      let linkResult = null
      if (stripeMode === 'setup_link') {
        const rowId = d.pipeline_id || d.tax_plan_id
        linkResult = await callApi('migration_send_setup_link', { pipeline: plan.pipeline, row_id: rowId })
      }
      setResult({ ...d, linkResult })
    } catch { setErr(isPreview ? 'Preview failed.' : 'Save failed.') }
    finally { setBusy(false) }
  }

  const money = (v) => parseFloat(String(v ?? '').replace(/[,$]/g, '')) || 0
  const taxTotal = money(retainerAmount) + money(implementationAmount)
  const totalAmount = isMap1 ? money(netInvoice) : taxTotal
  const sharesFilled = String(memberShare).trim() !== '' && String(vfosShare).trim() !== ''
  const sharesSum = money(memberShare) + money(vfosShare)
  const sumOk = sharesFilled && totalAmount > 0 && Math.abs(sharesSum - totalAmount) < 0.01
  const saveDisabled = busy || !sumOk || (stripeMode === 'existing' && !chosenPm)
  function onMemberShare(val) { setMemberShare(val); if (!isMap1 && splitType === 'Custom') setVfosShare(Math.max(0, taxTotal - (parseFloat(val) || 0)).toFixed(2)) }
  function onVfosShare(val) { setVfosShare(val); if (!isMap1 && splitType === 'Custom') setMemberShare(Math.max(0, taxTotal - (parseFloat(val) || 0)).toFixed(2)) }
  useEffect(() => {
    if (isMap1) return
    if (splitType === '1/3 Member, 2/3 VFOS') { const ms = (taxTotal / 3).toFixed(2); setMemberShare(ms); setVfosShare((taxTotal - parseFloat(ms)).toFixed(2)) }
    else if (splitType === '50/50') { const half = (taxTotal / 2).toFixed(2); setMemberShare(half); setVfosShare(half) }
  }, [splitType, taxTotal, isMap1])

  return (
    <div>
      {/* Plan + mode */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>What are we continuing?</div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <Field label="Plan">
            <select value={planKey} onChange={e => { setPlanKey(e.target.value); resetOutputs() }} style={inputStyle}>
              {PLAN_OPTIONS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <ModeChip active={stripeMode === 'existing'} onClick={() => { setStripeMode('existing'); resetOutputs() }} title="Client is on Stripe" sub="Enter their cus_ id — we reference the saved card." />
          <ModeChip active={stripeMode === 'setup_link'} onClick={() => { setStripeMode('setup_link'); resetOutputs() }} title="Not on Stripe — send setup link" sub="QBO etc. Save + email a link to add a card." />
        </div>
      </div>

      {/* Pricing */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Pricing</div>
        {isMap1 ? (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Field label="Net invoice — total ($)"><input value={netInvoice} onChange={e => setNetInvoice(e.target.value)} style={inputStyle} placeholder="e.g. 12000" /></Field>
            <Field label="Member share ($)"><input value={memberShare} onChange={e => setMemberShare(e.target.value)} style={inputStyle} placeholder="e.g. 6000" /></Field>
            <Field label="Our (VFO) share ($)"><input value={vfosShare} onChange={e => setVfosShare(e.target.value)} style={inputStyle} placeholder="e.g. 6000" /></Field>
            <Field label="Service level">
              <select value={serviceLevel} onChange={e => setServiceLevel(e.target.value)} style={inputStyle}>
                <option value="">-- Select --</option>
                <option value="Lite">Lite</option>
                <option value="Core">Core</option>
                <option value="Max">Max</option>
              </select>
            </Field>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Field label="Total fee ($)"><input value={taxTotal ? taxTotal.toFixed(2) : ''} readOnly style={readonlyInput} placeholder="retainer + implementation" /></Field>
              <Field label="Split type">
                <select value={splitType} onChange={e => setSplitType(e.target.value)} style={inputStyle}>
                  <option value="">-- Select --</option>
                  <option value="1/3 Member, 2/3 VFOS">1/3 Member, 2/3 VFOS</option>
                  <option value="50/50">50/50</option>
                  <option value="Custom">Custom</option>
                </select>
              </Field>
              <Field label="Member share ($)"><input value={memberShare} onChange={e => onMemberShare(e.target.value)} readOnly={splitType !== 'Custom'} style={splitType === 'Custom' ? inputStyle : readonlyInput} placeholder={splitType === 'Custom' ? 'e.g. 5000' : 'auto'} /></Field>
              <Field label="Our (VFO) share ($)"><input value={vfosShare} onChange={e => onVfosShare(e.target.value)} readOnly={splitType !== 'Custom'} style={splitType === 'Custom' ? inputStyle : readonlyInput} placeholder={splitType === 'Custom' ? 'e.g. 5000' : 'auto'} /></Field>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <Field label="Retainer amount ($)"><input value={retainerAmount} onChange={e => setRetainerAmount(e.target.value)} style={inputStyle} placeholder="e.g. 5000" /></Field>
              <Field label="Implementation amount ($)"><input value={implementationAmount} onChange={e => setImplementationAmount(e.target.value)} style={inputStyle} placeholder="e.g. 5000" /></Field>
            </div>
          </>
        )}
        {sharesFilled && totalAmount > 0 && (
          <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 600, color: sumOk ? '#1b9254' : '#e74c3c' }}>
            {sumOk
              ? `Shares add up to the ${isMap1 ? 'net invoice' : 'total fee'} ($${sharesSum.toLocaleString()}).`
              : `Member + VFO share ($${sharesSum.toLocaleString()}) must equal the ${isMap1 ? 'net invoice' : 'total fee'} ($${totalAmount.toLocaleString()}).`}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Payments so far</div>
        {isMap1 ? (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '6px' }}>
              <Field label="How many of the 4 quarterly payments are already made?">
                <select value={numPaid} onChange={e => setNumPaid(parseInt(e.target.value))} style={inputStyle}>
                  <option value={1}>1 of 4</option>
                  <option value={2}>2 of 4</option>
                  <option value={3}>3 of 4</option>
                </select>
              </Field>
              <Field label="Invoice number (issued at payment 1)"><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} style={inputStyle} /></Field>
            </div>
            {rows.map((r, i) => {
              const paid = i < numPaid
              return (
                <div key={i} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', borderRadius: '10px', marginTop: '10px', background: paid ? 'rgba(27,146,84,0.06)' : 'var(--vfo-input)', border: `1px solid ${paid ? 'rgba(27,146,84,0.2)' : 'var(--vfo-border-soft)'}` }}>
                  <div style={{ width: '92px', fontSize: '13px', fontWeight: 700, color: paid ? '#1b9254' : 'var(--vfo-muted)' }}>Payment {i + 1}<div style={{ fontSize: '11px', fontWeight: 500 }}>{paid ? 'Paid' : 'Scheduled'}</div></div>
                  <Field label={paid ? 'Date paid' : 'Scheduled date'}><input type="date" value={r.date} onChange={e => setRow(i, { date: e.target.value })} style={inputStyle} /></Field>
                  {paid && <Field label="Receipt number"><input value={r.receipt_number} onChange={e => setRow(i, { receipt_number: e.target.value })} style={inputStyle} /></Field>}
                </div>
              )
            })}
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--vfo-muted)', marginTop: 0, marginBottom: '12px' }}>Record the retainer they already paid. The implementation fee is charged later via the normal Tax 5 step against the saved card.</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Field label="Retainer date paid"><input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} style={inputStyle} /></Field>
              <Field label="Retainer receipt number"><input value={retReceipt} onChange={e => setRetReceipt(e.target.value)} style={inputStyle} /></Field>
              <Field label="Retainer invoice number"><input value={retInvoice} onChange={e => setRetInvoice(e.target.value)} style={inputStyle} /></Field>
            </div>
          </>
        )}
      </div>

      {/* Stripe */}
      <div style={sectionStyle}>
        <div style={sectionTitle}>Payment method</div>
        {stripeMode === 'existing' ? (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Stripe customer ID (cus_…)"><input value={custId} onChange={e => { setCustId(e.target.value); setLookup(null); setChosenPm(null) }} style={inputStyle} placeholder="cus_…" /></Field>
              <button onClick={doLookup} disabled={lookingUp || !custId.trim().startsWith('cus_')} style={primaryBtn(lookingUp || !custId.trim().startsWith('cus_'))}>{lookingUp ? 'Looking up…' : 'Look up card'}</button>
            </div>
            {lookupErr && <p style={{ color: '#e74c3c', fontSize: '13px', marginTop: '10px' }}>{lookupErr}</p>}
            {lookup && (
              <div style={{ marginTop: '14px' }}>
                <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginBottom: '8px' }}>{lookup.mode === 'sandbox' ? 'Sandbox account' : 'Live account'} · {lookup.customer?.email || ''}</div>
                {(lookup.payment_methods || []).length === 0 ? (
                  <p style={{ color: '#e06717', fontSize: '13px' }}>No saved card/bank found on this customer{lookup.legacy_default_source ? ' (a legacy source is on file — they may need the setup-link path instead)' : ''}.</p>
                ) : (
                  (lookup.payment_methods || []).map(pm => (
                    <label key={pm.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', border: `1.5px solid ${chosenPm?.id === pm.id ? '#1b9254' : 'var(--vfo-border-strong)'}`, background: chosenPm?.id === pm.id ? 'rgba(27,146,84,0.06)' : '#fff' }}>
                      <input type="radio" checked={chosenPm?.id === pm.id} onChange={() => setChosenPm(pm)} />
                      <span style={{ fontSize: '14px', color: 'var(--vfo-ink)', fontWeight: 600 }}>{pmLabel(pm)}</span>
                      {pm.kind === 'ach' ? <span style={tag('#0095ff')}>No fee</span> : <span style={tag('#e06717')}>+ card fee</span>}
                    </label>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <p style={{ fontSize: '14px', color: 'var(--vfo-muted)', margin: 0 }}>
            On save, a Stripe customer is created and a secure setup link is emailed to <strong>{client?.email || 'the client'}</strong>. Once they add a card or bank, the engine starts charging automatically (card → fee added; bank → fee-free).
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
        <button onClick={() => run(true)} disabled={busy || !sumOk} style={ghostBtn}>{busy ? 'Working…' : 'Preview'}</button>
        <button onClick={() => run(false)} disabled={saveDisabled} style={primaryBtn(saveDisabled)}>{busy ? 'Working…' : (stripeMode === 'setup_link' ? 'Save & send setup link' : 'Save')}</button>
        {!sumOk && <span style={{ fontSize: '12px', color: 'var(--vfo-muted)' }}>Enter member + VFO share (dollars) that sum to the total.</span>}
        {sumOk && stripeMode === 'existing' && !chosenPm && <span style={{ fontSize: '12px', color: 'var(--vfo-muted)' }}>Look up + pick a card to enable Save.</span>}
      </div>

      {err && <div style={{ ...sectionStyle, border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.05)', color: '#c0392b', fontSize: '14px' }}>{err}</div>}

      {preview && (
        <div style={sectionStyle}>
          <div style={sectionTitle}>Preview — {preview.action} ({preview.mode}{preview.stripe_mode === 'setup_link' ? ', dormant until card connected' : ''})</div>
          {preview.per_installment_amount && <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '0 0 10px' }}>Per-quarter charge: <strong>${preview.per_installment_amount}</strong></p>}
          {(preview.warnings || []).map((w, i) => <p key={i} style={{ fontSize: '13px', color: '#e06717', margin: '4px 0' }}>• {w}</p>)}
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '13px', color: 'var(--vfo-muted)', fontWeight: 600 }}>Exact row to be written</summary>
            <pre style={{ background: '#0f1b33', color: '#cfe0ff', padding: '14px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto', marginTop: '8px' }}>{JSON.stringify(preview.would_write, null, 2)}</pre>
          </details>
        </div>
      )}

      {result && (
        <div style={{ ...sectionStyle, border: '1px solid rgba(27,146,84,0.4)', background: 'rgba(27,146,84,0.05)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f7a3d', marginBottom: '6px' }}>Plan {result.action} (id {result.pipeline_id || result.tax_plan_id}) · {result.mode}</div>
          {result.linkResult?.sent && <p style={{ fontSize: '14px', color: 'var(--vfo-ink)', margin: '4px 0' }}>Setup link drafted to <strong>{result.linkResult.to_email}</strong>{result.linkResult.sandbox ? ' (sandbox)' : ''}. Send it from Gmail Drafts.</p>}
          {result.linkResult && !result.linkResult.sent && <p style={{ fontSize: '14px', color: '#e74c3c', margin: '4px 0' }}>Row saved, but setup link failed: {result.linkResult.error || 'unknown'}</p>}
          {(result.warnings || []).map((w, i) => <p key={i} style={{ fontSize: '13px', color: '#e06717', margin: '4px 0' }}>• {w}</p>)}
          {stripeMode === 'existing' && <p style={{ fontSize: '13px', color: 'var(--vfo-muted)', margin: '6px 0 0' }}>The engine will charge the remaining {isMap1 ? 'installments on their dates' : 'implementation via the Tax 5 step'} against the saved card.</p>}
        </div>
      )}
    </div>
  )
}

const tag = (color) => ({ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: `${color}1a`, color, border: `1px solid ${color}44` })
