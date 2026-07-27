import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callApi } from '../../lib/api'
import { ListHeader } from '../shared/TrackKit'
import { DirectoryListSkeleton } from '../shared/Skeleton'

const STORAGE_KEY = 'taxPlannerListIncluded'

function readIncluded() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]')
    if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite)
  } catch { /* ignore malformed */ }
  return []
}

export default function PlannerClientsList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [rows, setRows] = useState([])
  const [group, setGroup] = useState([])
  const [selfId, setSelfId] = useState(null)
  const [search, setSearch] = useState('')
  const [included, setIncluded] = useState(() => readIncluded())
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  async function load(includedIds) {
    setLoading(true)
    setLoadError('')
    try {
      const payload = includedIds && includedIds.length > 0 ? { planner_ids: includedIds } : {}
      const data = await callApi('tax_planner_portal_clients', payload)
      setRows(data.clients || [])
      setGroup(data.group || [])
      setSelfId(data.self_id ?? null)
    } catch (err) {
      setLoadError(err.message || 'Failed to load clients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const restored = readIncluded()
    const ids = restored.length > 0 ? restored : null
    load(ids)
  }, [])

  useEffect(() => {
    if (!filterOpen) return
    function onDocClick(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [filterOpen])

  function toggleInclude(id) {
    setIncluded(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      const idsToLoad = selfId != null ? [selfId, ...next] : next
      load(idsToLoad)
      return next
    })
  }

  const others = useMemo(
    () => group.filter(g => g.id !== selfId),
    [group, selfId],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      (r.client_name || '').toLowerCase().includes(q) ||
      (r.client_ref || '').toLowerCase().includes(q) ||
      (r.member_name || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const inputStyle = { padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '14px', width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }

  if (loading) {
    return (
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
        <DirectoryListSkeleton />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', padding: '28px 24px' }}>
      {loadError && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)' }}>{loadError}</div>
      )}

      <ListHeader title="Tax Planning" count={filtered.length} />

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input placeholder="Search by client, ref, or member..." style={inputStyle} onChange={e => setSearch(e.target.value)} value={search} />
        {others.length > 0 && (
          <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--vfo-border-strong)', background: included.length > 0 ? 'rgba(0,149,255,0.08)' : 'var(--vfo-input)', color: 'var(--vfo-ink)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif' }}>
              Group{included.length > 0 ? ` (${included.length})` : ''}
            </button>
            {filterOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, minWidth: '240px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '12px', boxShadow: '0 8px 28px rgba(20,45,95,0.16)', padding: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--vfo-faint)', padding: '4px 8px 8px' }}>Include group clients</div>
                {others.map(g => (
                  <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', color: 'var(--vfo-ink)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--vfo-tint)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <input type="checkbox" checked={included.includes(g.id)} onChange={() => toggleInclude(g.id)} style={{ cursor: 'pointer' }} />
                    Include {g.name}'s clients
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        {filtered.map(row => (
          <div key={row.tax_plan_id}
            onClick={() => navigate(`/tax-planner/client/${row.client_id}?program=${row.program_id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px', marginBottom: '6px', background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(20,45,95,0.04)', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,149,255,0.4)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--vfo-border-soft)'}>
            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12.5px', color: 'var(--vfo-muted)', width: '90px', flexShrink: 0 }}>{row.client_ref}</span>
            <span style={{ fontSize: '14px', color: 'var(--vfo-ink)', fontWeight: 600, flexShrink: 0 }}>{row.client_name || '—'}</span>
            <span style={{ fontSize: '12.5px', color: 'var(--vfo-muted)' }}>{row.member_name || '—'}</span>
            <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '12px', color: 'var(--vfo-faint)', whiteSpace: 'nowrap' }}>{row.planner_name || '—'}</span>
          </div>
        ))}
        {filtered.length === 0 && !loadError && (
          <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--vfo-faint)', fontSize: '13.5px', background: 'var(--vfo-tint)', border: '1px dashed var(--vfo-border-chip)', borderRadius: '12px' }}>
            {search ? 'No clients match your search.' : 'Your allocated clients will appear here.'}
          </div>
        )}
      </div>
    </div>
  )
}
