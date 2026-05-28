import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

const STAGE_LABELS = {
  new: 'New',
  decision_sent: 'Decision Sent',
  declined: 'Declined',
  agreement_sent: 'Agreement Sent',
  agreement_signing: 'Awaiting Countersign',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  invoice: 'Invoice & Receipt',
  accountant_created: 'Accountant Created',
  complete: 'Complete',
}

const STAGE_COLORS = {
  new: '#8bacc8',
  decision_sent: '#5b9fe6',
  declined: '#ef4444',
  agreement_sent: '#8b5cf6',
  agreement_signing: '#a855f7',
  payment_pending: '#ec4899',
  paid: '#14b8a6',
  invoice: '#14b8a6',
  accountant_created: '#22c55e',
  complete: '#22c55e',
}

function getCurrentStage(row) {
  if (row.login_setup_completed_at) return 'complete'
  if (row.member_number) return 'accountant_created'
  if (row.invoice_sent_at) return 'invoice'
  if (row.payment_status === 'succeeded') return 'paid'
  if (row.payment_link_sent_at && row.payment_status !== 'succeeded') return 'payment_pending'
  if (row.agreement_signed_by_accountant_at && !row.agreement_signed_by_ceo_at) return 'agreement_signing'
  if (row.agreement_sent_at) return 'agreement_sent'
  if (row.final_decision === 'No' || row.final_decision === 'Auto-Declined') return 'declined'
  if (row.decision_email_sent_at) return 'decision_sent'
  return 'new'
}

const F = ({ l, v, hide }) => {
  if (hide) return null
  return (
    <div style={{ display: 'flex', padding: '2px 0' }}>
      <span style={{ fontSize: '12px', color: '#5a8ab5', width: '180px', flexShrink: 0 }}>{l}</span>
      <span style={{ fontSize: '12px', color: v ? '#d1dce8' : '#3d5a7a' }}>{v || '—'}</span>
    </div>
  )
}

function Badge({ text, color }) {
  if (!text) return null
  const c = color || '#8bacc8'
  return (
    <span style={{
      fontSize: '11px', padding: '2px 10px', borderRadius: '4px', fontWeight: '600',
      background: `${c}15`, color: c, border: `1px solid ${c}30`,
    }}>{text}</span>
  )
}

