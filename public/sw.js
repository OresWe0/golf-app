self.addEventListener('push', function (event) {
  if (!event.data) return

  const data = event.data.json()

  const title = data.title || 'Ny aktivitet'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {
      url: data.url || '/dashboard',
    },
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})