import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { WebPushService } from '../services/web-push.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'

type SubscribeBody = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

type UnsubscribeBody = {
  endpoint: string
}

function isValidSubscribeBody(body: unknown): body is SubscribeBody {
  if (body === null || typeof body !== 'object') return false
  const b = body as SubscribeBody
  if (typeof b.endpoint !== 'string' || b.endpoint.length === 0 || b.endpoint.length > 4096) {
    return false
  }
  if (b.keys === null || typeof b.keys !== 'object') return false
  if (typeof b.keys.p256dh !== 'string' || b.keys.p256dh.length === 0 || b.keys.p256dh.length > 512) {
    return false
  }
  if (typeof b.keys.auth !== 'string' || b.keys.auth.length === 0 || b.keys.auth.length > 256) {
    return false
  }
  return true
}

@injectable()
export class PushController {
  constructor(@inject(TYPES.WebPushService) private readonly _webPush: WebPushService) {}

  getVapidPublicKey: FastifyPluginAsync = async (fastify) => {
    fastify.get('/push/vapid-public-key', async (_req, reply) => {
      const publicKey = this._webPush.getPublicKey()
      return reply.send({ publicKey })
    })
  }

  subscribe: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Body: SubscribeBody }>(
      '/push/subscribe',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        if (!isValidSubscribeBody(req.body)) {
          return reply.status(400).send({ error: 'Некорректная подписка push' })
        }
        if (this._webPush.getPublicKey() == null) {
          return reply.status(503).send({ error: 'Push-уведомления не настроены на сервере' })
        }
        await this._webPush.saveSubscription(req.user!.id, req.body)
        return reply.send({ ok: true })
      },
    )
  }

  unsubscribe: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Body: UnsubscribeBody }>(
      '/push/unsubscribe',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const endpoint = req.body?.endpoint
        if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > 4096) {
          return reply.status(400).send({ error: 'Некорректный endpoint' })
        }
        await this._webPush.unsubscribeUserEndpoint(req.user!.id, endpoint)
        return reply.send({ ok: true })
      },
    )
  }
}
