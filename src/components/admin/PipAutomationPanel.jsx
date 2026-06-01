import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'
import { StepCard, Detail, Badge, Pending, fmtMoney, fmtDate } from './automation/StepKit'
import SandboxModeToggle from './SandboxModeToggle'

const STAGE_LABELS = {
  purchase: 'Purchase',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  invoice: 'Invoice & Receipt',
  revshare: 'Rev Share',
  complete: 'Complete',
}

const STAGE_COLORS = {
  purchase: '#8b5cf6',
  payment_pending: '#ec4899',
  paid: '#14b8a6',
  invoice: '#14b8a6',
  revshare: '#22c55e',
  complete: '#22c55e',
}

function getCurrentStage(row) {
  if (row.pip_rev_member_email_sent_at && row.pip_rev_share_completed_at) return 'complete'
  if (row.pip_rev_share_status && row.pip_rev_share_status.startsWith('Completed')) return 'revshare'
  if (row.pip_invoice_receipt_email_sent_at) return 'invoice'
  if (row.pip_payment_status === 'succeeded') return 'paid'
  if (row.pip_payment_status === 'pending' || row.pip_payment_status === 'processing') return 'payment_pending'
  return 'purchase'
}

function purchaseLabel(row) {
  if (row.pip_purchase_kind === 'tax_planning') return 'Tax Planning'
  if (row.pip_purchase_kind === 'additional_pip') {
    const n = row.pip_purchase_pip_count || 0
    return `${n} Additional PIP Meeting${n === 1 ? '' : 's'}`
  }
  return '—'
}

