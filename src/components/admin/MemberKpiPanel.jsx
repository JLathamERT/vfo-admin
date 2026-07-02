import { useState, useMemo } from 'react'
import { KpiHero, SplitDonut, BreakdownRows, BreakdownCard } from './KpiKit'

// ── Member-type families ──────────────────────────────────────────────
// A "family" is a headline product grouped with its constituent member_types.
// Matching is EXACT (a reverse type->family map below), never substring, so e.g.
// "Implementation - VFO FT (Direct)" lands in its own family and is NOT swept
// into "VFO FT". Any member_type not listed here falls into a synthetic
// "Other" family so every member is always counted somewhere.
// Display order is the array order below (advisor + accountant KPI pages render
// families in this exact sequence — see familyData, which preserves source order
// for the curated advisor/accountant sets).
const ADVISOR_FAMILIES = [
  { key: 'implementation', label: 'Implementation', types: ['Implementation'] },
  { key: 'catalyst', label: 'Catalyst', types: ['Free Catalyst', 'Catalyst', 'Catalyst A'] },
  { key: 'accelerator', label: 'Accelerator', types: ['Accelerator', 'Accelerator A', 'Legacy Accelerator'] },
  { key: 'fusion', label: 'Fusion', types: ['Free Fusion', 'Fusion', 'Fusion A', 'Fusion A - I/M', 'Legacy Fusion'] },
  { key: 'corporate', label: 'Corporate Members', types: ['Corporate Member', 'Free Corporate Member', 'Free Corporate Member (Legacy)'] },
  { key: 'tbm', label: 'Legacy TBM', types: ['Free Legacy TBM'] },
  { key: 'financial', label: 'Financial Collaborator', types: ['Financial Collaborator'] },
  { key: 'reconciliation', label: 'VFO Reconciliation', types: ['VFO Reconciliation (Free)'] },
]

const ACCOUNTANT_FAMILIES = [
  { key: 'impl_ft', label: 'Implementation — VFO FT', types: ['Implementation - VFO FT (Direct)', 'Implementation - VFO FT (Advisor)'] },
  { key: 'vfo_ft', label: 'VFO FT', types: ['VFO FT (Direct)', 'VFO FT (Advisor)'] },
  { key: 'plus', label: 'Plus', types: ['Plus (Direct)', 'Plus (Advisor)'] },
  { key: 'advanced', label: 'Advanced', types: ['Advanced (Direct)', 'Advanced (Advisor)'] },
  { key: 'vfo_associate', label: 'VFO Associate', types: ['VFO Associate (Direct)', 'VFO Associate (Advisor)'] },
  { key: 'survey', label: 'Survey', types: ['Survey #1', 'Survey #2', 'Survey #3'] },
  { key: 'team', label: 'Team Member', types: ['Team Member'] },
  { key: 'fac', label: 'FAC Historic', types: ['FAC Historic'] },
]

// ── Status lenses ─────────────────────────────────────────────────────
// `suspended` and `paused` are boolean flags that sit ON TOP of an Active
// member, so they are SUBSETS of Active — selecting them re-scopes to the
// active members carrying that flag (they render as hollow-dot chips, not bar
// segments, because they'd double-count Active in the stacked bar).
const LENSES = [
  { key: 'active', label: 'Active', color: '#1b9254', desc: 'of total' },
  { key: 'suspended', label: 'Suspended', color: '#c98a14', desc: 'of active', sub: true },
  { key: 'paused', label: 'Paused', color: '#e06717', desc: 'of active', sub: true },
  { key: 'lost', label: 'Lost', color: '#e74c3c', desc: 'of total' },
  { key: 'removed', label: 'Removed', color: '#9fb1d6', desc: 'of total' },
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

export default function MemberKpiPanel({ allMembers, category }) {
  const [lens, setLens] = useState('active')

  const isAdvisorPage = category === 'advisor'
  const isStrategic = category === 'strategic_member'
  const title = isAdvisorPage ? 'Advisor KPIs' : isStrategic ? 'Strategic Member KPIs' : 'Accountant KPIs'
  const breakdownLabel = isStrategic ? 'Breakdown by group' : 'Breakdown by member type'
  const noun = isAdvisorPage ? 'advisors' : isStrategic ? 'strategic members' : 'accountants'

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
  // stays stable regardless of which lens is active.
  const statusCounts = useMemo(() => ({
    all: pool.length,
    active: pool.filter(LENS_PREDICATE.active).length,
    suspended: pool.filter(LENS_PREDICATE.suspended).length,
    paused: pool.filter(LENS_PREDICATE.paused).length,
    lost: pool.filter(LENS_PREDICATE.lost).length,
    removed: pool.filter(LENS_PREDICATE.removed).length,
  }), [pool])

  // Everything below the hero re-scopes to the selected status.
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
    const orderIndex = {}
    ordered.forEach((f, i) => { orderIndex[f.key] = i })
    return ordered
      .filter((f) => counts[f.key] > 0)
      .map((f) => ({
        key: f.key,
        label: f.label,
        count: counts[f.key],
        sub: Object.entries(subs[f.key]).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      }))
      // Advisor/accountant: render in the curated source-array order (the manual
      // KPI layout). Strategic groups are built dynamically, so they keep the
      // count-desc ordering ("other" always sorts last there).
      .sort((a, b) => {
        if (!isStrategic) return orderIndex[a.key] - orderIndex[b.key]
        if (a.key === 'other') return 1
        if (b.key === 'other') return -1
        return b.count - a.count
      })
  }, [scoped, typeToFamily, families, isStrategic])

  const activeLens = LENSES.find((l) => l.key === lens)

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '24px' }}>
      <KpiHero
        title={title}
        subtitle={`${statusCounts.all} ${noun} total · ${scoped.length} in view`}
        lenses={LENSES}
        counts={statusCounts}
        lens={lens}
        setLens={setLens}
        unitLabel="members"
      />

      <div style={{ display: 'flex', gap: '16px', alignItems: 'stretch', flexWrap: 'wrap' }}>
        {!isStrategic && (
          <div style={{ flex: '1 1 300px', minWidth: '280px', display: 'flex', flexDirection: 'column' }}>
            <SplitDonut
              title="Legacy vs New Model"
              total={scoped.length}
              segments={[
                { label: 'New Model', n: model.newModel, color: '#0a85e8' },
                { label: 'Legacy Model', n: model.legacy, color: '#8a9bbd' },
                ...(model.unknown > 0 ? [{ label: 'Unspecified', n: model.unknown, color: '#b9c6dd' }] : []),
              ]}
            />
          </div>
        )}
        <div style={{ flex: '2 1 460px', minWidth: '300px' }}>
          <BreakdownCard
            title={breakdownLabel}
            count={scoped.length}
            activeLens={lens !== 'all' ? activeLens : null}
            onClearLens={() => setLens('all')}
          >
            {familyData.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--vfo-faint)', fontSize: '14px' }}>
                No {noun} match the <strong>{activeLens.label}</strong> status.
              </div>
            ) : (
              <BreakdownRows rows={familyData} denom={scoped.length} />
            )}
          </BreakdownCard>
        </div>
      </div>
    </div>
  )
}
