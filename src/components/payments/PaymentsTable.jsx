import { useState } from 'react'

// Shared read-only renderer for the per-person Payments tabs (client / member /
// specialist). Takes a list of normalized rows from the *_payments_load actions,
// shows a unified chronological list, and offers "type" filter chips derived from
// the rows' category. No edit/upload/delete affordances — view only.

const STATUS = {
  paid:       { label: 'Paid',              fg: '#1a7f5a', bg: '#e7f5ee' },
  processing: { label: 'Processing',        fg: '#9a6700', bg: '#fdf3d8' },
  failed:     { label: 'Failed',            fg: '#b42318', bg: '#fdecea' },
  refunded:   { label: 'Refunded',          fg: '#475467', bg: '#eef2f9' },
  scheduled:  { label: 'Scheduled',         fg: '#1570ef', bg: '#e3effd' },
  awaiting:   { label: 'Awaiting decision', fg: '#7839ee', bg: '#f0e9fe' },
  unpaid:     { label: 'Not paid',          fg: '#667085', bg: '#f2f4f7' },
}

// Other-context tags (member / specialist rows). Client rows (MAP 1 / Tax / PIP)
// instead get a business-line tag from rowTag() below.
const PIPELINE_TAG = {
  'Advisor Onboarding': 'ADVISOR',
  'Accountant Onboarding': 'ACCOUNTANT',
  'Background Check': 'BG CHECK',
  'Monthly License': 'LICENSE',
  'Rev-Share Payout': 'PAYOUT',
}

// The row badge shows the BUSINESS LINE for client payments — Holistic (MAP 1 +
// Tax Priorities + PIP, all program 1) vs standalone Tax Planning (program 4).
// The Holistic vs Tax Planning split for a Tax row is read off its label
// ("Tax Planning — …" = program 4, else Holistic). Non-client rows keep their
// context tag (ADVISOR / PAYOUT / BG CHECK / LICENSE).
const HOLISTIC_TAG = { text: 'HOLISTIC', fg: '#1d4ed8', bg: '#e6eefe' }
const TAXPLANNING_TAG = { text: 'TAX PLANNING', fg: '#0e7490', bg: '#cffafe' }
const TAX_TAG = { text: 'TAX', fg: '#854d0e', bg: '#fdf0d9' }   // tax payout, program not on the transfer
function rowTag(r) {
  if (r.pipeline === 'MAP 1' || r.pipeline === 'PIP') return HOLISTIC_TAG
  if (r.pipeline === 'Tax') return /^Tax Planning/.test(r.label || '') ? TAXPLANNING_TAG : HOLISTIC_TAG
  if (r.pipeline === 'Tax-Payout') return TAX_TAG
  const t = PIPELINE_TAG[r.pipeline]
  return t ? { text: t, fg: '#4e6087', bg: '#eef2f9' } : null
}

// Preferred display order for the filter chips (categories not listed sort last).
const CATEGORY_ORDER = [
  'MAP 1', 'Tax Priorities', 'Tax Planning', 'PIP Meetings',
  'Onboarding fee', 'On behalf of clients', 'Rev-share payouts',
  'Background check', 'Monthly license',
]

function fmtMoney(n) {
  if (n === null || n === undefined) return '—'
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `−$${s}` : `$${s}`
}

