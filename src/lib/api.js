const EDGE_URL = import.meta.env.VITE_API_URL || 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHNwcnNtaHB1ZndvZ2JteGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDcwNjksImV4cCI6MjA4NzYyMzA2OX0.sdMVsnXePSH8zgstt82O1dhpMxYZq5QivyIrCHMbECU'

const REQUEST_TIMEOUT_MS = 20000

// An action is considered an idempotent READ if it matches one of the load-style
// naming conventions (load_*, *_load_*, *_load) or appears in the explicit list
// below. Read actions are safe to auto-retry on timeout because re-running them
// has no server-side side effects.
function isReadAction(action) {
  if (!action) return false
  if (/^load_|_load(_|$)/.test(action)) return true
  return action === 'vault_list'
}

// Login actions return 401 on bad credentials — that's a wrong-password, NOT an
// expired session, so callApi must surface it inline on the login page instead of
// redirecting to the portal-selection page.
const LOGIN_ACTIONS = ['admin_login', 'member_login', 'client_login', 'specialist_login', 'login']

export async function callApi(action, payload = {}, retries = 3) {
  const session = JSON.parse(sessionStorage.getItem('vfo_session') || 'null')
  for (let attempt = 1; attempt <= retries; attempt++) {
    let res = null
    let timedOut = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)
    try {
      res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({ action, token: session?.token, ...payload }),
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (res.status === 401) {
        // A 401 on a login action means bad credentials — surface it inline rather
        // than treating it as an expired session and bouncing to the portal.
        if (LOGIN_ACTIONS.includes(action)) {
          throw new Error(data.error || 'Invalid credentials')
        }
        clearSession()
        window.location.href = window.location.origin + '/vfo-portal/'
        throw new Error('Session expired — please log in again.')
      }
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (err) {
      clearTimeout(timeoutId)
      if (timedOut) {
        // Idempotent reads can safely retry on timeout — the server may have just
        // been cold-starting. Writes never retry on timeout because the server
        // may have already processed the request and a retry would double-write.
        if (isReadAction(action) && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000))
          continue
        }
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s. Please try again.`)
      }
      // Only retry if the request never reached the server (fetch itself failed —
      // network blip, CORS, offline). If we got ANY response, the server may have
      // already processed the request; retrying could double-write non-idempotent
      // actions like ciq_create, msm_add_client, etc.
      const fetchFailed = res === null
      if (!fetchFailed || attempt === retries) throw err
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

export function getSession() {
  return JSON.parse(sessionStorage.getItem('vfo_session') || 'null')
}

export function setSession(session) {
  sessionStorage.setItem('vfo_session', JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem('vfo_session')
  cachedDataPromise = null
  keyedCaches.clear()
}

let cachedDataPromise = null

export function loadCachedData({ refresh = false } = {}) {
  if (refresh || !cachedDataPromise) {
    cachedDataPromise = callApi('load_data').catch(err => {
      cachedDataPromise = null
      throw err
    })
  }
  return cachedDataPromise
}

export function clearCachedData() {
  cachedDataPromise = null
}

const keyedCaches = new Map()

export function loadCachedAction(action, payload = {}, { refresh = false } = {}) {
  let bucket = keyedCaches.get(action)
  if (!bucket) { bucket = new Map(); keyedCaches.set(action, bucket) }
  const key = JSON.stringify(payload)
  if (refresh || !bucket.has(key)) {
    const p = callApi(action, payload).catch(err => {
      bucket.delete(key)
      throw err
    })
    bucket.set(key, p)
  }
  return bucket.get(key)
}

export function clearActionCache(action) {
  if (action) keyedCaches.delete(action)
  else keyedCaches.clear()
}