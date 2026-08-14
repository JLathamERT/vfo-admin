// Single source of truth for "has this revenue-share leg actually paid out yet?" across
// the Accounting panels. Those panels print every slice of a split as a dollar figure,
// which reads as money that already moved; this turns the leg's payout column into a
// short note + tone so a slice still sitting in the VFO balance reads as pending.
//
// The status vocabulary is not invented here — it is what the payout handlers write and
// what the client-facing split cards already render:
//   - src/components/admin/tax/PricingSplitCard.jsx — legNote / noteColor, and the
//     'Awaiting Planner Allocation' + 'Awaiting Connect Setup' non-terminal pair
//   - src/components/admin/map1/Map1PricingSplitCard.jsx — adds the migrated
//     'settled on old system' reading of a legacy row's no-share-due leg
//   - edge utils/tax-planner-payout.ts (PLANNER_SHARE_WITHHELD),
//     utils/member-share-held.ts (AWAITING_CONNECT), actions/tax/revshare.ts and
//     actions/msm/pip-revshare.ts ('Yes' / 'Money Mapping' / 'N/A — No Share Due' /
//     'Failed' / 'Pending')
// Annotation only: no amount, filter or total is derived from any of this.

import { money as defaultMoney } from './specialistRevenueShared'

export const PENDING_COLOR = '#b9451d'
const PAID_COLOR = '#1b9254'
const MUTED = 'var(--vfo-muted)'

const TERMINAL = ['Yes', 'Money Mapping', 'N/A — No Share Due', 'N/A']

export function isTerminalLeg(status) {
  return TERMINAL.includes(status)
}

export function legState(status, { revShare, paymentStatus, context } = {}) {
  if (status === 'Yes') return { note: 'paid', tone: 'done' }
  // Credited as growth credits rather than transferred — it HAS happened.
  if (status === 'Money Mapping') return { note: 'money mapping', tone: 'done' }
  // Nothing will ever pay on this leg, so it is neither done nor pending.
  if (status === 'N/A — No Share Due' || status === 'N/A') return { note: 'no share due', tone: null }
  if (status === 'Awaiting Connect Setup') return { note: 'awaiting payout setup', tone: 'pending' }
  if (status === 'Awaiting Planner Allocation') return { note: 'awaiting planner', tone: 'pending' }
  if (status === 'Failed') return { note: 'failed — retrying', tone: 'pending' }
  if (status == null || status === '') {
    if (revShare === 'Pending') return { note: 'in progress', tone: 'pending' }
    if (paymentStatus === 'processing' || paymentStatus === 'check_pending') return { note: 'payment clearing', tone: 'pending' }
    // The tax retainer's revenue share does not fire on the charge — it fires on the
    // client's decision after the review, so a blank leg is waiting on the client.
    if (context === 'tax_retainer') return { note: 'awaiting client decision', tone: 'pending' }
    return { note: 'not yet paid', tone: 'pending' }
  }
  return { note: String(status).toLowerCase(), tone: 'pending' }
}

export function noteColor(state) {
  if (!state) return MUTED
  if (state.tone === 'pending') return PENDING_COLOR
  if (state.tone === 'done') return state.note === 'paid' ? PAID_COLOR : MUTED
  return MUTED
}

const noteStyle = { display: 'block', fontSize: '9px', lineHeight: 1.2, fontWeight: 400 }

// One split-amount grid cell: the amount in the caller's existing styling, dimmed unless
// the leg has actually settled, with the leg note underneath. A zero/absent share keeps
// whatever the caller rendered before (a dash, or a plain $0.00) and carries no note.
export function ShareCell({ value, state, money = defaultMoney, color, fontWeight, dash }) {
  const n = Number(value) || 0
  const note = n > 0 ? state?.note : null
  return (
    <span style={{ textAlign: 'right', color, fontWeight }}>
      <span style={{ opacity: note && state.tone !== 'done' ? 0.55 : 1 }}>{n > 0 || dash == null ? money(n) : dash}</span>
      {note && <span style={{ ...noteStyle, color: noteColor(state) }}>{note}</span>}
    </span>
  )
}

// "$X pending" under a totals / aggregate cell.
export function PendingNote({ amount, money = defaultMoney }) {
  if (!amount) return null
  return <span style={{ ...noteStyle, color: PENDING_COLOR }}>{money(amount)} pending</span>
}

// Muted one-liner under a cell — the Received column's in-flight payment note.
export function SubNote({ text }) {
  if (!text) return null
  return <span style={{ ...noteStyle, color: MUTED }}>{text}</span>
}

// The payment itself is still in flight, so nothing downstream of it can have paid out.
export function paymentNoteFor(status) {
  if (status === 'processing') return 'processing'
  if (status === 'check_pending') return 'check pending'
  return null
}
