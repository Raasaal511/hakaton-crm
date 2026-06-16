import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../../types.js'
import { authMiddleware } from '../../middlewares/authMiddleware.js'
import { AiService } from './ai.service.js'

@injectable()
export class AiController {
  constructor(@inject(TYPES.AiService) private ai: AiService) {}

  status: FastifyPluginAsync = async (fastify) => {
    fastify.get('/ai/status', async (req, reply) => {
      await authMiddleware(req, reply)
      return reply.send(await this.ai.getStatus())
    })
  }

  scoreLead: FastifyPluginAsync = async (fastify) => {
    fastify.post('/ai/lead-score', async (req, reply) => {
      await authMiddleware(req, reply)
      const body = req.body as {
        title: string
        amount?: number
        stage?: string
        priority?: string
        probability?: number
        source?: string
        description?: string
        daysSinceCreated?: number
      }

      if (!body.title) return reply.status(400).send({ error: 'title обязателен' })

      try {
        const result = await this.ai.scoreLead({
          title: body.title,
          amount: body.amount ?? 0,
          stage: body.stage ?? 'new',
          priority: body.priority ?? 'medium',
          probability: body.probability ?? 0,
          source: body.source,
          description: body.description,
          daysSinceCreated: body.daysSinceCreated,
        })
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        return reply.status(503).send({ error: msg })
      }
    })
  }

  getInsights: FastifyPluginAsync = async (fastify) => {
    fastify.post('/ai/insights', async (req, reply) => {
      await authMiddleware(req, reply)
      const body = req.body as { entityType: 'lead' | 'contact' | 'company'; data: Record<string, unknown> }
      if (!body.entityType || !body.data) return reply.status(400).send({ error: 'entityType и data обязательны' })

      try {
        const result = await this.ai.getInsights({ entityType: body.entityType, data: body.data })
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        return reply.status(503).send({ error: msg })
      }
    })
  }

  enrichContact: FastifyPluginAsync = async (fastify) => {
    fastify.post('/ai/enrich-contact', async (req, reply) => {
      await authMiddleware(req, reply)
      const body = req.body as { firstName: string; lastName?: string; email?: string; position?: string; company?: string }
      if (!body.firstName) return reply.status(400).send({ error: 'firstName обязателен' })

      try {
        const result = await this.ai.enrichContact(body)
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        return reply.status(503).send({ error: msg })
      }
    })
  }

  generateEmail: FastifyPluginAsync = async (fastify) => {
    fastify.post('/ai/email-draft', async (req, reply) => {
      await authMiddleware(req, reply)
      const body = req.body as { recipientName: string; subject: string; purpose: string; senderName?: string }
      if (!body.recipientName || !body.subject || !body.purpose) {
        return reply.status(400).send({ error: 'recipientName, subject и purpose обязательны' })
      }

      try {
        const result = await this.ai.generateEmailDraft(body)
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        return reply.status(503).send({ error: msg })
      }
    })
  }

  chat: FastifyPluginAsync = async (fastify) => {
    fastify.post('/ai/chat', async (req, reply) => {
      await authMiddleware(req, reply)
      const body = req.body as {
        messages: { role: 'user' | 'assistant'; content: string }[]
        systemPrompt?: string
      }
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return reply.status(400).send({ error: 'messages обязателен' })
      }

      try {
        const result = await this.ai.chat(body.messages, body.systemPrompt)
        return reply.send(result)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'AI unavailable'
        return reply.status(503).send({ error: msg })
      }
    })
  }
}
