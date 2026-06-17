import { useState, useEffect } from 'react'
import { callApi } from '../../lib/api'
import { TrackHero } from '../shared/TrackKit'
import { StepNav } from './ui'
import {
  SECTIONS, Q10_PREFERENCE_OPTIONS, DEFAULT_ACTIONS,
  computeScores, blankAnswers,
} from './constants'

const NAVY = '#002973', BLUE = '#125ecc', INK = '#16264a', MUTED = '#4e6087'
const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#fff', color: INK, fontSize: '13px', fontFamily: 'Inter, sans-serif' }
const cardStyle = { background: '#fff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '18px', overflow: 'hidden' }

function fmtCompleted(iso) {
  if (!iso) return ''
  const d = new Date(iso); const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function compositeFrom(score, enabled) {
  if (!score) return null
  const vals = []
  for (const s of SECTIONS) {
    const v = score[`${s.key}_score`]
    if (enabled[s.key] && v != null) vals.push(Number(v))
  }
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
}
function rowsFromBundle(bundle) {
  return (bundle.partnerships || []).map(p => ({ name: p.name || '', score: p.is_na ? '' : (p.score ?? ''), is_na: !!p.is_na }))
}
function initEnabled(score) {
  return {
    section1: score ? score.section1_enabled !== false : true,
    section2: score ? score.section2_enabled !== false : true,
    section3: score ? score.section3_enabled !== false : true,
  }
}

export default function GrowthScoring({ memberNumber, bundle, reload, onNavigate }) {
  const score = bundle.score
  const [view, setView] = useState(score ? 'summary' : 'form')
  const [answers, setAnswers] = useState(() => ({ ...blankAnswers(), ...(score?.raw_answers?.answers || {}) }))
  const [partners, setPartners] = useState(() => rowsFromBundle(bundle))
  const [q10pref, setQ10pref] = useState(score?.raw_answers?.q10_preference || '')
  const [enabled, setEnabled] = useState(initEnabled(score))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAnswers({ ...blankAnswers(), ...(score?.raw_answers?.answers || {}) })
    setPartners(rowsFromBundle(bundle))
    setQ10pref(score?.raw_answers?.q10_preference || '')
    setEnabled(initEnabled(score))
    setView(score ? 'summary' : 'form')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score?.id])

  function setAns(qid, patch) { setAnswers(a => ({ ...a, [qid]: { ...a[qid], ...patch } })) }

  async function generate() {
    setSaving(true)
    try {
      const sc = computeScores(answers, partners, { section1: true, section2: true, section3: true })
      await callApi('growth_plan_save_score', {
        member_number: memberNumber,
        completed_at: new Date().toISOString(),
        section1_score: sc.section1, section2_score: sc.section2, section3_score: sc.section3,
        composite_score: sc.composite,
        section1_enabled: true, section2_enabled: true, section3_enabled: true,
        raw_answers: { answers, q10_preference: q10pref },
        partnerships: partners
          .filter(r => (r.name && r.name.trim()) || r.is_na || r.score !== '')
          .map(r => ({ name: r.name?.trim() || null, score: r.is_na ? null : (r.score === '' ? null : Number(r.score)), is_na: !!r.is_na })),
        actions: DEFAULT_ACTIONS,
      })
      await reload()
    } catch (e) { alert(e?.message || 'Failed to generate score') }
    finally { setSaving(false) }
  }

  async function toggleSection(key) {
    const next = { ...enabled, [key]: !enabled[key] }
    setEnabled(next)
    try {
      await callApi('growth_plan_save_summary', {
        member_number: memberNumber,
        section1_enabled: next.section1, section2_enabled: next.section2, section3_enabled: next.section3,
        composite_score: compositeFrom(score, next),
      })
    } catch (e) { setEnabled(enabled); alert(e?.message || 'Failed to save') }
  }

  // ── Summary view ──────────────────────────────────────────────────────
  if (view === 'summary' && score) {
    const composite = compositeFrom(score, enabled)
    const anyOn = SECTIONS.some(s => enabled[s.key])
    return (
      <div>
        <TrackHero
          eyebrow="Growth Plan"
          title="Growth Summary Score"
          meta={<>Score completed on <strong style={{ color: '#243757' }}>{fmtCompleted(score.completed_at || score.created_at)}</strong></>}
        />
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Scoring-on toggles — sized to content so the page background shows below */}
          <div style={{ ...cardStyle, marginBottom: 0, flex: '0 0 300px', maxWidth: '100%' }}>
            <div style={{ padding: '18px 20px' }}>
              <div style={eyebrowLabel}>Scoring on</div>
              <div style={{ marginTop: '12px' }}>
                {SECTIONS.map((s, i) => (
                  <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 0', borderTop: i > 0 ? '1px solid #eef2f9' : 'none', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabled[s.key]} onChange={() => toggleSection(s.key)} style={{ width: '18px', height: '18px', accentColor: BLUE, flexShrink: 0 }} />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: INK, lineHeight: 1.35 }}>{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Growth Score card */}
          <div style={{ ...cardStyle, marginBottom: 0, flex: '1 1 400px', minWidth: '320px' }}>
            <div style={{ height: '4px', background: 'linear-gradient(90deg, #002973 0%, #125ecc 55%, #0a85e8 100%)' }} />
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ ...eyebrowLabel, marginBottom: '18px' }}>Overall Growth Score</div>
              <ScoreRing value={composite} size={144} primary />
              {anyOn ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '34px auto 26px', maxWidth: '480px' }}>
                    <div style={{ flex: 1, height: '1px', background: '#eef2f9' }} />
                    <span style={eyebrowLabel}>By section</span>
                    <div style={{ flex: 1, height: '1px', background: '#eef2f9' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '40px' }}>
                    {SECTIONS.filter(s => enabled[s.key]).map(s => (
                      <ScoreRing key={s.key} value={score[`${s.key}_score`]} size={104} label={s.label} />
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '12.5px', color: MUTED, marginTop: '22px' }}>Select a section to include it in the score.</div>
              )}
            </div>
          </div>
        </div>
        <StepNav
          onNext={() => onNavigate('gp_actions')}
          nextLabel="Continue →"
          secondary={<button onClick={() => setView('form')} style={pillOutline}>Edit answers / Re-score</button>}
        />
      </div>
    )
  }

  // ── Form view ─────────────────────────────────────────────────────────
  return (
    <div>
      <TrackHero
        eyebrow="Growth Plan"
        title="Scoring Growth"
      />
      {SECTIONS.map((s, idx) => (
        <div key={s.key} style={cardStyle}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #125ecc 0%, #0a85e8 100%)' }} />
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: NAVY, letterSpacing: '-0.01em' }}>{s.label}</div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#9aa6bf', letterSpacing: '0.4px' }}>SECTION {idx + 1} · /50</div>
            </div>
            {s.questions.map(q => (
              <QuestionRow key={q.id} q={q} ans={answers[q.id]} setAns={setAns}
                partners={partners} setPartners={setPartners}
                q10pref={q10pref} setQ10pref={setQ10pref} />
            ))}
          </div>
        </div>
      ))}
      <button onClick={generate} disabled={saving} style={{ padding: '12px 28px', borderRadius: '999px', border: 'none', background: saving ? '#9bb4e3' : 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: saving ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 14px rgba(18,94,204,0.32)' }}>
        {saving ? 'Generating…' : 'Generate Score'}
      </button>
    </div>
  )
}