function fmtDate(d) {
  if (!d) return '—'
  // Date-only values ("YYYY-MM-DD", e.g. pay1_date / retainer_date) are calendar
  // dates — build them in local time so they render as-is. `new Date("YYYY-MM-DD")`
  // would parse as UTC midnight and slip back a day for users west of UTC.
  // Full ISO timestamps (Stripe payouts/invoices) keep their instant behavior.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d))
  const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtMethod(method, last4) {
  if (!method) return '—'
  const m = method === 'card' ? 'Card'
    : method === 'ach' ? 'ACH'
    : method === 'check' ? 'Check'
    : method === 'connect' ? 'Stripe Connect'
    : method
  return last4 ? `${m} ••${last4}` : m
}

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.unpaid
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', background: s.bg, color: s.fg, fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

function Tag({ children, fg = '#4e6087', bg = '#eef2f9' }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '5px', background: bg, color: fg, fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export default function PaymentsTable({ rows = [], emptyText = 'No payments recorded yet.' }) {
  const [filter, setFilter] = useState('All')

  if (!rows.length) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#667085', fontSize: '13.5px', background: '#f8fafd', border: '1px dashed #dde5f2', borderRadius: '12px' }}>
        {emptyText}
      </div>
    )
  }

  // Distinct categories present, in preferred order, with counts.
  const counts = {}
  for (const r of rows) { const c = r.category || 'Other'; counts[c] = (counts[c] || 0) + 1 }
  const cats = Object.keys(counts).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
  // Display order: decision-pending ("Awaiting decision") rows float to the top —
  // they're future/actionable — then everything else newest-first (undated last).
  const ordered = [...rows].sort((a, b) => {
    const aw = (a.status === 'awaiting' ? 1 : 0), bw = (b.status === 'awaiting' ? 1 : 0)
    if (aw !== bw) return bw - aw
    const ta = a.date ? Date.parse(a.date) : -Infinity
    const tb = b.date ? Date.parse(b.date) : -Infinity
    return (isNaN(tb) ? -Infinity : tb) - (isNaN(ta) ? -Infinity : ta)
  })
  const shown = filter === 'All' ? ordered : ordered.filter(r => (r.category || 'Other') === filter)

  const chipStyle = (active) => ({ padding: '5px 13px', background: active ? '#125ecc' : '#eef2f9', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : '#4e6087', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' })
  const chipCount = (active) => ({ marginLeft: '5px', opacity: active ? 0.85 : 0.6, fontWeight: 700 })

  const th = { textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7a89a8', borderBottom: '1px solid #e3eaf5', whiteSpace: 'nowrap' }
  const td = { padding: '12px', fontSize: '13px', color: '#16264a', borderBottom: '1px solid #eef2f7', verticalAlign: 'top' }

  return (
    <div>
      {cats.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          <button style={chipStyle(filter === 'All')} onClick={() => setFilter('All')}>
            All<span style={chipCount(filter === 'All')}>{rows.length}</span>
          </button>
          {cats.map(c => (
            <button key={c} style={chipStyle(filter === c)} onClick={() => setFilter(c)}>
              {c}<span style={chipCount(filter === c)}>{counts[c]}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
          <thead>
            <tr>
              <th style={th}>Date</th>
              <th style={th}>Description</th>
              <th style={th}>Method</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const onBehalf = !!r.onBehalfByMember
              const tg = rowTag(r)
              return (
                <tr key={r.key} style={onBehalf ? { background: '#fffaf2' } : undefined}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#4e6087' }}>{fmtDate(r.date)}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {tg && <Tag fg={tg.fg} bg={tg.bg}>{tg.text}</Tag>}
                      <span style={{ fontWeight: 600 }}>{r.label}</span>
                    </div>
                    {r.detail && <div style={{ fontSize: '12px', color: '#667085', marginTop: '3px' }}>{r.detail}</div>}
                    {onBehalf && <div style={{ marginTop: '5px' }}><Tag fg="#8a5200" bg="#fcefd6">Paid by {r.onBehalfByMember} — not the client’s own payment</Tag></div>}
                    {r.onBehalfForClient && <div style={{ marginTop: '5px' }}><Tag fg="#1d4ed8" bg="#e6eefe">On behalf of {r.onBehalfForClient}</Tag></div>}
                    {(r.invoiceNumber || r.receiptNumber) && (
                      <div style={{ fontSize: '11px', color: '#94a3bd', marginTop: '5px', fontFamily: 'ui-monospace, monospace' }}>
                        {[r.invoiceNumber, r.receiptNumber].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: '#4e6087' }}>{fmtMethod(r.method, r.last4)}</td>
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: r.amount < 0 ? '#b42318' : '#16264a' }}>{fmtMoney(r.amount)}</td>
                  <td style={td}><StatusPill status={r.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
