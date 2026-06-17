// Shared style tokens + tiny atoms for the Growth Plan views (portal vibe).
export const NAVY = '#002973', BLUE = '#125ecc', INK = '#16264a', MUTED = '#4e6087'
export const GREEN = '#1b9254', AMBER = '#e06717', GREY = '#697a9c'

export const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #d6e0ee', background: '#fff', color: INK, fontSize: '13px', fontFamily: 'Inter, sans-serif' }
export const cardStyle = { background: '#fff', border: '1px solid #e9eef8', borderRadius: '16px', boxShadow: '0 4px 16px rgba(20,45,95,0.06)', marginBottom: '18px', overflow: 'hidden' }
export const accentStrip = { height: '3px', background: 'linear-gradient(90deg, #125ecc 0%, #0a85e8 100%)' }
export const eyebrowLabel = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '1.2px', color: '#0095ff', textTransform: 'uppercase' }
export const miniLabel = { fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7c8aa6', marginBottom: '6px' }
export const pillSolid = { padding: '9px 20px', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #125ecc 0%, #0a85e8 100%)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 4px 14px rgba(18,94,204,0.32)', whiteSpace: 'nowrap' }
export const pillOutline = { padding: '8px 16px', borderRadius: '999px', border: `1px solid ${BLUE}`, background: 'transparent', color: BLUE, fontWeight: 600, fontSize: '12.5px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }
export const pillGhost = { padding: '11px 20px', borderRadius: '999px', border: '1px solid #cdddf5', background: '#fff', color: MUTED, fontWeight: 600, fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }

export function NumBadge({ n }) {
  return <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#eef2f9', border: '1px solid #dde5f2', color: MUTED, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
}

// Vertical radio set (wrap in a flex-row container to lay them out inline).
export function Radios({ name, value, onChange, options }) {
  return (
    <>
      {options.map(o => {
        const on = value === o.value
        const color = o.color || BLUE
        return (
          <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', cursor: 'pointer', fontWeight: on ? 700 : 500, color: on ? color : '#4e6087', marginBottom: '6px', whiteSpace: 'nowrap' }}>
            <input type="radio" name={name} checked={on} onChange={() => onChange(o.value)} style={{ accentColor: color }} />
            {o.label}
          </label>
        )
      })}
    </>
  )
}

export function GrowthNeed({ text, cta, onClick }) {
  return (
    <div style={{ padding: '44px', textAlign: 'center', color: MUTED }}>
      <div style={{ fontSize: '14px', marginBottom: cta ? '14px' : 0, lineHeight: 1.5 }}>{text}</div>
      {cta && <button onClick={onClick} style={pillOutline}>{cta}</button>}
    </div>
  )
}

// Bottom step navigation: ← Back (left, optional) + a primary forward action
// (right, optional). `secondary` renders next to Back (e.g. a counts line).
export function StepNav({ onBack, onNext, nextLabel = 'Continue →', busy, secondary }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {onBack && <button onClick={onBack} disabled={busy} style={pillGhost}>← Back</button>}
        {secondary}
      </div>
      {onNext && <button onClick={onNext} disabled={busy} style={{ ...pillSolid, padding: '12px 28px', fontSize: '14px', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : nextLabel}</button>}
    </div>
  )
}
