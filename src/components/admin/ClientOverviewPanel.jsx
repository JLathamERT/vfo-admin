import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi, getSession } from '../../lib/api'
import ListFilterButton, { matchesFilter, SortSelect, useHeaderSort, sortByColumn, SortHeader } from './ListFilterButton'
import { ClientOverviewSkeleton } from '../shared/skeletons/admin'
import { MemberNameLink } from '../shared/personLinks'

// Client Overview — a mirror of Member Overview, but oriented around clients and
// their program tracks. Five sub-tabs, each lazily loaded from the backend
// `client_overview_load` engine and cached in component state. Each row is a
// client; expanding it reveals that section's track rows with a computed
// last/next action, per-track warnings (skipped steps) and a click-through.

const SECTIONS = [
  { key: 'map1', label: 'MAP 1' },
  { key: 'regular', label: 'Regular Priorities' },
  { key: 'holistic_tax', label: 'Holistic Tax Priorities' },
  { key: 'tax_planning', label: 'Tax Planning' },
  { key: 'pft', label: 'Partnership Fast Track' },
]

// Where a client-name click lands, per section — mirrors the per-track `link`
// values the backend emits (overview-*.ts), so e.g. the Tax Planning sub-tab
// opens the client under program 4, not the Holistic default.
const SECTION_LINK = {
  map1: { program: 1, tab: 'map1' },
  regular: { program: 1, tab: 'regular' },
  holistic_tax: { program: 1, tab: 'tax' },
  tax_planning: { program: 4, tab: 'tax' },
  pft: { program: 2, tab: 'pft' },
}

// The trailing section-specific columns of the expanded sub-table (the leading
// Track/State/Last action/Date/Next action columns are shared).
const SUB_EXTRAS = {
  map1: [
    { label: 'Service level', get: t => t.service_level },
    { label: 'Payment plan', get: t => t.payment_plan },
  ],
  regular: [{ label: 'Specialist', get: t => (t.specialists || []).join(', ') }],
  holistic_tax: [{ label: 'Specialists', get: t => (t.specialists || []).join(', ') }],
  tax_planning: [{ label: 'Specialists', get: t => (t.specialists || []).join(', ') }],
  pft: [{ label: 'Onboarding stage', get: t => t.onboarding_stage_label }],
}
const SUB_TITLE = { map1: 'Track', regular: 'Priority', holistic_tax: 'Plan', tax_planning: 'Plan', pft: 'Engagement' }

const CLIENT_SORT_OPTIONS = [
  { value: 'ref_asc', label: 'Client Ref: A to Z' },
  { value: 'ref_desc', label: 'Client Ref: Z to A' },
  { value: 'az', label: 'Name: A to Z' },
  { value: 'za', label: 'Name: Z to A' },
]

const GRID = '30px 112px 1.5fr 84px 1.3fr 96px 120px'

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function clientStatusColors(status) {
  const s = (status || '').toLowerCase()
  if (s === 'active') return { bg: 'rgba(27,146,84,0.13)', color: '#1b9254' }
  if (s === 'lost') return { bg: 'rgba(231,76,60,0.13)', color: '#e74c3c' }
  if (s === 'pending') return { bg: 'rgba(224,103,23,0.14)', color: '#e06717' }
  return { bg: 'var(--vfo-tint)', color: 'var(--vfo-muted)' }
}

function fmtDate(iso) {
  if (!iso) return '—'
  // Date-only strings must not go through Date() — UTC-midnight parsing shifts
  // them a day back in US timezones.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (m) return `${+m[2]}/${+m[3]}/${m[1]}`
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

const dot = (color) => ({ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: color, display: 'inline-block' })

function StateCell({ state, closedReason }) {
  if (state === 'complete') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1b9254', fontWeight: 600 }}><span style={dot('#1b9254')} />Completed</span>
  if (state === 'closed') return <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '999px', background: 'rgba(231,76,60,0.10)', color: '#b23c30' }}>{closedReason || 'Closed'}</span>
  if (state === 'in_progress') return <span style={{ color: '#0095ff', fontWeight: 600 }}>In progress</span>
  return <span style={{ color: 'var(--vfo-faint)' }}>Not started</span>
}

