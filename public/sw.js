/* 极光实验室 · Web Push Service Worker */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', event => {
  let payload = {
    title: '极光实验室',
    body: '你有一条新的实验室通知',
    url: '/',
    tag: 'lab-notification'
  }

  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    // 保留默认内容
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.tag,
      data: { url: payload.url },
      renotify: true
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification?.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
