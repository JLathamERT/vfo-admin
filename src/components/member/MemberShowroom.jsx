import { useState, useEffect, useLayoutEffect } from 'react'

const HEADSHOT_SUPABASE = 'https://ejpsprsmhpufwogbmxjv.supabase.co/storage/v1/object/public/headshots/'
const HEADSHOT_FALLBACK = 'https://biz-diagnostic.com/img/expert/'

// Fixed "standard plugin" look — identical on every member's account. Only the
// specialist list differs (driven by each member's own exclusions). Colours match
// the VFO portal. This view intentionally reads NONE of a member's saved plugin
// customisation (member_plugin_settings) — those settings stay separate/untouched.
const S = {
  bg_color: '#ffffff',        // page background
  text_color: '#002973',      // headings, search, filters, count
  accent_color: '#0b4bad',    // card + modal background
  card_text_color: '#ffffff', // names + bios on cards/modal
  primary_color: '#fb895a',   // active buttons, tags, hover, underlines
  font: 'Playfair Display',
  widget_font_size: 14,
  last_initial_only: true,
}

const FILTER_CATS = ['All', 'Tax Planning', 'Business Advisory', 'Legal', 'Insurance', 'Wealth Management']

function formatName(name) {
  if (!S.last_initial_only || !name) return name
  const parts = name.trim().split(' ')
  if (parts.length < 2) return name
  return parts[0] + ' ' + parts[parts.length - 1].charAt(0) + '.'
}

// Headshot with the same fallback chain as the standard widget:
// supabase headshot -> legacy host -> initial placeholder.
function Avatar({ expert, big }) {
  const [stage, setStage] = useState(expert.headshot_image ? 0 : 2)
  const src = stage === 0 ? HEADSHOT_SUPABASE + encodeURIComponent(expert.headshot_image)
    : stage === 1 ? HEADSHOT_FALLBACK + expert.headshot_image
    : null
  if (!src) return <div className="vfo-sr-avatar-ph" style={big ? { fontSize: '36px' } : undefined}>{(expert.name || '?').charAt(0)}</div>
  return <img src={src} alt={formatName(expert.name)} onError={() => setStage(s => s + 1)} />
}

