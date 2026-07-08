import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { NAVY, INK, MUTED, BLUE, inputStyle, cardStyle, accentStrip, GrowthNeed, StepNav, GrowthTabs } from './ui'
import { orderOnePage } from './grouping'
import AddActionForm from './AddActionForm'
import GrowthAddPriority from './GrowthAddPriority'

// Accountability progress statuses + their dot colors (light dots — yellow,
// light green — carry a `dark` flag so the matrix number stays navy/legible).
// These keys satisfy the growth_plan_actions.accountability_status CHECK constraint.
const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: '#f1c40f', dark: true },
  { value: 'behind', label: 'Behind Expectations', color: '#e74c3c' },
  { value: 'progressing', label: 'Progressing on Plan', color: '#86d6a0', dark: true },
  { value: 'ahead', label: 'Ahead of Expectations', color: '#16a34a' },
  { value: 'completed', label: 'Completed', color: BLUE },
]
const STATUS_COLOR = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.color]))
// Light dots (yellow, light green) need dark text to stay legible.
const STATUS_DARK = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, !!o.dark]))

// Rows top→bottom = High/Medium/Low Value; cols left→right = Low/Medium/High Effort
// (matches the legacy matrix orientation: top-left = high value / low effort).
const VALUE_ROWS = [{ key: 'high', label: 'High Value' }, { key: 'medium', label: 'Medium Value' }, { key: 'low', label: 'Low Value' }]
const EFFORT_COLS = [{ key: 'low', label: 'Low Effort' }, { key: 'medium', label: 'Medium Effort' }, { key: 'high', label: 'High Effort' }]

// Blue gradient scale across the 9 quadrants: deepest at high-value/high-effort
// (top-right) → lightest at low-value/low-effort (bottom-left).
const V_WEIGHT = { high: 2, medium: 1, low: 0 }
const E_WEIGHT = { high: 2, medium: 1, low: 0 }
const CELL_BLUES = ['#eef2f9', '#c3d9f7', '#94bbef', '#5b93e4', '#2f6fd6']
function cellBg(vKey, eKey) {
  const d = (V_WEIGHT[vKey] ?? 1) + (E_WEIGHT[eKey] ?? 1)
  return CELL_BLUES[d]
}

function seedField(bundle, field) {
  const o = {}
  for (const a of (bundle.actions || [])) o[a.id] = a[field] || ''
  return o
}

