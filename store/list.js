/**
 * list.js — accessible 2D fallback for the VFO 3D specialist bookstore.
 * Renders every specialist grouped by ecosystem, with live search and a detail
 * modal. Vanilla ES module; the only dependency is the sibling ./data.js.
 */
import { ECOSYSTEMS, ECO_COLORS, loadSpecialists } from './data.js'

const STYLE_ID = 'vsl-style'
const NAVY = '#002973'
const BLUE = '#0b4bad'
const CREAM = '#f7f3ec'
const INK = '#2b2a26'
const GOLD = '#e8dcc0'

const CSS = `
.vsl-root, .vsl-overlay { font-family: "DM Sans", system-ui, sans-serif; color: ${INK}; -webkit-font-smoothing: antialiased; }
.vsl-root *, .vsl-root *::before, .vsl-root *::after,
.vsl-overlay *, .vsl-overlay *::before, .vsl-overlay *::after { box-sizing: border-box; margin: 0; padding: 0; }
.vsl-root { display: none; background: ${CREAM}; min-height: 100%; }
.vsl-root.vsl-is-visible { display: block; }
.vsl-wrap { max-width: 1180px; margin: 0 auto; padding: 40px 32px 72px; }

.vsl-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 34px; }
.vsl-title { font-family: "Playfair Display", Georgia, serif; font-weight: 700; font-size: 34px; line-height: 1.15; color: ${NAVY}; }
.vsl-sub { margin-top: 6px; font-size: 15px; color: ${INK}a6; }
.vsl-search { width: 300px; max-width: 100%; padding: 12px 18px; border-radius: 999px; border: 1.5px solid ${GOLD};
  background: #fffdf8; font: inherit; font-size: 14.5px; color: ${INK}; outline: none; transition: border-color .2s, box-shadow .2s; }
.vsl-search::placeholder { color: ${INK}80; }
.vsl-search:focus { border-color: ${BLUE}; box-shadow: 0 0 0 3px ${BLUE}1f; }

.vsl-section { margin-bottom: 42px; }
.vsl-section[hidden] { display: none; }
.vsl-section-head { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid ${GOLD}; }
.vsl-swatch { width: 13px; height: 13px; border-radius: 3px; flex: 0 0 auto; }
.vsl-section-name { font-family: "Playfair Display", Georgia, serif; font-weight: 600; font-size: 21px; color: ${NAVY}; }
.vsl-count { font-size: 13.5px; font-weight: 500; color: ${INK}8c; }

.vsl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: 16px; }
.vsl-card { display: flex; align-items: center; gap: 14px; text-align: left; width: 100%; padding: 16px;
  background: #fffdf8; border: 1px solid ${GOLD}; border-radius: 14px; cursor: pointer; font: inherit; color: inherit;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
.vsl-card[hidden] { display: none; }
.vsl-card:hover, .vsl-card:focus-visible { transform: translateY(-3px); border-color: var(--vsl-eco, ${BLUE});
  box-shadow: 0 12px 26px ${NAVY}1a; }
/* The ring colour is a pre-mixed custom property: "var(--x)40" does NOT concatenate into a hex+alpha. */
.vsl-card:focus-visible { outline: none; box-shadow: 0 12px 26px ${NAVY}1a, 0 0 0 3px var(--vsl-eco-ring, ${BLUE}40); }
.vsl-card-body { min-width: 0; }
.vsl-card-name { display: block; font-weight: 700; font-size: 15.5px; color: ${NAVY}; line-height: 1.25; overflow-wrap: anywhere; }
.vsl-card-tag { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  margin-top: 4px; font-weight: 400; font-size: 13px; line-height: 1.4; color: ${INK}a6; }

.vsl-avatar { border-radius: 50%; overflow: hidden; flex: 0 0 auto; background: ${GOLD}66; }
.vsl-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.vsl-initials { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  color: #fff; font-family: "Playfair Display", Georgia, serif; font-weight: 700; letter-spacing: .5px; }

.vsl-empty { padding: 64px 0; text-align: center; font-size: 16px; color: ${INK}8c; }
.vsl-empty[hidden] { display: none; }
.vsl-retry { margin-top: 16px; padding: 10px 22px; border-radius: 999px; border: none; background: ${NAVY}; color: #fff;
  font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
.vsl-retry:hover { background: ${BLUE}; }

.vsl-overlay { position: fixed; inset: 0; z-index: 9000; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: ${NAVY}8c; backdrop-filter: blur(4px); }
.vsl-modal { position: relative; width: 100%; max-width: 640px; max-height: 85vh; overflow: auto;
  background: ${CREAM}; border: 1px solid ${GOLD}; border-radius: 18px; padding: 34px 34px 30px;
  box-shadow: 0 40px 80px ${NAVY}59; }
.vsl-modal-head { display: flex; align-items: center; gap: 20px; padding-right: 40px; }
.vsl-modal-name { font-family: "Playfair Display", Georgia, serif; font-weight: 700; font-size: 26px; line-height: 1.2; color: ${NAVY}; }
.vsl-modal-tag { margin-top: 6px; font-size: 14.5px; color: ${INK}b3; }
.vsl-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
.vsl-chip { padding: 5px 13px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 1.4; }
.vsl-divider { height: 1px; margin: 22px 0; background: ${GOLD}; }
.vsl-bio { white-space: pre-wrap; font-weight: 400; font-size: 14.5px; line-height: 1.55; color: ${INK}d9; }
.vsl-close { position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; border-radius: 50%;
  border: 1px solid ${GOLD}; background: #fffdf8; color: ${NAVY}; font-size: 20px; line-height: 1; cursor: pointer;
  display: flex; align-items: center; justify-content: center; }
.vsl-close:hover { background: ${GOLD}66; }
.vsl-close:focus-visible { outline: 2px solid ${BLUE}; outline-offset: 2px; }

@media (max-width: 560px) {
  .vsl-wrap { padding: 24px 16px 48px; }
  .vsl-title { font-size: 27px; }
  .vsl-search { width: 100%; }
  .vsl-grid { grid-template-columns: 1fr; }
  .vsl-overlay { padding: 0; }
  .vsl-modal { max-width: none; max-height: 100vh; height: 100%; border: none; border-radius: 0; padding: 26px 18px 32px; }
}
@media (prefers-reduced-motion: reduce) { .vsl-card { transition: none; } .vsl-card:hover, .vsl-card:focus-visible { transform: none; } }
`

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