function ShowroomModal({ expert, onClose }) {
  // useLayoutEffect (not useEffect) so the scroll lock applies BEFORE the browser
  // paints the modal — otherwise the background reflow lands a frame late and the
  // screen visibly flickers as the modal appears.
  useLayoutEffect(() => {
    const html = document.documentElement
    // Reserve the scrollbar's width as padding so hiding it doesn't reflow the
    // page wider (the portal keeps a permanent scrollbar via html overflow-y),
    // which otherwise makes the content shift sideways when the modal opens.
    const scrollBarW = window.innerWidth - html.clientWidth
    const prevBody = document.body.style.overflow
    const prevHtml = html.style.overflow
    const prevPad = html.style.paddingRight
    document.body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    if (scrollBarW > 0) html.style.paddingRight = scrollBarW + 'px'
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevBody
      html.style.overflow = prevHtml
      html.style.paddingRight = prevPad
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const bio = (expert.long_bio || '').replace(/\r\n/g, '\n')
  return (
    <div className="vfo-sr-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="vfo-sr-modal">
        <button className="vfo-sr-modal-close" onClick={onClose}>{'×'}</button>
        <div className="vfo-sr-modal-header">
          <div className="vfo-sr-modal-avatar"><Avatar expert={expert} big /></div>
          <div>
            <h3 className="vfo-sr-modal-name">{formatName(expert.name)}</h3>
            <p className="vfo-sr-modal-tagline">{expert.short_bio || ''}</p>
          </div>
        </div>
        {(expert.categories || []).length > 0 && (
          <div className="vfo-sr-modal-tags">
            {expert.categories.map(cat => <span key={cat} className="vfo-sr-modal-tag">{cat}</span>)}
          </div>
        )}
        <div className="vfo-sr-modal-divider" />
        <div className="vfo-sr-modal-bio">{bio}</div>
      </div>
    </div>
  )
}

export default function MemberShowroom({ experts = [], exclusions = [], ecoMap = {} }) {
  const [activeFilter, setActiveFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  // Member's chosen specialists = all experts minus their exclusions, with categories.
  const excluded = new Set(exclusions)
  const shown = experts
    .filter(ex => !excluded.has(ex.id))
    .map(ex => ({ ...ex, categories: ecoMap[ex.id] || [] }))

  const q = search.trim().toLowerCase()
  const filtered = shown.filter(ex => {
    const matchFilter = activeFilter === 'All' || ex.categories.indexOf(activeFilter) !== -1
    const matchSearch = !q || (ex.name || '').toLowerCase().indexOf(q) !== -1 || (ex.short_bio || '').toLowerCase().indexOf(q) !== -1
    return matchFilter && matchSearch
  })

  return (
    <div className="vfo-sr-root" style={{ background: S.bg_color, color: S.text_color }}>
      <style>{showroomCss(S, S.widget_font_size / 14)}</style>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(S.font)}:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap`} />

      <div className="vfo-sr-container">
        <div className="vfo-sr-search-wrap">
          <span className="vfo-sr-search-icon">{'⌕'}</span>
          <input type="text" className="vfo-sr-search" placeholder="Search specialists..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="vfo-sr-filters">
          {FILTER_CATS.map(cat => (
            <button key={cat} className={'vfo-sr-filter-btn' + (cat === activeFilter ? ' vfo-sr-active' : '')} onClick={() => setActiveFilter(cat)}>{cat}</button>
          ))}
        </div>

        <p className="vfo-sr-count">{filtered.length} SPECIALIST{filtered.length !== 1 ? 'S' : ''}</p>

        {filtered.length === 0 ? (
          <div className="vfo-sr-empty">No specialists match your search.</div>
        ) : (
          <div className="vfo-sr-grid">
            {filtered.map((ex, i) => (
              <div key={ex.id} className="vfo-sr-card" style={{ animationDelay: (i * 0.03) + 's' }} onClick={() => setSelected(ex)}>
                <div className="vfo-sr-card-header">
                  <div className="vfo-sr-avatar"><Avatar expert={ex} /></div>
                  <div>
                    <h3 className="vfo-sr-card-name">{formatName(ex.name)}</h3>
                    <p className="vfo-sr-card-tagline">{ex.short_bio || ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && <ShowroomModal expert={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function showroomCss(s, scale) {
  const r = (n) => Math.round(n * scale)
  return `
    .vfo-sr-root { font-family: "DM Sans", sans-serif; position: relative; line-height: 1.5; -webkit-font-smoothing: antialiased; min-height: 60vh; }
    .vfo-sr-root *, .vfo-sr-root *::before, .vfo-sr-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
    .vfo-sr-container { max-width: 1280px; margin: 0 auto; padding: 36px 48px 64px; }
    .vfo-sr-search-wrap { max-width: 480px; margin: 0 auto 32px; position: relative; display: block; }
    .vfo-sr-search-icon { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); font-size: 15px; pointer-events: none; color: ${s.text_color}aa; }
    .vfo-sr-search { width: 100%; padding: 14px 20px 14px 46px; border-radius: 12px; border: 2px solid ${s.text_color}33; background: ${s.text_color}08; font-size: ${r(15)}px; font-family: "DM Sans", sans-serif; outline: none; transition: border-color 0.2s; display: block; color: ${s.text_color}; }
    .vfo-sr-search::placeholder { color: ${s.text_color}; opacity: 0.45; }
    .vfo-sr-search:focus { border-color: ${s.primary_color}; }
    .vfo-sr-filters { display: flex; justify-content: center; gap: 10px; margin-bottom: 26px; flex-wrap: wrap; }
    .vfo-sr-filter-btn { padding: ${r(10)}px ${r(22)}px; border-radius: 10px; border: 2px solid ${s.text_color}33; background: transparent; font-size: ${r(13)}px; font-weight: 500; cursor: pointer; font-family: "DM Sans", sans-serif; letter-spacing: 0.3px; transition: all 0.25s ease; color: ${s.text_color}cc; }
    .vfo-sr-filter-btn:hover { border-color: ${s.text_color}66; color: ${s.text_color}; }
    .vfo-sr-filter-btn.vfo-sr-active { border-color: ${s.primary_color}; background: ${s.primary_color}1a; color: ${s.primary_color}; font-weight: 600; }
    .vfo-sr-count { font-size: ${r(14)}px; text-align: center; margin-bottom: 26px; letter-spacing: 1px; font-weight: 600; color: ${s.text_color}aa; }
    .vfo-sr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 22px; }
    .vfo-sr-card { background: ${s.accent_color}; border: 1px solid ${s.card_text_color}1f; border-radius: 16px; padding: 22px 20px 18px; cursor: pointer; transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease; opacity: 0; transform: translateY(18px); animation: vfoSrFadeUp 0.5s ease forwards; }
    .vfo-sr-card:hover { transform: translateY(-4px); border-color: ${s.primary_color}66; box-shadow: 0 18px 36px rgba(11,75,173,0.22); }
    .vfo-sr-card-header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
    .vfo-sr-avatar { width: ${r(74)}px; height: ${r(74)}px; border-radius: 50%; overflow: hidden; flex-shrink: 0; border: 2px solid ${s.card_text_color}26; background: ${s.card_text_color}14; transition: border-color 0.3s; margin: 0 auto; }
    .vfo-sr-card:hover .vfo-sr-avatar { border-color: ${s.primary_color}; }
    .vfo-sr-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
    .vfo-sr-avatar-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: ${r(26)}px; font-weight: 700; color: ${s.primary_color}; font-family: '${s.font}', serif; }
    .vfo-sr-card-name { font-size: ${r(18)}px; font-weight: 600; margin: 0; line-height: 1.3; color: ${s.card_text_color}; font-family: '${s.font}', serif; }
    .vfo-sr-card-tagline { font-size: ${r(13)}px; margin: 6px 0 0; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: ${r(37)}px; color: ${s.card_text_color}cc; }
    .vfo-sr-empty { text-align: center; padding: 72px 0; font-size: 16px; color: ${s.text_color}66; }
    .vfo-sr-overlay { position: fixed; inset: 0; background: rgba(8,20,45,0.55); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 24px; }
    .vfo-sr-modal { background: ${s.accent_color}; border: 1px solid ${s.primary_color}40; border-radius: 20px; max-width: 640px; width: 100%; max-height: 85vh; overflow: auto; padding: 40px; position: relative; box-shadow: 0 40px 80px rgba(8,20,45,0.4); color: ${s.card_text_color}; }
    .vfo-sr-modal-close { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border-radius: 50%; border: 1px solid ${s.card_text_color}26; background: ${s.card_text_color}14; color: ${s.card_text_color}cc; font-size: 18px; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .vfo-sr-modal-close:hover { background: ${s.card_text_color}26; color: ${s.card_text_color}; }
    .vfo-sr-modal-header { display: flex; align-items: center; gap: 22px; margin-bottom: 24px; }
    .vfo-sr-modal-avatar { width: 96px; height: 96px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background: ${s.card_text_color}14; border: 2px solid ${s.primary_color}; }
    .vfo-sr-modal-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 50%; }
    .vfo-sr-modal-name { font-size: ${r(27)}px; font-weight: 700; margin: 0; color: ${s.card_text_color}; font-family: '${s.font}', serif; }
    .vfo-sr-modal-tagline { font-size: ${r(15)}px; margin: 7px 0 0; font-weight: 500; color: ${s.card_text_color}cc; }
    .vfo-sr-modal-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .vfo-sr-modal-tag { padding: 6px 14px; border-radius: 8px; font-size: ${r(12)}px; font-weight: 500; display: inline-block; background: ${s.card_text_color}1a; color: ${s.card_text_color}; border: 1px solid ${s.card_text_color}33; }
    .vfo-sr-modal-divider { height: 1px; margin-bottom: 24px; background: linear-gradient(90deg, transparent, ${s.primary_color}59, transparent); }
    .vfo-sr-modal-bio { font-size: ${r(15)}px; line-height: 1.8; white-space: pre-wrap; font-weight: 300; color: ${s.card_text_color}d9; }
    @keyframes vfoSrFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 640px) { .vfo-sr-container { padding: 20px 14px 36px; } .vfo-sr-grid { grid-template-columns: 1fr; gap: 14px; } .vfo-sr-modal { padding: 22px; } .vfo-sr-overlay { padding: 12px; } .vfo-sr-modal-header { flex-direction: column; text-align: center; } .vfo-sr-modal-name { font-size: 22px; } .vfo-sr-modal-avatar { width: 80px; height: 80px; } .vfo-sr-search-wrap { max-width: 100%; } .vfo-sr-filters { gap: 6px; } }
  `
}
