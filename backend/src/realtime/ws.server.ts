import type { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import config from 'config'
import { and, eq } from 'drizzle-orm'
import { db } from '../infra/database/drizzle/client.js'
import {
  realtimeBoardJournalSchema,
  usersSchema,
  usersToOrganizationsSchema,
} from '../infra/database/drizzle/schema.js'
import { wsHub } from './ws.hub.js'
import type { WsClientToServer } from './ws.events.js'

const JWT_TOKEN = config.get<string>('jwt.token')

type JwtPayload = { id: number; email: string }

async function canConnectToOrganization(userId: number, orgId: number): Promise<boolean> {
  const users = await db
    .select({ systemRole: usersSchema.systemRole })
    .from(usersSchema)
    .where(eq(usersSchema.id, userId))
    .limit(1)
  if (users[0]?.systemRole === 'root') return true

  const memberships = await db
    .select({ userId: usersToOrganizationsSchema.userId })
    .from(usersToOrganizationsSchema)
    .where(and(
      eq(usersToOrganizationsSchema.userId, userId),
      eq(usersToOrganizationsSchema.organizationId, orgId),
    ))
    .limit(1)

  return memberships.length > 0
}

async function persistBoardEvent(
  orgId: number,
  actorUserId: number,
  eventType: string,
  boardId: string,
  payload: Record<string, unknown>,
) {
  await db.insert(realtimeBoardJournalSchema).values({
    organizationId: orgId,
    actorUserId,
    eventType,
    boardId,
    cardType: typeof payload.cardType === 'string' ? payload.cardType : null,
    cardId: typeof payload.cardId === 'number' ? payload.cardId : null,
    payload,
  }).catch(() => undefined)
}

export async function registerWsRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, async (socket, req) => {
    const query = req.query as Record<string, string>
    const token = req.headers.authorization?.split(' ')[1] ?? query.token
    const orgId = Number(query.orgId ?? 0)

    if (!token || !orgId) {
      socket.send(JSON.stringify({ type: 'error', message: 'token and orgId required' }))
      socket.close()
      return
    }

    let payload: JwtPayload
    try {
      payload = jwt.verify(token, JWT_TOKEN) as JwtPayload
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }))
      socket.close()
      return
    }

    if (!(await canConnectToOrganization(payload.id, orgId))) {
      socket.send(JSON.stringify({ type: 'error', message: 'No organization access' }))
      socket.close()
      return
    }

    const name = query.name ?? payload.email.split('@')[0]
    const socketId = wsHub.register(socket, payload.id, orgId, name)

    socket.on('message', (rawMsg: Buffer) => {
      let msg: WsClientToServer
      try {
        msg = JSON.parse(rawMsg.toString()) as WsClientToServer
      } catch {
        return
      }

      switch (msg.type) {
        case 'ping':
          wsHub.send(socketId, { type: 'pong' })
          break
        case 'join_board':
          wsHub.joinBoard(socketId, msg.boardId)
          break
        case 'leave_board':
          wsHub.leaveBoard(socketId, msg.boardId)
          break
        case 'cursor_move':
          wsHub.broadcastBoard(msg.boardId, {
            type: 'cursor_moved',
            boardId: msg.boardId,
            userId: payload.id,
            x: msg.x,
            y: msg.y,
          }, socketId)
          break
        case 'board_editing':
          wsHub.broadcastBoard(msg.boardId, {
            type: 'board_editing',
            boardId: msg.boardId,
            userId: payload.id,
            cardType: msg.cardType,
            cardId: msg.cardId,
            field: msg.field,
          }, socketId)
          break
        case 'board_comment': {
          const createdAt = new Date().toISOString()
          void persistBoardEvent(orgId, payload.id, 'comment', msg.boardId, msg)
          wsHub.broadcastBoard(msg.boardId, {
            type: 'board_comment_added',
            boardId: msg.boardId,
            userId: payload.id,
            cardType: msg.cardType,
            cardId: msg.cardId,
            body: msg.body,
            createdAt,
          })
          break
        }
        case 'board_reaction': {
          const createdAt = new Date().toISOString()
          void persistBoardEvent(orgId, payload.id, 'reaction', msg.boardId, msg)
          wsHub.broadcastBoard(msg.boardId, {
            type: 'board_reaction_added',
            boardId: msg.boardId,
            userId: payload.id,
            cardType: msg.cardType,
            cardId: msg.cardId,
            reaction: msg.reaction,
            createdAt,
          })
          break
        }
        case 'board_card_link': {
          const createdAt = new Date().toISOString()
          void persistBoardEvent(orgId, payload.id, 'card_link', msg.boardId, msg)
          wsHub.broadcastBoard(msg.boardId, {
            type: 'board_card_linked',
            boardId: msg.boardId,
            userId: payload.id,
            cardType: msg.cardType,
            cardId: msg.cardId,
            linkedType: msg.linkedType,
            linkedId: msg.linkedId,
            createdAt,
          })
          break
        }
      }
    })

    socket.on('close', () => {
      wsHub.unregister(socketId)
    })
  })
}
