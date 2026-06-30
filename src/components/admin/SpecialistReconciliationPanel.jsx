import { useState, useEffect, useMemo } from 'react'
import { callApi } from '../../lib/api'
import { NAVY, money, requestDate } from './specialistRevenueShared'

// Accounting > Specialists > VFO Specialist Member Reconciliation. Pick a year → every
// member with their yearly totals from specialist revenue: member share (revenue share
// payouts), VFOS share, money-mapping share. Accreditation rebate + credit note are
// placeholders (not built yet → blank).

function memberName(m) {
  return m.name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || '—'
}

// Annual accreditation credit note, based on the member's Elite VFO Income (VFOS share):
// >$100k → $18,000; $75k–$100k → $9,000; >$50k & <$75k → $6,000; otherwise none.
function creditNote(vfos) {
  const v = Number(vfos) || 0
  if (v > 100000) return 18000
  if (v >= 75000) return 9000
  if (v > 50000) return 6000
  return null
}

export default function SpecialistReconciliationPanel({ allMembers = [] }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())

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

  // All line items (member recipients only) tagged with their request year.
  const memberLines = useMemo(() => {
    const out = []
    for (const r of requests) {
      const d = requestDate(r)
      const y = d ? new Date(d).getFullYear() : null
      for (const l of (r.lines || [])) {
        if (!l.member_number) continue // member recipients only
        out.push({ ...l, year: y })
      }
    }
    return out
  }, [requests])

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()])
    memberLines.forEach(l => { if (l.year) set.add(l.year) })
    return Array.from(set).sort((a, b) => b - a)
  }, [memberLines])

  // member_number -> { member, vfos, mm } for the selected year.
  const totalsByMember = useMemo(() => {
    const map = {}
    for (const l of memberLines) {
      if (l.year !== year) continue
      const k = l.member_number
      const t = map[k] || (map[k] = { member: 0, vfos: 0, mm: 0 })
      const isMM = (l.revenue_decision || '') === 'Money Mapping'
      const ms = Number(l.member_share) || 0
      if (isMM) t.mm += ms
      else t.member += ms
      t.vfos += Number(l.vfos_share) || 0
    }
    return map
  }, [memberLines, year])

  const memberByNo = useMemo(() => {
    const map = {}; for (const m of allMembers) map[String(m.member_number)] = m; return map
  }, [allMembers])

  // Only members with any $ this year (matches the Holistic reconciliation).
  const rows = useMemo(() => {
    return Object.entries(totalsByMember)
      .filter(([, t]) => t.member || t.vfos || t.mm)
      .map(([mn, t]) => {
        const m = memberByNo[mn]
        const eligible = m?.credit_note_eligible !== false
        return { mn, t, m, cn: eligible ? creditNote(t.vfos) : null }
      })
      .sort((a, b) => String(a.mn).localeCompare(String(b.mn), undefined, { numeric: true }))
  }, [totalsByMember, memberByNo])

  const tot = rows.reduce((s, r) => ({ member: s.member + r.t.member, vfos: s.vfos + r.t.vfos, mm: s.mm + r.t.mm, cn: s.cn + (r.cn || 0) }), { member: 0, vfos: 0, mm: 0, cn: 0 })

  const wrap = { padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0f0', background: '#fff', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#16264a', cursor: 'pointer' }
  const grid = '90px 1.4fr 120px 120px 130px 130px 150px'
  const muted = { color: '#c2cbdb' }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Accounting</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: NAVY, margin: 0 }}>VFO Specialist Reconciliation</h2>
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
            <span>Member #</span><span>Member Name</span><span style={{ textAlign: 'right' }}>Member Share</span><span style={{ textAlign: 'right' }}>Money Mapping</span><span style={{ textAlign: 'right' }}>Elite VFO Income</span><span style={{ textAlign: 'right' }}>Accred. Rebate</span><span style={{ textAlign: 'right' }}>Accred. Credit Note</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '11px 18px', borderBottom: '2px solid #e3eaf5', background: '#fbfdff', alignItems: 'center', fontSize: '13px', fontWeight: 800, color: NAVY }}>
            <span />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#697a9c' }}>Totals</span>
            <span style={{ textAlign: 'right' }}>{money(tot.member)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.mm)}</span>
            <span style={{ textAlign: 'right' }}>{money(tot.vfos)}</span>
            <span style={{ textAlign: 'right', ...muted }}>—</span>
            <span style={{ textAlign: 'right' }}>{tot.cn ? money(tot.cn) : '—'}</span>
          </div>
          <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {rows.map(({ mn, m, t, cn }) => (
              <div key={mn} style={{ display: 'grid', gridTemplateColumns: grid, gap: '8px', padding: '11px 18px', borderBottom: '1px solid #f0f3f9', alignItems: 'center', fontSize: '13px', color: '#16264a' }}>
                <span style={{ color: '#4e6087' }}>{mn || '—'}</span>
                <span style={{ fontWeight: 600 }}>{m ? memberName(m) : '—'}</span>
                <span style={{ textAlign: 'right', fontWeight: t.member ? 700 : 400, color: t.member ? '#16264a' : '#c2cbdb' }}>{money(t.member)}</span>
                <span style={{ textAlign: 'right', fontWeight: t.mm ? 700 : 400, color: t.mm ? '#16264a' : '#c2cbdb' }}>{money(t.mm)}</span>
                <span style={{ textAlign: 'right', fontWeight: t.vfos ? 700 : 400, color: t.vfos ? '#16264a' : '#c2cbdb' }}>{money(t.vfos)}</span>
                <span style={{ textAlign: 'right', ...muted }}>—</span>
                <span style={{ textAlign: 'right', fontWeight: cn ? 700 : 400, color: cn ? '#7c3aed' : '#c2cbdb' }}>{cn ? money(cn) : '—'}</span>
              </div>
            ))}
            {rows.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: '#9aa7be', fontSize: '14px' }}>No member activity for this year.</div>}
          </div>
        </div>
      )}
      <p style={{ fontSize: '11.5px', color: '#9aa7be', marginTop: '12px' }}>Credit note is based on the member's Elite VFO Income and their "Eligible for Credit Note" setting (&gt;$100k → $18,000; $75k–$100k → $9,000; &gt;$50k–&lt;$75k → $6,000). Accreditation rebate is not tracked yet — shown blank.</p>
    </div>
  )
}
