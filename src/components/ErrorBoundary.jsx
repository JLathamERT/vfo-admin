import React from 'react'
import * as Sentry from '@sentry/react'

// App-wide error boundary (H2). Catches any uncaught render/runtime error in the
// React tree and shows a branded fallback instead of a blank white screen.
// Styles are inline on purpose — the boundary must render even if app CSS failed
// to load. componentDidCatch is the natural hook for error reporting (H3/Sentry).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info?.componentStack)
    // Report React render crashes to Sentry (H3) — these don't reach the global
    // handler because React catches them here.
    Sentry.captureException(error, { extra: { componentStack: info?.componentStack } })
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={S.brand}>VFO<span style={S.brandLight}>SERVICES</span></div>
          <div style={S.icon}>&#9888;</div>
          <h1 style={S.title}>Something went wrong</h1>
          <p style={S.msg}>
            An unexpected error occurred while loading this page. Your data is safe —
            please try again. If it keeps happening, reload the page or sign in again.
          </p>
          <div style={S.actions}>
            <button style={S.primary} onClick={this.handleReset}>Try again</button>
            <button style={S.secondary} onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      </div>
    )
  }
}

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 100%)', padding: '24px', fontFamily: 'Arial, Helvetica, sans-serif' },
  card: { background: 'var(--vfo-card)', borderRadius: '14px', maxWidth: '440px', width: '100%', padding: '40px 32px', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' },
  brand: { fontSize: '20px', fontWeight: 'bold', color: '#1e3a5f', letterSpacing: '0.5px', marginBottom: '20px' },
  brandLight: { color: '#3b82f6' },
  icon: { fontSize: '40px', marginBottom: '8px', color: '#e0a800' },
  title: { fontSize: '22px', color: '#0f2a4a', margin: '8px 0 12px' },
  msg: { fontSize: '15px', color: '#5b6b7f', lineHeight: 1.6, margin: '0 0 28px' },
  actions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  primary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 22px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  secondary: { background: 'var(--vfo-border-soft)', color: '#1e3a5f', border: 'none', borderRadius: '8px', padding: '12px 22px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
}

export default ErrorBoundary