function Step({ title, done, children }) {
  return (
    <div style={{ marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: done ? '#22c55e' : 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontSize: '12px', fontWeight: '600', color: done ? '#22c55e' : '#8bacc8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</span>
      </div>
      <div style={{ paddingLeft: '16px' }}>{children}</div>
    </div>
  )
}

function fmtMoney(n) {
  const v = parseFloat(n)
  if (!Number.isFinite(v)) return null
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(s) {
  if (!s) return null
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function selectedPlansLabel(row) {
  const parts = []
  if (row.selected_vfo_ft) parts.push('VFO Fast Track')
  if (row.selected_pft) parts.push('Partnership Fast Track')
  if (row.selected_corporate) parts.push('Corporate Membership')
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`
}

function AccountantPipelineRow({ row, expanded, onToggle }) {
  const accountantName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown'
  const stage = getCurrentStage(row)
  const stageLabel = STAGE_LABELS[stage]
  const stageColor = STAGE_COLORS[stage]
  const plans = selectedPlansLabel(row)

  return (
    <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{accountantName}</span>
          {row.member_number && <span style={{ fontSize: '12px', color: '#5a8ab5', fontFamily: 'monospace' }}>#{row.member_number}</span>}
          {plans && <Badge text={plans} color="#5b9fe6" />}
          {plans && row.payment_amount && <span style={{ fontSize: '12px', color: '#d1dce8' }}>{fmtMoney(row.payment_amount)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge text={stageLabel} color={stageColor} />
          <span style={{ color: '#8bacc8', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '4px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Step title="Decision" done={!!(row.final_decision || row.prelim_meeting_decision)}>
            <F l="Decision" v={row.final_decision || row.prelim_meeting_decision} />
            {row.prelim_meeting_decision === 'Undecided' && (
              <F l="Undecided email sent" v={fmtDate(row.decision_email_sent_at)} />
            )}
          </Step>

          <Step title="Agreement" done={!!row.agreement_signed_by_ceo_at}>
            {row.boldsign_document_id ? (
              <>
                <F l="BoldSign doc id" v={row.boldsign_document_id} />
                <F l="Sent at" v={fmtDate(row.agreement_sent_at)} />
                <F l="Signed by accountant" v={fmtDate(row.agreement_signed_by_accountant_at)} />
                <F l="Countersigned by CEO" v={fmtDate(row.agreement_signed_by_ceo_at)} />
                <F l="Signing reminder sent" v={fmtDate(row.signing_reminder_sent_at)} />
                <F l="Selected plans" v={plans} hide={!plans} />
                <F l="Payment amount" v={fmtMoney(row.payment_amount)} hide={!plans} />
                <F l="Engagement term" v={row.engagement_term_months ? `${row.engagement_term_months} months` : null} hide={!plans} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Payment" done={row.payment_status === 'succeeded'}>
            {row.stripe_customer_id || row.payment_link_sent_at ? (
              <>
                <F l="Stripe customer" v={row.stripe_customer_id} />
                <F l="Checkout token" v={row.checkout_token} />
                <F l="Payment link sent" v={fmtDate(row.payment_link_sent_at)} />
                <F l="Payment reminder sent" v={fmtDate(row.payment_reminder_sent_at)} />
                <F l="Status" v={row.payment_status} />
                <F l="Method" v={row.payment_method_type} />
                <F l="Account" v={row.acct_last4 ? `****${row.acct_last4}` : null} />
                <F l="Card fee" v={fmtMoney(row.card_processing_fee)} />
                <F l="Payment intent" v={row.stripe_payment_intent_id} />
                <F l="Completed at" v={fmtDate(row.payment_completed_at)} />
                <F l="Renewal review" v={fmtDate(row.renewal_date)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Confirmation, Invoice & Receipt" done={!!row.invoice_sent_at}>
            {row.confirmation_email_sent_at || row.invoice_number ? (
              <>
                <F l="Confirmation email sent" v={fmtDate(row.confirmation_email_sent_at)} />
                <F l="Invoice #" v={row.invoice_number} />
                <F l="Receipt #" v={row.receipt_number} />
                <F l="Invoice/receipt emailed" v={fmtDate(row.invoice_sent_at)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Accountant Creation" done={!!row.member_number}>
            {row.member_number ? (
              <>
                <F l="Member number" v={row.member_number} />
                <F l="Created at" v={fmtDate(row.member_created_at)} />
                <F l="Revenue decision" v={row.revenue_decision} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Member Login Setup" done={!!row.login_setup_completed_at}>
            {row.login_setup_token || row.login_setup_email_sent_at ? (
              <>
                <F l="Setup email sent" v={fmtDate(row.login_setup_email_sent_at)} />
                <F l="Token expires" v={fmtDate(row.login_setup_token_expires_at)} />
                <F l="Completed at" v={fmtDate(row.login_setup_completed_at)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <div style={{ marginTop: '6px', fontSize: '10px', color: '#4a7a9e' }}>
            Onboarding #{row.id} · Started {row.created_at?.split('T')[0]} · {row.email || 'no email'}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountantAutomationPanel() {
  const [rows, setRows] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await callApi('automation_load_accountant_pipelines')
      setRows(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>

  const inProgress = rows.filter(r => {
    const s = getCurrentStage(r)
    return s !== 'complete' && s !== 'declined'
  })
  const stats = [
    { label: 'TOTAL', value: rows.length, color: '#fff' },
    { label: 'IN PROGRESS', value: inProgress.length, color: '#5b9fe6' },
    { label: 'PAID', value: rows.filter(r => r.payment_status === 'succeeded').length, color: '#14b8a6' },
    { label: 'ACCOUNTANT CREATED', value: rows.filter(r => r.member_number).length, color: '#22c55e' },
    { label: 'COMPLETE', value: rows.filter(r => getCurrentStage(r) === 'complete').length, color: '#22c55e' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', margin: 0 }}>Accountant Onboarding Pipeline</h2>
          {sandboxConfig && (
            <span style={{
              padding: '4px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              background: sandboxConfig.sandbox_mode ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              color: sandboxConfig.sandbox_mode ? '#f59e0b' : '#ef4444',
              border: `1px solid ${sandboxConfig.sandbox_mode ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.4)'}`,
              letterSpacing: '0.5px',
            }}>
              {sandboxConfig.sandbox_mode ? 'SANDBOX MODE' : 'LIVE MODE'}
            </span>
          )}
        </div>
      </div>

      {error && <div style={{ color: '#ff6b6b', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '14px 20px', minWidth: '100px' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#8bacc8', letterSpacing: '1px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#5a8ab5', fontSize: '14px' }}>
          No accountant onboarding records yet.
        </div>
      ) : (
        rows.map(r => (
          <AccountantPipelineRow
            key={r.id}
            row={r}
            expanded={expandedRow === r.id}
            onToggle={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
          />
        ))
      )}
    </div>
  )
}
