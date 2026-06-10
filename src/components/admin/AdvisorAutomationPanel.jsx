import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { StepCard, Detail, Badge, Pending, fmtMoney, fmtDate } from './automation/StepKit'
import SandboxModeToggle from './SandboxModeToggle'

const STAGE_LABELS = {
  new: 'New',
  decision_sent: 'Decision Sent',
  declined: 'Declined',
  agreement_sent: 'Agreement Sent',
  agreement_signing: 'Awaiting Countersign',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  invoice: 'Invoice & Receipt',
  advisor_created: 'Advisor Created',
  complete: 'Complete',
}

const STAGE_COLORS = {
  new: '#4e6087',
  decision_sent: '#0095ff',
  declined: '#ef4444',
  agreement_sent: '#7c3aed',
  agreement_signing: '#9333ea',
  payment_pending: '#db2777',
  paid: '#0d9488',
  invoice: '#0d9488',
  advisor_created: '#16a34a',
  complete: '#16a34a',
}

function getCurrentStage(row) {
  if (row.login_setup_completed_at) return 'complete'
  if (row.member_number) return 'advisor_created'
  if (row.invoice_sent_at) return 'invoice'
  if (row.payment_status === 'succeeded') return 'paid'
  if (row.payment_link_sent_at && row.payment_status !== 'succeeded') return 'payment_pending'
  if (row.agreement_signed_by_advisor_at && !row.agreement_signed_by_ceo_at) return 'agreement_signing'
  if (row.agreement_sent_at) return 'agreement_sent'
  if (row.final_decision === 'No' || row.final_decision === 'Auto-Declined') return 'declined'
  if (row.decision_email_sent_at) return 'decision_sent'
  return 'new'
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

function AdvisorPipelineRow({ row, expanded, onToggle }) {
  const advisorName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown'
  const stage = getCurrentStage(row)
  const stageLabel = STAGE_LABELS[stage]
  const stageColor = STAGE_COLORS[stage]
  const plans = selectedPlansLabel(row)

  const decisionStatus = (row.final_decision === 'No' || row.final_decision === 'Auto-Declined') ? 'declined'
    : (row.final_decision || row.prelim_meeting_decision) ? 'done' : 'pending'
  const agreementStatus = row.agreement_signed_by_ceo_at ? 'done'
    : (row.agreement_sent_at || row.boldsign_document_id) ? 'awaiting' : 'pending'
  const payStatus = row.payment_status === 'succeeded' ? 'done'
    : (row.payment_link_sent_at || row.stripe_customer_id) ? 'awaiting' : 'pending'
  const invStatus = row.invoice_sent_at ? 'done' : (row.confirmation_email_sent_at || row.invoice_number) ? 'sent' : 'pending'
  const createStatus = row.member_number ? 'done' : 'pending'
  const loginStatus = row.login_setup_completed_at ? 'done'
    : (row.login_setup_email_sent_at || row.login_setup_token) ? 'awaiting' : 'pending'

  return (
    <div style={{ background: '#eef2f9', border: '1px solid #ebf0f8', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#16264a' }}>{advisorName}</span>
          {row.member_number && <span style={{ fontSize: '12px', color: '#697a9c', fontFamily: 'monospace' }}>#{row.member_number}</span>}
          {plans && <Badge text={plans} color="#0095ff" />}
          {plans && row.payment_amount && <span style={{ fontSize: '12px', color: '#243757' }}>{fmtMoney(row.payment_amount)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge text={stageLabel} color={stageColor} />
          <span style={{ color: '#4e6087', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '8px 18px 18px', borderTop: '1px solid #f2f5fa' }}>
          <StepCard title="Decision" status={decisionStatus}>
            <Detail l="Decision" v={<Badge text={row.final_decision || row.prelim_meeting_decision} />} showEmpty />
            <Detail l="Undecided email sent" v={fmtDate(row.decision_email_sent_at)} />
            <Detail l="48h reminder sent" v={fmtDate(row.decision_reminder_sent_at)} />
            <Detail l="96h PF notified" v={fmtDate(row.decision_pf_notified_at)} />
          </StepCard>

          <StepCard title="Agreement" status={agreementStatus}>
            {row.boldsign_document_id ? (
              <>
                <Detail l="Agreement sent" v={fmtDate(row.agreement_sent_at)} showEmpty />
                <Detail l="48h reminder sent" v={fmtDate(row.signing_reminder_sent_at)} />
                <Detail l="96h PF notified" v={fmtDate(row.signing_pf_notified_at)} />
                <Detail l="Signed by advisor" v={fmtDate(row.agreement_signed_by_advisor_at)} showEmpty />
                <Detail l="CEO countersigned" v={fmtDate(row.agreement_signed_by_ceo_at)} showEmpty />
                <Detail l="Selected plans" v={plans} />
                <Detail l="Payment amount" v={fmtMoney(row.payment_amount)} />
                <Detail l="Engagement term" v={row.engagement_term_months ? `${row.engagement_term_months} months` : null} />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Payment" status={payStatus}>
            {row.stripe_customer_id || row.payment_link_sent_at ? (
              <>
                <Detail l="Payment link emailed" v={fmtDate(row.payment_link_sent_at)} />
                <Detail l="48h reminder sent" v={fmtDate(row.payment_reminder_sent_at)} />
                <Detail l="96h PF notified" v={fmtDate(row.payment_pf_notified_at)} />
                <Detail l="Method" v={row.payment_method_type} />
                <Detail l="Account" v={row.acct_last4 ? `****${row.acct_last4}` : null} />
                <Detail l="Payment amount" v={fmtMoney(row.payment_amount)} />
                <Detail l="Status" v={row.payment_status} />
                <Detail l="Payment received" v={fmtDate(row.payment_completed_at)} />
                <Detail l="Renewal review" v={fmtDate(row.renewal_date)} />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Confirmation, Invoice & Receipt" status={invStatus}>
            {row.confirmation_email_sent_at || row.invoice_number ? (
              <>
                <Detail l="Confirmation email sent" v={fmtDate(row.confirmation_email_sent_at)} />
                <Detail l="Invoice emailed" v={fmtDate(row.invoice_sent_at)} showEmpty />
                <Detail l="Invoice #" v={row.invoice_number} mono />
                <Detail l="Receipt #" v={row.receipt_number} mono />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Advisor Creation" status={createStatus}>
            {row.member_number ? (
              <>
                <Detail l="Member number" v={row.member_number} />
                <Detail l="Created" v={fmtDate(row.member_created_at)} />
                <Detail l="Revenue decision" v={row.revenue_decision} />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Member Login Setup" status={loginStatus}>
            {row.login_setup_token || row.login_setup_email_sent_at ? (
              <>
                <Detail l="Setup email sent" v={fmtDate(row.login_setup_email_sent_at)} />
                <Detail l="Token expires" v={fmtDate(row.login_setup_token_expires_at)} />
                <Detail l="Completed" v={fmtDate(row.login_setup_completed_at)} showEmpty />
              </>
            ) : <Pending />}
          </StepCard>

          <div style={{ marginTop: '10px', fontSize: '10px', color: '#7c8aa6' }}>
            Onboarding #{row.id} · Started {fmtDate(row.created_at)} · {row.email || 'no email'}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdvisorAutomationPanel() {
  const [rows, setRows] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await callApi('automation_load_advisor_pipelines')
      setRows(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#4e6087' }}>Loading...</div>

  const inProgress = rows.filter(r => {
    const s = getCurrentStage(r)
    return s !== 'complete' && s !== 'declined'
  })
  const stats = [
    { label: 'TOTAL', value: rows.length, color: '#16264a' },
    { label: 'IN PROGRESS', value: inProgress.length, color: '#0095ff' },
    { label: 'PAID', value: rows.filter(r => r.payment_status === 'succeeded').length, color: '#0d9488' },
    { label: 'ADVISOR CREATED', value: rows.filter(r => r.member_number).length, color: '#16a34a' },
    { label: 'COMPLETE', value: rows.filter(r => getCurrentStage(r) === 'complete').length, color: '#16a34a' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '-0.02em', fontSize: '24px', color: '#16264a', margin: 0 }}>Advisor Onboarding Pipeline</h2>
          <SandboxModeToggle
            pipeline="ADVISOR_ONBOARDING"
            label="Advisor Onboarding"
            sandboxConfig={sandboxConfig}
            onChange={setSandboxConfig}
          />
        </div>
      </div>

      {error && <div style={{ color: '#d93025', fontWeight: 500, fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {stats.map(stat => (
          <div key={stat.label} style={{ background: '#f7f9fc', border: '1px solid #ebf0f8', borderRadius: '10px', padding: '14px 20px', minWidth: '100px' }}>
            <div style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#4e6087', letterSpacing: '1px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#697a9c', fontSize: '14px' }}>
          No advisor onboarding records yet.
        </div>
      ) : (
        rows.map(r => (
          <AdvisorPipelineRow
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
