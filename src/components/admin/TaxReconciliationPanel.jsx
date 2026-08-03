import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'
import { inPeriod } from './holisticShared'
import { clearedTaxPayments } from './taxShared'
import { AccountingTableSkeleton } from '../shared/Skeleton'
import { MemberNameLink } from '../shared/personLinks'

// Accounting > VFO Services > Tax Planning Reconciliation. Pick a year → each member
// with Tax activity that year and their revenue split from payments that CLEARED in the
// year: member share (revenue-share members), money-mapping share, VFOS share. ERT +
// strategic shares aren't tracked → blank. Covers Tax Priorities + Tax Planning.

export default function TaxReconciliationPanel({ embedded = false }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

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

  const members = useMemo(() => {
    const map = {}
    for (const p of payments) {
      if (!p.memberNumber) continue
      if (!inPeriod(p.clearedAt, year, -1)) continue
      const k = p.memberNumber
      const t = map[k] || (map[k] = { memberNumber: k, name: p.memberName || '—', member: 0, mm: 0, vfos: 0, strategic: 0 })
      if (!t.name && p.memberName) t.name = p.memberName
      if ((p.decision || '') === 'Money Mapping') t.mm += p.member
      else t.member += p.member
      t.vfos += p.vfos
      t.strategic += p.strategic || 0
    }
    return Object.values(map).sort((a, b) => String(a.memberNumber).localeCompare(String(b.memberNumber), undefined, { numeric: true }))
  }, [payments, year])

  const tot = members.reduce((s, m) => ({ member: s.member + m.member, mm: s.mm + m.mm, vfos: s.vfos + m.vfos, strategic: s.strategic + m.strategic }), { member: 0, mm: 0, vfos: 0, strategic: 0 })

  const wrap = embedded ? { fontFamily: 'Inter, sans-serif' } : { padding: '24px', maxWidth: '1150px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'var(--vfo-ink)', cursor: 'pointer' }
  const grid = '90px 1.4fr 130px 140px 130px 120px'
  const muted = { color: 'var(--vfo-faint)' }

  return (
    <div style={wrap}>
      {!embedded && (
        <div style={{ marginBottom: '18px' }}>
          <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · VFO Services</p>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: 0 }}>Tax Planning Reconciliation</h2>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <select style={sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} style={{ ...sel, color: '#125ecc', fontWeight: 600 }}>Refresh</button>
      </div>

      {loading && <AccountingTableSkeleton cols={6} />}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && (
        <div style={{ border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', overflow: 'hidden', background: 'var(--vfo-card)', boxShadow: 'var(--vfo-shadow-card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', background: 'var(--vfo-input)', borderBottom: '1px solid var(--vfo-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-muted)' }}>
            <span>Member #</span><span>Member Name</span><span style={{ textAlign: 'right' }}>Member Share</span><span style={{ textAlign: 'right' }}>Money Mapping</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span><span style={{ textAlign: 'right' }}>Strategic Share</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '11px 18px', borderBottom: '2px solid var(--vfo-border)', background: 'var(--vfo-input)', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)' }}>
            <span />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-muted)' }}>Totals</span>
            <span style={{ textAlign: 'right' }}>{money(tot.member)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.mm)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.vfos)}</span>
            <span style={{ textAlign: 'right', ...(tot.strategic ? {} : muted) }}>{tot.strategic ? money(tot.strategic) : '—'}</span>
          </div>
          {members.map(m => (
            <div key={m.memberNumber} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', borderBottom: '1px solid var(--vfo-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--vfo-ink)' }}>
              <span style={{ color: 'var(--vfo-muted)' }}>{m.memberNumber}</span>
              <span><MemberNameLink memberNumber={m.memberNumber} style={{ fontWeight: 600 }}>{m.name}</MemberNameLink></span>
              <span style={{ textAlign: 'right', fontWeight: m.member ? 700 : 400, color: m.member ? '#16a34a' : 'var(--vfo-faint)' }}>{money(m.member)}</span>
              <span style={{ textAlign: 'right', fontWeight: m.mm ? 700 : 400, color: m.mm ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{money(m.mm)}</span>
              <span style={{ textAlign: 'right', fontWeight: m.vfos ? 700 : 400, color: m.vfos ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{money(m.vfos)}</span>
              <span style={{ textAlign: 'right', fontWeight: m.strategic ? 700 : 400, color: m.strategic ? '#8b5cf6' : 'var(--vfo-faint)' }}>{m.strategic ? money(m.strategic) : '—'}</span>
            </div>
          ))}
          {members.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--vfo-faint)', fontSize: '14px' }}>No Tax member activity for this year.</div>}
        </div>
      )}
      <p style={{ fontSize: '11.5px', color: 'var(--vfo-faint)', marginTop: '12px' }}>Shares are from Tax payments (retainer + implementation) that cleared in the selected year. Strategic Share is the partner-company cut on strategic members' deals; blank for non-strategic members.</p>
    </div>
  )
}
