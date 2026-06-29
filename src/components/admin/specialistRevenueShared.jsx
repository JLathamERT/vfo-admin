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
  if (!requestReceived) return { label: 'Pending', color: '#697a9c' }
  switch (line.payout_status) {
    case 'revenue_share_sent': return { label: 'Revenue share payment sent', color: '#16a34a' }
    case 'money_mapping': return { label: 'Allocated to money mapping', color: '#16a34a' }
    case 'awaiting_connect': return { label: 'Awaiting Stripe Connect setup', color: '#b45309' }
    case 'failed': return { label: 'Transfer failed', color: '#ef4444' }
    default: return { label: 'Pending', color: '#697a9c' }
  }
}

export function StatusPill({ label, color }) {
  return (
    <span style={{ display: 'inline-block', padding: '3px 11px', borderRadius: '99px', fontSize: '11px', fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}33`, whiteSpace: 'nowrap' }}>{label}</span>
  )
}

// One specialist request row: header (name + totals + status) → expand → recipient table.
// `actions` is an optional render-prop ({ request }) => node shown in the expanded panel
// (used by the Automation tracker for the Retry button).
export function RequestRow({ request, actions }) {
  const [open, setOpen] = useState(false)
  const req = REQ_STATUS[request.payment_status] || { label: request.payment_status, color: '#697a9c' }
  const received = request.payment_status === 'received'
  const lines = request.lines || []
  const d = requestDate(request)
  const dateStr = d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  return (
    <div style={{ background: '#fff', border: '1px solid #e9eef8', borderRadius: '14px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}>
        <span style={{ fontSize: '11px', color: '#9aa7be', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#16264a' }}>{request.specialist_name || '—'}</div>
          <div style={{ fontSize: '12px', color: '#697a9c', marginTop: '2px' }}>{dateStr} · {lines.length} recipient{lines.length === 1 ? '' : 's'} · {request.total_deals || 0} deals</div>
        </div>
        <div style={{ display: 'flex', gap: '18px', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#16264a' }}>{money(request.total_member_share)}</div>
            <div style={{ fontSize: '11px', color: '#9aa7be' }}>member</div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#16264a' }}>{money(request.total_vfos_share)}</div>
            <div style={{ fontSize: '11px', color: '#9aa7be' }}>VFOS</div>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: NAVY }}>{money(request.gross_amount)}</div>
            <div style={{ fontSize: '11px', color: '#9aa7be' }}>gross</div>
          </div>
        </div>
        <div style={{ width: '160px', textAlign: 'right' }}><StatusPill label={req.label} color={req.color} /></div>
      </div>

      {open && (
        <div style={{ background: '#f8fafc', borderTop: '1px solid #e9eef8', padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', padding: '0 0 8px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>
            <div>Recipient</div><div>VFOS $</div><div>Member $</div><div>Deals</div><div style={{ textAlign: 'right' }}>Status</div>
          </div>
          {lines.map(line => {
            const m = lineStatusMeta(line, received)
            return (
              <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', alignItems: 'center', padding: '9px 0', borderTop: '1px solid #eef2f9', fontSize: '13px', color: '#243757' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{line.recipient_name || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#9aa7be' }}>{line.recipient_type === 'specialist' ? 'Specialist' : (line.member_number || 'Member')} · {line.revenue_decision || 'Revenue Share'}</div>
                </div>
                <div>{money(line.vfos_share)}</div>
                <div>{money(line.member_share)}</div>
                <div>{line.deals || 0}</div>
                <div style={{ textAlign: 'right' }}><StatusPill label={m.label} color={m.color} /></div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px 70px 1fr', gap: '10px', alignItems: 'center', padding: '10px 0 2px', borderTop: '2px solid #e3eaf5', marginTop: '4px', fontSize: '13px', fontWeight: 700, color: NAVY }}>
            <div>Totals</div>
            <div>{money(request.total_vfos_share)}</div>
            <div>{money(request.total_member_share)}</div>
            <div>{request.total_deals || 0}</div>
            <div style={{ textAlign: 'right', color: '#697a9c', fontWeight: 600 }}>{request.payment_method_type ? `${request.payment_method_type}${request.acct_last4 ? ` ••${request.acct_last4}` : ''}` : ''}</div>
          </div>
          {actions && <div style={{ marginTop: '14px' }}>{actions({ request })}</div>}
        </div>
      )}
    </div>
  )
}
