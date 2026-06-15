import { pushAPI } from '../api/requests/push'
import { urlBase64ToUint8Array } from './urlBase64ToUint8Array'

export type WebPushSyncResult =
  | 'synced'
  | 'skipped'
  | 'no_sw'
  | 'no_key'
  | 'not_configured'
  | 'denied'
  | 'error'

/** Синхронизирует подписку с сервером, если уже есть разрешение на уведомления. Без запроса диалога (для автозапуска). */
export async function syncWebPushIfAlreadyGranted(): Promise<WebPushSyncResult> {
  if (import.meta.env.DEV) return 'skipped'
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'no_sw'
  }
  if (!localStorage.getItem('token')) return 'skipped'
  if (Notification.permission !== 'granted') return 'skipped'

  try {
    const publicKey = await pushAPI.getVapidPublicKey()
    if (publicKey == null || publicKey === '') return 'not_configured'

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error'
    await pushAPI.subscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    })
    return 'synced'
  } catch {
    return 'error'
  }
}

/** Запрашивает разрешение у пользователя и регистрирует push-подписку. */
export async function enableWebPushWithPrompt(): Promise<WebPushSyncResult> {
  if (import.meta.env.DEV) return 'skipped'
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'no_sw'
  }
  if (!localStorage.getItem('token')) return 'skipped'

  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'skipped'

  try {
    const publicKey = await pushAPI.getVapidPublicKey()
    if (publicKey == null || publicKey === '') return 'not_configured'

    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const json = sub.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error'
    await pushAPI.subscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    })
    return 'synced'
  } catch {
    return 'error'
  }
}

export async function disableWebPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  try {
    await pushAPI.unsubscribe(endpoint)
  } catch {
    /* сервер мог уже удалить */
  }
}

export async function getWebPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return Boolean(sub)
}