// Every node is built with createElement + textContent, so specialist-supplied
// strings are never parsed as markup.
function el(tag, cls, text) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text != null) node.textContent = String(text)
  return node
}

// The only non-text sink in this module is an <img src>, so scheme-guard it.
function safeUrl(value) {
  const url = String(value == null ? '' : value).trim()
  return /^(?:javascript|vbscript):/i.test(url) ? '' : url
}

function ecoColor(specialist) {
  const cats = specialist.categories || []
  for (const cat of cats) if (ECO_COLORS[cat]) return ECO_COLORS[cat]
  return BLUE
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (parts[0].charAt(0) + last).toUpperCase()
}

function initialsNode(specialist, size) {
  const node = el('div', 'vsl-initials', initialsOf(specialist.name))
  node.style.background = ecoColor(specialist)
  node.style.fontSize = Math.round(size * 0.38) + 'px'
  node.setAttribute('aria-hidden', 'true')
  return node
}

// headshotUrl -> headshotFallback (once, guarded by a data attribute) -> initials circle.
function avatar(specialist, size) {
  const wrap = el('div', 'vsl-avatar')
  wrap.style.width = size + 'px'
  wrap.style.height = size + 'px'
  const primary = safeUrl(specialist.headshotUrl)
  const fallback = safeUrl(specialist.headshotFallback)
  if (!primary) {
    wrap.appendChild(initialsNode(specialist, size))
    return wrap
  }
  const img = el('img')
  img.alt = ''
  img.loading = 'lazy'
  img.decoding = 'async'
  img.addEventListener('error', () => {
    if (!img.dataset.vslFellBack && fallback && fallback !== primary) {
      img.dataset.vslFellBack = '1'
      img.src = fallback
      return
    }
    wrap.replaceChildren(initialsNode(specialist, size))
  })
  img.src = primary
  wrap.appendChild(img)
  return wrap
}

