import { injectable, inject } from 'inversify'
import { eq, and, inArray } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import { webPushSubscriptionsSchema } from '../schema.js'

export type PushSubscriptionKeys = {
  endpoint: string
  p256dh: string
  auth: string
}

@injectable()
export class WebPushSubscriptionsRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async upsertForUser(userId: number, sub: PushSubscriptionKeys): Promise<void> {
    const now = new Date()
    await this.db
      .insert(webPushSubscriptionsSchema)
      .values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: webPushSubscriptionsSchema.endpoint,
        set: {
          userId,
          p256dh: sub.p256dh,
          auth: sub.auth,
          updatedAt: now,
        },
      })
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.db.delete(webPushSubscriptionsSchema).where(eq(webPushSubscriptionsSchema.endpoint, endpoint))
  }

  async deleteByUserAndEndpoint(userId: number, endpoint: string): Promise<void> {
    await this.db
      .delete(webPushSubscriptionsSchema)
      .where(
        and(
          eq(webPushSubscriptionsSchema.userId, userId),
          eq(webPushSubscriptionsSchema.endpoint, endpoint),
        ),
      )
  }

  async findKeysByUserIds(userIds: number[]): Promise<PushSubscriptionKeys[]> {
    if (userIds.length === 0) return []
    const rows = await this.db
      .select({
        endpoint: webPushSubscriptionsSchema.endpoint,
        p256dh: webPushSubscriptionsSchema.p256dh,
        auth: webPushSubscriptionsSchema.auth,
      })
      .from(webPushSubscriptionsSchema)
      .where(inArray(webPushSubscriptionsSchema.userId, userIds))
    return rows
  }
}
