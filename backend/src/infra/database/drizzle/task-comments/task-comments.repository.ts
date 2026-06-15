import { inject, injectable } from 'inversify'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import { taskCommentSchema, usersSchema, type TaskComment } from '../schema.js'

export type TaskCommentWithAuthor = TaskComment & {
    author: { id: number; firstname: string; lastname: string; email: string } | null
}

@injectable()
export class TaskCommentsRepository {
    constructor(@inject(TYPES.DB) private db: DB) {}

    async listByTaskId(taskId: number): Promise<TaskCommentWithAuthor[]> {
        const rows = await this.db
            .select({
                id: taskCommentSchema.id,
                taskId: taskCommentSchema.taskId,
                authorId: taskCommentSchema.authorId,
                body: taskCommentSchema.body,
                createdAt: taskCommentSchema.createdAt,
                updatedAt: taskCommentSchema.updatedAt,
                deletedAt: taskCommentSchema.deletedAt,
                authorFirstname: usersSchema.firstname,
                authorLastname: usersSchema.lastname,
                authorEmail: usersSchema.email,
            })
            .from(taskCommentSchema)
            .leftJoin(usersSchema, eq(taskCommentSchema.authorId, usersSchema.id))
            .where(
                and(
                    eq(taskCommentSchema.taskId, taskId),
                    isNull(taskCommentSchema.deletedAt),
                ),
            )
            .orderBy(asc(taskCommentSchema.createdAt))
        return rows.map((r) => ({
            id: r.id,
            taskId: r.taskId,
            authorId: r.authorId,
            body: r.body,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            deletedAt: r.deletedAt,
            author:
                r.authorId != null
                    ? {
                          id: r.authorId,
                          firstname: r.authorFirstname ?? '',
                          lastname: r.authorLastname ?? '',
                          email: r.authorEmail ?? '',
                      }
                    : null,
        }))
    }

    async getById(id: number): Promise<TaskComment | null> {
        const rows = await this.db
            .select()
            .from(taskCommentSchema)
            .where(and(eq(taskCommentSchema.id, id), isNull(taskCommentSchema.deletedAt)))
        return rows[0] ?? null
    }

    async insert(row: { taskId: number; authorId: number; body: string }): Promise<TaskCommentWithAuthor> {
        const [created] = await this.db.insert(taskCommentSchema).values(row).returning()
        const withAuthor = await this.db
            .select({
                firstname: usersSchema.firstname,
                lastname: usersSchema.lastname,
                email: usersSchema.email,
            })
            .from(usersSchema)
            .where(eq(usersSchema.id, row.authorId))
        const a = withAuthor[0]
        return {
            ...created,
            author: a
                ? { id: row.authorId, firstname: a.firstname, lastname: a.lastname, email: a.email }
                : null,
        }
    }

    async update(id: number, body: string): Promise<TaskComment | null> {
        const [updated] = await this.db
            .update(taskCommentSchema)
            .set({ body })
            .where(and(eq(taskCommentSchema.id, id), isNull(taskCommentSchema.deletedAt)))
            .returning()
        return updated ?? null
    }

    async softDelete(id: number): Promise<void> {
        await this.db
            .update(taskCommentSchema)
            .set({ deletedAt: new Date() })
            .where(eq(taskCommentSchema.id, id))
    }
}
