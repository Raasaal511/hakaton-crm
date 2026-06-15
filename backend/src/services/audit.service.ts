import { inject, injectable } from 'inversify'
import { TYPES } from '../types.js'
import type { DB } from '../infra/database/drizzle/client.js'
import { auditLogsSchema } from '../infra/database/drizzle/schema.js'

export type AuditPayload = {
  organizationId?: number | null
  actorUserId?: number | null
  entityType: string
  entityId?: number | null
  action: string
  payload?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

@injectable()
export class AuditService {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async record(event: AuditPayload): Promise<void> {
    await this.db.insert(auditLogsSchema).values({
      organizationId: event.organizationId ?? null,
      actorUserId: event.actorUserId ?? null,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      action: event.action,
      payload: event.payload ?? {},
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
    })
  }
}
