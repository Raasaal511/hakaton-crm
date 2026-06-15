import { axiosAPI } from '../axios'

export type PushSubscribeBody = {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export const pushAPI = {
  async getVapidPublicKey(): Promise<string | null> {
    const { data } = await axiosAPI.get<{ publicKey: string | null }>('/push/vapid-public-key')
    return data.publicKey ?? null
  },

  async subscribe(body: PushSubscribeBody): Promise<void> {
    await axiosAPI.post('/push/subscribe', body)
  },

  async unsubscribe(endpoint: string): Promise<void> {
    await axiosAPI.post('/push/unsubscribe', { endpoint })
  },
}