export default function ClientOverviewPanel() {
  const navigate = useNavigate()
  const session = getSession()
  const showWarnings = !!session?.is_superadmin || (session?.allowed_tabs || []).includes('client_overview_warnings')

  const [activeSection, setActiveSection] = useState('map1')
  const [dataBySection, setDataBySection] = useState({})   // section -> clients[] (success only)
  const [loadingSection, setLoadingSection] = useState(null)
  const [errorBySection, setErrorBySection] = useState({}) // section -> message
  const [expanded, setExpanded] = useState({})             // client id -> bool
  const [warnOpen, setWarnOpen] = useState({})             // `${clientId}:${trackId}` -> bool
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState({ status: ['Active', 'Pending'] })
  const [listSort, setListSort] = useState('ref_asc')
  // One header-sort state for this table instance; kept across sub-tab switches
  // (the main columns are identical in every section).
  const { sort: colSort, onSort, reset: resetColSort } = useHeaderSort()

  // Lazily load each section on first visit; a cached section never refetches, a
  // failed one retries when the admin returns to it.
  useEffect(() => {
    if (dataBySection[activeSection]) return
    let alive = true
    setLoadingSection(activeSection)
    setErrorBySection(e => ({ ...e, [activeSection]: '' }))
    callApi('client_overview_load', { section: activeSection })
      .then(res => { if (alive) setDataBySection(d => ({ ...d, [activeSection]: res.clients || [] })) })
      .catch(err => { if (alive) setErrorBySection(e => ({ ...e, [activeSection]: err.message })) })
      .finally(() => { if (alive) setLoadingSection(ls => (ls === activeSection ? null : ls)) })
    return () => { alive = false }
  }, [activeSection])

  const clients = dataBySection[activeSection] || []
  const isLoading = loadingSection === activeSection && !dataBySection[activeSection]
  const error = errorBySection[activeSection]

  const pfOptions = useMemo(() => [...new Set(clients.map(c => c.assigned_pf).filter(Boolean))].sort(), [clients])
  const programOptions = useMemo(() => {
    const s = new Set()
    clients.forEach(c => (c.programs || []).forEach(p => s.add(p.name)))
    return [...s].sort()
  }, [clients])

  const filterGroups = [
    { key: 'status', label: 'Status', options: ['Active', 'Pending', 'Lost', 'Removed'], get: c => capitalize(c.status) || 'Active' },
    ...(pfOptions.length ? [{ key: 'pf', label: 'PF', options: pfOptions, get: c => c.assigned_pf || '(none)' }] : []),
    ...(programOptions.length ? [{ key: 'programs', label: 'Programs', options: programOptions, get: c => (c.programs || []).map(p => p.name) }] : []),
    ...(showWarnings ? [{ key: 'warnings', label: 'Warnings', options: ['Has warnings'], get: c => ((c.tracks || []).some(t => (t.warnings || []).length > 0) ? ['Has warnings'] : []) }] : []),
  ]

  const q = search.trim().toLowerCase()
  const searched = q
    ? clients.filter(c => c.name?.toLowerCase().includes(q) || c.client_ref?.toLowerCase().includes(q) || String(c.member_number || '').toLowerCase().includes(q) || c.member_name?.toLowerCase().includes(q))
    : clients
  const filtered = searched.filter(c => matchesFilter(c, filterGroups, listFilter))
  // Baseline = the dropdown ordering; a clicked column header overrides it.
  const sorted = useMemo(() => {
    const list = [...filtered]
    const refOf = c => c.client_ref || ''
    const nameOf = c => (c.name || '').toLowerCase()
    switch (listSort) {
      case 'ref_desc': return list.sort((a, b) => refOf(b).localeCompare(refOf(a)))
      case 'az': return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      case 'za': return list.sort((a, b) => nameOf(b).localeCompare(nameOf(a)))
      case 'ref_asc':
      default: return list.sort((a, b) => refOf(a).localeCompare(refOf(b)))
    }
  }, [filtered, listSort])
  const sortColumns = {
    ref: { type: 'text', get: c => c.client_ref },
    name: { type: 'text', get: c => c.name },
    member_number: { type: 'number', get: c => { const n = parseInt(String(c.member_number ?? ''), 10); return Number.isNaN(n) ? null : n } },
    member_name: { type: 'text', get: c => c.member_name },
    status: { type: 'text', get: c => capitalize(c.status) || 'Active' },
    pf: { type: 'text', get: c => c.assigned_pf },
  }
  const rows = sortByColumn(sorted, colSort, sortColumns)

  const extras = SUB_EXTRAS[activeSection] || []
  const subGrid = ['1.2fr', '1.3fr', '1.3fr', '96px', '1.4fr', ...extras.map(() => '1fr'), ...(showWarnings ? ['120px'] : [])].join(' ')

  function openTrack(client, t) {
    const l = t.link || {}
    const url = `/admin/client/${client.id}?program=${l.program}&tab=${l.tab}` + (l.track ? `&track=${l.track}` : '') + (l.plan ? `&plan=${l.plan}` : '')
    navigate(url)
  }

  const wrap = { padding: '24px', maxWidth: '1500px', margin: '0 auto' }
  const sel = { padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-card)', fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'var(--vfo-ink)' }

  return (
    <div style={wrap}>
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '12px', color: '#0a85e8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', margin: 0 }}>Clients</p>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vfo-heading)', margin: '4px 0 0' }}>Client Overview</h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setActiveSection(s.key)}
            style={{ padding: '7px 16px', borderRadius: '999px', border: '1px solid ' + (activeSection === s.key ? '#125ecc' : 'var(--vfo-border-strong)'), background: activeSection === s.key ? '#125ecc' : 'var(--vfo-input)', color: activeSection === s.key ? '#fff' : 'var(--vfo-muted)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search by client, ref, member #, or member name..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...sel, flex: 1, minWidth: '240px', background: 'var(--vfo-input)' }} />
        <ListFilterButton groups={filterGroups} value={listFilter} onChange={setListFilter} />
        <SortSelect value={listSort} onChange={v => { setListSort(v); resetColSort() }} options={CLIENT_SORT_OPTIONS} />
      </div>

      {error && <div style={{ padding: '10px 14px', marginBottom: '12px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '8px', color: '#c0392b', fontSize: '13px' }}>Could not load this section: {error}</div>}

      {isLoading ? <ClientOverviewSkeleton /> : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--vfo-border-soft)', borderRadius: '14px', background: 'var(--vfo-card)', boxShadow: 'var(--vfo-shadow-card)' }}>
          <div style={{ minWidth: '1020px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '12px 18px', background: 'var(--vfo-input)', borderBottom: '1px solid var(--vfo-border-soft)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-muted)' }}>
              <span />
              <SortHeader label="Client Ref" sortKey="ref" sort={colSort} onSort={onSort} />
              <SortHeader label="Name" sortKey="name" sort={colSort} onSort={onSort} />
              <SortHeader label="Member #" sortKey="member_number" sort={colSort} onSort={onSort} />
              <SortHeader label="Member Name" sortKey="member_name" sort={colSort} onSort={onSort} />
              <SortHeader label="Status" sortKey="status" sort={colSort} onSort={onSort} />
              <SortHeader label="PF" sortKey="pf" sort={colSort} onSort={onSort} />
            </div>

            {rows.length === 0 && !error && (
              <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--vfo-faint)', fontSize: '13px' }}>No clients match the current filters.</div>
            )}

            {rows.map(c => {
              const isOpen = !!expanded[c.id]
              const tracks = c.tracks || []
              const allComplete = tracks.length > 0 && tracks.every(t => t.state === 'complete')
              const sc = clientStatusColors(c.status)
              return (
                <div key={c.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '11px 18px', borderBottom: '1px solid var(--vfo-border-soft)', alignItems: 'center', fontSize: '13px', color: 'var(--vfo-ink)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <button
                        onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
                        title={isOpen ? 'Hide tracks' : `Show tracks (${tracks.length})`}
                        style={{ width: '24px', height: '24px', border: '1px solid var(--vfo-border-strong)', background: isOpen ? 'var(--vfo-tint)' : 'var(--vfo-card)', borderRadius: '6px', cursor: 'pointer', color: 'var(--vfo-muted)', fontSize: '11px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isOpen ? '▾' : '▸'}
                      </button>
                      {allComplete && <span style={dot('#1b9254')} title="All tracks completed" />}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--vfo-muted)' }}>{c.client_ref || '—'}</span>
                    <span onClick={() => { const sl = SECTION_LINK[activeSection]; navigate(sl ? `/admin/client/${c.id}?program=${sl.program}&tab=${sl.tab}` : `/admin/client/${c.id}`) }} style={{ fontWeight: 600, color: '#125ecc', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}>{c.name || '—'}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--vfo-muted)' }}>{c.member_number || '—'}</span>
                    {c.member_name
                      ? <MemberNameLink memberNumber={c.member_number} style={{ fontSize: '12px' }}>{c.member_name}</MemberNameLink>
                      : <span style={{ fontSize: '12px', color: 'var(--vfo-faint)' }}>—</span>}
                    <span>
                      {c.status
                        ? <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', fontWeight: 600, background: sc.bg, color: sc.color }}>{capitalize(c.status)}</span>
                        : <span style={{ color: 'var(--vfo-faint)' }}>—</span>}
                    </span>
                    <span style={{ fontSize: '12px', color: c.assigned_pf ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{c.assigned_pf || '—'}</span>
                  </div>

                  {isOpen && (
                    <div style={{ padding: '4px 18px 14px 52px', borderBottom: '1px solid var(--vfo-border-soft)', background: 'var(--vfo-input)' }}>
                      {tracks.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--vfo-faint)', padding: '8px 0' }}>No tracks in this section.</div>
                      ) : (
                        <div style={{ border: '1px solid var(--vfo-border-soft)', borderRadius: '10px', overflow: 'hidden', minWidth: '820px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: subGrid, gap: '10px', padding: '8px 14px', background: 'var(--vfo-input)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vfo-muted)' }}>
                            <span>{SUB_TITLE[activeSection]}</span>
                            <span>State</span>
                            <span>Last action</span>
                            <span>Date</span>
                            <span>Next action</span>
                            {extras.map(e => <span key={e.label}>{e.label}</span>)}
                            {showWarnings && <span>Warnings</span>}
                          </div>
                          {tracks.map(t => {
                            const wk = `${c.id}:${t.id}`
                            const warns = t.warnings || []
                            const wOpen = !!warnOpen[wk]
                            return (
                              <div key={t.id}>
                                <div onClick={() => openTrack(c, t)}
                                  style={{ display: 'grid', gridTemplateColumns: subGrid, gap: '10px', padding: '9px 14px', borderTop: '1px solid var(--vfo-border-soft)', alignItems: 'center', fontSize: '12.5px', color: 'var(--vfo-ink)', background: 'var(--vfo-card)', cursor: 'pointer' }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'var(--vfo-card)'}>
                                  <span style={{ fontWeight: 600, color: '#125ecc' }}>{t.title || '—'}</span>
                                  <span><StateCell state={t.state} closedReason={t.closed_reason} /></span>
                                  <span style={{ color: t.last_action ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{t.last_action || '—'}</span>
                                  <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--vfo-muted)' }}>{fmtDate(t.last_action_at)}</span>
                                  <span style={{ color: t.next_action ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{t.next_action || '—'}</span>
                                  {extras.map(e => {
                                    const v = e.get(t)
                                    return <span key={e.label} style={{ fontSize: '12px', color: v ? 'var(--vfo-ink)' : 'var(--vfo-faint)' }}>{v || '—'}</span>
                                  })}
                                  {showWarnings && (
                                    <span>
                                      {warns.length === 0
                                        ? <span style={{ color: 'var(--vfo-faint)' }}>—</span>
                                        : <span onClick={ev => { ev.stopPropagation(); setWarnOpen(w => ({ ...w, [wk]: !w[wk] })) }}
                                            style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '999px', background: 'rgba(230,168,20,0.16)', color: '#b7791f', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                            {warns.length} warning{warns.length === 1 ? '' : 's'}
                                          </span>}
                                    </span>
                                  )}
                                </div>
                                {showWarnings && wOpen && warns.length > 0 && (
                                  <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--vfo-border-soft)', background: 'rgba(230,168,20,0.06)' }}>
                                    {warns.map((w, i) => (
                                      <div key={i} style={{ fontSize: '12px', color: '#8a5c12', padding: '3px 0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                        <span style={{ ...dot('#b7791f'), marginTop: '5px' }} />
                                        <span>{w.detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