function buildCard(specialist, onOpen) {
  const btn = el('button', 'vsl-card')
  btn.type = 'button'
  btn.setAttribute('aria-haspopup', 'dialog')
  const color = ecoColor(specialist)
  btn.style.setProperty('--vsl-eco', color)
  btn.style.setProperty('--vsl-eco-ring', color + '40')
  btn.appendChild(avatar(specialist, 56))
  const body = el('div', 'vsl-card-body')
  body.appendChild(el('span', 'vsl-card-name', specialist.name || 'Specialist'))
  if (specialist.shortBio) body.appendChild(el('span', 'vsl-card-tag', specialist.shortBio))
  btn.appendChild(body)
  btn.addEventListener('click', () => onOpen(specialist, btn))
  return btn
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Modal lives on <body> so no ancestor transform/overflow can clip the fixed overlay.
function createModal() {
  let overlay = null
  let invoker = null
  let prevOverflow = null

  function lockScroll() {
    const html = document.documentElement
    const barWidth = window.innerWidth - html.clientWidth
    prevOverflow = { body: document.body.style.overflow, html: html.style.overflow, pad: html.style.paddingRight }
    document.body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    if (barWidth > 0) html.style.paddingRight = barWidth + 'px'
  }

  function unlockScroll() {
    if (!prevOverflow) return
    document.body.style.overflow = prevOverflow.body
    document.documentElement.style.overflow = prevOverflow.html
    document.documentElement.style.paddingRight = prevOverflow.pad
    prevOverflow = null
  }

  function onKeydown(e) {
    if (!overlay) return
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key !== 'Tab') return
    const items = Array.from(overlay.querySelectorAll(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement)
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }

  function close() {
    if (!overlay) return
    overlay.remove()
    overlay = null
    document.removeEventListener('keydown', onKeydown, true)
    unlockScroll()
    if (invoker && document.contains(invoker)) invoker.focus()
    invoker = null
  }

  function open(specialist, fromEl) {
    close()
    invoker = fromEl || null
    overlay = el('div', 'vsl-overlay')
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close() })

    const modal = el('div', 'vsl-modal')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', specialist.name || 'Specialist')

    const closeBtn = el('button', 'vsl-close', '×')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close')
    closeBtn.addEventListener('click', close)
    modal.appendChild(closeBtn)

    const head = el('div', 'vsl-modal-head')
    head.appendChild(avatar(specialist, 96))
    const heading = el('div')
    heading.appendChild(el('h2', 'vsl-modal-name', specialist.name || 'Specialist'))
    if (specialist.shortBio) heading.appendChild(el('p', 'vsl-modal-tag', specialist.shortBio))
    head.appendChild(heading)
    modal.appendChild(head)

    const cats = (specialist.categories || []).filter(Boolean)
    if (cats.length) {
      const chips = el('div', 'vsl-chips')
      for (const cat of cats) {
        const color = ECO_COLORS[cat] || BLUE
        const chip = el('span', 'vsl-chip', cat)
        chip.style.background = color + '1a'
        chip.style.color = color
        chip.style.border = '1px solid ' + color + '59'
        chips.appendChild(chip)
      }
      modal.appendChild(chips)
    }

    modal.appendChild(el('div', 'vsl-divider'))
    modal.appendChild(el('div', 'vsl-bio', String(specialist.longBio || specialist.shortBio || '').replace(/\r\n/g, '\n')))

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    lockScroll()
    document.addEventListener('keydown', onKeydown, true)
    closeBtn.focus()
  }

  return { open, close, isOpen: () => overlay !== null }
}

