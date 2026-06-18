import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { NAVY, INK, BLUE, inputStyle, cardStyle, accentStrip, miniLabel, NumBadge, Radios, GrowthNeed, StepNav } from './ui'

const LEVELS = [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]
const fieldGroup = { background: '#f7f9fc', border: '1px solid #e9eef8', borderRadius: '10px', padding: '11px 16px' }

export default function GrowthBuildPlan({ memberNumber, bundle, reload, onNavigate }) {
  const onePage = (bundle.actions || [])
    .filter(a => a.g3_status === 'one_page_plan')
    .sort((a, b) => a.action_number - b.action_number)
  const [rows, setRows] = useState(() => onePage.map(a => ({
    id: a.id, action_number: a.action_number, action_text: a.action_text || '',
    owned_by: a.owned_by || '', assisted_by: a.assisted_by || '',
    value_level: a.value_level || 'medium', effort_level: a.effort_level || 'medium',
  })))
  const [saving, setSaving] = useState(false)
  // Per-plan pool of names for the Owned By / Assisted By dropdowns — seeded from
  // names already on this plan, and grows as you type new ones. Shared across both
  // fields and every row, so a name is only ever entered once for this person's plan.
  const [people, setPeople] = useState(() => {
    const set = new Set()
    for (const a of onePage) for (const v of [a.owned_by, a.assisted_by]) if (v && v.trim()) set.add(v.trim())
    return [...set]
  })
  function rememberName(name) {
    const n = (name || '').trim()
    if (n) setPeople(p => p.includes(n) ? p : [...p, n])
  }
  const sortedPeople = [...people].sort((a, b) => a.localeCompare(b))

  if (!bundle.score) return <GrowthNeed text="Complete Scoring Growth first." cta="Go to Scoring Growth" onClick={() => onNavigate('gp_score')} />
  if (!onePage.length) return <GrowthNeed text="No actions are in the One Page Plan yet — complete Prioritize Growth Actions first." cta="Go to Prioritize Growth Actions" onClick={() => onNavigate('gp_prioritize')} />

  function update(id, patch) { setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r)) }

  async function save(target) {
    setSaving(true)
    try {
      await callApi('growth_plan_save_actions', {
        member_number: memberNumber,
        updates: rows.map(r => ({ id: r.id, owned_by: r.owned_by, assisted_by: r.assisted_by, value_level: r.value_level, effort_level: r.effort_level })),
      })
      await reload()
      onNavigate(target)
    } catch (e) { alert(e?.message || 'Failed to save') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <TrackHero
        eyebrow="Growth Plan"
        title="Build One Page Growth Plan"
        meta={<>Assign ownership and rate each action's value and effort. Names you enter are saved to a reusable dropdown shared across all rows.</>}
      />
      {rows.map((r, i) => (
        <div key={r.id} style={cardStyle}>
          <div style={accentStrip} />
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '14px' }}>
              <NumBadge n={i + 1} />
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: NAVY, lineHeight: 1.5, paddingTop: '3px' }}>{r.action_text}</div>
            </div>
            <div style={{ paddingLeft: '34px' }}>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                  <div style={miniLabel}>Owned By</div>
                  <NameCombo value={r.owned_by} onChange={v => update(r.id, { owned_by: v })} onCommit={rememberName} people={sortedPeople} placeholder="Type or pick a name" />
                </div>
                <div style={{ flex: '1 1 220px', minWidth: '180px' }}>
                  <div style={miniLabel}>Assisted By</div>
                  <NameCombo value={r.assisted_by} onChange={v => update(r.id, { assisted_by: v })} onCommit={rememberName} people={sortedPeople} placeholder="Type or pick a name" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={fieldGroup}>
                  <div style={miniLabel}>Value</div>
                  <div style={{ display: 'flex', gap: '14px' }}><Radios name={`v_${r.id}`} value={r.value_level} onChange={v => update(r.id, { value_level: v })} options={LEVELS} /></div>
                </div>
                <div style={fieldGroup}>
                  <div style={miniLabel}>Effort</div>
                  <div style={{ display: 'flex', gap: '14px' }}><Radios name={`e_${r.id}`} value={r.effort_level} onChange={v => update(r.id, { effort_level: v })} options={LEVELS} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
      <StepNav onBack={() => save('gp_prioritize')} onNext={() => save('gp_onepage')} nextLabel="View One Page Plan →" busy={saving} />
    </div>
  )
}

// Styled name combobox — replaces the native <datalist> (whose popup can't be
// themed). Pick an existing name from the per-plan pool or type a new one. The
// menu is portaled to <body> so the card's overflow:hidden can't clip it, and
// positioned to the input via its viewport rect (closes on scroll/resize).
function NameCombo({ value, onChange, onCommit, people, placeholder }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const inputRef = useRef(null)

  function openMenu() {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const q = (value || '').trim().toLowerCase()
  const filtered = people.filter(n => n.toLowerCase().includes(q))
  const exact = people.some(n => n.toLowerCase() === q)

  function pick(name) { onChange(name); if (onCommit) onCommit(name); setOpen(false) }

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); if (!open) openMenu() }}
        onFocus={openMenu}
        onClick={openMenu}
        onBlur={() => { if (onCommit) onCommit(value); setOpen(false) }}
        placeholder={placeholder}
        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', paddingRight: '30px' }}
      />
      <span onMouseDown={e => { e.preventDefault(); open ? setOpen(false) : openMenu() }}
        style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#8a97b0', cursor: 'pointer' }}>▼</span>
      {open && rect && createPortal(
        <div style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, maxHeight: '224px', overflowY: 'auto', background: '#fff', border: '1px solid #d6e0ee', borderRadius: '10px', boxShadow: '0 12px 30px rgba(20,45,95,0.18)', zIndex: 1000, fontFamily: 'Inter, sans-serif' }}>
          {filtered.map(n => <ComboOpt key={n} label={n} active={n.toLowerCase() === q} onPick={() => pick(n)} />)}
          {q && !exact && <ComboOpt label={`+ Add "${value.trim()}"`} accent topBorder={filtered.length > 0} onPick={() => pick(value.trim())} />}
          {!filtered.length && !q && <div style={{ padding: '11px 14px', fontSize: '12px', color: '#8a97b0' }}>No saved names yet — type to add one.</div>}
        </div>, document.body)}
    </div>
  )
}

function ComboOpt({ label, onPick, active, accent, topBorder }) {
  const [hover, setHover] = useState(false)
  return (
    <div onMouseDown={e => { e.preventDefault(); onPick() }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '10px 14px', fontSize: '13px', cursor: 'pointer', color: accent ? BLUE : INK, fontWeight: (accent || active) ? 700 : 500, background: hover ? '#eef4ff' : (active ? '#f4f7fd' : '#fff'), borderTop: topBorder ? '1px solid #eef2f9' : 'none' }}>
      {label}
    </div>
  )
}
