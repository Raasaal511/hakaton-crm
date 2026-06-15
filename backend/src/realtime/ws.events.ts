// Typed WebSocket event definitions for PulsarCRM realtime layer

export type WsClientToServer =
  | { type: 'ping' }
  | { type: 'join_board'; boardId: string }
  | { type: 'leave_board'; boardId: string }
  | { type: 'cursor_move'; boardId: string; x: number; y: number }
  | { type: 'board_editing'; boardId: string; cardType: string; cardId: number; field?: string }
  | { type: 'board_comment'; boardId: string; cardType: string; cardId: number; body: string }
  | { type: 'board_reaction'; boardId: string; cardType: string; cardId: number; reaction: string }
  | { type: 'board_card_link'; boardId: string; cardType: string; cardId: number; linkedType: string; linkedId: number }

export type WsServerToClient =
  | { type: 'pong' }
  | { type: 'error'; message: string }
  // Presence
  | { type: 'presence_joined'; boardId: string; user: WsPresenceUser }
  | { type: 'presence_left'; boardId: string; userId: number }
  | { type: 'presence_list'; boardId: string; users: WsPresenceUser[] }
  | { type: 'cursor_moved'; boardId: string; userId: number; x: number; y: number }
  | { type: 'board_editing'; boardId: string; userId: number; cardType: string; cardId: number; field?: string }
  | { type: 'board_comment_added'; boardId: string; userId: number; cardType: string; cardId: number; body: string; createdAt: string }
  | { type: 'board_reaction_added'; boardId: string; userId: number; cardType: string; cardId: number; reaction: string; createdAt: string }
  | { type: 'board_card_linked'; boardId: string; userId: number; cardType: string; cardId: number; linkedType: string; linkedId: number; createdAt: string }
  // CRM entity mutations broadcast to org members
  | { type: 'lead_created'; orgId: number; lead: Record<string, unknown> }
  | { type: 'lead_updated'; orgId: number; leadId: number; patch: Record<string, unknown> }
  | { type: 'lead_moved'; orgId: number; leadId: number; stage: string; columnId: number | null }
  | { type: 'lead_deleted'; orgId: number; leadId: number }
  | { type: 'contact_created'; orgId: number; contact: Record<string, unknown> }
  | { type: 'contact_updated'; orgId: number; contactId: number; patch: Record<string, unknown> }
  | { type: 'company_created'; orgId: number; company: Record<string, unknown> }
  | { type: 'company_updated'; orgId: number; companyId: number; patch: Record<string, unknown> }
  | { type: 'deal_created'; orgId: number; deal: Record<string, unknown> }
  | { type: 'deal_updated'; orgId: number; dealId: number; patch: Record<string, unknown> }
  | { type: 'deal_moved'; orgId: number; dealId: number; stageId: number | null; probability: number }
  | { type: 'document_created'; orgId: number; entityType: string; entityId: number; document: Record<string, unknown> }
  | { type: 'communication_created'; orgId: number; entityType: string; entityId: number; communication: Record<string, unknown> }
  // Catalog mutations
  | { type: 'product_stock_changed'; orgId: number; productId: number; newStock: number }
  // Task board mutations
  | { type: 'task_created'; orgId: number; task: Record<string, unknown> }
  | { type: 'task_updated'; orgId: number; taskId: number; patch: Record<string, unknown> }
  | { type: 'task_moved'; orgId: number; taskId: number; columnId: number; position: number }
  | { type: 'task_deleted'; orgId: number; taskId: number }

export type WsPresenceUser = {
  userId: number
  name: string
  color: string
}
