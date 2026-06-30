import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money } from './specialistRevenueShared'
import { clearedPayments, inPeriod } from './holisticShared'

// Accounting > VFO Services > Holistic Planning Reconciliation. Pick a year → each
// member with Holistic activity that year and their revenue split from payments that
// CLEARED in the year: member share (revenue-share members), money-mapping share, VFOS
// share. ERT + strategic shares aren't tracked in Holistic yet → blank.

export default function HolisticReconciliationPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await callApi('holistic_planning_load')
      if (res?.error) { setError(res.error); return }
      setRows(res.rows || [])
    } catch (e) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  const payments = useMemo(() => clearedPayments(rows), [rows])

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    payments.forEach(p => { if (p.clearedAt) set.add(new Date(p.clearedAt).getFullYear()) })
    return Array.from(set).sort((a, b) => b - a)
  }, [payments])

  // member_number -> { name, member, mm, vfos } for payments cleared in the year.
  const members = useMemo(() => {
    const map = {}
    for (const p of payments) {
      if (!p.memberNumber) continue
      if (!inPeriod(p.clearedAt, year, -1)) continue
      const k = p.memberNumber
      const t = map[k] || (map[k] = { memberNumber: k, name: p.memberName || '—', member: 0, mm: 0, vfos: 0 })
      if (!t.name && p.memberName) t.name = p.memberName
      if ((p.decision || '') === 'Money Mapping') t.mm += p.member
      else t.member += p.member
      t.vfos += p.vfos
    }
    return Object.values(map).sort((a, b) => String(a.memberNumber).localeCompare(String(b.memberNumber), undefined, { numeric: true }))
  }, [payments, year])

  const tot = members.reduce((s, m) => ({ member: s.member + m.member, mm: s.mm + m.mm, vfos: s.vfos + m.vfos }), { member: 0, mm: 0, vfos: 0 })

  const wrap = { padding: '24px', maxWidth: '1150px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0f0', background: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#16264a', cursor: 'pointer' }
  const grid = '90px 1.4fr 130px 140px 130px 120px'
  const muted = { color: '#c2cbdb' }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting · VFO Services</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>Holistic Planning Reconciliation</h2>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
        <select style={sel} value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load} style={{ ...sel, color: '#125ecc', fontWeight: 600 }}>Refresh</button>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#4e6087' }}>Loading…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>{error}</div>}
      {!loading && !error && (
        <div style={{ border: '1px solid #e9eef8', borderRadius: '14px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 16px rgba(20,45,95,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', background: '#f7f9fc', borderBottom: '1px solid #e9eef8', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#697a9c' }}>
            <span>Member #</span><span>Member Name</span><span style={{ textAlign: 'right' }}>Member Share</span><span style={{ textAlign: 'right' }}>Money Mapping</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span><span style={{ textAlign: 'right' }}>Strategic Share</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '11px 18px', borderBottom: '2px solid #e3eaf5', background: '#fbfdff', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: NAVY }}>
            <span />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#697a9c' }}>Totals</span>
            <span style={{ textAlign: 'right' }}>{money(tot.member)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.mm)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.vfos)}</span>
            <span style={{ textAlign: 'right', ...muted }}>—</span>
          </div>
          {members.map(m => (
            <div key={m.memberNumber} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '12px 18px', borderBottom: '1px solid #f0f3f9', alignItems: 'center', fontSize: '13px', color: '#16264a' }}>
              <span style={{ color: '#4e6087' }}>{m.memberNumber}</span>
              <span style={{ fontWeight: 600 }}>{m.name}</span>
              <span style={{ textAlign: 'right', fontWeight: m.member ? 700 : 400, color: m.member ? '#16a34a' : '#c2cbdb' }}>{money(m.member)}</span>
              <span style={{ textAlign: 'right', fontWeight: m.mm ? 700 : 400, color: m.mm ? '#16264a' : '#c2cbdb' }}>{money(m.mm)}</span>
              <span style={{ textAlign: 'right', fontWeight: m.vfos ? 700 : 400, color: m.vfos ? '#16264a' : '#c2cbdb' }}>{money(m.vfos)}</span>
              <span style={{ textAlign: 'right', ...muted }}>—</span>
            </div>
          ))}
          {members.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No Holistic member activity for this year.</div>}
        </div>
      )}
      <p style={{ fontSize: '11.5px', color: '#9aa7be', marginTop: '12px' }}>Shares are from Holistic payments that cleared in the selected year. ERT and strategic shares aren't tracked in Holistic yet — shown blank.</p>
    </div>
  )
}
