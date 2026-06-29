import { useState, useMemo } from 'react'

// ── Member-type families ──────────────────────────────────────────────
// A "family" is a headline product grouped with its constituent member_types.
// Matching is EXACT (a reverse type->family map below), never substring, so e.g.
// "Implementation - VFO FT (Direct)" lands in its own family and is NOT swept
// into "VFO FT". Any member_type not listed here falls into a synthetic
// "Other" family so every member is always counted somewhere.
const ADVISOR_FAMILIES = [
  { key: 'catalyst', label: 'Catalyst', types: ['Free Catalyst', 'Catalyst', 'Catalyst A'] },
  { key: 'fusion', label: 'Fusion', types: ['Free Fusion', 'Fusion', 'Fusion A', 'Fusion A - I/M', 'Legacy Fusion'] },
  { key: 'accelerator', label: 'Accelerator', types: ['Accelerator', 'Accelerator A', 'Legacy Accelerator'] },
  { key: 'tbm', label: 'Legacy TBM', types: ['Free Legacy TBM'] },
  { key: 'implementation', label: 'Implementation', types: ['Implementation'] },
  { key: 'financial', label: 'Financial Collaborator', types: ['Financial Collaborator'] },
  { key: 'reconciliation', label: 'VFO Reconciliation', types: ['VFO Reconciliation (Free)'] },
  { key: 'corporate', label: 'Corporate Members', types: ['Corporate Member', 'Free Corporate Member', 'Free Corporate Member (Legacy)'] },
]

const ACCOUNTANT_FAMILIES = [
  { key: 'impl_ft', label: 'Implementation — VFO FT', types: ['Implementation - VFO FT (Direct)', 'Implementation - VFO FT (Advisor)'] },
  { key: 'advanced', label: 'Advanced', types: ['Advanced (Direct)', 'Advanced (Advisor)'] },
  { key: 'plus', label: 'Plus', types: ['Plus (Direct)', 'Plus (Advisor)'] },
  { key: 'vfo_ft', label: 'VFO FT', types: ['VFO FT (Direct)', 'VFO FT (Advisor)'] },
  { key: 'vfo_associate', label: 'VFO Associate', types: ['VFO Associate (Direct)', 'VFO Associate (Advisor)'] },
  { key: 'team', label: 'Team Member', types: ['Team Member'] },
  { key: 'survey', label: 'Survey', types: ['Survey #1', 'Survey #2', 'Survey #3'] },
  { key: 'fac', label: 'FAC Historic', types: ['FAC Historic'] },
]

// ── Status lenses ─────────────────────────────────────────────────────
// `suspended` and `paused` are boolean flags that sit ON TOP of an Active
// member, so they are SUBSETS of Active — clicking them re-scopes to the
// active members carrying that flag. Lost/Removed come from elite_status.
// Active is first (it's the default lens); Total sits last as the grand total —
// its natural home as the sum of every status, and labelled so it's clear it
// includes Lost & Removed (not just the active roster).
const LENSES = [
  { key: 'active', label: 'Active', color: '#1b9254', desc: 'of total' },
  { key: 'suspended', label: 'Suspended', color: '#c98a14', desc: 'of active', sub: true },
  { key: 'paused', label: 'Paused', color: '#e06717', desc: 'of active', sub: true },
  { key: 'lost', label: 'Lost', color: '#e74c3c', desc: 'of total' },
  { key: 'removed', label: 'Removed', color: '#7c8aa6', desc: 'of total' },
  { key: 'all', label: 'Total', color: '#125ecc', desc: 'incl. lost & removed' },
]

const statusOf = (m) => m.elite_status || 'Active'
const isActive = (m) => statusOf(m) === 'Active'

const LENS_PREDICATE = {
  all: () => true,
  active: isActive,
  suspended: (m) => isActive(m) && !!m.suspended,
  paused: (m) => isActive(m) && !!m.paused,
  lost: (m) => statusOf(m) === 'Lost',
  removed: (m) => statusOf(m) === 'Removed',
}

// ── small color helpers ───────────────────────────────────────────────
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

