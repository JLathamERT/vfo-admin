import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'
import { inPeriod } from './holisticShared'
import { clearedTaxPayments } from './taxShared'

// Accounting > VFO Services > Tax Planning Revenue. Each tax payment (retainer or
// implementation) that cleared in the chosen month/year — connected member, program
// (Tax Priorities / Tax Planning), and the member vs VFOS revenue split. No scheduled
// payments, no outbound revenue-share payouts.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(s) }
}

function ProgramTag({ label }) {
  const planning = label === 'Tax Planning'
  const c = planning ? { bg: 'rgba(147,51,234,0.12)', fg: '#7c3aed' } : { bg: 'rgba(18,94,204,0.10)', fg: '#125ecc' }
  return <span style={{ padding: '3px 10px', borderRadius: '20px', background: c.bg, color: c.fg, fontSize: '11px', fontWeight: 700 }}>{label}</span>
}

export default function TaxRevenuePanel() {
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
      const res = await callApi('tax_planning_load')
      if (res?.error) { setError(res.error); return }
      setRows(res.rows || [])
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const payments = useMemo(() => clearedTaxPayments(rows), [rows])

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
  const grid = '130px 1.3fr 1.2fr 130px 120px 120px 120px'

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · VFO Services</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>Tax Planning Revenue</h2>
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
        <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No Tax payments cleared in this period.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ border: '1px solid #e9eef8', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 16px rgba(20,45,95,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', background: '#f7f9fc', borderBottom: '1px solid #e9eef8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#697a9c' }}>
            <span>Cleared</span><span>Client</span><span>Connected Member</span><span>Program</span><span style={{ textAlign: 'right' }}>Received</span><span style={{ textAlign: 'right' }}>Member</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span>
          </div>
          {filtered.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', borderBottom: '1px solid #f0f3f9', alignItems: 'center', fontSize: '13px', color: '#16264a' }}>
              <span style={{ color: '#4e6087' }}>{fmtDate(p.clearedAt)}</span>
              <span style={{ fontWeight: 600 }}>{p.clientName}<span style={{ color: '#9aa7be', fontWeight: 400 }}> · {p.kind}</span></span>
              <span>{p.memberName || '—'}{p.memberNumber && <span style={{ color: '#9aa7be' }}> · {p.memberNumber}</span>}</span>
              <span><ProgramTag label={p.tier} /></span>
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