function PipPipelineRow({ row, expanded, onToggle }) {
  const client = row.clients || {}
  const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim() || 'Unknown'
  const stage = getCurrentStage(row)
  const stageLabel = STAGE_LABELS[stage]
  const stageColor = STAGE_COLORS[stage]

  const payStatus = row.pip_payment_status === 'succeeded' ? 'done'
    : (row.pip_payment_status === 'pending' || row.pip_payment_status === 'processing' || row.pip_payment_email_sent_at) ? 'awaiting' : 'pending'
  const invStatus = row.pip_invoice_receipt_email_sent_at ? 'done' : row.pip_invoice_number ? 'sent' : 'pending'
  const revStatus = (row.pip_rev_member_email_sent_at || (row.pip_rev_share_status || '').startsWith('Completed')) ? 'done'
    : row.pip_rev_share_status ? 'awaiting' : 'pending'
  const revDecision = /money mapping/i.test(row.pip_rev_share_status || '') ? 'Money Mapping'
    : (row.pip_rev_share_amount || /revenue share/i.test(row.pip_rev_share_status || '')) ? 'Revenue Share' : null

  return (
    <div style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: '600', color: '#fff' }}>{clientName}</span>
          <span style={{ fontSize: '12px', color: '#5a8ab5', fontFamily: 'monospace' }}>{client.client_ref}</span>
          <Badge text={purchaseLabel(row)} color="#5b9fe6" />
          {row.pip_purchase_amount && <span style={{ fontSize: '12px', color: '#d1dce8' }}>{fmtMoney(row.pip_purchase_amount)}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {row.sandbox && <Badge text="SANDBOX" color="#f59e0b" />}
          <Badge text={stageLabel} color={stageColor} />
          <span style={{ color: '#8bacc8', fontSize: '10px', transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '8px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <StepCard title="Purchase Details" status="done">
            <Detail l="Kind" v={purchaseLabel(row)} />
            <Detail l="Gross service value" v={fmtMoney(row.pip_purchase_gross)} />
            <Detail l="Member contribution" v={fmtMoney(row.pip_purchase_member_contribution)} />
            <Detail l="Net amount due" v={fmtMoney(row.pip_purchase_amount)} />
            <Detail l="Member share" v={fmtMoney(row.pip_purchase_member_share)} />
            <Detail l="VFOs share" v={fmtMoney(row.pip_purchase_vfos_share)} />
            <Detail l="Engagement year" v={row.pip_engagement_year ? `Year ${row.pip_engagement_year}` : null} />
            <Detail l="Purchased" v={fmtDate(row.pip_completed_date)} />
          </StepCard>

          <StepCard title="Payment" status={payStatus}>
            {row.pip_payment_status ? (
              <>
                <Detail l="Payment link emailed" v={fmtDate(row.pip_payment_email_sent_at)} />
                <Detail l="Method" v={row.pip_payment_method_type} />
                <Detail l="Account" v={row.pip_acct_last4 ? `****${row.pip_acct_last4}` : null} />
                <Detail l="Payment amount" v={fmtMoney(row.pip_purchase_amount)} />
                <Detail l="Status" v={row.pip_payment_status} />
                <Detail l="Payment received" v={fmtDate(row.pip_payment_completed_at)} />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Confirmation Email" status={row.pip_confirmation_email_sent_at ? 'done' : 'pending'}>
            {row.pip_confirmation_email_sent_at
              ? <Detail l="Confirmation email" v={fmtDate(row.pip_confirmation_email_sent_at)} />
              : <Pending />}
          </StepCard>

          <StepCard title="Invoice & Receipt" status={invStatus}>
            {row.pip_invoice_number ? (
              <>
                <Detail l="Invoice emailed" v={fmtDate(row.pip_invoice_receipt_email_sent_at)} showEmpty />
                <Detail l="Invoice #" v={row.pip_invoice_number} mono />
                <Detail l="Receipt #" v={row.pip_receipt_number} mono />
              </>
            ) : <Pending />}
          </StepCard>

          <StepCard title="Revenue Share" status={revStatus}>
            {row.pip_rev_share_status ? (
              <>
                <Detail l="Revenue decision" v={revDecision} showEmpty />
                <Detail l="Revenue share completed" v={fmtDate(row.pip_rev_share_completed_at)} />
                <Detail l="Revenue share amount" v={fmtMoney(row.pip_rev_share_amount)} />
                <Detail l="Transfer id" v={row.pip_rev_share_transfer_id} mono />
                <Detail l="Rev share confirmation email" v={fmtDate(row.pip_rev_member_email_sent_at)} />
              </>
            ) : <Pending />}
          </StepCard>

          <div style={{ marginTop: '10px', fontSize: '10px', color: '#4a7a9e' }}>
            Track #{row.id} · Created {fmtDate(row.created_at)}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PipAutomationPanel() {
  const [rows, setRows] = useState([])
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await callApi('automation_load_pip_pipelines')
      setRows(data.rows || [])
      setSandboxConfig(data.sandbox_config || null)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: '#8bacc8' }}>Loading...</div>

  const stats = [
    { label: 'TOTAL', value: rows.length, color: '#fff' },
    { label: 'PAID', value: rows.filter(r => r.pip_payment_status === 'succeeded').length, color: '#14b8a6' },
    { label: 'PENDING REVSHARE', value: rows.filter(r => r.pip_payment_status === 'succeeded' && !r.pip_rev_share_status?.startsWith('Completed')).length, color: '#ec4899' },
    { label: 'COMPLETE', value: rows.filter(r => getCurrentStage(r) === 'complete').length, color: '#22c55e' },
    { label: 'SANDBOX', value: rows.filter(r => r.sandbox).length, color: '#f59e0b' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: '#fff', margin: 0 }}>PIP Meetings Pipeline</h2>
          <SandboxModeToggle
            pipeline="MAP 1"
            label="PIP Meetings"
            sandboxConfig={sandboxConfig}
            onChange={setSandboxConfig}
            note="PIP Meetings shares the MAP 1 sandbox flag — switching here also switches the MAP 1 pipeline."
          />
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
          No PIP purchases yet.
        </div>
      ) : (
        rows.map(r => (
          <PipPipelineRow
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
