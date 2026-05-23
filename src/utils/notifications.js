export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendPushNotification(title, body, icon = '/favicon.ico') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(title, { body, icon })
}

export function notifyMissingAnimals(groupName, amCount, pmCount) {
  sendPushNotification(
    'Missing Animals Alert',
    `${groupName}: AM=${amCount}, PM=${pmCount} — ${amCount - pmCount} unaccounted`,
  )
}

export function notifyUrgentFieldReport(groupName, message) {
  sendPushNotification('Urgent Field Report', `${groupName}: ${message}`)
}

export function notifyVetReferral(earTag, groupName) {
  sendPushNotification('Vet Referral', `${earTag} from ${groupName} referred to vet`)
}