function fmtDueDate(d) {
  const [y, m, day] = String(d).split('-').map(Number)
  if (!y || !m || !day) return String(d)
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default function GrowthOnePage({ memberNumber, bundle, reload, onNavigate, role = 'admin', variant }) {
  const isAdmin = role === 'admin'
  const score = bundle.score
  const [acctMode, setAcctMode] = useState(!!score?.accountability_mode)
  const [dues, setDues] = useState(() => seedField(bundle, 'due_date'))
  const [statuses, setStatuses] = useState(() => seedField(bundle, 'accountability_status'))

  async function toggleAcct() {
    const next = !acctMode
    setAcctMode(next)
    try {
      await callApi('growth_plan_set_accountability', { member_number: memberNumber, enabled: next })
      if (reload) reload()
    } catch (e) { setAcctMode(!next); alert(e?.message || 'Failed to update Accountability Mode') }
  }
  async function setDue(id, date) {
    const prev = dues[id] || ''
    setDues(d => ({ ...d, [id]: date }))
    try {
      await callApi('growth_plan_set_accountability', { member_number: memberNumber, due_dates: [{ id, due_date: date || null }] })
      if (reload) reload()
    } catch (e) { setDues(d => ({ ...d, [id]: prev })); alert(e?.message || 'Failed to save due date') }
  }
  async function setStatus(id, status) {
    const prev = statuses[id] || ''
    setStatuses(s => ({ ...s, [id]: status }))
    try {
      await callApi('growth_plan_save_accountability', { member_number: memberNumber, updates: [{ id, status: status || '' }] })
      if (reload) reload()
    } catch (e) { setStatuses(s => ({ ...s, [id]: prev })); alert(e?.message || 'Failed to save progress') }
  }
  async function onDelete(id) {
    if (typeof window !== 'undefined' && !window.confirm('Remove this custom priority? Any sub-tasks under it are removed too.')) return
    try { await callApi('growth_plan_delete_action', { member_number: memberNumber, id }); if (reload) await reload() }
    catch (e) { alert(e?.message || 'Failed to remove') }
  }
  async function addSubtask(parentId, fields) {
    await callApi('growth_plan_add_action', { member_number: memberNumber, parent_action_id: parentId, ...fields })
    if (reload) await reload()
  }
  async function saveField(id, patch) {
    try {
      await callApi('growth_plan_save_actions', { member_number: memberNumber, updates: [{ id, ...patch }] })
      if (reload) reload()
    } catch (e) { alert(e?.message || 'Failed to save') }
  }

  if (!score) return <GrowthNeed text="Complete Scoring Growth first." cta="Go to Scoring Growth" onClick={() => onNavigate('gp_score')} />

  const op = (bundle.actions || [])
    .filter(a => a.g3_status === 'one_page_plan')
    .sort((a, b) => a.action_number - b.action_number)
  if (!op.length) return isAdmin
    ? <GrowthNeed text="No actions are in the One Page Plan yet — complete the earlier steps first." cta="Go to Build One Page Plan" onClick={() => onNavigate('gp_build')} />
    : <GrowthNeed text="No priorities have been added to your Growth Plan yet." />

  // Completed priorities leave the matrix + New/Ongoing tables for their own
  // "Completed Action Items" list. Active items keep the shared 1..N numbering
  // (matrix + New/Ongoing); completed items are numbered separately. Uses live
  // `statuses` so marking an item Completed moves it instantly.
  const byIdAll = new Map(op.map(a => [a.id, a]))
  const active = op.filter(a => statuses[a.id] !== 'completed')
  const doneItems = op.filter(a => statuses[a.id] === 'completed')
  const ordered = orderOnePage(active, byIdAll)
  const news = ordered.filter(a => a.section === 'new')
  const ongoing = ordered.filter(a => a.section === 'ongoing')
  const numberedDone = doneItems.map((a, i) => ({ ...a, num: i + 1, isSub: !!a.parent_action_id, parentText: byIdAll.get(a.parent_action_id)?.action_text || '' }))
  const canEdit = isAdmin || acctMode

  const dateStr = new Date(score.completed_at || score.created_at)
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div>
      <TrackHero eyebrow="Growth Plan" title="One Page Growth Plan" meta={<>Plan for the road ahead · <strong style={{ color: 'var(--vfo-ink-2)' }}>{dateStr}</strong></>} />

      {/* Accountability Mode toggle (admin only) */}
      {isAdmin && (
        <div style={cardStyle}>
          <div style={accentStrip} />
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 320px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)' }}>Accountability Mode</div>
              <div style={{ fontSize: '12.5px', color: MUTED, marginTop: '4px', lineHeight: 1.45 }}>
                Turn on to set an update-by date and track progress on each priority.
              </div>
            </div>
            <Toggle on={acctMode} onClick={toggleAcct} />
          </div>
        </div>
      )}

      {/* Value / Effort matrix */}
      <div style={cardStyle}>
        <div style={accentStrip} />
        <div style={{ padding: '20px' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '540px' }}>
              <Matrix items={ordered} acct={acctMode} statuses={statuses} />
            </div>
          </div>
          {acctMode && (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--vfo-tint)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--vfo-card)', border: '2px solid rgba(0,41,115,0.18)' }} />
                <span style={{ fontSize: '11.5px', color: MUTED }}>Not set</span>
              </span>
              {STATUS_OPTIONS.filter(o => o.value !== 'completed').map(o => (
                <span key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: o.color }} />
                  <span style={{ fontSize: '11.5px', color: MUTED }}>{o.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <ActionTable title="New Action Items" rows={news} acct={acctMode} isAdmin={isAdmin} canEdit={canEdit} dues={dues} statuses={statuses} onDue={setDue} onStatus={setStatus} onDelete={onDelete} onAddSubtask={addSubtask} onSaveField={saveField} />
      <ActionTable title="Ongoing Action Items" rows={ongoing} acct={acctMode} isAdmin={isAdmin} canEdit={canEdit} dues={dues} statuses={statuses} onDue={setDue} onStatus={setStatus} onDelete={onDelete} onAddSubtask={addSubtask} onSaveField={saveField} />
      {numberedDone.length > 0 && <ActionTable title="Completed Action Items" rows={numberedDone} acct={acctMode} isAdmin={isAdmin} canEdit={canEdit} dues={dues} statuses={statuses} onDue={setDue} onStatus={setStatus} onDelete={onDelete} onSaveField={saveField} />}
      {isAdmin && <AdminAddPriorities memberNumber={memberNumber} bundle={bundle} reload={reload} variant={variant} />}
      {isAdmin && <StepNav onBack={() => onNavigate('gp_build')} />}
    </div>
  )
}

const ADD_TABS = [{ key: 'parking', label: 'Parking Garage' }, { key: 'dropped', label: 'Dropped Priorities' }]

// Admin-only section at the bottom of the One Page Plan: add off-plan priorities
// to the plan, mirroring the member's Dropped Priorities / Parking Garage tabs.
function AdminAddPriorities({ memberNumber, bundle, reload, variant }) {
  const [tab, setTab] = useState('parking')
  return (
    <div style={{ marginTop: '26px', marginBottom: '6px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vfo-heading)', marginBottom: '12px' }}>Add Priorities</div>
      <GrowthTabs tabs={ADD_TABS} active={tab} onChange={setTab} />
      <div style={{ marginTop: '14px' }}>
        <GrowthAddPriority role="admin" tab={tab} embedded memberNumber={memberNumber} bundle={bundle} reload={reload} variant={variant} />
      </div>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} style={{
      width: '54px', height: '30px', borderRadius: '999px', border: 'none', cursor: 'pointer', flexShrink: 0,
      background: on ? 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)' : '#cdd8ea',
      padding: '3px', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', transition: 'background .15s',
    }}>
      <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--vfo-card)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
    </button>
  )
}

