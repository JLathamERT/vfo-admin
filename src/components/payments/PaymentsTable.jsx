import { useState, Fragment } from 'react'

// Shared read-only renderer for the per-person Payments tabs (client / member /
// specialist). Takes a list of normalized rows from the *_payments_load actions,
// shows a unified chronological list, and offers "type" filter chips derived from
// the rows' category. No edit/upload/delete affordances — view only.

const STATUS = {
  paid:       { label: 'Paid',              fg: '#1a7f5a', bg: '#e7f5ee' },
  processing: { label: 'Processing',        fg: '#9a6700', bg: '#fdf3d8' },
  failed:     { label: 'Failed',            fg: '#b42318', bg: '#fdecea' },
  refunded:   { label: 'Refunded',          fg: '#475467', bg: 'var(--vfo-tint)' },
  scheduled:  { label: 'Scheduled',         fg: '#1570ef', bg: '#e3effd' },
  awaiting:   { label: 'Awaiting decision', fg: '#7839ee', bg: '#f0e9fe' },
  unpaid:     { label: 'Not paid',          fg: 'var(--vfo-faint)', bg: '#f2f4f7' },
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
const HOLISTIC_TAG = { text: 'HOLISTIC', fg: '#1d4ed8', bg: 'var(--vfo-tint)' }
const TAXPLANNING_TAG = { text: 'TAX PLANNING', fg: '#0e7490', bg: '#cffafe' }
const TAX_TAG = { text: 'TAX', fg: '#854d0e', bg: '#fdf0d9' }   // tax payout, program not on the transfer
function rowTag(r) {
  if (r.pipeline === 'MAP 1' || r.pipeline === 'PIP') return HOLISTIC_TAG
  if (r.pipeline === 'Tax') return /^Tax Planning/.test(r.label || '') ? TAXPLANNING_TAG : HOLISTIC_TAG
  if (r.pipeline === 'Tax-Payout') return TAX_TAG
  const t = PIPELINE_TAG[r.pipeline]
  return t ? { text: t, fg: 'var(--vfo-muted)', bg: 'var(--vfo-tint)' } : null
}

// Person-type tag colours for the global (admin) Payments page — shown in the Person
// column + the "Who" filter chips. Absent on the per-person tabs (rows carry no person).
const PTYPE_TAG = {
  Client:     { fg: '#1d4ed8', bg: 'var(--vfo-tint)' },
  Member:     { fg: '#7839ee', bg: '#f0e9fe' },
  Specialist: { fg: '#0e7490', bg: '#cffafe' },
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

function StatusPill({ status, count }) {
  const s = STATUS[status] || STATUS.unpaid
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', background: s.bg, color: s.fg, fontSize: '11.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
      {s.label}{count > 1 ? ` ×${count}` : ''}
    </span>
  )
}

// Rows that fold into one expandable parent: MAP 1 quarterly installments
// (keys map1-<id>-p<n>) and a tax plan's retainer/implementation/refunds
// (keys tax-<id>-<kind>). Returns the shared parent key, or null for standalone
// rows (pay-in-full MAP 1, PIP, onboarding fee, background check, rev-share payout).
function groupKeyOf(r) {
  const k = r.key || ''
  let m = /^(map1-\d+)-p\d+$/.exec(k); if (m) return m[1]
  m = /^(tax-\d+)-[a-z]+$/.exec(k); if (m) return m[1]
  return null
}

function Tag({ children, fg = 'var(--vfo-muted)', bg = 'var(--vfo-tint)' }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: '5px', background: bg, color: fg, fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

export default function PaymentsTable({ rows = [], emptyText = 'No payments recorded yet.', buckets = null }) {
  const [filter, setFilter] = useState('All')   // payment-type (category) filter
  const [ptype, setPtype] = useState('All')      // person-type filter (global admin page only)
  const [bucketKey, setBucketKey] = useState(buckets ? buckets[0].key : null)  // 2-way money-in/out filter (global page)
  const [expanded, setExpanded] = useState({})   // group key -> true once its installments are shown

  if (!rows.length) {
    return (
      <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--vfo-faint)', fontSize: '13.5px', background: '#f8fafd', border: '1px dashed var(--vfo-border-chip)', borderRadius: '12px' }}>
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
  // Person dimension (present only on the global admin page — rows carry person/personType).
  const hasPerson = rows.some(r => r.person)
  const ptypeCounts = {}
  if (hasPerson) for (const r of rows) { const t = r.personType || 'Other'; ptypeCounts[t] = (ptypeCounts[t] || 0) + 1 }
  const ptypes = ['Client', 'Member', 'Specialist'].filter(t => ptypeCounts[t])

  // When `buckets` is supplied (global admin page), a single 2-way filter — Payments
  // received vs. Revenue share payouts — replaces the per-person category/Who chips.
  const bucketCounts = {}
  if (buckets) for (const b of buckets) bucketCounts[b.key] = ordered.filter(b.match).length
  const activeBucket = buckets ? (buckets.find(b => b.key === bucketKey) || buckets[0]) : null

  const shown = buckets
    ? ordered.filter(activeBucket.match)
    : ordered
        .filter(r => filter === 'All' || (r.category || 'Other') === filter)
        .filter(r => ptype === 'All' || (r.personType || 'Other') === ptype)

  // Fold multi-payment engagements (quarterly MAP 1; tax retainer/implementation) into
  // one expandable parent so scheduled installments don't clutter the list. Each group
  // holds its place at the position of its first (newest) row; singles stay inline.
  const entries = []
  const gmap = new Map()
  for (const r of shown) {
    const gk = groupKeyOf(r)
    if (!gk) { entries.push({ single: r }); continue }
    let g = gmap.get(gk)
    if (!g) { g = { key: gk, rows: [] }; gmap.set(gk, g); entries.push(g) }
    g.rows.push(r)
  }

  const chipStyle = (active) => ({ padding: '5px 13px', background: active ? '#125ecc' : 'var(--vfo-tint)', border: 'none', borderRadius: '999px', boxShadow: active ? '0 2px 8px rgba(18,94,204,0.28)' : 'none', color: active ? '#ffffff' : 'var(--vfo-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' })
  const chipCount = (active) => ({ marginLeft: '5px', opacity: active ? 0.85 : 0.6, fontWeight: 700 })

  const th = { textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7a89a8', borderBottom: '1px solid var(--vfo-border)', whiteSpace: 'nowrap' }
  const td = { padding: '12px', fontSize: '13px', color: 'var(--vfo-ink)', borderBottom: '1px solid var(--vfo-border-soft)', verticalAlign: 'top' }

  // One data row. Used for standalone rows AND, with child=true, the installment rows
  // tucked under an expanded group parent (indented + lighter, no repeated person/tag).
  function renderRow(r, child) {
    const onBehalf = !!r.onBehalfByMember
    const tg = rowTag(r)
    return (
      <tr key={r.key} style={{ ...(onBehalf ? { background: '#fffaf2' } : null), ...(child ? { background: '#fbfcfe' } : null) }}>
        <td style={td} />
        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--vfo-muted)', ...(child ? { paddingLeft: '14px' } : null) }}>{fmtDate(r.date)}</td>
        {hasPerson && (
          <td style={{ ...td, whiteSpace: 'nowrap' }}>
            {!child && <div style={{ fontWeight: 600 }}>{r.person}</div>}
            {!child && r.personType && PTYPE_TAG[r.personType] && (
              <div style={{ marginTop: '3px' }}><Tag fg={PTYPE_TAG[r.personType].fg} bg={PTYPE_TAG[r.personType].bg}>{r.personType}</Tag></div>
            )}
          </td>
        )}
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!child && tg && <Tag fg={tg.fg} bg={tg.bg}>{tg.text}</Tag>}
            <span style={{ fontWeight: child ? 500 : 600, color: child ? '#475467' : 'var(--vfo-ink)' }}>{r.label}</span>
          </div>
          {r.detail && <div style={{ fontSize: '12px', color: 'var(--vfo-faint)', marginTop: '3px' }}>{r.detail}</div>}
          {onBehalf && <div style={{ marginTop: '5px' }}><Tag fg="#8a5200" bg="#fcefd6">Paid by {r.onBehalfByMember} — not the client’s own payment</Tag></div>}
          {r.onBehalfForClient && <div style={{ marginTop: '5px' }}><Tag fg="#1d4ed8" bg="var(--vfo-tint)">On behalf of {r.onBehalfForClient}</Tag></div>}
          {(r.invoiceNumber || r.receiptNumber) && (
            <div style={{ fontSize: '11px', color: 'var(--vfo-placeholder)', marginTop: '5px', fontFamily: 'ui-monospace, monospace' }}>
              {[r.invoiceNumber, r.receiptNumber].filter(Boolean).join('  ·  ')}
            </div>
          )}
        </td>
        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--vfo-muted)' }}>{fmtMethod(r.method, r.last4)}</td>
        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 700, color: r.amount < 0 ? '#b42318' : 'var(--vfo-ink)' }}>{fmtMoney((r.amount || 0) - (r.fee || 0))}</div>
          {r.fee > 0 && <div style={{ fontSize: '11px', color: 'var(--vfo-placeholder)', marginTop: '2px', fontWeight: 500 }}>+ {fmtMoney(r.fee)} fee</div>}
        </td>
        <td style={td}><StatusPill status={r.status} /></td>
      </tr>
    )
  }

  // Collapsed parent for a multi-row engagement: engagement label, total, and a status
  // tally (e.g. "Paid ×1 · Scheduled ×3"). Click toggles the installment rows.
  function renderGroup(g) {
    const kids = [...g.rows].sort((a, b) => {
      const ta = a.date ? Date.parse(a.date) : Infinity
      const tb = b.date ? Date.parse(b.date) : Infinity
      return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb)
    })
    const first = kids[0]
    // Overview method = the CURRENT method (what future charges use) = the latest
    // installment's, not the oldest's — installment 1 keeps its frozen original
    // method, so kids[0] would mislead after a payment-method change.
    const latest = kids[kids.length - 1]
    const tg = rowTag(first)
    const total = kids.reduce((s, k) => s + (k.amount || 0), 0)
    const feeTotal = kids.reduce((s, k) => s + (k.fee || 0), 0)
    const labels = kids.map(k => k.label)
    const groupLabel = labels.every(l => l === labels[0]) ? labels[0] : (first.category || labels[0])
    const noun = g.key.startsWith('map1') ? 'payments' : 'charges'
    const startDate = (kids.find(k => k.date) || {}).date || null
    const order = ['awaiting', 'scheduled', 'processing', 'paid', 'refunded', 'failed', 'unpaid']
    const tally = {}
    for (const k of kids) tally[k.status] = (tally[k.status] || 0) + 1
    const open = !!expanded[g.key]
    return (
      <Fragment key={g.key}>
        <tr onClick={() => setExpanded(p => ({ ...p, [g.key]: !p[g.key] }))} style={{ cursor: 'pointer', background: open ? 'var(--vfo-page)' : 'var(--vfo-card)' }}>
          <td style={{ ...td, padding: '12px 4px', textAlign: 'center', color: 'var(--vfo-muted)' }}>
            <span style={{ fontSize: '18px', lineHeight: 1, fontWeight: 700 }}>{open ? '▾' : '▸'}</span>
          </td>
          <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--vfo-muted)' }}>{fmtDate(startDate)}</td>
          {hasPerson && (
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <div style={{ fontWeight: 600 }}>{first.person}</div>
              {first.personType && PTYPE_TAG[first.personType] && (
                <div style={{ marginTop: '3px' }}><Tag fg={PTYPE_TAG[first.personType].fg} bg={PTYPE_TAG[first.personType].bg}>{first.personType}</Tag></div>
              )}
            </td>
          )}
          <td style={td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {tg && <Tag fg={tg.fg} bg={tg.bg}>{tg.text}</Tag>}
              <span style={{ fontWeight: 700 }}>{groupLabel}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--vfo-faint)', marginTop: '3px' }}>
              {kids.length} {noun}
            </div>
          </td>
          <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--vfo-muted)' }}>{fmtMethod(latest.method, latest.last4)}</td>
          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 700, color: total < 0 ? '#b42318' : 'var(--vfo-ink)' }}>{fmtMoney(total - feeTotal)}</div>
            {feeTotal > 0 && <div style={{ fontSize: '11px', color: 'var(--vfo-placeholder)', marginTop: '2px', fontWeight: 500 }}>+ {fmtMoney(feeTotal)} fee</div>}
          </td>
          <td style={td}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {order.filter(s => tally[s]).map(s => <StatusPill key={s} status={s} count={tally[s]} />)}
            </div>
          </td>
        </tr>
        {open && kids.map(k => renderRow(k, true))}
      </Fragment>
    )
  }

  return (
    <div>
      {buckets ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {buckets.map(b => (
            <button key={b.key} style={chipStyle(activeBucket.key === b.key)} onClick={() => setBucketKey(b.key)}>
              {b.label}<span style={chipCount(activeBucket.key === b.key)}>{bucketCounts[b.key]}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {hasPerson && ptypes.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#7a89a8', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '2px' }}>Who</span>
              <button style={chipStyle(ptype === 'All')} onClick={() => setPtype('All')}>
                All<span style={chipCount(ptype === 'All')}>{rows.length}</span>
              </button>
              {ptypes.map(t => (
                <button key={t} style={chipStyle(ptype === t)} onClick={() => setPtype(t)}>
                  {t}<span style={chipCount(ptype === t)}>{ptypeCounts[t]}</span>
                </button>
              ))}
            </div>
          )}

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
        </>
      )}

      <div style={{ overflowX: 'auto' }}>
        {/* Fixed column widths so the layout is identical across filters/tabs (and the
            expanded child rows) — otherwise auto-sizing shifts the headings per content. */}
        <table style={{ width: '100%', minWidth: hasPerson ? '920px' : '680px', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: 'Inter, sans-serif' }}>
          <colgroup>
            <col style={{ width: '38px' }} />
            <col style={{ width: '120px' }} />
            {hasPerson && <col style={{ width: '150px' }} />}
            <col />
            <col style={{ width: '135px' }} />
            <col style={{ width: '120px' }} />
            <col style={{ width: '150px' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={th} />
              <th style={th}>Date</th>
              {hasPerson && <th style={th}>Person</th>}
              <th style={th}>Description</th>
              <th style={th}>Method</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => e.single
              ? renderRow(e.single, false)
              : (e.rows.length === 1 ? renderRow(e.rows[0], false) : renderGroup(e)))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
