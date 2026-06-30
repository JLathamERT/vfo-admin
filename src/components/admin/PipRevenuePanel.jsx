import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'
import { inPeriod } from './holisticShared'
import { clearedPipPurchases } from './pipShared'

// Accounting > VFO Services > Additional PIP Revenue. Each additional-PIP purchase
// (additional PIP meetings or Tax Planning) that cleared in the chosen month/year, with
// connected member and the member vs VFOS (Elite VFO Income) revenue split.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(s) }
}

export default function PipRevenuePanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('pip_additional_load')
      if (res?.error) { setError(res.error); return }
      setRows(res.rows || [])
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const payments = useMemo(() => clearedPipPurchases(rows), [rows])

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    payments.forEach(p => { if (p.clearedAt) set.add(new Date(p.clearedAt).getFullYear()) })
    return Array.from(set).sort((a, b) => b - a)
  }, [payments])

  const filtered = useMemo(() => payments
    .filter(p => inPeriod(p.clearedAt, year, month))
    .sort((a, b) => new Date(b.clearedAt) - new Date(a.clearedAt)),
    [payments, year, month])

  const totGross = filtered.reduce((s, p) => s + p.amount, 0)
  const totMember = filtered.reduce((s, p) => s + p.member, 0)
  const totVfos = filtered.reduce((s, p) => s + p.vfos, 0)
  const periodLabel = month >= 0 ? `${MONTHS[month]} ${year}` : `${year}`

  const wrap = { padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0f0', background: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#16264a', cursor: 'pointer' }
  const grid = '120px 1.2fr 1.1fr 1.1fr 110px 110px 110px'

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · VFO Services</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>Additional PIP Revenue</h2>
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
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>Member revenue</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>{money(totMember)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>Elite VFO Income</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16264a' }}>{money(totVfos)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>{periodLabel} received</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: NAVY }}>{money(totGross)}</div>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>Loading…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No additional-PIP purchases cleared in this period.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ border: '1px solid #e9eef8', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 16px rgba(20,45,95,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', background: '#f7f9fc', borderBottom: '1px solid #e9eef8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#697a9c' }}>
            <span>Cleared</span><span>Client</span><span>Connected Member</span><span>Purchased</span><span style={{ textAlign: 'right' }}>Received</span><span style={{ textAlign: 'right' }}>Member</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span>
          </div>
          {filtered.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', borderBottom: '1px solid #f0f3f9', alignItems: 'center', fontSize: '13px', color: '#16264a' }}>
              <span style={{ color: '#4e6087' }}>{fmtDate(p.clearedAt)}</span>
              <span style={{ fontWeight: 600 }}>{p.clientName}</span>
              <span>{p.memberName || '—'}{p.memberNumber && <span style={{ color: '#9aa7be' }}> · {p.memberNumber}</span>}</span>
              <span style={{ color: '#4e6087' }}>{p.kindLabel}</span>
              <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.amount)}</span>
              <span style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>{money(p.member)}</span>
              <span style={{ textAlign: 'right' }}>{money(p.vfos)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
