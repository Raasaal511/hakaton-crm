/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

const navigationHandler = createHandlerBoundToURL('/index.html')
registerRoute(new NavigationRoute(navigationHandler, { denylist: [/^\/api\//] }))

/** Сообщение от workbox-window при нажатии «Обновить» (registerType: 'prompt'). */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim())
})

type PushPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    return
  }
  const title =
    typeof payload.title === 'string' && payload.title.trim() !== ''
      ? payload.title
      : 'Уведомление'
  const options: NotificationOptions = {
    body: typeof payload.body === 'string' ? payload.body : undefined,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : undefined,
    data: { url: typeof payload.url === 'string' ? payload.url : '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const rawUrl =
    typeof event.notification.data === 'object' &&
    event.notification.data !== null &&
    'url' in event.notification.data &&
    typeof (event.notification.data as { url: unknown }).url === 'string'
      ? (event.notification.data as { url: string }).url
      : '/'
  const targetUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const path = new URL(targetUrl).pathname
      for (const client of clientList) {
        try {
          if (new URL(client.url).pathname === path && 'focus' in client) {
            return client.focus()
          }
        } catch {
          /* ignore */
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