export async function initListView(container, opts = {}) {
  injectStyle()
  container.classList.add('vsl-root')
  container.replaceChildren()

  const modal = createModal()
  let visible = false
  let prevBodyOverflow = null

  function show() {
    if (visible) return
    visible = true
    prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = '' // the list scrolls; the 3D shell may have locked the page
    container.classList.add('vsl-is-visible')
  }

  function hide() {
    if (!visible) return
    modal.close()
    visible = false
    container.classList.remove('vsl-is-visible')
    if (prevBodyOverflow !== null) { document.body.style.overflow = prevBodyOverflow; prevBodyOverflow = null }
  }

  function renderError(retry) {
    container.replaceChildren()
    const wrap = el('div', 'vsl-wrap')
    const box = el('div', 'vsl-empty')
    box.appendChild(el('div', null, 'We could not load the specialist directory.'))
    const btn = el('button', 'vsl-retry', 'Retry')
    btn.type = 'button'
    btn.addEventListener('click', retry)
    box.appendChild(btn)
    wrap.appendChild(box)
    container.appendChild(wrap)
  }

  function renderList(data) {
    const byEcosystem = (data && data.byEcosystem) || {}
    container.replaceChildren()

    const wrap = el('div', 'vsl-wrap')
    const head = el('div', 'vsl-head')
    const titleBlock = el('div')
    titleBlock.appendChild(el('h1', 'vsl-title', 'Browse the shelves'))
    titleBlock.appendChild(el('p', 'vsl-sub', 'Every VFO specialist, by ecosystem.'))
    head.appendChild(titleBlock)

    const search = el('input', 'vsl-search')
    search.type = 'search'
    search.autocomplete = 'off'
    search.placeholder = 'Search specialists…'
    search.setAttribute('aria-label', 'Search specialists')
    head.appendChild(search)
    wrap.appendChild(head)

    // One entry per non-empty ecosystem, holding its cards plus a lowercased
    // haystack so filtering never re-reads the DOM.
    const sections = []
    ECOSYSTEMS.forEach((eco, i) => {
      const people = byEcosystem[eco] || []
      if (!people.length) return

      const section = el('section', 'vsl-section')
      const headingId = 'vsl-eco-' + i
      section.setAttribute('aria-labelledby', headingId)

      const secHead = el('div', 'vsl-section-head')
      const swatch = el('span', 'vsl-swatch')
      swatch.style.background = ECO_COLORS[eco] || BLUE
      secHead.appendChild(swatch)
      const name = el('h2', 'vsl-section-name', eco)
      name.id = headingId
      secHead.appendChild(name)
      const badge = el('span', 'vsl-count', '(' + people.length + ')')
      secHead.appendChild(badge)
      section.appendChild(secHead)

      const grid = el('div', 'vsl-grid')
      const items = people.map((sp) => {
        const node = buildCard(sp, modal.open)
        grid.appendChild(node)
        return { node, hay: ((sp.name || '') + ' ' + (sp.shortBio || '')).toLowerCase() }
      })
      section.appendChild(grid)
      wrap.appendChild(section)
      sections.push({ section, badge, items })
    })

    const empty = el('div', 'vsl-empty', 'No matches')
    empty.hidden = true
    wrap.appendChild(empty)

    if (!sections.length) {
      empty.textContent = 'No specialists to show yet.'
      empty.hidden = false
    }

    function applyFilter() {
      const q = search.value.trim().toLowerCase()
      let shown = 0
      for (const sec of sections) {
        let count = 0
        for (const item of sec.items) {
          const match = !q || item.hay.indexOf(q) !== -1
          item.node.hidden = !match
          if (match) count += 1
        }
        sec.badge.textContent = '(' + count + ')'
        sec.section.hidden = count === 0
        shown += count
      }
      empty.hidden = shown > 0 // with zero sections this keeps the "nothing yet" copy up
    }

    search.addEventListener('input', applyFilter)
    container.appendChild(wrap)
  }

  let seed = opts.data // pre-loaded payload from the shell, if any
  async function load() {
    try {
      const data = seed || await loadSpecialists()
      renderList(data)
    } catch (err) {
      console.error('[store/list] failed to load specialists', err)
      renderError(() => { seed = null; load() }) // a bad seed must not be retried
    }
  }

  await load()
  return { show, hide, isVisible: () => visible }
}
