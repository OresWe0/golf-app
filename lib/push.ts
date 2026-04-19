function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

const SW_VERSION = process.env.NEXT_PUBLIC_SW_VERSION || 'dev'
const SW_URL = `/sw.js?v=${encodeURIComponent(SW_VERSION)}`

export async function registerPushSubscription() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers stöds inte i denna webbläsare.')
  }

  if (!('PushManager' in window)) {
    throw new Error('Pushnotiser stöds inte i denna webbläsare.')
  }

  const registration = await navigator.serviceWorker.register(SW_URL, {
    updateViaCache: 'none',
  })

  await registration.update()

  const permission = await Notification.requestPermission()

  if (permission !== 'granted') {
    throw new Error('Notiser tillåts inte.')
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  if (!vapidPublicKey) {
    throw new Error('Saknar NEXT_PUBLIC_VAPID_PUBLIC_KEY.')
  }

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  }

  const json = subscription.toJSON()

  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth

  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error('Kunde inte läsa push subscription.')
  }

  return {
    endpoint: subscription.endpoint,
    p256dh,
    auth,
  }
}

export async function unregisterPushSubscription() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers stöds inte i denna webbläsare.')
  }

  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()

  if (!subscription) {
    return null
  }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()

  return { endpoint }
}