// The Value/Effort matrix keeps its designed colors in BOTH themes (Jake's call,
// 2026-07-02) — every color in this box is a fixed literal on purpose.
function Matrix({ items, acct, statuses }) {
  const cols = '120px repeat(3, 1fr)'
  const last = VALUE_ROWS.length - 1
  return (
    <div style={{ border: '1px solid #d6e0ee', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, background: '#ffffff' }}>
        <div style={{ borderBottom: '1px solid #e9eef8' }} />
        {EFFORT_COLS.map(c => (
          <div key={c.key} style={{ ...colHeader, borderBottom: '1px solid #e9eef8' }}>{c.label}</div>
        ))}
      </div>
      {VALUE_ROWS.map((vr, ri) => (
        <div key={vr.key} style={{ display: 'grid', gridTemplateColumns: cols }}>
          <div style={{ ...rowHeader, background: '#ffffff', borderBottom: ri < last ? '1px solid #e9eef8' : 'none' }}>{vr.label}</div>
          {EFFORT_COLS.map((ec, ci) => {
            const cellItems = items.filter(a => (a.value_level || 'medium') === vr.key && (a.effort_level || 'medium') === ec.key)
            return (
              <div key={ec.key} style={{ ...matrixCell, background: cellBg(vr.key, ec.key), borderLeft: ci === 0 ? '1px solid #e9eef8' : '1px solid rgba(255,255,255,0.5)', borderBottom: ri < last ? '1px solid rgba(255,255,255,0.5)' : 'none' }}>
                {cellItems.map(a => <MatrixDot key={a.id} num={a.num} color={acct ? STATUS_COLOR[statuses[a.id]] : undefined} dark={acct ? STATUS_DARK[statuses[a.id]] : false} />)}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// Dots must stand out on any quadrant shade. White fill (navy number, faint navy
// ring) by default; under Accountability Mode the fill becomes the bright status
// color with a white ring so it still pops on the blue cells.
function MatrixDot({ num, color, dark }) {
  const filled = !!color
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '50%',
      background: color || '#ffffff',
      color: filled ? (dark ? NAVY : '#ffffff') : NAVY,
      fontWeight: 800, fontSize: '14px', fontFamily: 'Inter, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: filled ? '2px solid #ffffff' : '2px solid rgba(0,41,115,0.18)',
      boxShadow: '0 2px 8px rgba(0,20,60,0.40)',
    }}>{num}</div>
  )
}

function ActionTable({ title, rows, acct, isAdmin, canEdit, dues, statuses, onDue, onStatus, onDelete, onAddSubtask, onSaveField }) {
  const colCount = 4 + (acct ? 2 : 0)
  return (
    <div style={cardStyle}>
      <div style={accentStrip} />
      <div style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--vfo-heading)', marginBottom: rows.length ? '10px' : 0 }}>{title}</div>
        {rows.length === 0
          ? <div style={{ fontSize: '12.5px', color: MUTED }}>None.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: acct ? '760px' : '480px' }}>
                <thead>
                  <tr>
                    <th style={th(40)}>#</th>
                    <th style={th()}>Action</th>
                    <th style={th(140)}>Owned By</th>
                    <th style={th(140)}>Assisted By</th>
                    {acct && <th style={th(140)}>Update By</th>}
                    {acct && <th style={th(190)}>Progress</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => (
                    <ActionRow key={a.id} a={a} acct={acct} isAdmin={isAdmin} canEdit={canEdit} dues={dues} statuses={statuses} onDue={onDue} onStatus={onStatus} onDelete={onDelete} onAddSubtask={onAddSubtask} onSaveField={onSaveField} colCount={colCount} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  )
}

function ActionRow({ a, acct, isAdmin, canEdit, dues, statuses, onDue, onStatus, onDelete, onAddSubtask, onSaveField, colCount }) {
  const [adding, setAdding] = useState(false)
  const [owned, setOwned] = useState(a.owned_by || '')
  const [assisted, setAssisted] = useState(a.assisted_by || '')
  return (
    <>
      <tr>
        <td style={{ ...td, fontWeight: 700, color: 'var(--vfo-heading)' }}>{a.num}</td>
        <td style={td}>
          {a.isSub && <span style={{ color: 'var(--vfo-faint)', marginRight: '5px' }}>↳</span>}{a.action_text}
          {a.is_custom && canEdit && onDelete && <button onClick={() => onDelete(a.id)} title="Remove custom priority" style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#c2502f', cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: 0, lineHeight: 1 }}>×</button>}
          {a.isSub && a.parentText && <div style={{ fontSize: '11px', color: 'var(--vfo-faint)', marginTop: '2px' }}>sub-task of: {a.parentText}</div>}
          {!a.isSub && canEdit && onAddSubtask && (
            <div style={{ marginTop: '5px' }}>
              <button onClick={() => setAdding(v => !v)} style={{ background: 'none', border: 'none', color: BLUE, cursor: 'pointer', fontSize: '11.5px', fontWeight: 600, padding: 0 }}>{adding ? '× Cancel sub-task' : '+ Add sub-task'}</button>
            </div>
          )}
        </td>
        <td style={td}>
          {canEdit
            ? <input value={owned} onChange={e => setOwned(e.target.value)} onBlur={() => { if ((a.owned_by || '') !== owned) onSaveField(a.id, { owned_by: owned }) }} placeholder="Name" style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
            : (a.owned_by || '—')}
        </td>
        <td style={td}>
          {canEdit
            ? <input value={assisted} onChange={e => setAssisted(e.target.value)} onBlur={() => { if ((a.assisted_by || '') !== assisted) onSaveField(a.id, { assisted_by: assisted }) }} placeholder="Name" style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }} />
            : (a.assisted_by || '—')}
        </td>
        {acct && (
          <td style={td}>
            {isAdmin
              ? <input type="date" value={dues[a.id] || ''} onChange={e => onDue(a.id, e.target.value)} style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px' }} />
              : <span style={{ fontSize: '12.5px', color: dues[a.id] ? INK : 'var(--vfo-faint)' }}>{dues[a.id] ? fmtDueDate(dues[a.id]) : '—'}</span>}
          </td>
        )}
        {acct && (
          <td style={td}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: STATUS_COLOR[statuses[a.id]] || '#cdd8ea' }} />
              <select value={statuses[a.id] || ''} onChange={e => onStatus(a.id, e.target.value)} style={{ ...inputStyle, padding: '5px 8px', fontSize: '12px', width: '100%' }}>
                <option value="">— Not set —</option>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </td>
        )}
      </tr>
      {adding && (
        <tr>
          <td colSpan={colCount} style={{ padding: '0 10px 14px' }}>
            <AddActionForm idKey={'sub' + a.id} submitLabel="Add sub-task" placeholder="Describe the sub-task…" onCancel={() => setAdding(false)} onSubmit={async (f) => { await onAddSubtask(a.id, f); setAdding(false) }} />
          </td>
        </tr>
      )}
    </>
  )
}

const colHeader = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#002973', textAlign: 'center', padding: '11px 8px' }
const rowHeader = { fontSize: '11px', fontWeight: 700, color: '#002973', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', textAlign: 'right', padding: '0 12px' }
const matrixCell = { minHeight: '80px', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', alignItems: 'center', alignContent: 'center' }
const th = (w) => ({ textAlign: 'left', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--vfo-faint)', padding: '6px 10px', borderBottom: '2px solid var(--vfo-tint)', width: w ? `${w}px` : 'auto' })
const td = { fontSize: '13px', color: INK, padding: '9px 10px', borderBottom: '1px solid var(--vfo-tint)', verticalAlign: 'top', lineHeight: 1.45 }
