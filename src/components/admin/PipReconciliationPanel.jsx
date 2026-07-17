import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'
import { inPeriod } from './holisticShared'
import { clearedPipPurchases } from './pipShared'
import { AccountingTableSkeleton } from '../shared/Skeleton'

// Accounting > VFO Services > Additional PIP Reconciliation. Pick a year → grouped BY
// CLIENT: each client with additional-PIP activity that year and the revenue split from
// purchases that cleared in the year (member share for revenue-share members, money-
// mapping share, Elite VFO Income).

export default function PipReconciliationPanel({ embedded = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

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

  // client_id -> { clientName, memberName, member, mm, vfos } for the selected year.
  const clients = useMemo(() => {
    const map = {}
    for (const p of payments) {
      if (!inPeriod(p.clearedAt, year, -1)) continue
      const k = p.clientId
      const t = map[k] || (map[k] = { clientId: k, clientName: p.clientName, memberName: p.memberName || '—', member: 0, mm: 0, vfos: 0 })
      if (!t.memberName && p.memberName) t.memberName = p.memberName
      if ((p.decision || '') === 'Money Mapping') t.mm += p.member
      else t.member += p.member
      t.vfos += p.vfos
    }
    return Object.values(map).sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)))
  }, [payments, year])

  const tot = clients.reduce((s, c) => ({ member: s.member + c.member, mm: s.mm + c.mm, vfos: s.vfos + c.vfos }), { member: 0, mm: 0, vfos: 0 })

  const wrap = embedded ? { fontFamily: 'Inter, sans-serif' } : { padding: '24px', maxWidth: '1150px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'var(--vfo-ink)', cursor: 'pointer' }
  const grid = '1.4fr 1.2fr 140px 150px 150px'

  return (
    <div style={wrap}>
      {!embedded && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · VFO Services</p>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>Additional PIP Reconciliation</h2>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <select style={sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} style={{ ...sel, color: '#125ecc', fontWeight: 600 }}>Refresh</button>
      </div>

      {loading && <AccountingTableSkeleton cols={5} />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}

      {!loading && !error && (
        <div style={{ border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', overflow: 'hidden', background: 'var(--vfo-card)', boxShadow: 'var(--vfo-shadow-card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', background: 'var(--vfo-input)', borderBottom: '1px solid var(--vfo-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-muted)' }}>
            <span>Client</span><span>Connected Member</span><span style={{ textAlign: 'right' }}>Member Share</span><span style={{ textAlign: 'right' }}>Money Mapping</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '11px 18px', borderBottom: '2px solid var(--vfo-border)', background: 'var(--vfo-input)', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-muted)' }}>Totals</span>
            <span />
            <span style={{ textAlign: 'right' }}>{money(tot.member)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.mm)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.vfos)}</span>
          </div>
          {clients.map(c => (
            <div key={c.clientId} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', borderBottom: '1px solid var(--vfo-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--vfo-ink)' }}>
              <span style={{ fontWeight: 600 }}>{c.clientName}</span>
              <span style={{ color: 'var(--vfo-muted)' }}>{c.memberName}</span>
              <span style={{ textAlign: 'right', fontWeight: c.member ? 700 : 400, color: c.member ? '#16a34a' : 'var(--vfo-faint)' }}>{money(c.member)}</span>
              <span style={{ textAlign: 'right', fontWeight: c.mm ? 700 : 400, color: c.mm ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{money(c.mm)}</span>
              <span style={{ textAlign: 'right', fontWeight: c.vfos ? 700 : 400, color: c.vfos ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{money(c.vfos)}</span>
            </div>
          ))}
          {clients.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>No additional-PIP client activity for this year.</div>}
        </div>
      )}
    </div>
  )
}
