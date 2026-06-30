import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'

// Accounting > Specialists > VFO Specialist License Fees. Pick year + month to see the
// $99/mo specialist license payments that cleared that period (read from the
// specialist_license_payments ledger — one row per paid monthly invoice). No payment
// input here; this is a read-only monthly view.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtDate(s) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(s) }
}

function StatusTag({ status, method }) {
  const ach = method === 'ach'
  const tone = status === 'succeeded'
    ? { bg: 'rgba(22,163,74,0.12)', fg: '#16a34a', label: 'Paid' }
    : { bg: 'rgba(78,96,135,0.12)', fg: '#4e6087', label: status || '—' }
  return (
    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
      <span style={{ padding: '3px 10px', borderRadius: '20px', background: tone.bg, color: tone.fg, fontSize: '11.5px', fontWeight: 700 }}>{tone.label}</span>
      <span style={{ padding: '3px 8px', borderRadius: '20px', background: ach ? 'rgba(2,41,115,0.08)' : 'rgba(18,94,204,0.10)', color: ach ? '#002973' : '#125ecc', fontSize: '11px', fontWeight: 600 }}>{ach ? 'ACH' : 'Card'}</span>
    </span>
  )
}

export default function SpecialistLicensePanel() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11, or -1 for All

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('specialist_license_payments_load')
      if (res?.error) { setError(res.error); return }
      setPayments(res.payments || [])
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    payments.forEach(p => { if (p.paid_at) set.add(new Date(p.paid_at).getFullYear()) })
    return Array.from(set).sort((a, b) => b - a)
  }, [payments])

  const filtered = useMemo(() => payments.filter(p => {
    if (!p.paid_at) return false
    const dt = new Date(p.paid_at)
    if (dt.getFullYear() !== year) return false
    if (month >= 0 && dt.getMonth() !== month) return false
    return true
  }), [payments, year, month])

  const periodTotal = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const periodLabel = month >= 0 ? `${MONTHS[month]} ${year}` : `${year}`

  const wrap = { padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0f0', background: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#16264a', cursor: 'pointer' }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>VFO Specialist License Fees</h2>
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
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>Payments</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#16264a' }}>{filtered.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>{periodLabel} total</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: NAVY }}>{money(periodTotal)}</div>
          </div>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>Loading…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No license payments for this period.</div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ border: '1px solid #e9eef8', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 16px rgba(20,45,95,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px 120px 150px', gap: '8px', padding: '12px 18px', background: '#f7f9fc', borderBottom: '1px solid #e9eef8', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#697a9c' }}>
            <span>Specialist</span><span>Status</span><span style={{ textAlign: 'right' }}>Amount</span><span style={{ textAlign: 'right' }}>Paid</span>
          </div>
          {filtered.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 170px 120px 150px', gap: '8px', padding: '13px 18px', borderBottom: '1px solid #f0f3f9', alignItems: 'center', fontSize: '13px', color: '#16264a' }}>
              <span style={{ fontWeight: 600 }}>
                {p.specialist_name || `Specialist #${p.expert_id || p.onboarding_id}`}
                {p.last4 && <span style={{ color: '#9aa7be', fontWeight: 400 }}> · ••••{p.last4}</span>}
              </span>
              <StatusTag status={p.status} method={p.method} />
              <span style={{ textAlign: 'right', fontWeight: 700 }}>{money(p.amount)}</span>
              <span style={{ textAlign: 'right', color: '#4e6087' }}>{fmtDate(p.paid_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
