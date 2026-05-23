const PREFIX = 'dar_offline_'

export function cacheWrite(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch (_) {}
}

export function cacheRead(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw).data : null
  } catch (_) {
    return null
  }
}

export function cacheRemove(key) {
  localStorage.removeItem(PREFIX + key)
}

// Pending sync queue
const QUEUE_KEY = 'dar_sync_queue'

export function queueUpdate(entry) {
  const queue = getQueue()
  queue.push({ ...entry, queuedAt: Date.now() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch (_) {
    return []
  }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function removeFromQueue(index) {
  const queue = getQueue()
  queue.splice(index, 1)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}
