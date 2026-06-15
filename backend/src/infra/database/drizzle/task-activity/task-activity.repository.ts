import { injectable, inject } from 'inversify'
import { and, desc, eq, lt, type SQL } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import { taskActivitySchema, usersSchema } from '../schema.js'

export type TaskActivityListRow = {
  id: number
  taskId: number
  actorUserId: number | null
  kind: string
  payload: Record<string, unknown>
  createdAt: Date | null
  actor: { id: number; firstname: string; lastname: string } | null
}

@injectable()
export class TaskActivityRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  async insert(input: {
    taskId: number
    actorUserId: number
    kind: string
    payload: Record<string, unknown>
  }): Promise<void> {
    await this.db.insert(taskActivitySchema).values({
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      kind: input.kind,
      payload: input.payload,
    })
  }

  async listByTaskId(
    taskId: number,
    opts: { limit: number; beforeId?: number },
  ): Promise<TaskActivityListRow[]> {
    const limit = Math.min(100, Math.max(1, opts.limit))
    const cond: SQL[] = [eq(taskActivitySchema.taskId, taskId)]
    if (opts.beforeId != null) {
      cond.push(lt(taskActivitySchema.id, opts.beforeId))
    }
    const rows = await this.db
      .select({
        id: taskActivitySchema.id,
        taskId: taskActivitySchema.taskId,
        actorUserId: taskActivitySchema.actorUserId,
        kind: taskActivitySchema.kind,
        payload: taskActivitySchema.payload,
        createdAt: taskActivitySchema.createdAt,
        actorFirstname: usersSchema.firstname,
        actorLastname: usersSchema.lastname,
      })
      .from(taskActivitySchema)
      .leftJoin(usersSchema, eq(taskActivitySchema.actorUserId, usersSchema.id))
      .where(and(...cond))
      .orderBy(desc(taskActivitySchema.id))
      .limit(limit)

    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      actorUserId: r.actorUserId,
      kind: r.kind,
      payload: r.payload as Record<string, unknown>,
      createdAt: r.createdAt,
      actor:
        r.actorUserId != null && r.actorFirstname != null && r.actorLastname != null
          ? {
              id: r.actorUserId,
              firstname: r.actorFirstname,
              lastname: r.actorLastname,
            }
          : null,
    }))
  }
}
