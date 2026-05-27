import { useEffect, useState } from 'react'
import { callApi } from '../../lib/api'

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
        <div style={{ padding: '4px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Step title="Purchase Details" done>
            <F l="Kind" v={purchaseLabel(row)} />
            <F l="Gross service value" v={fmtMoney(row.pip_purchase_gross)} />
            <F l="Member contribution" v={fmtMoney(row.pip_purchase_member_contribution)} />
            <F l="Net amount due" v={fmtMoney(row.pip_purchase_amount)} />
            <F l="Member share" v={fmtMoney(row.pip_purchase_member_share)} />
            <F l="VFOs share" v={fmtMoney(row.pip_purchase_vfos_share)} />
            <F l="Engagement year" v={row.pip_engagement_year ? `Year ${row.pip_engagement_year}` : null} />
            <F l="Purchased via" v={row.pip_completed_date ? fmtDate(row.pip_completed_date) : null} />
          </Step>

          <Step title="Payment" done={row.pip_payment_status === 'succeeded'}>
            {row.pip_payment_status ? (
              <>
                <F l="Status" v={row.pip_payment_status} />
                <F l="Method" v={row.pip_payment_method_type} />
                <F l="Account" v={row.pip_acct_last4 ? `****${row.pip_acct_last4}` : null} />
                <F l="Card fee" v={fmtMoney(row.pip_card_processing_fee)} />
                <F l="Payment intent" v={row.pip_payment_intent_id} />
                <F l="Email sent" v={fmtDate(row.pip_payment_email_sent_at)} />
                <F l="Completed at" v={fmtDate(row.pip_payment_completed_at)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Confirmation" done={!!row.pip_confirmation_email_sent_at}>
            {row.pip_confirmation_email_sent_at ? (
              <F l="Sent at" v={fmtDate(row.pip_confirmation_email_sent_at)} />
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Invoice & Receipt" done={!!row.pip_invoice_receipt_email_sent_at}>
            {row.pip_invoice_number ? (
              <>
                <F l="Invoice #" v={row.pip_invoice_number} />
                <F l="Receipt #" v={row.pip_receipt_number} />
                <F l="Emailed at" v={fmtDate(row.pip_invoice_receipt_email_sent_at)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <Step title="Revenue Share" done={!!row.pip_rev_member_email_sent_at}>
            {row.pip_rev_share_status ? (
              <>
                <F l="Status" v={row.pip_rev_share_status} />
                <F l="Amount" v={fmtMoney(row.pip_rev_share_amount)} />
                <F l="Transfer" v={row.pip_rev_share_transfer_id} />
                <F l="Completed at" v={fmtDate(row.pip_rev_share_completed_at)} />
                <F l="Member email sent" v={fmtDate(row.pip_rev_member_email_sent_at)} />
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#5a8ab5' }}>Awaiting</span>
            )}
          </Step>

          <div style={{ marginTop: '6px', fontSize: '10px', color: '#4a7a9e' }}>
            Track #{row.id} · Created {row.created_at?.split('T')[0]}
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
