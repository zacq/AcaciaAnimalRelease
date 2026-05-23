const SESSION_KEY = 'dar_session'
const INACTIVITY_MS = 8 * 60 * 60 * 1000

export function saveSession(user) {
  const session = { user, loginTime: Date.now(), lastActive: Date.now() }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const session = JSON.parse(raw)
  if (Date.now() - session.lastActive > INACTIVITY_MS) {
    clearSession()
    return null
  }
  return session
}

export function touchSession() {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return
  const session = JSON.parse(raw)
  session.lastActive = Date.now()
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function hashPassword(password) {
  // Simple deterministic hash for demo — replace with bcrypt in a real backend
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    hash = (Math.imul(31, hash) + password.charCodeAt(i)) | 0
  }
  return hash.toString(16)
}
