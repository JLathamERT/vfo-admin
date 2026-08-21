import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money, requestDate, RequestRow, MarkReceivedButton, DeleteRequestButton, canDeleteSpecrevRequest } from './specialistRevenueShared'
import SpecialistPaymentInput from './SpecialistPaymentInput'
import { OnboardingListSkeleton } from '../shared/Skeleton'

// Accounting → VFO Specialist Revenue. Pick year + month to see the specialist
// payment requests for that period, expand each to see recipients and statuses.
// The "New Payment" button at the top reveals the Payment Input form inline (the
// two used to be separate tabs).

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SpecialistRevenuePanel({ allExperts = [], allMembers = [], embedded = false }) {
  const [showInput, setShowInput] = useState(false)
  const [viewMode, setViewMode] = useState('specialist') // 'specialist' | 'member'
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11, or -1 for All

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('specialist_revenue_load')
      if (res?.error) { setError(res.error); return }
      setRequests(res.requests || [])
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    requests.forEach(r => { const d = requestDate(r); if (d) set.add(new Date(d).getFullYear()) })
    return Array.from(set).sort((a, b) => b - a)
  }, [requests])

  const filtered = useMemo(() => requests.filter(r => {
    const d = requestDate(r); if (!d) return false
    const dt = new Date(d)
    if (dt.getFullYear() !== year) return false
    if (month >= 0 && dt.getMonth() !== month) return false
    return true
  }), [requests, year, month])

  // Money totals + the By-member rollup count only requests whose payment has been
  // received — pending/requested requests are expected money, not real revenue yet.
  // (The By-specialist list below still shows every request, incl. pending, so you can
  // mark them received.)
  const receivedFiltered = useMemo(() => filtered.filter(r => r.payment_status === 'received'), [filtered])

  // Member view: every recipient line across ALL specialists in the period, grouped
  // by recipient (so a member's deals are together no matter which specialist billed).
  const memberGroups = useMemo(() => {
    const map = {}
    for (const r of receivedFiltered) {
      const d = requestDate(r)
      for (const l of (r.lines || [])) {
        const key = l.member_number || (l.recipient_type === 'specialist' ? `spec:${l.expert_id}` : l.recipient_name) || 'unknown'
        const g = map[key] || (map[key] = { key, name: l.recipient_name || '—', sub: l.member_number || (l.recipient_type === 'specialist' ? 'Specialist' : 'Member'), decision: l.revenue_decision || 'Revenue Share', member: 0, vfos: 0, deals: 0, items: [] })
        g.member += Number(l.member_share) || 0
        g.vfos += Number(l.vfos_share) || 0
        g.deals += Number(l.deals) || 0
        g.items.push({ specialist: r.specialist_name || '—', date: d, member_share: l.member_share, vfos_share: l.vfos_share, deals: l.deals })
      }
    }
    return Object.values(map).sort((a, b) => b.member - a.member)
  }, [receivedFiltered])

  const periodGross = receivedFiltered.reduce((s, r) => s + (Number(r.gross_amount) || 0), 0)
  const periodMember = receivedFiltered.reduce((s, r) => s + (Number(r.total_member_share) || 0), 0)
  const periodVfos = receivedFiltered.reduce((s, r) => s + (Number(r.total_vfos_share) || 0), 0)
  const periodLabel = month >= 0 ? `${MONTHS[month]} ${year}` : `${year}`

  const wrap = embedded ? { fontFamily: 'Inter, sans-serif' } : { padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'var(--vfo-ink)', cursor: 'pointer' }

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {embedded ? <div /> : (
          <div>
            <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting</p>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>VFO Specialist Revenue</h2>
          </div>
        )}
        <button onClick={() => setShowInput(s => !s)}
          style={{ padding: '10px 18px', borderRadius: '8px', border: showInput ? '1px solid var(--vfo-border-strong)' : 'none', background: showInput ? 'var(--vfo-card)' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', color: showInput ? 'var(--vfo-muted)' : '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: showInput ? 'none' : '0 2px 8px rgba(18,94,204,0.28)' }}>
          {showInput ? 'Close form' : '+ New Payment'}
        </button>
      </div>

      {showInput && (
        <div style={{ border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', background: 'var(--vfo-input)', marginBottom: '22px', overflow: 'hidden' }}>
          <SpecialistPaymentInput allExperts={allExperts} allMembers={allMembers} onSent={load} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <select style={sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select style={sel} value={month} onChange={e => setMonth(Number(e.target.value))}>
          <option value={-1}>All months</option>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <button onClick={load} style={{ ...sel, color: '#125ecc', fontWeight: 600 }}>Refresh</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '24px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>Member shares</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>{money(periodMember)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>VFOS shares</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--vfo-ink)' }}>{money(periodVfos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>{periodLabel} gross</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--vfo-heading)' }}>{money(periodGross)}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {[['specialist', 'By specialist'], ['member', 'By member']].map(([k, l]) => (
          <button key={k} onClick={() => setViewMode(k)}
            style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${viewMode === k ? '#125ecc' : '#d6e0f0'}`, background: viewMode === k ? 'rgba(18,94,204,0.08)' : '#fff', color: viewMode === k ? '#125ecc' : 'var(--vfo-muted)', fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {l}
          </button>
        ))}
      </div>

      {loading && <OnboardingListSkeleton rows={3} />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>No specialist payments for this period.</div>
      )}
      {!loading && !error && filtered.length > 0 && viewMode === 'specialist' && filtered.map(r => (
        <RequestRow key={r.id} request={r} actions={({ request }) => (
          request.payment_status === 'pending' ? <MarkReceivedButton request={request} onDone={load} />
            : canDeleteSpecrevRequest(request) ? <DeleteRequestButton request={request} onDone={load} />
              : null
        )} />
      ))}
      {!loading && !error && filtered.length > 0 && viewMode === 'member' && memberGroups.map(g => <MemberGroupRow key={g.key} group={g} />)}
    </div>
  )
}

// One recipient's deals grouped across all specialists (Member view).
function MemberGroupRow({ group }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', marginBottom: '10px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer' }}>
        <span style={{ fontSize: '11px', color: 'var(--vfo-faint)', width: '12px' }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{group.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '2px' }}>{group.sub} · {group.items.length} deal{group.items.length === 1 ? '' : 's'} across specialists · {group.decision}</div>
        </div>
        <div style={{ display: 'flex', gap: '18px', textAlign: 'right' }}>
          <div><div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{money(group.member)}</div><div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>member</div></div>
          <div><div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-ink)' }}>{money(group.vfos)}</div><div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>VFOS</div></div>
          <div><div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--vfo-heading)' }}>{group.deals}</div><div style={{ fontSize: '11px', color: 'var(--vfo-faint)' }}>deals</div></div>
        </div>
      </div>
      {open && (
        <div style={{ background: 'var(--vfo-input)', borderTop: '1px solid var(--vfo-border-soft)', padding: '14px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 130px 110px 110px 70px', gap: '10px', padding: '0 0 8px', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--vfo-muted)' }}>
            <div>Specialist</div><div>Date</div><div>VFOS $</div><div>Member $</div><div>Deals</div>
          </div>
          {group.items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 130px 110px 110px 70px', gap: '10px', alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--vfo-tint)', fontSize: '13px', color: 'var(--vfo-ink-2)' }}>
              <div style={{ fontWeight: 600 }}>{it.specialist}</div>
              <div style={{ color: 'var(--vfo-muted)' }}>{it.date ? new Date(it.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
              <div>{money(it.vfos_share)}</div>
              <div>{money(it.member_share)}</div>
              <div>{it.deals || 0}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
