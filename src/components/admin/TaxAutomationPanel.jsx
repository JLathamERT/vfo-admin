import { Fragment, useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

const STAGE_LABELS = {
  not_started:     'Not Started',
  ready_for_tax3:  'Ready for Tax 3 sent',
  decision:        'Tax 3 — Decision',
  final_decision:  'Final Decision',
  agreement:       'Agreement Sent',
  signed:          'Both Signed',
  payment:         'Payment',
  confirmation:    'Confirmation',
  invoice:         'Invoice & Receipt',
  tax4:            'Tax 4 — Continue/Stop',
  revshare:        'Revenue Share',
  refunded:        'Refunded',
  implementation:  'Implementation Charged',
  complete:        'Complete',
  closed:          'Closed',
}

const STAGE_COLORS = {
  not_started: '#8bacc8',
  ready_for_tax3: '#3b82f6',
  decision: '#8b5cf6',
  final_decision: '#f59e0b',
  agreement: '#6366f1',
  signed: '#6366f1',
  payment: '#ec4899',
  confirmation: '#14b8a6',
  invoice: '#14b8a6',
  tax4: '#5b9fe6',
  revshare: '#22c55e',
  refunded: '#ef4444',
  implementation: '#22c55e',
  complete: '#22c55e',
  closed: '#ef4444',
}

const DECISION_COLORS = { Yes: '#27ae60', No: '#e74c3c', Undecided: '#f59e0b', ExtraMeeting: '#5b9fe6' }

function getCurrentStage(p) {
  if (p.implementation_announcement_email_sent) return 'complete'
  if (p.implementation_charge_status === 'succeeded') return 'implementation'
  if (p.refund_status === 'succeeded') return 'refunded'
  if (p.retainer_rev_paid === 'Yes') return 'revshare'
  if (p.post_review_decision) return 'tax4'
  if (p.retainer_invoice_email_sent || p.retainer_receipt_status === 'Sent') return 'invoice'
  if (p.retainer_confirmation_status === 'Sent') return 'confirmation'
  if (p.retainer_status) return 'payment'
  if (p.client_signed === 'Yes' && p.ceo_signed === 'Yes') return 'signed'
  if (p.agreement_sent === 'Yes') return 'agreement'
  if (p.tax_final_decision === 'No' || (p.tax_decision === 'No' && p.tax_decision_email_sent === 'Yes')) return 'closed'
  if (p.tax_final_decision) return 'final_decision'
  if (p.tax_decision) return 'decision'
  if (p.ready_for_tax3_decision) return 'ready_for_tax3'
  return 'not_started'
}

const F = ({ l, v, hide }) => {
  if (hide) return null
  return (
    <div style={{ display: 'flex', padding: '2px 0' }}>
      <span style={{ fontSize: 12, color: '#5a8ab5', width: 180, flexShrink: 0 }}>{l}</span>
      <span style={{ fontSize: 12, color: v ? '#d1dce8' : '#3d5a7a' }}>{v || '—'}</span>
    </div>
  )
}

function Badge({ text, color }) {
  if (!text) return null
  const c = color || DECISION_COLORS[text] || '#8bacc8'
  return (
    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 4, fontWeight: 600, background: `${c}15`, color: c, border: `1px solid ${c}30` }}>{text}</span>
  )
}

function fmtMoney(n) {
  return n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null
}

function Step({ title, done, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14, paddingTop: 3 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: done ? '#27ae60' : 'transparent', border: `2px solid ${done ? '#27ae60' : 'rgba(255,255,255,0.12)'}`, flexShrink: 0 }} />
        <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.06)', marginTop: 4 }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: done ? '#fff' : '#5a8ab5', letterSpacing: '0.4px', marginBottom: 4, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ paddingLeft: 2 }}>{children}</div>
      </div>
    </div>
  )
}

