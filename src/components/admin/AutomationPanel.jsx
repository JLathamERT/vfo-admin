import { Fragment, useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
 
const STAGE_LABELS = {
  c81: 'PIP 1 — Reconfirmation Email',
  c13: 'PIP Follow Up — Decision',
  c14: 'PC Admin — Follow-up Email',
  c15: 'PC Admin — Final Decision',
  c16: 'PC Admin — Agreement Sent',
  c17: 'PC Admin — Client Signed',
  c18: 'PC Admin — CEO Signed',
  payment: 'Payment',
  confirmation: 'Confirmation',
  invoice: 'Invoice',
  receipts: 'Receipts',
  revshare: 'Rev Share',
  complete: 'Complete',
  closed: 'Closed'
}
 
const STAGE_COLORS = {
  c81: '#3b82f6', c13: '#8b5cf6', c14: '#f59e0b', c15: '#f59e0b',
  c16: '#6366f1', c17: '#6366f1', c18: '#6366f1',
  payment: '#ec4899', confirmation: '#14b8a6', invoice: '#14b8a6',
  receipts: '#14b8a6', revshare: '#22c55e', complete: '#22c55e', closed: '#ef4444'
}
 
const DECISION_COLORS = { Yes: '#27ae60', No: '#e74c3c', Undecided: '#f59e0b', ExtraMeeting: '#5b9fe6' }
 
function getCurrentStage(row) {
  if (row.c24_email_sent) return 'complete'
  if (row.c13_decision === 'No' && row.c14_email_sent === 'Yes') return 'closed'
  if (row.rec1_status || row.rec1_number) return 'receipts'
  if (row.invoice_number) return 'invoice'
  if (row.confirmation_status) return 'confirmation'
  if (row.pay1_status) return 'payment'
  if (row.c18_ceo_signed) return 'c18'
  if (row.c17_client_signed) return 'c17'
  if (row.c16_sent && row.c16_sent !== 'No') return 'c16'
  if (row.c15_final_decision) return 'c15'
  if (row.c14_email_sent && row.c14_email_sent !== 'No') return 'c14'
  if (row.c13_decision) return 'c13'
  if (row.c81_decision) return 'c81'
  return 'c81'
}
 
function tryParseJSON(str) {
  if (!str) return null
  try { return JSON.parse(str) } catch { return str }
}
 
const F = ({ l, v, hide }) => {
  if (hide) return null
  return (
    <div style={{ display: 'flex', padding: '2px 0' }}>
      <span style={{ fontSize: '12px', color: '#5a8ab5', width: '160px', flexShrink: 0 }}>{l}</span>
      <span style={{ fontSize: '12px', color: v ? '#d1dce8' : '#3d5a7a' }}>{v || '—'}</span>
    </div>
  )
}
 
function Badge({ text, color }) {
  if (!text) return null
  const c = color || DECISION_COLORS[text] || '#8bacc8'
  return (
    <span style={{
      fontSize: '11px', padding: '2px 10px', borderRadius: '4px', fontWeight: '600',
      background: `${c}15`, color: c, border: `1px solid ${c}30`
    }}>{text}</span>
  )
}
 
function PaymentButtons({ row, onRefresh }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  async function clickPaidByCheck() {
    if (!window.confirm('Mark this client as paying by check?\n\nThis sets pay1_status to "check_pending" and blocks the Stripe /pay link. The customer can no longer pay online unless this is undone manually in SQL.')) return
    setBusy('paidbycheck'); setErr('')
    try {
      await callApi('automation_CONTRACT_paidbycheck', { client_id: row.client_id })
      await onRefresh()
    } catch (e) { setErr(e.message || String(e)) }
    finally { setBusy(null) }
  }

  async function clickCheckCleared(n) {
    const note = n === 1
      ? 'This sets pay1_status to "succeeded" and fires the confirmation email, invoice/receipt PDFs, and revshare chain.'
      : `This sets pay${n}_status to "succeeded" and fires the invoice/receipt PDFs and revshare chain for P${n}.`
    if (!window.confirm(`Mark P${n} check as cleared?\n\n${note}\n\nOnly click this AFTER your bank has actually cleared the check.`)) return
    setBusy(`cleared-${n}`); setErr('')
    try {
      await callApi('automation_CONTRACT_checkcleared', { client_id: row.client_id, payment_number: n })
      await onRefresh()
    } catch (e) { setErr(e.message || String(e)) }
    finally { setBusy(null) }
  }

  const btnStyle = {
    padding: '4px 10px', fontSize: '11px', fontWeight: '600',
    background: 'rgba(34,197,94,0.15)', color: '#22c55e',
    border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px',
    cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnDisabledStyle = { ...btnStyle, opacity: 0.5, cursor: 'not-allowed' }

  const buttons = []

  if (row.checkout_token && !row.pay1_status) {
    buttons.push(
      <button key="paidbycheck" onClick={clickPaidByCheck} disabled={!!busy} style={busy ? btnDisabledStyle : btnStyle}>
        {busy === 'paidbycheck' ? 'Working...' : 'Paid via check'}
      </button>
    )
  }

  if (row.payment_method_type === 'check') {
    for (const n of [1, 2, 3, 4]) {
      const status = row[`pay${n}_status`]
      const date = row[`pay${n}_date`]
      if (!date) continue
      if (status === 'succeeded') continue
      buttons.push(
        <button key={`cleared-${n}`} onClick={() => clickCheckCleared(n)} disabled={!!busy} style={busy ? btnDisabledStyle : btnStyle}>
          {busy === `cleared-${n}` ? 'Working...' : `Check cleared P${n}`}
        </button>
      )
    }
  }

  if (buttons.length === 0 && !err) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
      {buttons}
      {err && <span style={{ fontSize: '11px', color: '#ff6b6b', width: '100%', marginTop: '4px' }}>{err}</span>}
    </div>
  )
}

function Step({ title, done, children }) {
  return (
    <div style={{ display: 'flex', gap: '14px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '14px', paddingTop: '3px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#27ae60' : 'transparent', border: `2px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.12)'}`, flexShrink: 0 }} />
        <div style={{ flex: 1, width: '1px', background: 'rgba(255,255,255,0.06)', marginTop: '4px' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: done ? '#fff' : '#5a8ab5', letterSpacing: '0.4px', marginBottom: '4px', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ paddingLeft: '2px' }}>{children}</div>
      </div>
    </div>
  )
}
 
function ExpandedRow({ row, onRefresh }) {
  const currentPriorities = tryParseJSON(row.current_priorities)
  const parkedPriorities = tryParseJSON(row.parked_priorities)
  const undecidedReasons = tryParseJSON(row.undecided_reason)
  const extraCc = tryParseJSON(row.extra_cc)
 
  return (
    <div style={{ padding: '4px 24px 16px 48px', background: 'rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
 
      {/* PIP 1 */}
      <Step title="PIP 1 — Reconfirmation Email" done={!!row.c81_decision}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Badge text={row.c81_decision} />
          {row.c81_email_sent && <Badge text={row.c81_email_sent === 'Skipped' ? 'Email Skipped' : 'Email Sent'} color={row.c81_email_sent === 'Skipped' ? '#f59e0b' : '#27ae60'} />}
        </div>
        <F l="Follow-up meeting" v={row.followup_meeting_date} />
      </Step>
 
      {/* PIP Follow Up */}
      <Step title="PIP Follow Up — Decision" done={!!row.c13_decision}>
        {row.c13_decision ? (
          <>
            <div style={{ marginBottom: '6px' }}><Badge text={row.c13_decision} /></div>
            {row.c13_decision === 'Yes' && (
              <>
                <F l="Service level" v={row.service_level} />
                <F l="Gross fee" v={row.gross_fee ? `$${row.gross_fee}` : null} />
                <F l="Member contribution" v={row.member_contribution ? `$${row.member_contribution}` : null} />
                <F l="Net invoice" v={row.net_invoice ? `$${row.net_invoice}` : null} />
                <F l="Member share" v={row.member_share ? `$${row.member_share}` : null} />
                <F l="VFOs share" v={row.vfos_share ? `$${row.vfos_share}` : null} />
                <F l="Payment plan" v={row.payment_plan} />
              </>
            )}
            {row.c13_decision === 'Undecided' && (
              <>
                {Array.isArray(undecidedReasons) && undecidedReasons.length > 0 && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Reasons: </span>
                    <span style={{ fontSize: '12px', color: '#d1dce8' }}>{undecidedReasons.join('; ')}</span>
                  </div>
                )}
                <F l="Lite" v={row.lite_membership ? `$${row.lite_membership}` : null} />
                <F l="Core" v={row.core_membership ? `$${row.core_membership}` : null} />
                <F l="Max" v={row.max_membership} />
              </>
            )}
            {Array.isArray(currentPriorities) && currentPriorities.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Current priorities: </span>
                <span style={{ fontSize: '12px', color: '#d1dce8' }}>{currentPriorities.join(', ')}</span>
              </div>
            )}
            {Array.isArray(parkedPriorities) && parkedPriorities.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Parked: </span>
                <span style={{ fontSize: '12px', color: '#d1dce8' }}>{parkedPriorities.join(', ')}</span>
              </div>
            )}
            {Array.isArray(extraCc) && extraCc.length > 0 && <F l="Extra CC" v={extraCc.join(', ')} />}
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      {/* Follow-up Email */}
      <Step title="PC Admin — Follow-up Email" done={row.c14_email_sent === 'Yes'}>
        {row.c14_email_sent === 'Yes' ? (
          <>
            <Badge text="Email Sent" color="#27ae60" />
            {row.c14_followup1_sent && <F l="Followup 1" v="Sent" />}
            {row.c14_followup2_sent && <F l="Followup 2" v="Sent" />}
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      {/* Final Decision */}
      <Step title="PC Admin — Final Decision" done={!!row.c15_final_decision}>
        {row.c15_final_decision ? (
          <>
            {row.c15_via_extra_meeting && (
              <div style={{ fontSize: '11px', color: '#5b9fe6', marginBottom: '6px' }}>Via extra meeting</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Badge text={row.c15_final_decision} />
              {row.c15_service_level && <span style={{ fontSize: '12px', color: '#d1dce8' }}>{row.c15_service_level}</span>}
            </div>
            {row.c15_final_decision === 'Yes' && (
              <>
                <F l="Gross fee" v={`$${row.gross_fee}`} />
                <F l="Member contribution" v={row.member_contribution ? `$${row.member_contribution}` : null} />
                <F l="Net invoice" v={row.net_invoice ? `$${row.net_invoice}` : null} />
                <F l="Member share" v={row.member_share ? `$${row.member_share}` : null} />
                <F l="VFOs share" v={row.vfos_share ? `$${row.vfos_share}` : null} />
                <F l="Payment plan" v={row.payment_plan} />
              </>
            )}
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      {/* Contract */}
      <Step title="Contract" done={row.c18_ceo_signed === 'Yes'}>
        {row.c16_sent && row.c16_sent !== 'No' ? (
          <>
            <F l="Agreement sent" v={row.c16_sent} />
            <F l="Client signed" v={row.c17_client_signed} />
            <F l="CEO signed" v={row.c18_ceo_signed} />
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      {/* Payment */}
      <Step title="Payment" done={!!row.pay1_status}>
        {row.pay1_status ? (
          <>
            <F l="Method" v={row.payment_method_type} />
            <F l="Account" v={row.acct_last4 ? `****${row.acct_last4}` : null} />
            <F l="Pay 1" v={row.pay1_status ? `${row.pay1_status}${row.pay1_date ? ' — ' + row.pay1_date : ''}` : null} />
            {row.pay2_status && <F l="Pay 2" v={`${row.pay2_status}${row.pay2_date ? ' — ' + row.pay2_date : ''}`} />}
            {row.pay3_status && <F l="Pay 3" v={`${row.pay3_status}${row.pay3_date ? ' — ' + row.pay3_date : ''}`} />}
            {row.pay4_status && <F l="Pay 4" v={`${row.pay4_status}${row.pay4_date ? ' — ' + row.pay4_date : ''}`} />}
            <PaymentButtons row={row} onRefresh={onRefresh} />
          </>
        ) : (
          <>
            <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            <PaymentButtons row={row} onRefresh={onRefresh} />
          </>
        )}
      </Step>
 
      {/* Invoice & Receipts */}
      <Step title="Invoice & Receipts" done={!!row.invoice_number}>
        {row.invoice_number ? (
          <>
            <F l="Invoice #" v={row.invoice_number} />
            <F l="Invoice emailed" v={row.invoice_email_sent ? 'Yes' : null} />
            {[1,2,3,4].map(n => {
              const num = row[`rec${n}_number`]
              if (!num) return null
              return <F key={n} l={`Receipt ${n}`} v={`${num} — ${row[`rec${n}_status`] || 'pending'}`} />
            })}
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      {/* Rev Share */}
      <Step title="Revenue Share" done={row.c24_email_sent}>
        {row.rec1_rev_share ? (
          <>
            {[1,2,3,4].map(n => {
              const share = row[`rec${n}_rev_share`]
              if (!share) return null
              return <F key={n} l={`Rev share ${n}`} v={`$${share} — ${row[`rec${n}_rev_paid`] || 'unpaid'}`} />
            })}
            <F l="Member contrib" v={row.member_contrib_status} />
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
        )}
      </Step>
 
      <div style={{ marginTop: '6px', fontSize: '10px', color: '#4a7a9e' }}>
        Created {row.created_at?.split('T')[0]} · Updated {row.updated_at?.split('T')[0]}
      </div>
    </div>
  )
}
 
function SandboxBadge({ config, onClick }) {
  const sandbox = !!config?.sandbox_mode
  const palette = sandbox
    ? { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b', label: 'SANDBOX MODE' }
    : { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#ef4444', label: 'LIVE MODE' }
  return (
    <button
      onClick={onClick}
      title="Click to toggle"
      style={{
        padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
        background: palette.bg, color: palette.text,
        border: `1px solid ${palette.border}`, letterSpacing: '0.5px',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {palette.label}
    </button>
  )
}

function SandboxToggleModal({ currentlySandbox, onConfirm, onCancel, saving }) {
  const switchingTo = currentlySandbox ? 'LIVE' : 'SANDBOX'
  const isGoingLive = switchingTo === 'LIVE'
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      fontFamily: '"DM Sans", sans-serif',
    }}>
      <div style={{
        background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', padding: '32px', maxWidth: '440px', width: '90%',
      }}>
        <h2 style={{ fontSize: '18px', color: '#fff', margin: '0 0 12px' }}>
          Switch to {switchingTo} mode?
        </h2>
        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
          {isGoingLive
            ? 'This will switch the MAP1 automation pipeline to use LIVE Stripe + BoldSign keys. Real emails will be sent to real clients/members/PFs and real cards will be charged. Are you sure?'
            : 'This will switch back to sandbox mode. All emails route to the sandbox address and Stripe/BoldSign use test keys.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: '10px 20px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
              color: '#94a3b8', fontSize: '14px', cursor: saving ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            style={{
              padding: '10px 20px', borderRadius: '8px',
              border: 'none', background: isGoingLive ? '#ef4444' : '#f59e0b',
              color: '#fff', fontSize: '14px', fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
              fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : `Switch to ${switchingTo}`}
          </button>
        </div>
      </div>
    </div>
  )
}
 
export default function AutomationPanel({ section }) {
  const [pipelines, setPipelines] = useState([])
  const [selectedPipeline, setSelectedPipeline] = useState(null)
  const [pipelineData, setPipelineData] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)
  const [showModeModal, setShowModeModal] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
 
  useEffect(() => { loadPipelines() }, [])
  useEffect(() => { if (selectedPipeline) loadPipelineData(selectedPipeline) }, [selectedPipeline])
 
  async function loadPipelines() {
    try {
      const data = await callApi('automation_load_pipelines')
      setPipelines(data.pipelines || [])
      if (data.pipelines?.length > 0) setSelectedPipeline(data.pipelines[0])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
 
  async function loadPipelineData(pipeline) {
    try {
      const data = await callApi('automation_load_pipeline_data', { table_name: pipeline.table_name })
      setPipelineData(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) { setError(err.message) }
  }

  async function toggleSandboxMode() {
    if (!sandboxConfig) return
    const next = !sandboxConfig.sandbox_mode
    setSavingMode(true)
    try {
      await callApi('save_sandbox_config', {
        sandbox_mode: next,
        stripe_test_mode: next,
        boldsign_test_mode: next,
      })
      setSandboxConfig({ ...sandboxConfig, sandbox_mode: next, stripe_test_mode: next, boldsign_test_mode: next })
      setShowModeModal(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingMode(false)
    }
  }
 
  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>
 
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', margin: 0 }}>Automation Pipeline</h2>
          <SandboxBadge config={sandboxConfig} onClick={() => setShowModeModal(true)} />
        </div>
        {pipelines.length > 1 && (
          <select value={selectedPipeline?.id || ''} onChange={e => { const p = pipelines.find(p => p.id === parseInt(e.target.value)); if (p) setSelectedPipeline(p) }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '14px', fontFamily: 'DM Sans, sans-serif' }}>
            {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
 
      {error && <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
 
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL', value: pipelineData.length, color: '#fff' },
          { label: 'ACTIVE', value: pipelineData.filter(r => { const s = getCurrentStage(r); return s !== 'complete' && s !== 'closed' }).length, color: '#3b82f6' },
          { label: 'COMPLETE', value: pipelineData.filter(r => getCurrentStage(r) === 'complete').length, color: '#22c55e' },
          { label: 'CLOSED', value: pipelineData.filter(r => getCurrentStage(r) === 'closed').length, color: '#ef4444' },
          { label: 'SANDBOX', value: pipelineData.filter(r => r.sandbox).length, color: '#f59e0b' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 20px', minWidth: '100px' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#8bacc8', letterSpacing: '1px' }}>{stat.label}</div>
          </div>
        ))}
      </div>
 
      {pipelineData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#8bacc8', fontSize: '15px', marginBottom: '8px' }}>No clients in pipeline yet</p>
          <p style={{ color: '#5a8ab5', fontSize: '13px' }}>Clients will appear here as they enter the automation flow</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['', 'Client', 'Member', 'PF', 'Stage', 'Decision', 'Service', 'Payment', 'Updated'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', color: '#5a8ab5', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: '600', width: h === '' ? '30px' : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pipelineData.map(row => {
                const stage = getCurrentStage(row)
                const stageColor = STAGE_COLORS[stage] || '#8bacc8'
                const isExpanded = expandedRow === row.id
                return (
                  <Fragment key={row.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '12px 8px', fontSize: '10px', color: '#8bacc8' }}>
                        <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#fff' }}>
                        <div>{row.client_name || row.client_ref || '—'}</div>
                        {row.client_ref && row.client_name && <div style={{ fontSize: '11px', color: '#5a8ab5' }}>{row.client_ref}</div>}
                        {row.sandbox && <span style={{ fontSize: '10px', color: '#f59e0b', fontStyle: 'italic' }}>sandbox</span>}
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>{row.member_name || '—'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>{row.pf || '—'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}33` }}>
                          {STAGE_LABELS[stage] || stage}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>{row.c15_final_decision || row.c13_decision || '—'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>{row.service_level || row.c15_service_level || '—'}</td>
                      <td style={{ padding: '12px', fontSize: '13px', color: '#8bacc8' }}>{row.pay1_status || '—'}</td>
                      <td style={{ padding: '12px', fontSize: '12px', color: '#5a8ab5' }}>{row.updated_at ? row.updated_at.split('T')[0] : '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}><ExpandedRow row={row} onRefresh={() => loadPipelineData(selectedPipeline)} /></td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModeModal && (
        <SandboxToggleModal
          currentlySandbox={!!sandboxConfig?.sandbox_mode}
          onConfirm={toggleSandboxMode}
          onCancel={() => setShowModeModal(false)}
          saving={savingMode}
        />
      )}
    </div>
  )
}