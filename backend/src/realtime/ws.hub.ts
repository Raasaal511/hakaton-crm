import type { WebSocket } from '@fastify/websocket'
import type { WsServerToClient, WsPresenceUser } from './ws.events.js'

type ConnectedClient = {
  ws: WebSocket
  userId: number
  orgId: number
  name: string
  color: string
  boards: Set<string>
}

const PRESENCE_COLORS = [
  '#4361ee', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#0891b2', '#d97706', '#dc2626',
]

function pickColor(userId: number): string {
  return PRESENCE_COLORS[userId % PRESENCE_COLORS.length]
}

class WsHub {
  // socketId -> client
  private clients = new Map<string, ConnectedClient>()
  // boardId -> Set<socketId>
  private boards = new Map<string, Set<string>>()
  // orgId -> Set<socketId>
  private orgs = new Map<number, Set<string>>()

  private nextId = 0
  private mkId() { return String(++this.nextId) }

  register(ws: WebSocket, userId: number, orgId: number, name: string): string {
    const id = this.mkId()
    this.clients.set(id, {
      ws,
      userId,
      orgId,
      name,
      color: pickColor(userId),
      boards: new Set(),
    })
    let orgSet = this.orgs.get(orgId)
    if (!orgSet) { orgSet = new Set(); this.orgs.set(orgId, orgSet) }
    orgSet.add(id)
    return id
  }

  unregister(socketId: string) {
    const client = this.clients.get(socketId)
    if (!client) return
    for (const boardId of client.boards) {
      const boardSet = this.boards.get(boardId)
      boardSet?.delete(socketId)
      this.broadcastBoard(boardId, { type: 'presence_left', boardId, userId: client.userId })
    }
    this.orgs.get(client.orgId)?.delete(socketId)
    this.clients.delete(socketId)
  }

  joinBoard(socketId: string, boardId: string) {
    const client = this.clients.get(socketId)
    if (!client) return
    client.boards.add(boardId)
    let boardSet = this.boards.get(boardId)
    if (!boardSet) { boardSet = new Set(); this.boards.set(boardId, boardSet) }
    boardSet.add(socketId)

    const presenceUser: WsPresenceUser = { userId: client.userId, name: client.name, color: client.color }
    this.broadcastBoard(boardId, { type: 'presence_joined', boardId, user: presenceUser }, socketId)

    const users = this.getBoardPresence(boardId)
    this.send(socketId, { type: 'presence_list', boardId, users })
  }

  leaveBoard(socketId: string, boardId: string) {
    const client = this.clients.get(socketId)
    if (!client) return
    client.boards.delete(boardId)
    this.boards.get(boardId)?.delete(socketId)
    this.broadcastBoard(boardId, { type: 'presence_left', boardId, userId: client.userId })
  }

  broadcastBoard(boardId: string, event: WsServerToClient, excludeId?: string) {
    const boardSet = this.boards.get(boardId)
    if (!boardSet) return
    const payload = JSON.stringify(event)
    for (const sid of boardSet) {
      if (sid === excludeId) continue
      const c = this.clients.get(sid)
      if (c && c.ws.readyState === 1) c.ws.send(payload)
    }
  }

  broadcastOrg(orgId: number, event: WsServerToClient, excludeId?: string) {
    const orgSet = this.orgs.get(orgId)
    if (!orgSet) return
    const payload = JSON.stringify(event)
    for (const sid of orgSet) {
      if (sid === excludeId) continue
      const c = this.clients.get(sid)
      if (c && c.ws.readyState === 1) c.ws.send(payload)
    }
  }

  send(socketId: string, event: WsServerToClient) {
    const c = this.clients.get(socketId)
    if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(event))
  }

  private getBoardPresence(boardId: string): WsPresenceUser[] {
    const boardSet = this.boards.get(boardId)
    if (!boardSet) return []
    const users: WsPresenceUser[] = []
    for (const sid of boardSet) {
      const c = this.clients.get(sid)
      if (c) users.push({ userId: c.userId, name: c.name, color: c.color })
    }
    return users
  }
}

export const wsHub = new WsHub()