function PaymentButtons({ plan, onRefresh }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')

  async function clickPayByCheck() {
    if (!window.confirm('Mark this client as paying by check?\n\n• Sets retainer_status to "check_pending"\n• Blocks the Stripe /tax-pay link\n• Drafts a Gmail with check mailing instructions\n\nProceed?')) return
    setBusy('paidbycheck'); setErr('')
    try { await callApi('automation_TAX_paidbycheck', { tax_plan_id: plan.id }); await onRefresh() }
    catch (e) { setErr(e.message || String(e)) } finally { setBusy(null) }
  }
  async function clickCheckCleared() {
    if (!window.confirm('Mark check as cleared?\n\nSets retainer_status to "succeeded" and chains confirmation + invoice/receipt.\nOnly click AFTER your bank has cleared the check.')) return
    setBusy('cleared'); setErr('')
    try { await callApi('automation_TAX_checkcleared', { tax_plan_id: plan.id }); await onRefresh() }
    catch (e) { setErr(e.message || String(e)) } finally { setBusy(null) }
  }

  const btnStyle = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }
  const btnDisabled = { ...btnStyle, opacity: 0.5, cursor: 'not-allowed' }

  const showPayByCheck = plan.checkout_token && !plan.retainer_status
  const showCleared = plan.payment_method_type === 'check' && plan.retainer_status === 'check_pending'
  if (!showPayByCheck && !showCleared && !err) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {showPayByCheck && <button onClick={clickPayByCheck} disabled={!!busy} style={busy ? btnDisabled : btnStyle}>{busy === 'paidbycheck' ? 'Working…' : 'Pay via check'}</button>}
      {showCleared && <button onClick={clickCheckCleared} disabled={!!busy} style={busy ? btnDisabled : btnStyle}>{busy === 'cleared' ? 'Working…' : 'Mark check cleared'}</button>}
      {err && <span style={{ fontSize: 11, color: '#ff6b6b', width: '100%', marginTop: 4 }}>{err}</span>}
    </div>
  )
}