const eyebrowLabel = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#0095ff', textTransform: 'uppercase' }
const pillOutline = { padding: '8px 16px', borderRadius: '999px', border: `1px solid ${BLUE}`, background: 'transparent', color: BLUE, fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }

function ScoreRing({ value, label, size = 78, primary }) {
  // Composite = dark blue with white number; sections = much lighter with navy number.
  const grad = primary
    ? 'linear-gradient(135deg, #002060 0%, #0a3f9e 100%)'
    : 'linear-gradient(135deg, #cfe0f7 0%, #e3edfc 100%)'
  const numColor = primary ? '#ffffff' : '#002973'
  const shadow = primary ? '0 10px 24px rgba(0,32,96,0.38)' : '0 4px 12px rgba(18,94,204,0.16)'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', margin: '0 auto', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow }}>
        <span style={{ color: numColor, fontWeight: 800, fontSize: Math.round(size * 0.36) + 'px', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}>{value == null ? 'N/A' : value}</span>
      </div>
      {label && <div style={{ fontSize: '11px', fontWeight: 600, color: MUTED, marginTop: '10px', maxWidth: size + 90, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.35 }}>{label}</div>}
    </div>
  )
}

function QuestionRow({ q, ans, setAns, partners, setPartners, q10pref, setQ10pref }) {
  const a = ans || { value: '', na: false, notes: '' }
  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid #eef2f9' }}>
      <div style={{ fontSize: '13.5px', color: INK, marginBottom: '10px', lineHeight: 1.5 }}>{q.text}</div>
      {q.type === 'partnerships' ? (
        <PartnershipEditor partners={partners} setPartners={setPartners} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <select value={a.na ? '' : a.value} disabled={a.na} onChange={e => setAns(q.id, { value: e.target.value })} style={{ ...inputStyle, minWidth: '170px', opacity: a.na ? 0.5 : 1 }}>
            <option value="">-- Select --</option>
            {q.type === 'words'
              ? q.options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)
              : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={a.na} onChange={e => setAns(q.id, { na: e.target.checked })} style={{ accentColor: BLUE }} /> N/A
          </label>
        </div>
      )}
      {q.preference && (
        <div style={{ marginTop: '14px', paddingLeft: '2px' }}>
          {Q10_PREFERENCE_OPTIONS.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12.5px', color: INK, marginBottom: '8px', cursor: 'pointer', lineHeight: 1.45 }}>
              <input type="radio" name={q.id + '_pref'} checked={q10pref === o.value} onChange={() => setQ10pref(o.value)} style={{ marginTop: '3px', accentColor: BLUE }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      <textarea value={a.notes || ''} onChange={e => setAns(q.id, { notes: e.target.value })} placeholder="Notes" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginTop: '10px', minHeight: '44px', resize: 'vertical' }} />
    </div>
  )
}

function PartnershipEditor({ partners, setPartners }) {
  function update(i, patch) { setPartners(rows => rows.map((r, j) => j === i ? { ...r, ...patch } : r)) }
  function add() { setPartners(rows => [...rows, { name: '', score: '', is_na: false }]) }
  function remove(i) { setPartners(rows => rows.filter((_, j) => j !== i)) }
  return (
    <div>
      {partners.length === 0 && <div style={{ fontSize: '12px', color: '#8a97b0', marginBottom: '8px' }}>No partnerships added yet.</div>}
      {partners.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <input placeholder="Partner name" value={r.name} onChange={e => update(i, { name: e.target.value })} style={{ ...inputStyle, flex: '1 1 200px', minWidth: '160px' }} />
          <select value={r.is_na ? '' : r.score} disabled={r.is_na} onChange={e => update(i, { score: e.target.value })} style={{ ...inputStyle, width: '92px', opacity: r.is_na ? 0.5 : 1 }}>
            <option value="">Score</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: MUTED, cursor: 'pointer' }}>
            <input type="checkbox" checked={r.is_na} onChange={e => update(i, { is_na: e.target.checked })} style={{ accentColor: BLUE }} /> N/A
          </label>
          <button onClick={() => remove(i)} title="Remove" style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
      ))}
      <button onClick={add} style={{ marginTop: '4px', padding: '6px 14px', borderRadius: '999px', border: '1px dashed #9bb4e3', background: '#f4f7fd', color: BLUE, fontWeight: 600, fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>+ Create Partnership</button>
    </div>
  )
}
