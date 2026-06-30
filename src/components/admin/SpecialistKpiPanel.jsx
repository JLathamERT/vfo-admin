import { useState, useMemo } from 'react'

// Specialist (experts) analytics. Mirrors the member KPI page's visual language
// but for the specialist data model: statuses are Active / Lost / Removed only
// (no suspended/paused), the "model" split becomes Top of the T vs not, and the
// type breakdown becomes the ecosystems — which OVERLAP, because a specialist
// can belong to more than one (Member Services excepted — it's mutually exclusive).
// So ecosystem counts intentionally sum to more than the roster, and we say so.

const ECOSYSTEMS = ['Business Advisory', 'Risk Mitigation', 'Legal Services', 'Tax Planning', 'Wealth Management', 'Member Services']

const LENSES = [
  { key: 'active', label: 'Active', color: '#1b9254', desc: 'of total' },
  { key: 'lost', label: 'Lost', color: '#e74c3c', desc: 'of total' },
  { key: 'removed', label: 'Removed', color: '#7c8aa6', desc: 'of total' },
  { key: 'all', label: 'Total', color: '#125ecc', desc: 'incl. lost & removed' },
]

const statusOf = (e) => e.status || 'Active'
const LENS_PREDICATE = {
  all: () => true,
  active: (e) => statusOf(e) === 'Active',
  lost: (e) => statusOf(e) === 'Lost',
  removed: (e) => statusOf(e) === 'Removed',
}

function hexA(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
function darken(hex, f = 0.8) {
  const h = hex.replace('#', '')
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f)
  return `rgb(${r},${g},${b})`
}

function StatCard({ lens, value, total, selected, onClick }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const c = lens.color
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        border: selected ? `1.5px solid ${c}` : '1px solid #e9eef8',
        background: selected ? `linear-gradient(135deg, ${c} 0%, ${darken(c)} 100%)` : '#ffffff',
        borderRadius: '14px', padding: '14px 16px 13px', overflow: 'hidden', minWidth: 0, width: '100%',
        boxShadow: selected ? `0 10px 24px ${hexA(c, 0.34)}` : '0 2px 10px rgba(20,45,95,0.05)',
        transition: 'transform .15s ease, box-shadow .15s ease',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; if (!selected) e.currentTarget.style.boxShadow = '0 8px 20px rgba(20,45,95,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = selected ? `0 10px 24px ${hexA(c, 0.34)}` : '0 2px 10px rgba(20,45,95,0.05)' }}
    >
      {!selected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: c }} />}
      <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: selected ? 'rgba(255,255,255,0.88)' : '#7c8aa6' }}>{lens.label}</div>
      <div style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: '6px', color: selected ? '#ffffff' : '#16264a', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '11px', fontWeight: 600, marginTop: '3px', color: selected ? 'rgba(255,255,255,0.82)' : '#9aa6bf' }}>
        {lens.key === 'all' ? lens.desc : `${pct}% ${lens.desc}`}
      </div>
    </button>
  )
}

