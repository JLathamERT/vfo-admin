import { useState, useEffect, useMemo, useRef } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, BLUE, money, StatusPill } from './specialistRevenueShared'
import { OnboardingListSkeleton } from '../shared/Skeleton'
import SandboxModeToggle from './SandboxModeToggle'
import StepEmailsChip from '../shared/StepEmailsChip'
import { MemberNameLink } from '../shared/personLinks'

// Accounting > Members > Advisor/Accountant Membership Fees.
//
// Billing model: the member pays their FIRST payment at the setup link; their
// ongoing charge day = the day they paid (1st-15th; paying after the 15th
// skips a month then bills on the 1st). Charges are whole dollars (round half
// up). Renewal is always a 15th — the last 15th before their 1-year mark
// (transfers keep the renewal they already had). The schedule appears once
// they pay.
//
// Three sections per category: Members (expandable reconciliation grid),
// Set Up Payments (input form incl. mid-year transfers), Outstanding.

const PLAN_STATUS = {
  setup_pending: { label: 'Awaiting first payment', color: '#0095ff' },
  active: { label: 'Active', color: '#16a34a' },
  canceled: { label: 'Canceled', color: '#6b7280' },
  terminated: { label: 'Terminated', color: '#ef4444' },
}

const SCHED_STATUS = {
  scheduled: { label: 'Scheduled', color: '#6b7280' },
  processing: { label: 'Processing', color: '#e06717' },
  paid: { label: 'Paid', color: '#16a34a' },
  missed: { label: 'Missed', color: '#ef4444' },
  declined: { label: 'Declined', color: '#ef4444' },
  waived: { label: 'Waived', color: '#6b7280' },
  canceled: { label: 'Canceled', color: '#6b7280' },
}

