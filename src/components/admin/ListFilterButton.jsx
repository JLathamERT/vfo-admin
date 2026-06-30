import { useState } from 'react'

// Reusable multi-select filter dropdown for admin lists. `groups` is an array of
// { key, label, options: string[], get: item => string }. `value` is
// { [key]: string[] }. An item matches a group when that group's selection is
// empty (no filter) OR includes the item's value. The caller's initial `value`
// sets the default (e.g. { status: ['Active'] }); "All" = untick everything in a
// group.
export default function ListFilterButton({ groups, value, onChange }) {
  const [open, setOpen] = useState(false)
  const total = groups.reduce((n, g) => n + (value[g.key]?.length || 0), 0)
  function toggle(key, opt) {
    const cur = value[key] || []
    onChange({ ...value, [key]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] })
  }
  const btnStyle = { padding: '9px 16px', borderRadius: '8px', border: '1px solid #d6e0ee', background: total > 0 ? 'rgba(18,94,204,0.1)' : '#f7f9fc', color: total > 0 ? '#125ecc' : '#4e6087', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={btnStyle}>
        Filter{total > 0 ? ` (${total})` : ''}<span style={{ fontSize: '9px', opacity: 0.6 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
          <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '6px', background: '#fff', border: '1px solid #e3eaf5', borderRadius: '12px', minWidth: '220px', zIndex: 200, padding: '8px 0', boxShadow: '0 14px 36px rgba(20,45,95,0.16)', maxHeight: '380px', overflowY: 'auto' }}>
            {groups.map(g => (
              <div key={g.key} style={{ padding: '6px 14px 10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#4e6087', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{g.label}</div>
                {g.options.map(opt => (
                  <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', fontSize: '13px', color: '#16264a', cursor: 'pointer' }}>
                    <input type="checkbox" checked={(value[g.key] || []).includes(opt)} onChange={() => toggle(g.key, opt)} style={{ accentColor: '#125ecc', cursor: 'pointer' }} />
                    {opt}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// An item passes when every group is either unselected (no filter) or includes
// the item's value for that group. `get` may return a single value (scalar) or
// an array of values (e.g. a specialist's ecosystems) — for an array, the item
// matches when ANY of its values is selected.
export function matchesFilter(item, groups, value) {
  return groups.every(g => {
    const sel = value[g.key] || []
    if (sel.length === 0) return true
    const got = g.get(item)
    return Array.isArray(got) ? got.some(v => sel.includes(v)) : sel.includes(got)
  })
}

// Sort a list by join_date. 'newest' = most recent first, 'oldest' = earliest
// first, anything else leaves the original order. Items with no join_date sort last.
export function sortByJoin(arr, sortBy) {
  if (sortBy !== 'newest' && sortBy !== 'oldest') return arr
  return [...arr].sort((a, b) => {
    const da = a.join_date || '', db = b.join_date || ''
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return sortBy === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
  })
}

// Richer sort for the member directories (advisors / accountants / strategic):
// by member number (low/high), join date (oldest/newest), or name (A→Z / Z→A).
// Member numbers are usually integers but corporate ones look like "<parent>-C<n>";
// we sort on the leading integer, breaking ties (and non-numeric values) with a
// string compare. Items with no join_date sort last in the date modes.
export const MEMBER_SORT_OPTIONS = [
  { value: 'number_asc', label: 'Member #: Low to High' },
  { value: 'number_desc', label: 'Member #: High to Low' },
  { value: 'date_oldest', label: 'Join date: Oldest' },
  { value: 'date_newest', label: 'Join date: Newest' },
  { value: 'az', label: 'Name: A to Z' },
  { value: 'za', label: 'Name: Z to A' },
]

export function sortMembers(arr, sortBy) {
  const list = [...arr]
  const numKey = (m) => String(m.plugin_member_number ?? m.member_number ?? '')
  const numOf = (m) => { const n = parseInt(numKey(m), 10); return Number.isNaN(n) ? Infinity : n }
  const nameOf = (m) => (m.name || '').toLowerCase()
  const byNumber = (a, b) => (numOf(a) - numOf(b)) || numKey(a).localeCompare(numKey(b))
  const byDate = (a, b, dir) => {
    const da = a.join_date || '', db = b.join_date || ''
    if (!da && !db) return 0
    if (!da) return 1
    if (!db) return -1
    return dir === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
  }
  switch (sortBy) {
    case 'number_desc': return list.sort((a, b) => byNumber(b, a))
    case 'date_oldest': return list.sort((a, b) => byDate(a, b, 'oldest'))
    case 'date_newest': return list.sort((a, b) => byDate(a, b, 'newest'))
    case 'az': return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
    case 'za': return list.sort((a, b) => nameOf(b).localeCompare(nameOf(a)))
    case 'number_asc':
    default: return list.sort(byNumber)
  }
}

// Small sort dropdown for the admin lists. Defaults to the join-date options
// (used by the specialist list); the member directories pass MEMBER_SORT_OPTIONS.
const DEFAULT_SORT_OPTIONS = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'newest', label: 'Join date: Newest' },
  { value: 'oldest', label: 'Join date: Oldest' },
]
export function SortSelect({ value, onChange, options = DEFAULT_SORT_OPTIONS }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#4e6087', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
