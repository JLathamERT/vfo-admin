import { useState } from 'react'
import { getTheme, setTheme } from '../../lib/theme'

// Light/dark mode picker shown in every portal's Settings area. The choice is
// per-device (localStorage) — no backend involved.
export default function AppearanceCard() {
  const [theme, setThemeState] = useState(getTheme())

  function pick(next) {
    setTheme(next)
    setThemeState(next)
  }

  const optionStyle = (active) => ({
    flex: 1,
    padding: '14px 16px',
    borderRadius: '12px',
    border: active ? '2px solid var(--vfo-sky)' : '1px solid var(--vfo-border-strong)',
    background: active ? 'rgba(0,149,255,0.10)' : 'var(--vfo-input)',
    color: 'var(--vfo-ink)',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  })

  const swatchStyle = (dark) => ({
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    flexShrink: 0,
    border: '1px solid var(--vfo-border-strong)',
    background: dark
      ? 'linear-gradient(135deg, #001b4f 0%, #002973 100%)'
      : 'linear-gradient(135deg, #ffffff 0%, #f4f7fd 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  return (
    <div style={{ background: 'var(--vfo-card)', border: '1px solid var(--vfo-border-soft)', borderRadius: '16px', boxShadow: 'var(--vfo-shadow-card)', padding: '24px', marginBottom: '20px' }}>
      <div style={{ fontSize: '13px', color: 'var(--vfo-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Appearance</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={() => pick('light')} style={optionStyle(theme === 'light')}>
          <span style={swatchStyle(false)}><span style={{ fontSize: '15px' }}>☀️</span></span>
          <span>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Light</span>
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--vfo-muted)', marginTop: '2px' }}>The classic look</span>
          </span>
        </button>
        <button onClick={() => pick('dark')} style={optionStyle(theme === 'dark')}>
          <span style={swatchStyle(true)}><span style={{ fontSize: '15px' }}>🌙</span></span>
          <span>
            <span style={{ display: 'block', fontSize: '14px', fontWeight: 600 }}>Dark</span>
            <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--vfo-muted)', marginTop: '2px' }}>VFO navy</span>
          </span>
        </button>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--vfo-muted)', marginTop: '14px', marginBottom: 0 }}>Saved on this device — the portal will remember your choice next time you sign in.</p>
    </div>
  )
}
