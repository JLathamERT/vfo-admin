// Light/dark theme preference, shared by all four portals. The choice is
// persisted in localStorage (survives browser restarts, unlike the
// sessionStorage session) and applied as a data-theme attribute on <html>,
// which index.css uses to swap the --vfo-* palette.
const KEY = 'vfo_theme'

export function getTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* private mode — apply without persisting */ }
  applyTheme(theme)
}

export function applyTheme(theme = getTheme()) {
  document.documentElement.dataset.theme = theme
}
