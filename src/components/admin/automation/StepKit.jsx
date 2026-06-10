// Shared presentation kit for the admin automation panels (MAP 1, Tax, PIP,
// Advisor, Accountant). Each pipeline step renders as a StepCard with a
// status pill + status-colored rail, and a body of labeled sub-blocks
// (WHAT WE DID / INFO ENTERED / SENT / CLIENT REPLY) so every step makes
// clear what was triggered, what info was entered, what was sent, and how the
// client / counterparty replied. Presentation only — no behavior.

// ---- status vocabulary --------------------------------------------------
// Order matters for the rail colors; pick the status per step in the panel.
export const STATUS = {
  pending:  { label: 'Pending',         color: '#697a9c' },
  active:   { label: 'In progress',     color: '#e06717' },
  sent:     { label: 'Sent',            color: '#0d9488' },
  awaiting: { label: 'Awaiting client', color: '#0095ff' },
  done:     { label: 'Done',            color: '#1b9254' },
  declined: { label: 'Declined',        color: '#e74c3c' },
  skipped:  { label: 'Skipped',         color: '#697a9c' },
}

const DECISION_COLORS = {
  Yes: '#1b9254', Proceed: '#1b9254', Continue: '#1b9254', Confirmed: '#1b9254',
  No: '#e74c3c', Decline: '#e74c3c', Declined: '#e74c3c', Stop: '#e74c3c', Refund: '#e74c3c',
  Undecided: '#e06717', ExtraMeeting: '#0095ff',
}

// ---- formatting helpers -------------------------------------------------
export function fmtMoney(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''))
  if (isNaN(n)) return null
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtDate(v) {
  if (!v) return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  return String(v)
}

// ---- atoms --------------------------------------------------------------
export function StatusPill({ status, label }) {
  const s = STATUS[status] || STATUS.pending
  const filled = status === 'done' || status === 'declined'
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
      padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap',
      background: filled ? s.color : `${s.color}16`,
      color: filled ? '#ffffff' : s.color,
      border: filled ? '1px solid transparent' : `1px solid ${s.color}38`,
    }}>{label || s.label}</span>
  )
}

export function Badge({ text, color }) {
  if (text === null || text === undefined || text === '') return null
  const c = color || DECISION_COLORS[text] || '#4e6087'
  return (
    <span style={{
      fontSize: '11px', padding: '2px 10px', borderRadius: '4px', fontWeight: 600,
      background: `${c}15`, color: c, border: `1px solid ${c}30`,
    }}>{text}</span>
  )
}

// A single label/value row. Hidden when `hide` or (value empty AND not showEmpty).
export function Detail({ l, v, hide, showEmpty, mono }) {
  if (hide) return null
  if ((v === null || v === undefined || v === '') && !showEmpty) return null
  return (
    <div style={{ display: 'flex', padding: '2px 0', alignItems: 'baseline' }}>
      <span style={{ fontSize: '12px', color: '#697a9c', width: '180px', flexShrink: 0 }}>{l}</span>
      <span style={{
        fontSize: '12px', color: (v || v === 0) ? '#243757' : '#9aa6bf',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
        wordBreak: 'break-word',
      }}>{(v || v === 0) ? v : '—'}</span>
    </div>
  )
}

// A labeled sub-block (WHAT WE DID / INFO ENTERED / SENT / CLIENT REPLY).
// Renders nothing when it has no children.
export function SubBlock({ label, children, hide }) {
  if (hide) return null
  const kids = Array.isArray(children) ? children.filter(Boolean) : children
  if (!kids || (Array.isArray(kids) && kids.length === 0)) return null
  return (
    <div style={{ marginTop: '8px' }}>
      {label && (
        <div style={{
          fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
          color: '#7c8aa6', marginBottom: '3px',
        }}>{label}</div>
      )}
      <div style={{ paddingLeft: '2px' }}>{kids}</div>
    </div>
  )
}

// Muted "nothing yet" line for a step that hasn't been reached.
export function Pending({ text = 'Not started yet' }) {
  return <span style={{ fontSize: '12px', color: '#697a9c', fontStyle: 'italic' }}>{text}</span>
}

// ---- the step card ------------------------------------------------------
export function StepCard({ title, status = 'pending', children }) {
  const s = STATUS[status] || STATUS.pending
  return (
    <div style={{
      position: 'relative',
      background: '#ffffff',
      border: '1px solid #eef2f9',
      borderLeft: `4px solid ${s.color}`,
      borderRadius: '12px',
      padding: '13px 16px',
      marginBottom: '10px',
      boxShadow: '0 2px 8px rgba(20,45,95,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <span style={{
            width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
            background: status === 'pending' ? 'transparent' : s.color,
            border: `2px solid ${s.color}`,
          }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#16264a', letterSpacing: '0.2px' }}>{title}</span>
        </div>
        <StatusPill status={status} />
      </div>
      <div style={{ paddingLeft: '18px' }}>{children}</div>
    </div>
  )
}
