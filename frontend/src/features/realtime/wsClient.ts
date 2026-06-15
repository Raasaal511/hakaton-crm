import { WS_HOSTNAME } from 'shared/config'

type WsEvent = Record<string, unknown> & { type: string }
type Handler = (event: WsEvent) => void

class WsClient {
  private ws: WebSocket | null = null
  private handlers = new Map<string, Set<Handler>>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private orgId: number | null = null
  private userName: string | null = null
  private intentionalClose = false
  private reconnectDelay = 1000

  connect(orgId: number, userName: string) {
    this.orgId = orgId
    this.userName = userName
    this.intentionalClose = false
    this.openSocket()
  }

  disconnect() {
    this.intentionalClose = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  private openSocket() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    const token = localStorage.getItem('token')
    if (!token || !this.orgId) return

    const url = new URL(WS_HOSTNAME)
    url.searchParams.set('orgId', String(this.orgId))
    url.searchParams.set('name', encodeURIComponent(this.userName ?? ''))
    url.searchParams.set('token', token)

    this.ws = new WebSocket(url.toString())

    this.ws.onopen = () => {
      this.reconnectDelay = 1000
      this.emit({ type: '_connected' })
    }

    this.ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data as string) as WsEvent
        this.emit(data)
      } catch {
        // ignore malformed
      }
    }

    this.ws.onclose = () => {
      this.emit({ type: '_disconnected' })
      if (!this.intentionalClose) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
          this.openSocket()
        }, this.reconnectDelay)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private emit(event: WsEvent) {
    const set = this.handlers.get(event.type)
    if (set) for (const fn of set) fn(event)
    const all = this.handlers.get('*')
    if (all) for (const fn of all) fn(event)
  }

  on(type: string, handler: Handler) {
    let set = this.handlers.get(type)
    if (!set) { set = new Set(); this.handlers.set(type, set) }
    set.add(handler)
    return () => { set!.delete(handler) }
  }

  send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  joinBoard(boardId: string) { this.send({ type: 'join_board', boardId }) }
  leaveBoard(boardId: string) { this.send({ type: 'leave_board', boardId }) }
  sendEditing(boardId: string, cardType: string, cardId: number, field?: string) {
    this.send({ type: 'board_editing', boardId, cardType, cardId, field })
  }
  addComment(boardId: string, cardType: string, cardId: number, body: string) {
    this.send({ type: 'board_comment', boardId, cardType, cardId, body })
  }
  addReaction(boardId: string, cardType: string, cardId: number, reaction: string) {
    this.send({ type: 'board_reaction', boardId, cardType, cardId, reaction })
  }
  linkCard(boardId: string, cardType: string, cardId: number, linkedType: string, linkedId: number) {
    this.send({ type: 'board_card_link', boardId, cardType, cardId, linkedType, linkedId })
  }
  ping() { this.send({ type: 'ping' }) }
}

export const wsClient = new WsClient()