function ExpandedRow({ row, onRefresh }) {
  return (
    <div style={{ padding: '4px 24px 16px 48px', background: 'rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

      <Step title="Ready for Tax 3 — Email" done={!!row.ready_for_tax3_decision}>
        {row.ready_for_tax3_decision ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Badge text={row.ready_for_tax3_decision} />
            {row.ready_for_tax3_email_sent === 'Yes' && <Badge text="Email Sent" color="#27ae60" />}
          </div>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Tax 3 — Decision" done={!!row.tax_decision}>
        {row.tax_decision ? (
          <>
            <div style={{ marginBottom: 6 }}><Badge text={row.tax_decision} /></div>
            {row.tax_decision === 'Yes' && (
              <>
                <F l="Risk mindset" v={row.risk_mindset} />
                <F l="Retainer" v={fmtMoney(row.retainer_amount) ? `$${fmtMoney(row.retainer_amount)}` : null} />
                <F l="Implementation fee" v={fmtMoney(row.implementation_amount) ? `$${fmtMoney(row.implementation_amount)}` : null} />
                <F l="Total fee" v={fmtMoney(row.total_fee) ? `$${fmtMoney(row.total_fee)}` : null} />
                <F l="Split type" v={row.split_type} />
                <F l="Member share" v={fmtMoney(row.member_share) ? `$${fmtMoney(row.member_share)}` : null} />
                <F l="VFOS share" v={fmtMoney(row.vfos_share) ? `$${fmtMoney(row.vfos_share)}` : null} />
              </>
            )}
            {row.tax_decision === 'Undecided' && (
              <>
                <F l="Potential tax savings" v={fmtMoney(row.potential_tax_savings) ? `$${fmtMoney(row.potential_tax_savings)}` : null} />
                <F l="Initial retainer quoted" v={fmtMoney(row.initial_retainer_quoted) ? `$${fmtMoney(row.initial_retainer_quoted)}` : null} />
                <F l="Token generated" v={row.tax_token ? 'Yes' : null} />
                <F l="Email sent" v={row.tax_decision_email_sent} />
              </>
            )}
            <F l="Presentation link" v={row.presentation_link} />
            <F l="Meeting notes" v={row.meeting_notes} />
            <F l="Extra CC" v={row.extra_cc} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Client — Final Decision (Undecided path)" done={!!row.tax_final_decision}>
        {row.tax_final_decision ? (
          <>
            {row.tax_via_extra_meeting && <div style={{ fontSize: 11, color: '#5b9fe6', marginBottom: 6 }}>Via extra meeting</div>}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <Badge text={row.tax_final_decision} />
            </div>
            {(row.tax_final_decision === 'Yes' || (row.tax_final_decision === 'ExtraMeeting' && row.retainer_amount)) && (
              <>
                <F l="Risk mindset" v={row.risk_mindset} />
                <F l="Retainer" v={fmtMoney(row.retainer_amount) ? `$${fmtMoney(row.retainer_amount)}` : null} />
                <F l="Implementation fee" v={fmtMoney(row.implementation_amount) ? `$${fmtMoney(row.implementation_amount)}` : null} />
                <F l="Total fee" v={fmtMoney(row.total_fee) ? `$${fmtMoney(row.total_fee)}` : null} />
                <F l="Split type" v={row.split_type} />
                <F l="Member share" v={fmtMoney(row.member_share) ? `$${fmtMoney(row.member_share)}` : null} />
                <F l="VFOS share" v={fmtMoney(row.vfos_share) ? `$${fmtMoney(row.vfos_share)}` : null} />
              </>
            )}
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>{row.tax_decision === 'Undecided' ? 'Awaiting client decision via /tax-decide' : 'N/A (direct Yes/No path)'}</span>}
      </Step>

      <Step title="Contract" done={row.ceo_signed === 'Yes'}>
        {row.agreement_sent === 'Yes' ? (
          <>
            <F l="Agreement sent" v={row.agreement_sent} />
            <F l="BoldSign doc id" v={row.boldsign_doc_id} />
            <F l="Client signed" v={row.client_signed} />
            <F l="CEO signed" v={row.ceo_signed} />
            <F l="Sent date" v={row.signed_followup_sent_date} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Payment" done={row.retainer_status === 'succeeded'}>
        {row.checkout_token || row.retainer_status ? (
          <>
            <F l="Stripe customer" v={row.stripe_customer_id} />
            <F l="Checkout token" v={row.checkout_token ? 'Generated' : null} />
            <F l="Method" v={row.payment_method_type} />
            <F l="Account" v={row.acct_last4 ? `****${row.acct_last4}` : null} />
            <F l="Retainer status" v={row.retainer_status} />
            <F l="Retainer date" v={row.retainer_date} />
            <F l="Card processing fee" v={fmtMoney(row.card_processing_fee) ? `$${fmtMoney(row.card_processing_fee)}` : null} />
            <F l="Payment intent" v={row.retainer_payment_intent_id} />
            <PaymentButtons plan={row} onRefresh={onRefresh} />
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>
            <PaymentButtons plan={row} onRefresh={onRefresh} />
          </>
        )}
      </Step>

      <Step title="Confirmation" done={row.retainer_confirmation_status === 'Sent'}>
        <F l="Confirmation status" v={row.retainer_confirmation_status} />
      </Step>

      <Step title="Invoice & Receipt" done={!!row.retainer_invoice_email_sent}>
        {row.retainer_invoice_number ? (
          <>
            <F l="Invoice #" v={row.retainer_invoice_number} />
            <F l="Receipt #" v={row.retainer_receipt_number} />
            <F l="Invoice drive id" v={row.retainer_invoice_drive_id} />
            <F l="Receipt drive id" v={row.retainer_receipt_drive_id} />
            <F l="Email sent" v={row.retainer_invoice_email_sent ? 'Yes' : null} />
            <F l="Receipt status" v={row.retainer_receipt_status} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Tax 4 — Continue / Stop" done={!!row.post_review_decision}>
        {row.post_review_decision ? (
          <>
            <Badge text={row.post_review_decision} color={row.post_review_decision?.includes('Refund') ? '#e74c3c' : '#27ae60'} />
            {row.refund_status && (
              <>
                <F l="Refund status" v={row.refund_status} />
                <F l="Refund id" v={row.refund_id} />
                <F l="Refund amount" v={fmtMoney(row.refund_amount) ? `$${fmtMoney(row.refund_amount)}` : null} />
                <F l="Refund date" v={row.refund_date} />
                <F l="Refund email sent" v={row.refund_email_sent ? 'Yes' : null} />
              </>
            )}
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting Tax 4 meeting + admin decision</span>}
      </Step>

      <Step title="Retainer Revenue Share" done={row.retainer_rev_paid === 'Yes'}>
        {row.retainer_rev_share ? (
          <>
            <F l="Rev share status" v={row.retainer_rev_share} />
            <F l="Rev paid" v={row.retainer_rev_paid} />
            <F l="Member email sent" v={row.retainer_rev_email_sent ? 'Yes' : null} />
            <F l="Member contrib" v={row.member_contrib_status} />
            <F l="Tracy intro sent" v={row.tracy_intro_email_sent ? 'Yes' : null} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Implementation Fee" done={row.implementation_charge_status === 'succeeded'}>
        {row.implementation_charge_status ? (
          <>
            <F l="Charge status" v={row.implementation_charge_status} />
            <F l="Payment intent" v={row.implementation_payment_intent_id} />
            <F l="Charge date" v={row.implementation_charge_date} />
            <F l="Confirmation status" v={row.implementation_confirmation_status} />
            <F l="Receipt #" v={row.implementation_receipt_number} />
            <F l="Receipt drive id" v={row.implementation_receipt_drive_id} />
            <F l="Receipt status" v={row.implementation_receipt_status} />
            <F l="Triggering specialist" v={row.implementing_specialist_id} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting first "Proceed with Implementation" in Tax 5</span>}
      </Step>

      <Step title="Implementation Revenue Share" done={row.implementation_rev_paid === 'Yes'}>
        {row.implementation_rev_share ? (
          <>
            <F l="Rev share status" v={row.implementation_rev_share} />
            <F l="Rev paid" v={row.implementation_rev_paid} />
            <F l="Member email sent" v={row.implementation_rev_email_sent ? 'Yes' : null} />
          </>
        ) : <span style={{ fontSize: 12, color: '#5a8ab5' }}>Awaiting</span>}
      </Step>

      <Step title="Wrap-up Announcement" done={!!row.implementation_announcement_email_sent}>
        <F l="Announcement email sent" v={row.implementation_announcement_email_sent ? 'Yes' : null} />
      </Step>

      <div style={{ marginTop: 6, fontSize: 10, color: '#4a7a9e' }}>
        Plan #{row.id} · Created {row.created_at?.split('T')[0]}
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
    <button onClick={onClick} title="Click to toggle"
      style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: palette.bg, color: palette.text, border: `1px solid ${palette.border}`, letterSpacing: '0.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
      {palette.label}
    </button>
  )
}

function SandboxToggleModal({ currentlySandbox, onConfirm, onCancel, saving }) {
  const switchingTo = currentlySandbox ? 'LIVE' : 'SANDBOX'
  const isGoingLive = switchingTo === 'LIVE'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, fontFamily: '"DM Sans", sans-serif' }}>
      <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 32, maxWidth: 440, width: '90%' }}>
        <h2 style={{ fontSize: 18, color: '#fff', margin: '0 0 12px' }}>Switch Tax pipeline to {switchingTo} mode?</h2>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
          {isGoingLive
            ? 'This will switch the TAX automation pipeline to use LIVE Stripe + BoldSign keys. Real emails will be sent to real clients and real cards will be charged. Are you sure?'
            : 'This will switch back to sandbox mode. Emails route to sandbox_email and Stripe/BoldSign use test keys.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button onClick={onCancel} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#94a3b8', fontSize: 14, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={onConfirm} disabled={saving} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: isGoingLive ? '#ef4444' : '#f59e0b', color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : `Switch to ${switchingTo}`}</button>
        </div>
      </div>
    </div>
  )
}

export default function TaxAutomationPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [expandedRow, setExpandedRow] = useState(null)
  const [showModeModal, setShowModeModal] = useState(false)
  const [savingMode, setSavingMode] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const data = await callApi('automation_load_tax_plans')
      setRows(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) { setError(err.message || String(err)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function toggleSandboxMode() {
    if (!sandboxConfig) return
    const next = !sandboxConfig.sandbox_mode
    setSavingMode(true)
    try {
      await callApi('save_sandbox_config', {
        pipeline: 'TAX',
        sandbox_mode: next,
        stripe_test_mode: next,
        boldsign_test_mode: next,
      })
      setSandboxConfig({ ...sandboxConfig, sandbox_mode: next, stripe_test_mode: next, boldsign_test_mode: next })
      setShowModeModal(false)
    } catch (err) { setError(err.message) }
    finally { setSavingMode(false) }
  }

  const stats = {
    total: rows.length,
    active: rows.filter(p => { const s = getCurrentStage(p); return s !== 'complete' && s !== 'closed' && s !== 'refunded' }).length,
    complete: rows.filter(p => getCurrentStage(p) === 'complete').length,
    closed: rows.filter(p => { const s = getCurrentStage(p); return s === 'closed' || s === 'refunded' }).length,
    sandbox: rows.filter(p => p.sandbox).length,
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#8bacc8' }}>Loading…</div>

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#fff', margin: 0 }}>Tax Planning Automation</h2>
          <SandboxBadge config={sandboxConfig} onClick={() => setShowModeModal(true)} />
        </div>
      </div>

      {error && <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'TOTAL', value: stats.total, color: '#fff' },
          { label: 'ACTIVE', value: stats.active, color: '#3b82f6' },
          { label: 'COMPLETE', value: stats.complete, color: '#22c55e' },
          { label: 'CLOSED', value: stats.closed, color: '#ef4444' },
          { label: 'SANDBOX', value: stats.sandbox, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 20px', minWidth: 100 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#8bacc8', letterSpacing: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ color: '#8bacc8', fontSize: 15, marginBottom: 8 }}>No tax plans yet</p>
          <p style={{ color: '#5a8ab5', fontSize: 13 }}>Tax plans appear here as they enter the automation flow</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['', 'Client', 'Member', 'PF', 'Stage', 'Decision', 'Retainer', 'Payment', 'Started'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, color: '#5a8ab5', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, width: h === '' ? 30 : undefined }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const stage = getCurrentStage(row)
                const stageColor = STAGE_COLORS[stage] || '#8bacc8'
                const isExpanded = expandedRow === row.id
                return (
                  <Fragment key={row.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent' }}
                      onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                      onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                      <td style={{ padding: '12px 8px', fontSize: 10, color: '#8bacc8' }}>
                        <span style={{ display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </td>
                      <td style={{ padding: 12, fontSize: 14, color: '#fff' }}>
                        <div>{row.client_name || row.client_ref || '—'}</div>
                        {row.client_ref && row.client_name && <div style={{ fontSize: 11, color: '#5a8ab5' }}>{row.client_ref}</div>}
                        {row.sandbox && <span style={{ fontSize: 10, color: '#f59e0b', fontStyle: 'italic' }}>sandbox</span>}
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: '#8bacc8' }}>{row.member_name || row.member_number || '—'}</td>
                      <td style={{ padding: 12, fontSize: 13, color: '#8bacc8' }}>{row.assigned_pf || '—'}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: `${stageColor}18`, color: stageColor, border: `1px solid ${stageColor}33` }}>
                          {STAGE_LABELS[stage] || stage}
                        </span>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: '#8bacc8' }}>{row.tax_final_decision || row.tax_decision || '—'}</td>
                      <td style={{ padding: 12, fontSize: 13, color: '#8bacc8' }}>{fmtMoney(row.retainer_amount) ? `$${fmtMoney(row.retainer_amount)}` : '—'}</td>
                      <td style={{ padding: 12, fontSize: 13, color: '#8bacc8' }}>{row.retainer_status || '—'}</td>
                      <td style={{ padding: 12, fontSize: 12, color: '#5a8ab5' }}>{row.created_at ? row.created_at.split('T')[0] : '—'}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}><ExpandedRow row={row} onRefresh={load} /></td>
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
        <SandboxToggleModal currentlySandbox={!!sandboxConfig?.sandbox_mode} onConfirm={toggleSandboxMode} onCancel={() => setShowModeModal(false)} saving={savingMode} />
      )}
    </div>
  )
}