// ── Clickable status stat card (the "lens") ───────────────────────────
function StatCard({ lens, value, total, selected, onClick }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const c = lens.color
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        border: selected ? `1.5px solid ${c}` : `1px solid ${lens.sub ? '#eef2f9' : '#e9eef8'}`,
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

// ── Legacy vs New model proportion bar ────────────────────────────────
function ModelSplit({ legacy, newModel, unknown, total }) {
  const seg = [
    { label: 'New Model', n: newModel, color: '#0a85e8' },
    { label: 'Legacy Model', n: legacy, color: '#8a9bbd' },
    ...(unknown > 0 ? [{ label: 'Unspecified', n: unknown, color: '#cdd7e8' }] : []),
  ]
  const pct = (n) => (total > 0 ? (n / total) * 100 : 0)
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', padding: '18px 22px', marginBottom: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Legacy vs New Model</span>
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

// ── A member-type family card with its sub-type breakdown ─────────────
function FamilyCard({ fam, scopedTotal, rank }) {
  const sharePct = scopedTotal > 0 ? Math.round((fam.count / scopedTotal) * 100) : 0
  const top = fam.subtypes[0]?.count || 1
  const isMulti = fam.subtypes.length > 1
  return (
    <div
      style={{ background: '#ffffff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 3px 14px rgba(20,45,95,0.05)', overflow: 'hidden', transition: 'transform .15s ease, box-shadow .15s ease', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 28px rgba(20,45,95,0.13)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 3px 14px rgba(20,45,95,0.05)' }}
    >
      <div style={{ height: '3px', background: rank === 0 ? 'linear-gradient(90deg,#002973 0%,#125ecc 60%,#0a85e8 100%)' : '#e3eaf5' }} />
      <div style={{ padding: '16px 18px 17px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#16264a', letterSpacing: '-0.01em' }}>{fam.label}</div>
            <div style={{ fontSize: '11px', color: '#9aa6bf', fontWeight: 600, marginTop: '3px' }}>{sharePct}% of view{isMulti ? ` · ${fam.subtypes.length} types` : ''}</div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.03em', color: '#125ecc', lineHeight: 1, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fam.count}</div>
        </div>

        {isMulti && (
          <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid #eef2f9', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {fam.subtypes.map((st) => (
              <div key={st.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: '#4e6087', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.type || '— (unset)'}</span>
                  <span style={{ fontSize: '12.5px', color: '#16264a', fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginLeft: '8px', flexShrink: 0 }}>{st.count}</span>
                </div>
                <div style={{ height: '5px', borderRadius: '999px', background: '#eef2f9', overflow: 'hidden' }}>
                  <div style={{ width: `${(st.count / top) * 100}%`, height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg,#125ecc,#0a85e8)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemberKpiPanel({ allMembers, category }) {
  const [lens, setLens] = useState('active')

  const isAdvisorPage = category === 'advisor'
  const isStrategic = category === 'strategic_member'
  const title = isAdvisorPage ? 'Advisor KPIs' : isStrategic ? 'Strategic Member KPIs' : 'Accountant KPIs'
  const breakdownLabel = isStrategic ? 'Breakdown by group' : 'Breakdown by member type'

  // The category pool. Advisors = everything that is NOT an accountant or
  // strategic member (intentionally includes the null-category Corporate
  // Members, matching the Advisor Search list); accountants / strategic members
  // = exact member_category match.
  const pool = useMemo(() => (
    isAdvisorPage
      ? allMembers.filter((m) => m.member_category !== 'accountant' && m.member_category !== 'strategic_member')
      : allMembers.filter((m) => m.member_category === category)
  ), [allMembers, isAdvisorPage, category])

  // Family set. Advisors/accountants have curated family groupings; strategic
  // members are grouped by their Strategic Group (member_type) — one single-type
  // family per group, built dynamically from the pool.
  const families = useMemo(() => {
    if (isAdvisorPage) return ADVISOR_FAMILIES
    if (!isStrategic) return ACCOUNTANT_FAMILIES
    const groups = [...new Set(pool.map((m) => m.member_type).filter(Boolean))].sort()
    return groups.map((g) => ({ key: g, label: g, types: [g] }))
  }, [isAdvisorPage, isStrategic, pool])

  // Exact type -> family reverse map (rebuilt when the family set changes).
  const typeToFamily = useMemo(() => {
    const map = {}
    families.forEach((f) => f.types.forEach((t) => { map[t] = f.key }))
    return map
  }, [families])

  // Headline status counts — always computed off the FULL pool so the lens
  // cards stay stable regardless of which lens is active.
  const statusCounts = useMemo(() => ({
    all: pool.length,
    active: pool.filter(LENS_PREDICATE.active).length,
    suspended: pool.filter(LENS_PREDICATE.suspended).length,
    paused: pool.filter(LENS_PREDICATE.paused).length,
    lost: pool.filter(LENS_PREDICATE.lost).length,
    removed: pool.filter(LENS_PREDICATE.removed).length,
  }), [pool])

  // Everything below the lens re-scopes to the selected status.
  const scoped = useMemo(() => pool.filter(LENS_PREDICATE[lens]), [pool, lens])

  const model = useMemo(() => {
    const legacy = scoped.filter((m) => m.advisor_model === 'Legacy Model').length
    const newModel = scoped.filter((m) => m.advisor_model === 'New Model').length
    return { legacy, newModel, unknown: scoped.length - legacy - newModel }
  }, [scoped])

  // Aggregate the scoped pool into families + sub-types.
  const familyData = useMemo(() => {
    const counts = {}   // famKey -> total
    const subs = {}     // famKey -> { memberType -> count }
    scoped.forEach((m) => {
      const key = typeToFamily[m.member_type] || 'other'
      counts[key] = (counts[key] || 0) + 1
      if (!subs[key]) subs[key] = {}
      const t = m.member_type || ''
      subs[key][t] = (subs[key][t] || 0) + 1
    })
    const ordered = [...families, { key: 'other', label: 'Other', types: [] }]
    return ordered
      .filter((f) => counts[f.key] > 0)
      .map((f) => ({
        key: f.key,
        label: f.label,
        count: counts[f.key],
        subtypes: Object.entries(subs[f.key]).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
      }))
      // Families WITH sub-types ("big" cards) sort ahead of single-type ("small")
      // cards, each group then ordered by count desc — avoids big/small/big jitter.
      .sort((a, b) => {
        const am = a.subtypes.length > 1 ? 0 : 1
        const bm = b.subtypes.length > 1 ? 0 : 1
        if (am !== bm) return am - bm
        return b.count - a.count
      })
  }, [scoped, typeToFamily, families])

  const activeLens = LENSES.find((l) => l.key === lens)
  const wrap = { maxWidth: '1180px', margin: '0 auto', padding: '24px' }

  return (
    <div style={wrap}>
      {/* Hero */}
      <div style={{ borderRadius: '18px', overflow: 'hidden', marginBottom: '22px', background: 'linear-gradient(120deg, #002973 0%, #0a3f9e 48%, #125ecc 100%)', boxShadow: '0 14px 34px rgba(0,41,115,0.26)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-60px', right: '-30px', width: '230px', height: '230px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 70%)' }} />
        <div style={{ position: 'relative', padding: '26px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '220px' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.03em', color: '#ffffff', lineHeight: 1.1 }}>{title}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '60px', fontWeight: 800, letterSpacing: '-0.04em', color: '#ffffff', lineHeight: 0.95, fontVariantNumeric: 'tabular-nums' }}>{statusCounts.active}</div>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: '6px' }}>Active members</div>
          </div>
        </div>
      </div>

      {/* Status lens */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        {LENSES.map((l) => (
          <StatCard
            key={l.key}
            lens={l}
            value={statusCounts[l.key]}
            total={l.sub ? statusCounts.active : statusCounts.all}
            selected={lens === l.key}
            onClick={() => setLens(lens === l.key ? 'all' : l.key)}
          />
        ))}
      </div>

      {/* Model split (scoped) — strategic members have no Legacy/New model */}
      {!isStrategic && <ModelSplit legacy={model.legacy} newModel={model.newModel} unknown={model.unknown} total={scoped.length} />}

      {/* Family breakdown header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em', color: '#002973' }}>{breakdownLabel}</span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#eef2f9', border: '1px solid #dde5f2', color: '#4e6087' }}>{scoped.length}</span>
        </div>
        {lens !== 'all' && (
          <button
            onClick={() => setLens('all')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'Inter, sans-serif', color: activeLens.color, background: hexA(activeLens.color, 0.1), border: `1px solid ${hexA(activeLens.color, 0.3)}`, borderRadius: '999px', padding: '6px 13px', cursor: 'pointer' }}
          >
            Filtered: {activeLens.label}
            <span style={{ fontSize: '14px', lineHeight: 1, opacity: 0.7 }}>×</span>
          </button>
        )}
      </div>

      {/* Family grid */}
      {familyData.length === 0 ? (
        <div style={{ background: '#ffffff', border: '1px dashed #d6e0ee', borderRadius: '16px', padding: '40px', textAlign: 'center', color: '#9aa6bf', fontSize: '14px' }}>
          No {isAdvisorPage ? 'advisors' : isStrategic ? 'strategic members' : 'accountants'} match the <strong style={{ color: '#7c8aa6' }}>{activeLens.label}</strong> status.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '14px', alignItems: 'start' }}>
          {familyData.map((fam, i) => (
            <FamilyCard key={fam.key} fam={fam} scopedTotal={scoped.length} rank={i} />
          ))}
        </div>
      )}
    </div>
  )
}
