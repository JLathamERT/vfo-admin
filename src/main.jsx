import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import { applyThemeForCurrentRoute } from './lib/theme'

// Apply the saved light/dark preference before first paint — portal routes
// only; login and public token pages always render light.
applyThemeForCurrentRoute()

// Sentry error tracking (H3). The DSN is a public ingest-only key (safe to ship,
// like the anon key) — it can only SEND error reports to this project, not read
// anything. Error monitoring only: no Session Replay (would capture client PII)
// and no performance tracing, which keeps us within the free tier.
Sentry.init({
  dsn: 'https://8901dcdcf290d054228b1611f2a929ec@o4511588768088064.ingest.us.sentry.io/4511588781654017',
  environment: 'production',
})

const redirect = sessionStorage.getItem('vfo_redirect')
if (redirect) {
  sessionStorage.removeItem('vfo_redirect')
  window.history.replaceState(null, '', '/' + redirect)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter basename="/">
      <App />
    </BrowserRouter>
  </ErrorBoundary>
)