// Top of the T vs not — proportion bar (mirrors the member page's model split).
function TopOfTSplit({ topT, notTopT, total }) {
  const seg = [
    { label: 'Top of the T', n: topT, color: '#c89b2a' },
    { label: 'Not Top of the T', n: notTopT, color: '#8a9bbd' },
  ]
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0)
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px 22px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Top of the T</span>
        <span style={{ fontSize: '12px', color: '#9aa6bf', fontWeight: 600 }}>{total} in view</span>
      </div>
      <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', background: '#eef2f9', border: '1px solid #e3eaf5' }}>
        {seg.map((s) => s.n > 0 && (
          <div key={s.label} title={`${s.label}: ${s.n}`} style={{ width: `${pct(s.n)}%`, background: s.color, transition: 'width .3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '20px', marginTop: '14px', flexWrap: 'wrap' }}>
        {seg.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: '13px', color: '#16264a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{s.n}</span>
            <span style={{ fontSize: '12px', color: '#697a9c' }}>{s.label}</span>
            <span style={{ fontSize: '11px', color: '#9aa6bf', fontWeight: 600 }}>{Math.round(pct(s.n))}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SpecialistKpiPanel({ experts = [], ecoMap = {} }) {
  const [lens, setLens] = useState('active')

  const pool = experts
  const statusCounts = useMemo(() => ({
    all: pool.length,
    active: pool.filter(LENS_PREDICATE.active).length,
    lost: pool.filter(LENS_PREDICATE.lost).length,
    removed: pool.filter(LENS_PREDICATE.removed).length,
  }), [pool])

  const scoped = useMemo(() => pool.filter(LENS_PREDICATE[lens]), [pool, lens])
  const ecosOf = (e) => ecoMap[e.id] || []

  const top = useMemo(() => {
    const t = scoped.filter((e) => e.top_of_t === true).length
    return { topT: t, notTopT: scoped.length - t }
  }, [scoped])

  // Ecosystem membership is NOT mutually exclusive — a specialist counts in each
  // ecosystem they belong to. Sorted by count desc; all five always shown.
  const ecoData = useMemo(() => {
    const counts = ECOSYSTEMS.map((name) => ({ name, count: scoped.filter((e) => ecosOf(e).includes(name)).length }))
    return counts.sort((a, b) => b.count - a.count)
  }, [scoped, ecoMap])
  const multi = useMemo(() => scoped.filter((e) => ecosOf(e).length > 1).length, [scoped, ecoMap])
  const none = useMemo(() => scoped.filter((e) => ecosOf(e).length === 0).length, [scoped, ecoMap])
  const maxEco = Math.max(1, ...ecoData.map((d) => d.count))

  const activeLens = LENSES.find((l) => l.key === lens)
  const wrap = { maxWidth: '1180px', margin: '0 auto', padding: '24px' }

  return (
    <div style={wrap}>
      {/* Hero */}
      <div style={{ borderRadius: '18px', overflow: 'hidden', marginBottom: '22px', background: 'linear-gradient(120deg, #002973 0%, #0a3f9e 48%, #125ecc 100%)', boxShadow: '0 14px 34px rgba(0,41,115,0.26)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-30px', width: '230px', height: '230px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%)' }} />
        <div style={{ position: 'relative', padding: '26px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '220px' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff', lineHeight: 1.1 }}>Specialist KPIs</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '60px', fontWeight: 800, letterSpacing: '-0.04em', color: '#ffffff', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums' }}>{statusCounts.active}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: '6px' }}>Active specialists</div>
          </div>
        </div>
      </div>

      {/* Status lens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        {LENSES.map((l) => (
          <StatCard
            key={l.key}
            lens={l}
            value={statusCounts[l.key]}
            total={statusCounts.all}
            selected={lens === l.key}
            onClick={() => setLens(lens === l.key ? 'all' : l.key)}
          />
        ))}
      </div>

      {/* Top of the T split (scoped) */}
      <TopOfTSplit topT={top.topT} notTopT={top.notTopT} total={scoped.length} />

      {/* Ecosystem breakdown header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#002973' }}>Breakdown by ecosystem</span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>{scoped.length}</span>
        </div>
        {lens !== 'all' && (
          <button onClick={() => setLens('all')} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'Inter, sans-serif', color: activeLens.color, background: hexA(activeLens.color, 0.1), border: `1px solid ${hexA(activeLens.color, 0.3)}`, borderRadius: '999px', padding: '6px 13px', cursor: 'pointer' }}>
            Filtered: {activeLens.label}
            <span style={{ fontSize: '14px', lineHeight: 1, opacity: 0.7 }}>×</span>
          </button>
        )}
      </div>
      <div style={{ fontSize: '12px', color: '#697a9c', marginBottom: '16px' }}>
        Specialists can belong to more than one ecosystem, so these counts overlap and add up to more than the roster.
      </div>

      {/* Ecosystem ranked bars */}
      <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '20px 22px', marginBottom: '16px' }}>
        {ecoData.map((d) => (
          <div key={d.name} style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <span style={{ fontSize: '13.5px', color: '#16264a', fontWeight: 600 }}>{d.name}</span>
              <span style={{ fontSize: '13.5px', color: '#16264a', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {d.count}
                <span style={{ fontSize: '11px', color: '#9aa6bf', fontWeight: 600, marginLeft: '6px' }}>
                  {scoped.length > 0 ? Math.round((d.count / scoped.length) * 100) : 0}%
                </span>
              </span>
            </div>
            <div style={{ height: '8px', borderRadius: '999px', background: '#eef2f9', overflow: 'hidden' }}>
              <div style={{ width: `${(d.count / maxEco) * 100}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#125ecc,#0a85e8)', transition: 'width .3s' }} />
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #eef2f9' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '999px', background: 'rgba(0,149,255,0.1)', border: '1px solid rgba(0,149,255,0.25)', color: '#0a6fc2' }}>
            {multi} in 2+ ecosystems
          </span>
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>
            {none} in none
          </span>
        </div>
      </div>
    </div>
  )
}
