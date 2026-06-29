import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money, requestDate, RequestRow } from './specialistRevenueShared'

// Accounting → VFO Specialist Revenue. Pick year + month to see the specialist
// payment requests for that period, expand each to see recipients and statuses.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function SpecialistRevenuePanel() {
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

  const periodGross = filtered.reduce((s, r) => s + (Number(r.gross_amount) || 0), 0)
  const periodMember = filtered.reduce((s, r) => s + (Number(r.total_member_share) || 0), 0)
  const periodVfos = filtered.reduce((s, r) => s + (Number(r.total_vfos_share) || 0), 0)
  const periodLabel = month >= 0 ? `${MONTHS[month]} ${year}` : `${year}`

  const wrap = { padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0f0', background: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#16264a', cursor: 'pointer' }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>VFO Specialist Revenue</h2>
      </div>

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
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>Member shares</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>{money(periodMember)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>VFOS shares</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16264a' }}>{money(periodVfos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>{periodLabel} gross</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: NAVY }}>{money(periodGross)}</div>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>Loading…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No specialist payments for this period.</div>
      )}
      {!loading && !error && filtered.map(r => <RequestRow key={r.id} request={r} />)}
    </div>
  )
}
