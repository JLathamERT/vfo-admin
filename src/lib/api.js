const EDGE_URL = 'https://ejpsprsmhpufwogbmxjv.supabase.co/functions/v1/vfo-admin-api'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcHNwcnNtaHB1ZndvZ2JteGp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNDcwNjksImV4cCI6MjA4NzYyMzA2OX0.sdMVsnXePSH8zgstt82O1dhpMxYZq5QivyIrCHMbECU'

export async function callApi(action, payload = {}) {
  const session = JSON.parse(sessionStorage.getItem('vfo_session') || 'null')
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({ action, token: session?.token, ...payload })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export function getSession() {
  return JSON.parse(sessionStorage.getItem('vfo_session') || 'null')
}

export function setSession(session) {
  sessionStorage.setItem('vfo_session', JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem('vfo_session')
}