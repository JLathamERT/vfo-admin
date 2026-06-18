import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { NAVY, INK, MUTED, GREEN, AMBER, cardStyle, accentStrip, inputStyle, pillSolid, pillOutline, miniLabel, Radios } from './ui'
import { CATEGORY_ORDER, CATEGORY_LABELS_LONG } from './constants'
import AddActionForm from './AddActionForm'

const LEVELS = [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]
const DROP = '#c2502f'

// Shared "off-plan priorities" surface, used two ways:
//   • member portal — as its own top-level tab (Dropped Priorities / Parking Garage)
//   • admin One Page Plan — embedded at the bottom under a Dropped/Parking switcher
// `tab` selects the pool: 'dropped' = off-plan & not parked (+ create-your-own),
// 'parking' = parked. Each row can be added to the plan (with Owned By / Value /
// Effort) and moved to the other bucket (Dropped → Park, Parking → Drop). Members
// may only act while Accountability Mode is on; admins always.
export default function GrowthAddPriority({ memberNumber, bundle, reload, role = 'member', tab = 'dropped', embedded = false }) {
  const isAdmin = role === 'admin'
  const isParking = tab === 'parking'
  const acctOn = !!bundle.score?.accountability_mode
  const canEdit = isAdmin || acctOn
  const [showCreate, setShowCreate] = useState(false)

  const pool = (bundle.actions || [])
    .filter(a => a.g3_status !== 'one_page_plan')
    .filter(a => {
      const parked = a.g2_status === 'park' || a.g3_status === 'park'
      return isParking ? parked : !parked
    })
    .sort((a, b) => a.action_number - b.action_number)

  const title = isParking ? 'Parking Garage' : 'Dropped Priorities'
  const heroMeta = isParking
    ? <>Priorities parked for later — add one to your plan, or drop it.</>
    : <>Pick a priority, set who's responsible and its value &amp; effort, then add it to your plan — or park it for later.</>

  // Member without Accountability Mode: read-only notice (no pool, no create).
  if (!canEdit) {
    return (
      <div>
        {!embedded && <TrackHero eyebrow="Growth Plan" title={title} meta={heroMeta} />}
        <div style={cardStyle}><div style={accentStrip} /><div style={{ padding: '20px', fontSize: '13px', color: MUTED }}>You can add priorities once your coach turns on Accountability Mode.</div></div>
      </div>
    )
  }

  async function addCustom(fields) {
    await callApi('growth_plan_add_action', { member_number: memberNumber, ...fields })
    if (reload) await reload()
  }

  return (
    <div>
      {!embedded && <TrackHero eyebrow="Growth Plan" title={title} meta={heroMeta} />}
      {!isParking && (
        <div style={cardStyle}>
          <div style={accentStrip} />
          <div style={{ padding: '16px 20px' }}>
            {!showCreate
              ? <button onClick={() => setShowCreate(true)} style={{ ...pillOutline, borderColor: GREEN, color: GREEN }}>+ Create your own priority (not in the list)</button>
              : <AddActionForm idKey="custom" submitLabel="Add to Plan" onCancel={() => setShowCreate(false)} onSubmit={async (f) => { await addCustom(f); setShowCreate(false) }} />}
          </div>
        </div>
      )}
      {pool.length === 0
        ? <div style={cardStyle}><div style={accentStrip} /><div style={{ padding: '20px', fontSize: '13px', color: MUTED }}>{isParking ? 'Nothing parked.' : 'Every priority is already on the plan or parked.'}</div></div>
        : CATEGORY_ORDER.map(cat => {
          const rows = pool.filter(a => a.category === cat)
          if (!rows.length) return null
          return (
            <div key={cat} style={cardStyle}>
              <div style={accentStrip} />
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: NAVY, marginBottom: '4px' }}>{CATEGORY_LABELS_LONG[cat]}</div>
                {rows.map(a => <AddRow key={a.id} a={a} memberNumber={memberNumber} reload={reload} isParking={isParking} />)}
              </div>
            </div>
          )
        })}
    </div>
  )
}

function AddRow({ a, memberNumber, reload, isParking }) {
  const [open, setOpen] = useState(false)
  const [owned, setOwned] = useState('')
  const [assisted, setAssisted] = useState('')
  const [value, setValue] = useState('medium')
  const [effort, setEffort] = useState('medium')
  const [busy, setBusy] = useState(false)

  async function write(event, patch) {
    setBusy(true)
    try {
      await callApi('growth_plan_save_actions', { member_number: memberNumber, event, updates: [{ id: a.id, ...patch }] })
      await reload()
    } catch (e) { alert(e?.message || 'Failed to update'); setBusy(false) }
  }
  const addToPlan = () => write('prioritized', { g3_status: 'one_page_plan', g2_status: 'potential', g3_action_type: 'new', owned_by: owned, assisted_by: assisted, value_level: value, effort_level: effort })
  const park = () => write('parking_moved', { g2_status: 'park', g3_status: 'park' })
  const drop = () => write('parking_moved', { g2_status: 'drop', g3_status: '' })

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid #eef2f9' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', fontSize: '13.5px', color: INK, lineHeight: 1.5 }}>{a.action_text}</div>
        {!open && (
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={() => setOpen(true)} style={{ ...pillOutline, borderColor: GREEN, color: GREEN, opacity: busy ? 0.6 : 1 }}>+ Add to Plan</button>
            {isParking
              ? <button disabled={busy} onClick={drop} style={{ ...pillOutline, borderColor: DROP, color: DROP, opacity: busy ? 0.6 : 1 }}>Drop</button>
              : <button disabled={busy} onClick={park} style={{ ...pillOutline, borderColor: AMBER, color: AMBER, opacity: busy ? 0.6 : 1 }}>Park</button>}
          </div>
        )}
      </div>
      {open && (
        <div style={{ marginTop: '12px', background: '#f7f9fc', border: '1px solid #e9eef8', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={miniLabel}>Owned By</div>
              <input value={owned} onChange={e => setOwned(e.target.value)} placeholder="Name" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={miniLabel}>Assisted By</div>
              <input value={assisted} onChange={e => setAssisted(e.target.value)} placeholder="Name" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <div><div style={miniLabel}>Value</div><div style={{ display: 'flex', gap: '14px' }}><Radios name={`v_${a.id}`} value={value} onChange={setValue} options={LEVELS} /></div></div>
            <div><div style={miniLabel}>Effort</div><div style={{ display: 'flex', gap: '14px' }}><Radios name={`e_${a.id}`} value={effort} onChange={setEffort} options={LEVELS} /></div></div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addToPlan} disabled={busy} style={{ ...pillSolid, opacity: busy ? 0.7 : 1 }}>{busy ? 'Adding…' : 'Add to Plan'}</button>
            <button onClick={() => setOpen(false)} disabled={busy} style={pillOutline}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
