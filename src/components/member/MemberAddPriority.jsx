import { useState } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { NAVY, INK, MUTED, GREEN, cardStyle, accentStrip, inputStyle, pillSolid, pillOutline, miniLabel, Radios } from '../growth/ui'
import { CATEGORY_ORDER, CATEGORY_LABELS_LONG } from '../growth/constants'
import AddActionForm from '../growth/AddActionForm'

const LEVELS = [{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]

// Member view: add any off-plan action (the originally dropped + parked pool) to
// the One Page Plan, setting Owned By / Assisted By / Value / Effort on the way in.
// Member edits are only permitted while Accountability Mode is on.
export default function MemberAddPriority({ memberNumber, bundle, reload }) {
  const [showCreate, setShowCreate] = useState(false)
  const acctOn = !!bundle.score?.accountability_mode
  const available = (bundle.actions || [])
    .filter(a => a.g3_status !== 'one_page_plan')
    .sort((a, b) => a.action_number - b.action_number)

  if (!acctOn) {
    return (
      <div>
        <TrackHero eyebrow="Growth Plan" title="Add a Priority" meta={<>Add an action to your plan.</>} />
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
      <TrackHero eyebrow="Growth Plan" title="Add a Priority" meta={<>Pick an action, set who's responsible and its value &amp; effort, then add it to your plan.</>} />
      <div style={cardStyle}>
        <div style={accentStrip} />
        <div style={{ padding: '16px 20px' }}>
          {!showCreate
            ? <button onClick={() => setShowCreate(true)} style={{ ...pillOutline, borderColor: GREEN, color: GREEN }}>+ Create your own priority (not in the list)</button>
            : <AddActionForm idKey="memcustom" submitLabel="Add to Plan" onCancel={() => setShowCreate(false)} onSubmit={async (f) => { await addCustom(f); setShowCreate(false) }} />}
        </div>
      </div>
      {available.length === 0
        ? <div style={cardStyle}><div style={accentStrip} /><div style={{ padding: '20px', fontSize: '13px', color: MUTED }}>Every action is already on your plan.</div></div>
        : CATEGORY_ORDER.map(cat => {
          const rows = available.filter(a => a.category === cat)
          if (!rows.length) return null
          return (
            <div key={cat} style={cardStyle}>
              <div style={accentStrip} />
              <div style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: NAVY, marginBottom: '4px' }}>{CATEGORY_LABELS_LONG[cat]}</div>
                {rows.map(a => <AddRow key={a.id} a={a} memberNumber={memberNumber} reload={reload} />)}
              </div>
            </div>
          )
        })}
    </div>
  )
}

function AddRow({ a, memberNumber, reload }) {
  const [open, setOpen] = useState(false)
  const [owned, setOwned] = useState('')
  const [assisted, setAssisted] = useState('')
  const [value, setValue] = useState('medium')
  const [effort, setEffort] = useState('medium')
  const [busy, setBusy] = useState(false)
  const parked = a.g2_status === 'park' || a.g3_status === 'park'

  async function add() {
    setBusy(true)
    try {
      await callApi('growth_plan_save_actions', {
        member_number: memberNumber,
        event: 'prioritized',
        updates: [{ id: a.id, g3_status: 'one_page_plan', g3_action_type: 'new', owned_by: owned, assisted_by: assisted, value_level: value, effort_level: effort }],
      })
      await reload()
    } catch (e) { alert(e?.message || 'Failed to add'); setBusy(false) }
  }

  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid #eef2f9' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px', fontSize: '13.5px', color: INK, lineHeight: 1.5 }}>
          {a.action_text}
          {parked && <span style={{ marginLeft: '8px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.4px', textTransform: 'uppercase', padding: '1px 7px', borderRadius: '999px', color: '#b06400', background: '#fdeed9' }}>Parked</span>}
        </div>
        {!open && <button onClick={() => setOpen(true)} style={{ ...pillOutline, borderColor: GREEN, color: GREEN }}>+ Add to Plan</button>}
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
            <button onClick={add} disabled={busy} style={{ ...pillSolid, opacity: busy ? 0.7 : 1 }}>{busy ? 'Adding…' : 'Add to Plan'}</button>
            <button onClick={() => setOpen(false)} disabled={busy} style={pillOutline}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
