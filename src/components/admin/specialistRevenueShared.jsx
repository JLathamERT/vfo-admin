// Shared helpers + row renderer for the VFO Specialist Revenue surfaces
// (Accounting viewer + Automation tracker).
import { useState } from 'react'

export const NAVY = '#002973'
export const BLUE = '#125ecc'

export function money(n) {
  return `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function requestDate(r) {
  return r.payment_completed_at || r.payment_requested_at || r.created_at
}

const REQ_STATUS = {
  requested: { label: 'Payment requested', color: '#0095ff' },
  processing: { label: 'Payment processing', color: '#e06717' },
  received: { label: 'Payment received', color: '#16a34a' },
  failed: { label: 'Payment failed', color: '#ef4444' },
}

// Per-recipient status. Before the specialist's money is in, everything reads Pending.
function lineStatusMeta(line, requestReceived) {
  if (!requestReceived) return { label: 'Pending', color: 'var(--vfo-muted)' }
  switch (line.payout_status) {
    case 'revenue_share_sent': return { label: 'Revenue share payment sent', color: '#16a34a' }
    case 'money_mapping': return { label: 'Allocated to money mapping', color: '#16a34a' }
    case 'awaiting_connect': return { label: 'Awaiting Stripe Connect setup', color: '#b45309' }
    case 'failed': return { label: 'Transfer failed', color: '#ef4444' }
    default: return { label: 'Pending', color: 'var(--vfo-muted)' }
  }
}

export function StatusPill({ label, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 11px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>{label}</span>
  )
}

// A labelled value with a small Copy button (bank-transfer details).
function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(String(value || ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)', marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--vfo-ink)', fontWeight: 600 }}>{value || '—'}</span>
        {value && (
          <button type="button" onClick={copy}
            style={{ padding: '2px 9px', borderRadius: '6px', border: `1px solid ${BLUE}`, background: 'var(--vfo-card)', color: BLUE, fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

// One specialist request row: header (name + totals + status) → expand → recipient table.
// `actions` is an optional render-prop ({ request }) => node shown in the expanded panel
// (used by the Automation tracker for the Retry button).
export function RequestRow({ request, actions }) {
  const [open, setOpen] = useState(false)
  const req = REQ_STATUS[request.payment_status] || { label: request.payment_status, color: 'var(--vfo-muted)' }
  const received = request.payment_status === 'received'
  const lines = request.lines || []
  const d = requestDate(request)
  const dateStr = d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}>
        <span style={{ fontSize: '11px', color: 'var(--vfo-faint)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{request.specialist_name || '—'}</div>
          <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>{dateStr} · {lines.length} recipient{lines.length === 1 ? '' : 's'} · {request.total_deals || 0} deals</div>
        </div>
        <div style={{ display: 'flex', gap: '18px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{money(request.total_member_share)}</div>
            <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>member</div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{money(request.total_vfos_share)}</div>
            <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>VFOS</div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-heading)' }}>{money(request.gross_amount)}</div>
            <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>gross</div>
          </div>
        </div>
        <div style={{ width: '160px', textAlign: 'right' }}>
          <StatusPill label={req.label} color={req.color} />
          {request.payment_status === 'requested' && Number(request.bank_transfer_amount_received) > 0 && (
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#e06717', marginTop: '4px' }}>{money(request.bank_transfer_amount_received)} received so far</div>
          )}
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--vfo-input)', borderTop: '1px solid var(--vfo-border-soft)', padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', padding: '0 0 8px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>
            <div>Recipient</div><div>VFOS $</div><div>Member $</div><div>Deals</div><div style={{ textAlign: 'right' }}>Status</div>
          </div>
          {lines.map(line => {
            const m = lineStatusMeta(line, received)
            return (
              <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--vfo-tint)', fontSize: '13px', color: 'var(--vfo-ink-2)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{line.recipient_name || '—'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>{line.recipient_type === 'specialist' ? 'Specialist' : (line.member_number || 'Member')} · {line.revenue_decision || 'Revenue Share'}</div>
                </div>
                <div>{money(line.vfos_share)}</div>
                <div>{money(line.member_share)}</div>
                <div>{line.deals || 0}</div>
                <div style={{ textAlign: 'right' }}><StatusPill label={m.label} color={m.color} /></div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', alignItems: 'center', padding: '10px 0 2px', borderTop: '2px solid var(--vfo-border)', marginTop: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--vfo-heading)' }}>
            <div>Totals</div>
            <div>{money(request.total_vfos_share)}</div>
            <div>{money(request.total_member_share)}</div>
            <div>{request.total_deals || 0}</div>
            <div style={{ textAlign: 'right', color: 'var(--vfo-muted)', fontWeight: 600 }}>{request.payment_method_type ? `${request.payment_method_type === 'bank_transfer' ? 'bank transfer' : request.payment_method_type}${request.acct_last4 ? ` ••${request.acct_last4}` : ''}` : ''}</div>
          </div>
          {request.payment_method_type === 'bank_transfer' && request.bank_transfer_account_number && (
            <div style={{ marginTop: '14px', padding: '14px 16px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '10px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)', marginBottom: '12px' }}>Bank transfer details</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <CopyField label="Bank name" value={request.bank_transfer_bank_name} />
                <CopyField label="Routing number" value={request.bank_transfer_routing_number} />
                <CopyField label="Account number" value={request.bank_transfer_account_number} />
                <CopyField label="Reference" value={request.bank_transfer_reference} />
              </div>
              {request.payment_status === 'requested' && Number(request.bank_transfer_amount_received) > 0 && (
                <div style={{ marginTop: '12px', fontSize: '12px', fontWeight: 600, color: '#e06717' }}>
                  Partially funded — {money(request.bank_transfer_amount_received)} of {money(request.gross_amount)} received. The request stays open until the remainder arrives.
                </div>
              )}
            </div>
          )}
          {actions && <div style={{ marginTop: '14px' }}>{actions({ request })}</div>}
        </div>
      )}
    </div>
  )
}
