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
// the item's value for that group.
export function matchesFilter(item, groups, value) {
  return groups.every(g => {
    const sel = value[g.key] || []
    return sel.length === 0 || sel.includes(g.get(item))
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

// Small sort dropdown for the admin lists (Newest / Oldest by join date).
export function SortSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#f7f9fc', color: '#4e6087', fontSize: '13px', fontWeight: 600, fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
      <option value="default">Sort: Default</option>
      <option value="newest">Join date: Newest</option>
      <option value="oldest">Join date: Oldest</option>
    </select>
  )
}