function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// For timestamptz values (e.g. paid_at, setup_email_sent_at): parse the full
// timestamp and render the LOCAL calendar date, so an evening-ET payment shows
// on the day it happened rather than the UTC date. Same visual format as fmtDate.
function fmtStamp(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function todayIso() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

function addMonthsIso(dateIso, months) {
  let [y, m, d] = dateIso.split('-').map(Number)
  m += months
  while (m > 12) { m -= 12; y++ }
  while (m < 1) { m += 12; y-- }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addYearsIso(dateStr, years) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dim = new Date(y + years, m, 0).getDate()
  return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`
}

// Recurring charge dates after an immediate first payment on payDate: same day
// monthly when paid 1st-15th; paid after the 15th skips a month then the 1st.
function chargeDatesAfter(payDateIso, untilExclusive, max = 11) {
  const payDay = Number(payDateIso.slice(8, 10))
  const day = payDay <= 15 ? payDay : 1
  const startOffset = payDay <= 15 ? 1 : 2
  const anchor = payDateIso.slice(0, 8) + String(day).padStart(2, '0')
  const dates = []
  for (let i = 0; i < 24; i++) {
    const d = addMonthsIso(anchor, startOffset + i)
    if (untilExclusive && d >= untilExclusive) break
    dates.push(d)
    if (dates.length >= max) break
  }
  return dates
}

// Renewal = last 15th strictly before payDate + 12 months.
function renewalPreview(payDateIso) {
  const plus = addMonthsIso(payDateIso.slice(0, 8) + Math.min(Number(payDateIso.slice(8, 10)), 15), 12)
  if (Number(payDateIso.slice(8, 10)) > 15) return plus.slice(0, 8) + '15'
  return addMonthsIso(plus.slice(0, 8) + '15', -1)
}

function parseMoney(v) {
  const n = parseFloat(String(v ?? '').replace(/[,$]/g, ''))
  return Number.isFinite(n) ? n : 0
}

// Whole dollars, .50 rounds up.
function roundDollar(n) {
  return Math.round(n)
}

function monthsDiff(fromIso, toIso) {
  const [fy, fm] = fromIso.split('-').map(Number)
  const [ty, tm] = toIso.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

function fmtMonthYear(dateIso) {
  const [y, m] = dateIso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Bucket schedule rows into 12-month membership years anchored on the earliest
// due date, so the grid shows one year at a time once renewals accumulate.
function bucketByYear(schedule) {
  if (!schedule.length) return []
  const firstDue = schedule[0].due_date
  const buckets = []
  for (const row of schedule) {
    const idx = Math.max(0, Math.floor(monthsDiff(firstDue, row.due_date) / 12))
    if (!buckets[idx]) {
      const winStart = addMonthsIso(firstDue, idx * 12)
      buckets[idx] = { label: `${fmtMonthYear(winStart)} – ${fmtMonthYear(addMonthsIso(winStart, 11))}`, rows: [] }
    }
    buckets[idx].rows.push(row)
  }
  return buckets.filter(Boolean)
}

// Self-contained searchable single-select (same pattern as SpecialistPaymentInput).
function SearchSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = options.find(o => o.key === value)
  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', color: selected ? 'var(--vfo-ink)' : 'var(--vfo-faint)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.label : (placeholder || 'Select…')}</span>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border)', borderRadius: '10px', zIndex: 50, boxShadow: '0 14px 36px rgba(20,45,95,0.16)', overflow: 'hidden' }}>
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--vfo-tint)', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', background: 'var(--vfo-card)', color: 'var(--vfo-ink)' }} />
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: '12px', fontSize: '12px', color: 'var(--vfo-faint)' }}>No matches</div>}
            {filtered.map(o => (
              <button key={o.key} type="button" onClick={() => { onChange(o.key); setOpen(false); setQuery('') }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none', background: o.key === value ? 'var(--vfo-tint)' : 'transparent', color: 'var(--vfo-ink)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
                onMouseLeave={e => e.currentTarget.style.background = o.key === value ? 'var(--vfo-tint)' : 'transparent'}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const label = { fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)', marginBottom: '5px' }
const input = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', color: 'var(--vfo-ink)', fontFamily: 'Inter, sans-serif', outline: 'none' }
const card = { background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', boxShadow: 'var(--vfo-shadow-card)' }
const primaryBtn = (busy) => ({ padding: '8px 16px', borderRadius: '8px', border: 'none', background: busy ? '#c7d2e4' : `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 100%)`, color: '#fff', fontWeight: 700, fontSize: '13px', cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' })
const ghostBtn = { padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', color: 'var(--vfo-ink-2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
const dangerBtn = { padding: '8px 16px', borderRadius: '8px', border: '1px solid #f3c0c0', background: 'var(--vfo-card)', color: '#b91c1c', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export default function MembershipFeesPanel({ title, category, allMembers = [] }) {
  const [section, setSection] = useState('members')
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editPlan, setEditPlan] = useState(null)
  const [sandboxConfig, setSandboxConfig] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => { load() }, [category])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('membership_plans_load', { category })
      if (res?.error) { setError(res.error); return }
      setPlans(res.plans || [])
      setSandboxConfig(res.sandbox_config || null)
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(plan) {
    setEditPlan(plan)
    setSection('setup')
  }

  const pills = [
    { key: 'members', label: 'Members' },
    { key: 'setup', label: 'Set Up Payments' },
    { key: 'outstanding', label: 'Outstanding' },
    { key: 'outstanding_links', label: 'Outstanding Payment Links' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1050px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · Members</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>{title}</h2>
          <SandboxModeToggle pipeline="MEMBER_MEMBERSHIP" label="Membership Fees" sandboxConfig={sandboxConfig} onChange={setSandboxConfig}
            note="Membership setup links + monthly pulls follow this toggle. Both Advisor and Accountant panels share the one MEMBER_MEMBERSHIP row." />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {pills.map(p => (
          <button key={p.key} type="button" onClick={() => { setSection(p.key); setNotice(null); if (p.key !== 'setup') setEditPlan(null) }}
            style={{ padding: '8px 16px', borderRadius: '99px', border: '1px solid ' + (section === p.key ? 'transparent' : 'var(--vfo-border-strong)'), background: section === p.key ? `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 100%)` : 'var(--vfo-card)', color: section === p.key ? '#fff' : 'var(--vfo-ink-2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {p.label}
          </button>
        ))}
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '12.5px', padding: '8px 12px', borderRadius: '8px', marginBottom: '14px', wordBreak: 'break-all',
          color: notice.tone === 'success' ? '#166534' : notice.tone === 'amber' ? '#b45309' : '#b91c1c',
          border: `1px solid ${notice.tone === 'success' ? '#bbf7d0' : notice.tone === 'amber' ? '#fde68a' : '#fecaca'}`,
          background: notice.tone === 'success' ? '#f0fdf4' : notice.tone === 'amber' ? '#fffbeb' : '#fef2f2' }}>
          <span style={{ flex: 1, minWidth: 0 }}>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}
            style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, fontSize: '12.5px', fontWeight: 700, color: 'inherit', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Dismiss</button>
        </div>
      )}

      {loading && <OnboardingListSkeleton rows={3} />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}

      {!loading && !error && section === 'members' && (
        <MembersSection plans={plans} onChanged={load} onEdit={startEdit} />
      )}
      {!loading && !error && section === 'setup' && (
        <SetupSection key={editPlan?.id || 'new'} category={category} allMembers={allMembers} plans={plans} editPlan={editPlan}
          onSaved={(n) => { setEditPlan(null); setSection('members'); load(); setNotice(n || null) }} />
      )}
      {!loading && !error && section === 'outstanding' && (
        <OutstandingSection plans={plans} />
      )}
      {!loading && !error && section === 'outstanding_links' && (
        <OutstandingLinksSection plans={plans} onChanged={load} onEdit={startEdit} />
      )}
    </div>
  )
}

// ── Members: the reconciliation list ──────────────────────────────────────────

function MembersSection({ plans, onChanged, onEdit }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = plans.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return (p.member_name || '').toLowerCase().includes(q) || (p.member_number || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or member number…"
          style={{ ...input, width: '260px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...input, width: '210px' }}>
          <option value="all">All statuses</option>
          <option value="setup_pending">Awaiting first payment</option>
          <option value="active">Active</option>
          <option value="canceled">Canceled</option>
          <option value="terminated">Terminated</option>
        </select>
        <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>{filtered.length} plan{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>
          No membership plans yet — create one under Set Up Payments.
        </div>
      )}
      {filtered.map(p => <PlanCard key={p.id} plan={p} onChanged={onChanged} onEdit={onEdit} />)}
    </div>
  )
}

function PlanCard({ plan, onChanged, onEdit }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showTerminate, setShowTerminate] = useState(false)
  const [terminateFee, setTerminateFee] = useState('')
  const [showNextYear, setShowNextYear] = useState(false)
  const [nyAmount, setNyAmount] = useState(plan.next_year_amount ? String(plan.next_year_amount) : '')
  const [nyCredit, setNyCredit] = useState(plan.next_year_credit_note ? String(plan.next_year_credit_note) : '')
  const meta = PLAN_STATUS[plan.status] || { label: plan.status, color: 'var(--vfo-muted)' }
  const allSched = plan.schedule || []
  const years = useMemo(() => bucketByYear(allSched), [allSched])
  const [yearIdx, setYearIdx] = useState(-1) // -1 = latest (current) year
  const activeYear = years.length ? years[yearIdx === -1 ? years.length - 1 : yearIdx] : null
  const sched = activeYear ? activeYear.rows : []
  const currentRows = years.length ? years[years.length - 1].rows : []
  const payable = currentRows.filter(r => Number(r.amount_due) > 0)
  const paidCount = payable.filter(r => r.status === 'paid').length
  const missedCount = currentRows.filter(r => r.status === 'missed' || r.status === 'declined').length
  const perPull = Number(plan.per_pull_amount) || 0
  const m = plan.member || {}
  const closed = plan.status === 'canceled' || plan.status === 'terminated'

  // Known-value substitutions for the email previews (see StepEmailsChip).
  // Mirrors the setup-link handler exactly: [Amount] uses the annual value for
  // annual transfers (else per-pull), [Cadence] = per month/year, [Renewal Date]
  // = long-month UTC. Empty/unverifiable values are omitted (tokens stay chips).
  const emailCtx = (() => {
    const ctx = {}
    const first = ((m.first_name || '') || String(plan.member_name || '').split(' ')[0] || '').trim()
    if (first) ctx['First Name'] = first
    const saveOnly = Number(plan.per_pull_amount) <= 0 || (plan.transfer && plan.frequency === 'annual')
    const amt = saveOnly && plan.frequency === 'annual' ? Number(plan.annual_amount) : Number(plan.per_pull_amount || 0)
    if (Number.isFinite(amt) && amt > 0) ctx['Amount'] = `$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    if (plan.frequency === 'monthly' || plan.frequency === 'annual') ctx['Cadence'] = plan.frequency === 'monthly' ? 'per month' : 'per year'
    if (plan.renewal_date) {
      const [ry, rm, rd] = String(plan.renewal_date).slice(0, 10).split('-').map(Number)
      if (ry && rm && rd) ctx['Renewal Date'] = new Date(Date.UTC(ry, rm - 1, rd)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    }
    return ctx
  })()

  async function run(action, payload, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return null
    setBusy(true); setMsg(null)
    try {
      const res = await callApi(action, payload)
      if (res?.ok) return res
      setMsg({ tone: 'error', text: res?.error || 'Action failed.' })
      return null
    } catch (e) {
      setMsg({ tone: 'error', text: e?.message || 'Action failed.' })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function sendLink() {
    const res = await run('membership_send_setup_link', { plan_id: plan.id })
    if (!res) return
    if (res.email_skipped) setMsg({ tone: 'amber', text: `Link ready, but the email template isn't seeded yet — send it manually: ${res.setup_link}` })
    else setMsg({ tone: 'success', text: `Setup email drafted for ${res.to_email}.` })
    onChanged?.()
  }

  // Active plans: same action, but the backend sends an update-payment-method
  // email and returns { update_link: true }. Amber (template not seeded) shape
  // is handled the same way as the setup path.
  async function sendUpdateLink() {
    const res = await run('membership_send_setup_link', { plan_id: plan.id })
    if (!res) return
    if (res.email_skipped) setMsg({ tone: 'amber', text: `Link ready, but the email template isn't seeded yet — send it manually: ${res.setup_link}` })
    else setMsg({ tone: 'success', text: `Update-method email created for ${res.to_email}.` })
    onChanged?.()
  }

  async function terminate() {
    const fee = parseMoney(terminateFee)
    const res = await run('membership_terminate', { plan_id: plan.id, termination_fee: fee },
      fee > 0
        ? `Terminate ${plan.member_name}'s membership and charge a ${money(roundDollar(fee))} termination fee to their ${plan.payment_method_type === 'ach' ? 'bank account' : 'card'} on file right now?`
        : `Terminate ${plan.member_name}'s membership with no termination fee? Remaining scheduled payments are voided.`)
    if (!res) return
    if (res.fee_status === 'declined') setMsg({ tone: 'amber', text: `Plan terminated, but the fee charge FAILED: ${res.fee_error || 'declined'}. The declined fee row stays in the grid for follow-up.` })
    setShowTerminate(false)
    onChanged?.()
  }

  async function saveNextYear(clear) {
    const res = await run('membership_next_year_save', clear
      ? { plan_id: plan.id, clear: true }
      : { plan_id: plan.id, next_year_amount: parseMoney(nyAmount), next_year_credit_note: parseMoney(nyCredit) })
    if (!res) return
    setShowNextYear(false)
    onChanged?.()
  }

  const grid = '1.2fr 110px 110px 110px 110px 1.4fr'

  return (
    <div style={{ ...card, marginBottom: '10px', overflow: 'hidden', opacity: closed ? 0.7 : 1 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}>
        <span style={{ fontSize: '11px', color: 'var(--vfo-faint)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <MemberNameLink memberNumber={plan.member_number}>{plan.member_name || plan.member_number}</MemberNameLink>
            {plan.transfer && <StatusPill label="Transferred" color="#6b7280" />}
            {(m.suspended || m.membership_suspended) && <StatusPill label="Suspended" color="#ef4444" />}
            {m.paused && <StatusPill label="Paused" color="#e06717" />}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>
            {plan.member_number} · {plan.advisor_model || 'Model —'} · {m.member_type || '—'}
            {' · '}{plan.frequency === 'monthly'
              ? `Monthly (${money(perPull)}/mo${plan.charge_day ? ` on the ${ordinal(plan.charge_day)}` : ''})`
              : `Annual (${money(perPull)}/yr)`}
            {Number(plan.credit_note) > 0 ? ` · Credit note ${money(plan.credit_note)}` : ''}
            {plan.payment_method_type ? ` · ${plan.payment_method_type === 'ach' ? 'ACH' : 'Card'}${plan.acct_last4 ? ` ••${plan.acct_last4}` : ''}` : ''}
            {plan.next_year_amount ? ` · Next year ${money(plan.next_year_amount)}${Number(plan.next_year_credit_note) > 0 ? ` − ${money(plan.next_year_credit_note)} credit` : ''}` : ''}
            {!plan.auto_renew && !closed ? ' · Auto-renew OFF' : ''}
            {plan.status === 'terminated' && Number(plan.termination_fee) > 0 ? ` · Termination fee ${money(plan.termination_fee)}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-heading)' }}>{money(plan.net_annual)}</div>
          <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>net / year</div>
        </div>
        <div style={{ textAlign: 'right', width: '110px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vfo-ink-2)' }}>{plan.status === 'setup_pending' ? '—' : fmtDate(plan.renewal_date)}</div>
          <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>renewal</div>
        </div>
        <div style={{ textAlign: 'right', width: '80px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: missedCount ? '#ef4444' : 'var(--vfo-ink-2)' }}>
            {payable.length ? `${paidCount}/${payable.length}` : '—'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>paid</div>
        </div>
        <div style={{ width: '170px', textAlign: 'right' }}>
          <StatusPill label={meta.label} color={meta.color} />
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--vfo-input)', borderTop: '1px solid var(--vfo-border-soft)', padding: '14px 18px' }}>
          {plan.status === 'setup_pending' ? (
            <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', padding: '4px 0 10px' }}>
              Awaiting their first payment — the month-by-month schedule appears once they pay at the setup link.
              Their charge day and renewal date are locked in from the day they pay.
            </div>
          ) : (
            <>
              {years.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>Membership year</span>
                  <select value={yearIdx === -1 ? years.length - 1 : yearIdx} onChange={e => setYearIdx(Number(e.target.value))}
                    onClick={e => e.stopPropagation()}
                    style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '12.5px', color: 'var(--vfo-ink)', fontFamily: 'Inter, sans-serif' }}>
                    {years.map((yr, i) => (
                      <option key={yr.label} value={i}>{yr.label}{i === years.length - 1 ? ' (current)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', padding: '0 0 8px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>
                <div>Period</div><div>Due date</div><div>Amount</div><div>Credit</div><div>Status</div><div style={{ textAlign: 'right' }}>Payment</div>
              </div>
              {sched.map(row => {
                const sMeta = SCHED_STATUS[row.status] || { label: row.status, color: 'var(--vfo-muted)' }
                const zero = Number(row.amount_due) === 0
                const rowBg = row.status === 'paid' ? 'rgba(22,163,74,0.07)'
                  : (row.status === 'missed' || row.status === 'declined') ? 'rgba(239,68,68,0.07)' : 'transparent'
                return (
                  <div key={row.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', alignItems: 'center', padding: '9px 6px', margin: '0 -6px', borderTop: '1px solid var(--vfo-tint)', fontSize: '13px', color: 'var(--vfo-ink-2)', background: rowBg, borderRadius: '6px' }}>
                    <div style={{ fontWeight: 600 }}>{row.period_label}</div>
                    <div>{fmtDate(row.due_date)}</div>
                    <div style={{ fontWeight: 600, color: zero ? 'var(--vfo-faint)' : 'var(--vfo-ink)' }}>{money(row.amount_due)}</div>
                    <div style={{ color: 'var(--vfo-faint)' }}>{Number(row.credit_applied) > 0 ? money(row.credit_applied) : '—'}</div>
                    <div><StatusPill label={zero && row.status === 'scheduled' ? 'Covered by credit' : sMeta.label} color={zero && row.status === 'scheduled' ? '#6b7280' : sMeta.color} /></div>
                    <div style={{ textAlign: 'right', fontSize: '11.5px', color: 'var(--vfo-muted)', wordBreak: 'break-all' }}>
                      {row.status === 'paid' || row.status === 'processing' ? (
                        <>
                          {row.paid_at ? `${fmtStamp(row.paid_at)} · ` : ''}
                          {row.payment_method_type ? `${row.payment_method_type}${row.acct_last4 ? ` ••${row.acct_last4}` : ''} · ` : ''}
                          {row.stripe_payment_intent_id || ''}
                        </>
                      ) : (row.failure_reason || '—')}
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '10px', alignItems: 'center', padding: '10px 6px 2px', borderTop: '2px solid var(--vfo-border)', marginTop: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--vfo-heading)' }}>
                <div>Totals</div>
                <div />
                <div>{money(sched.reduce((s, r) => s + Number(r.amount_due || 0), 0))}</div>
                <div>{money(sched.reduce((s, r) => s + Number(r.credit_applied || 0), 0))}</div>
                <div style={{ color: '#16a34a' }}>{money(sched.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount_due || 0), 0))} paid</div>
                <div />
              </div>
            </>
          )}

          {!closed && (
            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {plan.status === 'setup_pending' && (
                <>
                  <button type="button" disabled={busy} onClick={sendLink} style={primaryBtn(busy)}>
                    {busy ? 'Working…' : (plan.setup_email_sent_at ? 'Resend payment setup link' : 'Send payment setup link')}
                  </button>
                  {plan.setup_email_sent_at && (
                    <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>Link sent {fmtStamp(plan.setup_email_sent_at)}</span>
                  )}
                  <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); onEdit?.(plan) }}
                    style={{ ...ghostBtn, border: `1px solid ${BLUE}`, color: BLUE }}>
                    Edit plan
                  </button>
                  <button type="button" disabled={busy} style={dangerBtn}
                    onClick={() => run('membership_plan_cancel', { plan_id: plan.id, mode: 'cancel_now' }, 'Cancel this plan? It never took a payment, so it just gets closed.').then(r => r && onChanged?.())}>
                    Cancel plan
                  </button>
                </>
              )}
              {plan.status === 'active' && (
                <>
                  <button type="button" disabled={busy} onClick={sendUpdateLink} style={ghostBtn}>
                    {busy ? 'Working…' : 'Send payment update link'}
                  </button>
                  <button type="button" disabled={busy} style={ghostBtn}
                    onClick={() => run('membership_plan_cancel', { plan_id: plan.id, mode: plan.auto_renew ? 'auto_renew_off' : 'auto_renew_on' }).then(r => r && onChanged?.())}>
                    {plan.auto_renew ? 'Turn auto-renew off' : 'Turn auto-renew on'}
                  </button>
                  <button type="button" disabled={busy} style={ghostBtn} onClick={() => setShowNextYear(v => !v)}>
                    Edit next year's terms
                  </button>
                  <button type="button" disabled={busy} style={dangerBtn} onClick={() => setShowTerminate(v => !v)}>
                    Terminate member
                  </button>
                </>
              )}
              <span style={{ marginLeft: '8px' }}><StepEmailsChip pipeline="MEMBER_MEMBERSHIP_FEES" title="Payment link emails" context={emailCtx} templates={[
                { name: 'MEMBERSHIP_setup_link', when: 'New plan — payment setup link' },
                { name: 'MEMBERSHIP_transfer_setup_link', when: 'Transfer plan — setup link' },
                { name: 'MEMBERSHIP_update_link', when: 'Active plan — update payment method link' },
              ]} /></span>
            </div>
          )}

          {showNextYear && plan.status === 'active' && (
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '10px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)' }}>
              <div style={{ ...label, marginBottom: '10px' }}>Next membership year (applies at renewal on {fmtDate(plan.renewal_date)})</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ width: '180px' }}>
                  <div style={label}>Annual value ($)</div>
                  <input value={nyAmount} onChange={e => setNyAmount(e.target.value)} placeholder={String(plan.annual_amount)} style={input} />
                </div>
                <div style={{ width: '180px' }}>
                  <div style={label}>Credit note ($)</div>
                  <input value={nyCredit} onChange={e => setNyCredit(e.target.value)} placeholder="0" style={input} />
                </div>
                <button type="button" disabled={busy} style={primaryBtn(busy)} onClick={() => saveNextYear(false)}>Save</button>
                {(plan.next_year_amount || plan.next_year_credit_note) && (
                  <button type="button" disabled={busy} style={ghostBtn} onClick={() => saveNextYear(true)}>Clear (use current terms)</button>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--vfo-faint)' }}>
                Unset = renews at the current annual value with no credit. Monthly amounts stay whole dollars (round half up).
              </div>
            </div>
          )}

          {showTerminate && plan.status === 'active' && (
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '10px', background: 'var(--vfo-card)', border: '1px solid #f3c0c0' }}>
              <div style={{ ...label, marginBottom: '10px', color: '#b91c1c' }}>Terminate {plan.member_name}</div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ width: '200px' }}>
                  <div style={label}>Termination fee ($, 0 = none)</div>
                  <input value={terminateFee} onChange={e => setTerminateFee(e.target.value)} placeholder="e.g. 2500" style={input} />
                </div>
                <button type="button" disabled={busy} onClick={terminate}
                  style={{ ...primaryBtn(busy), background: busy ? '#c7d2e4' : '#ef4444' }}>
                  {busy ? 'Working…' : 'Confirm termination'}
                </button>
                <button type="button" disabled={busy} style={ghostBtn} onClick={() => setShowTerminate(false)}>Back</button>
              </div>
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--vfo-faint)' }}>
                The fee is charged to their saved {plan.payment_method_type === 'ach' ? 'bank account' : 'card'} immediately; all remaining scheduled payments are voided and the plan will not renew.
              </div>
            </div>
          )}

          {msg && (
            <div style={{ marginTop: '10px', fontSize: '12.5px', padding: '8px 12px', borderRadius: '8px', wordBreak: 'break-all',
              color: msg.tone === 'success' ? '#166534' : msg.tone === 'amber' ? '#b45309' : '#b91c1c',
              border: `1px solid ${msg.tone === 'success' ? '#bbf7d0' : msg.tone === 'amber' ? '#fde68a' : '#fecaca'}`,
              background: msg.tone === 'success' ? '#f0fdf4' : msg.tone === 'amber' ? '#fffbeb' : '#fef2f2' }}>{msg.text}</div>
          )}
        </div>
      )}
    </div>
  )
}

function ordinal(n) {
  const v = Number(n) || 0
  const s = ['th', 'st', 'nd', 'rd']
  const m = v % 100
  return `${v}${s[(m - 20) % 10] || s[m] || s[0]}`
}

// ── Set Up Payments: the input form ───────────────────────────────────────────

function SetupSection({ category, allMembers, plans, editPlan, onSaved }) {
  const [memberNumber, setMemberNumber] = useState(editPlan?.member_number || '')
  const [isTransfer, setIsTransfer] = useState(!!editPlan?.transfer)
  const [transferRenewal, setTransferRenewal] = useState(editPlan?.transfer ? editPlan.renewal_date : '')
  const [priorPaid, setPriorPaid] = useState(
    editPlan?.prior_payments_made === 0 || editPlan?.prior_payments_made ? String(editPlan.prior_payments_made) : '',
  )
  const [frequency, setFrequency] = useState(editPlan?.frequency || 'monthly')
  const [annualAmount, setAnnualAmount] = useState(editPlan ? String(editPlan.annual_amount) : '')
  const [creditNote, setCreditNote] = useState(editPlan && Number(editPlan.credit_note) > 0 ? String(editPlan.credit_note) : '')
  const [creditMemo, setCreditMemo] = useState(editPlan?.credit_note_memo || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const liveNumbers = useMemo(() => new Set(
    plans.filter(p => p.status !== 'canceled' && p.status !== 'terminated' && p.id !== editPlan?.id).map(p => p.member_number)
  ), [plans, editPlan])

  const options = useMemo(() => {
    // Untagged members (corporate members etc.) are only ever advisors — they
    // appear in the advisor picker automatically and never in the accountant one.
    const pool = allMembers.filter(m =>
      (category === 'advisor' ? (m.member_category === 'advisor' || !m.member_category) : m.member_category === 'accountant') &&
      !liveNumbers.has(m.member_number)
    )
    return pool
      .map(m => ({
        key: m.member_number,
        label: `${m.last_name || ''}${m.last_name && m.first_name ? ', ' : ''}${m.first_name || ''} — ${m.member_number}${m.member_type ? ` (${m.member_type})` : ''}`,
        member: m,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allMembers, category, liveNumbers])

  const selected = allMembers.find(m => m.member_number === memberNumber)
  const annual = parseMoney(annualAmount)
  const credit = parseMoney(creditNote)
  const net = Math.max(0, Math.round((annual - credit) * 100) / 100)
  const today = todayIso()
  const transferRenewalValid = /^\d{4}-\d{2}-15$/.test(transferRenewal || '') && transferRenewal > today && transferRenewal <= addYearsIso(today, 1)

  // As-if-they-pay-today preview (the real dates lock in when they pay).
  const previewChargeDay = Number(today.slice(8, 10)) <= 15 ? Number(today.slice(8, 10)) : 1
  const previewRenewal = renewalPreview(today)
  const transferPullCount = isTransfer && transferRenewalValid && frequency === 'monthly'
    ? 1 + chargeDatesAfter(today, transferRenewal, 23).length
    : 0
  const priorPaidFilled = String(priorPaid).trim() !== ''
  const priorPaidValid = priorPaidFilled &&
    /^\d+$/.test(String(priorPaid).trim()) && Number(priorPaid) >= 0 && Number(priorPaid) <= 11
  // Everything else about a monthly transfer is derived from the payments they
  // already made — the backend does the same arithmetic, so keep them in step.
  const prior = priorPaidValid ? Number(priorPaid) : 0
  const remaining = 12 - prior
  // Fewer charge dates left than payments owed (a late-in-the-year transfer)
  // means the extra months ride along on the payment at the link.
  const pullsAtLink = 1 + Math.max(0, remaining - transferPullCount)
  const perPull = frequency === 'annual'
    ? roundDollar(isTransfer ? annual : net)
    : isTransfer
      ? (priorPaidValid ? Math.max(0, roundDollar(annual / 12 - credit / remaining)) : 0)
      : Math.max(0, roundDollar(net / 12))
  const linkAmount = pullsAtLink * perPull

  async function save() {
    setMsg(null)
    if (!memberNumber) { setMsg({ tone: 'error', text: 'Pick a member first.' }); return }
    if (!(annual > 0)) { setMsg({ tone: 'error', text: 'Enter the annual membership value.' }); return }
    if (isTransfer && !transferRenewalValid) { setMsg({ tone: 'error', text: 'Enter the member\'s existing renewal date — it must be the 15th of a month, within a year.' }); return }
    if (isTransfer && frequency === 'monthly' && !priorPaidValid) {
      setMsg({ tone: 'error', text: priorPaidFilled ? 'Must be a whole number between 0 and 11.' : 'Enter how many payments they\'ve already made this year (0 if none).' })
      return
    }
    setBusy(true)
    try {
      const res = await callApi('membership_plan_save', {
        plan_id: editPlan?.id || undefined,
        member_number: memberNumber,
        category,
        frequency,
        transfer: isTransfer,
        annual_amount: annual,
        credit_note: credit,
        credit_note_memo: creditMemo || undefined,
        renewal_date: isTransfer ? transferRenewal : undefined,
        prior_payments_made: isTransfer && frequency === 'monthly' ? Number(priorPaid) : undefined,
      })
      if (!res?.ok) { setMsg({ tone: 'error', text: res?.error || 'Could not save the plan.' }); return }
      if (editPlan) { onSaved?.({ tone: 'success', text: 'Plan updated.' }); return }
      // Create: the plan now exists, so email failure is reported but never
      // reverts the save.
      try {
        const link = await callApi('membership_send_setup_link', { plan_id: res.plan_id })
        if (link?.email_skipped) onSaved?.({ tone: 'amber', text: `Plan created — link ready, but the email template isn't seeded yet — send it manually: ${link.setup_link}` })
        else if (link?.ok) onSaved?.({ tone: 'success', text: `Plan created — setup email drafted for ${link.to_email}.` })
        else onSaved?.({ tone: 'amber', text: `Plan created, but the setup email failed: ${link?.error || 'unknown error'}. Use "Send setup link" on their plan card to retry.` })
      } catch (e) {
        onSaved?.({ tone: 'amber', text: `Plan created, but the setup email failed: ${e?.message || 'unknown error'}. Use "Send setup link" on their plan card to retry.` })
      }
    } catch (e) {
      setMsg({ tone: 'error', text: e?.message || 'Could not save the plan.' })
    } finally {
      setBusy(false)
    }
  }

  const chip = (active) => ({ padding: '9px 18px', borderRadius: '8px', border: '1px solid ' + (active ? 'transparent' : 'var(--vfo-border-strong)'), background: active ? `linear-gradient(90deg, ${NAVY} 0%, ${BLUE} 100%)` : 'var(--vfo-card)', color: active ? '#fff' : 'var(--vfo-ink-2)', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' })

  return (
    <div style={{ ...card, padding: '20px' }}>
      {editPlan && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(18,94,204,0.08)', border: '1px solid rgba(18,94,204,0.25)', fontSize: '13px', color: 'var(--vfo-ink-2)' }}>
          Editing the plan for <strong>{editPlan.member_name}</strong> — they haven't paid yet, so terms can still change.
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={label}>Which member is this for?</div>
        <SearchSelect options={options} value={memberNumber} onChange={setMemberNumber}
          placeholder={`Select a${category === 'advisor' ? 'n advisor' : 'n accountant'} member…`} />
      </div>

      {selected && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <StatusPill label={selected.advisor_model || 'Model unknown'} color={selected.advisor_model === 'New Model' ? '#7c3aed' : '#0095ff'} />
          <StatusPill label={selected.member_type || 'Type —'} color="#6b7280" />
          <StatusPill label={selected.elite_status || 'Active'} color={(selected.elite_status || 'Active') === 'Active' ? '#16a34a' : '#e06717'} />
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <div style={label}>Is this a brand-new membership, or moving someone over from the old billing?</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" style={chip(!isTransfer)} onClick={() => setIsTransfer(false)}>Brand new membership</button>
          <button type="button" style={chip(isTransfer)} onClick={() => setIsTransfer(true)}>Transfer from old billing (mid-year)</button>
        </div>
        {isTransfer && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--vfo-muted)' }}>
            They already paid this year's earlier months on the old system — they pay their next month at the setup link, bill monthly until their existing renewal date, then auto-renew at the full annual value.
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div>
          <div style={label}>Annual membership value ($)</div>
          <input value={annualAmount} onChange={e => setAnnualAmount(e.target.value)} placeholder="e.g. 18000" style={input} />
        </div>
        <div>
          <div style={label}>Credit note ($, optional)</div>
          <input value={creditNote} onChange={e => setCreditNote(e.target.value)} placeholder="0" style={input} />
        </div>
        <div>
          <div style={label}>Credit note reason (optional)</div>
          <input value={creditMemo} onChange={e => setCreditMemo(e.target.value)} placeholder="e.g. earned via referrals in 2025" style={input} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
        <div>
          <div style={label}>Payment frequency</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={chip(frequency === 'monthly')} onClick={() => setFrequency('monthly')}>Monthly</button>
            <button type="button" style={chip(frequency === 'annual')} onClick={() => setFrequency('annual')}>Annual</button>
          </div>
        </div>
        {isTransfer && (
          <div>
            <div style={label}>Their existing renewal date (must be a 15th)</div>
            <input type="date" value={transferRenewal} onChange={e => setTransferRenewal(e.target.value)} style={input} />
            {transferRenewal && !transferRenewalValid && (
              <div style={{ marginTop: '5px', fontSize: '12px', color: '#b91c1c' }}>Must be the 15th of a month, in the future and within a year.</div>
            )}
          </div>
        )}
        {isTransfer && frequency === 'monthly' && (
          <div>
            <div style={label}>Payments already made this year</div>
            <input
              type="number" min="0" max="11" step="1" placeholder="e.g. 6"
              value={priorPaid} onChange={e => setPriorPaid(e.target.value)} style={input}
            />
            {priorPaidFilled && !priorPaidValid ? (
              <div style={{ marginTop: '5px', fontSize: '12px', color: '#b91c1c' }}>Must be a whole number between 0 and 11.</div>
            ) : (
              <div style={{ marginTop: '5px', fontSize: '12px', color: 'var(--vfo-ink-3)' }}>Under the old billing. The rest is worked out from this: 12 minus this number are still to be charged.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px', padding: '14px 16px', borderRadius: '10px', background: 'var(--vfo-input)', border: '1px solid var(--vfo-border-soft)', fontSize: '13px', color: 'var(--vfo-ink-2)' }}>
        <div style={{ ...label, marginBottom: '8px' }}>Plan preview</div>
        {isTransfer ? (
          frequency === 'monthly' ? (
            (!transferRenewalValid || !priorPaidValid) ? (
              <div style={{ color: '#b45309' }}>Enter their existing renewal date and how many payments they've made to see the remaining schedule.</div>
            ) : (
              <div>
                Paid {prior} of 12 — <strong>{remaining} × {money(perPull)}</strong> left: <strong>{money(linkAmount)}</strong> at the link
                {pullsAtLink > 1 ? ` (includes ${pullsAtLink - 1}-month catch-up)` : ''}, then {remaining - pullsAtLink} monthly
                {' '}until renewal <strong>{fmtDate(transferRenewal)}</strong>
                {credit > 0 ? <> · credit {money(credit)}</> : null}
              </div>
            )
          ) : !transferRenewalValid ? (
            <div style={{ color: '#b45309' }}>Enter their existing renewal date to see the remaining schedule.</div>
          ) : (
            <div>Nothing due now · next charge <strong>{money(roundDollar(annual))}</strong> at renewal <strong>{fmtDate(transferRenewal)}</strong></div>
          )
        ) : (
          <div>
            <strong>{frequency === 'monthly' ? `12 × ${money(perPull)}` : `1 × ${money(perPull)}`}</strong>
            {credit > 0 ? <> ({money(annual)} − {money(credit)} credit)</> : null}
            {' · '}first payment at the link
            {net === 0 && annual > 0 ? ' (fully credited — link saves their payment method only)' : ''}
            {' · '}if paid today: {frequency === 'monthly' ? <>charge day the {ordinal(previewChargeDay)}, </> : null}renewal <strong>{fmtDate(previewRenewal)}</strong>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={save} style={{ ...primaryBtn(busy), padding: '10px 22px' }}>
          {busy ? 'Saving…' : (editPlan ? 'Save changes' : 'Create membership plan')}
        </button>
        <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>Creating the plan also emails the member their payment setup link (resend anytime from the Members list). Legacy members pay no card fee; New Model card payments add the standard processing fee.</span>
      </div>
      {msg && <div style={{ marginTop: '10px', fontSize: '12.5px', padding: '8px 12px', borderRadius: '8px', color: msg.tone === 'error' ? '#b91c1c' : '#166534', border: `1px solid ${msg.tone === 'error' ? '#fecaca' : '#bbf7d0'}`, background: msg.tone === 'error' ? '#fef2f2' : '#f0fdf4' }}>{msg.text}</div>}
    </div>
  )
}

// ── Outstanding: missed / overdue payments ────────────────────────────────────

function OutstandingSection({ plans }) {
  const today = todayIso()
  const groups = plans
    .filter(p => p.status === 'active' || p.status === 'terminated')
    .map(p => {
      const overdue = (p.schedule || []).filter(r =>
        Number(r.amount_due) > 0 && (
          r.status === 'missed' || r.status === 'declined' ||
          (r.status === 'scheduled' && r.due_date < today)
        ))
      return { plan: p, overdue, total: overdue.reduce((s, r) => s + Number(r.amount_due || 0), 0) }
    })
    .filter(g => g.overdue.length > 0)

  if (groups.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>
        Nothing outstanding — every expected payment is on track.
      </div>
    )
  }

  return (
    <div>
      {groups.map(({ plan, overdue, total }) => (
        <OutstandingRow key={plan.id} plan={plan} overdue={overdue} total={total} />
      ))}
    </div>
  )
}

// ── Outstanding Payment Links: setup links sent but never completed ───────────

// Prop is named `label` for readability at the call sites; renamed on the way in
// so it does not shadow the module-level `label` style.
function LinkDetail({ label: text, value }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '7px 0', borderTop: '1px solid var(--vfo-tint)', fontSize: '13px' }}>
      <div style={{ width: '170px', flexShrink: 0, color: 'var(--vfo-muted)', fontWeight: 600 }}>{text}</div>
      <div style={{ color: 'var(--vfo-ink)' }}>{value}</div>
    </div>
  )
}

function OutstandingLinksSection({ plans, onChanged, onEdit }) {
  // Unlike the tax/holistic Outstanding Payment Links tabs, sandbox plans show
  // here (badged) — this panel is also where sandbox test runs are watched.
  const rows = plans.filter(p => p.status === 'setup_pending' && p.setup_email_sent_at)

  if (rows.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>
        No outstanding payment links — everyone who was sent a setup link has completed it.
      </div>
    )
  }

  return (
    <div>
      {rows.map(p => <OutstandingLinkRow key={p.id} plan={p} onChanged={onChanged} onEdit={onEdit} />)}
    </div>
  )
}

// One outstanding setup link. Per-row busy/message state lives here because
// hooks can't be used inside the .map above.
function OutstandingLinkRow({ plan, onChanged, onEdit }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const perPull = Number(plan.per_pull_amount) || 0
  // Annual transfers charge nothing now (they renew at the renewal date), so
  // their link only saves a payment method.
  const saveOnly = perPull <= 0 || (plan.transfer && plan.frequency === 'annual')

  async function sendLink() {
    setBusy(true); setMsg(null)
    try {
      const res = await callApi('membership_send_setup_link', { plan_id: plan.id })
      if (!res?.ok) { setMsg({ tone: 'error', text: res?.error || 'Action failed.' }); return }
      if (res.email_skipped) setMsg({ tone: 'amber', text: `Link ready, but the email template isn't seeded yet — send it manually: ${res.setup_link}` })
      else setMsg({ tone: 'success', text: `Setup email drafted for ${res.to_email}.` })
      onChanged?.()
    } catch (e) {
      setMsg({ tone: 'error', text: e?.message || 'Action failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...card, marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}>
        <span style={{ fontSize: '11px', color: 'var(--vfo-faint)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <MemberNameLink memberNumber={plan.member_number}>{plan.member_name || plan.member_number}</MemberNameLink>
            <StatusPill label="Setup link" color="#125ecc" />
            {plan.transfer && <StatusPill label="Transferred" color="#6b7280" />}
            {plan.sandbox && <StatusPill label="Sandbox" color="#e06717" />}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>
            {plan.member_number} · Link sent {fmtStamp(plan.setup_email_sent_at)}
            {' · '}{plan.frequency === 'monthly' ? `Monthly (${money(perPull)}/mo)` : `Annual (${money(perPull)}/yr)`}
          </div>
        </div>
        <div style={{ width: '120px', textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: saveOnly ? 'var(--vfo-ink-2)' : 'var(--vfo-heading)' }}>
            {saveOnly ? 'Save-only' : money(perPull)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>{saveOnly ? 'no charge at link' : 'due at link'}</div>
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--vfo-input)', borderTop: '1px solid var(--vfo-border-soft)', padding: '14px 18px' }}>
          <LinkDetail label="Annual value" value={money(plan.annual_amount)} />
          <LinkDetail label="Credit note" value={Number(plan.credit_note) > 0 ? money(plan.credit_note) : '—'} />
          {plan.transfer && <LinkDetail label="Renewal date" value={fmtDate(plan.renewal_date)} />}
          <LinkDetail label="Plan created" value={`${fmtStamp(plan.created_at)}${plan.created_by ? ` · ${plan.created_by}` : ''}`} />
          <LinkDetail label="Link sent" value={fmtStamp(plan.setup_email_sent_at)} />

          <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={sendLink} style={primaryBtn(busy)}>
              {busy ? 'Working…' : 'Resend payment setup link'}
            </button>
            <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); onEdit?.(plan) }}
              style={{ ...ghostBtn, border: `1px solid ${BLUE}`, color: BLUE }}>
              Edit plan
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: '10px', fontSize: '12.5px', padding: '8px 12px', borderRadius: '8px', wordBreak: 'break-all',
              color: msg.tone === 'success' ? '#166534' : msg.tone === 'amber' ? '#b45309' : '#b91c1c',
              border: `1px solid ${msg.tone === 'success' ? '#bbf7d0' : msg.tone === 'amber' ? '#fde68a' : '#fecaca'}`,
              background: msg.tone === 'success' ? '#f0fdf4' : msg.tone === 'amber' ? '#fffbeb' : '#fef2f2' }}>{msg.text}</div>
          )}
        </div>
      )}
    </div>
  )
}

// One outstanding plan. Its own state so the reminder button can show progress
// per row (hooks can't live inside the .map above). Rows whose overdue payments
// are all still 'scheduled' (not yet swept) are rejected by the backend, so the
// reminder button is hidden for them in favour of an explanatory note.
function OutstandingRow({ plan, overdue, total }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  // Known-value substitution for the failure email (see StepEmailsChip). Only
  // the member first name is cleanly in scope here (the email's [Amount] uses a
  // per-arrears figure not available on this row), so everything else stays a
  // bracketed chip.
  const emailCtx = (() => {
    const ctx = {}
    const first = String(plan.member_name || '').trim().split(/\s+/)[0]
    if (first) ctx['First Name'] = first
    return ctx
  })()
  // The backend only emails rows already marked missed/declined. When every
  // overdue row is still 'scheduled' (awaiting tonight's automatic charge run),
  // the reminder call is guaranteed to 400 — so gate the button instead.
  const canRemind = overdue.some(r => r.status === 'missed' || r.status === 'declined')

  async function sendReminder() {
    setBusy(true); setMsg(null)
    try {
      const res = await callApi('membership_send_reminder', { plan_id: plan.id })
      if (res?.ok) setMsg({ tone: 'success', text: `Reminder email created for ${res.to_email}.` })
      else setMsg({ tone: 'error', text: res?.error || 'Could not send the reminder.' })
    } catch (e) {
      setMsg({ tone: 'error', text: e?.message || 'Could not send the reminder.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...card, marginBottom: '10px', padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}><MemberNameLink memberNumber={plan.member_number}>{plan.member_name || plan.member_number}</MemberNameLink></div>
          <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>
            {plan.member_number} · {overdue.length} overdue payment{overdue.length === 1 ? '' : 's'}: {overdue.map(r => r.period_label).join(', ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>{money(total)}</div>
          <div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>owed</div>
        </div>
        {canRemind ? (
          <button type="button" disabled={busy} onClick={sendReminder} style={primaryBtn(busy)}>
            {busy ? 'Sending…' : 'Send reminder email'}
          </button>
        ) : (
          <span style={{ fontSize: '12px', color: 'var(--vfo-faint)', maxWidth: '220px', textAlign: 'right' }}>
            Overdue — will be charged by tonight's automatic run
          </span>
        )}
        <span style={{ marginLeft: '8px' }}><StepEmailsChip pipeline="MEMBER_MEMBERSHIP_FEES" title="Payment reminder email" context={emailCtx} templates={[
          { name: 'MEMBERSHIP_payment_failed', when: 'Payment failed / reminder to the member' },
        ]} /></span>
      </div>
      {msg && (
        <div style={{ marginTop: '10px', fontSize: '12.5px', padding: '8px 12px', borderRadius: '8px', wordBreak: 'break-all',
          color: msg.tone === 'success' ? '#166534' : msg.tone === 'amber' ? '#b45309' : '#b91c1c',
          border: `1px solid ${msg.tone === 'success' ? '#bbf7d0' : msg.tone === 'amber' ? '#fde68a' : '#fecaca'}`,
          background: msg.tone === 'success' ? '#f0fdf4' : msg.tone === 'amber' ? '#fffbeb' : '#fef2f2' }}>{msg.text}</div>
      )}
    </div>
  )
}
