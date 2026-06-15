import { inject, injectable } from 'inversify'
import { asc, eq } from 'drizzle-orm'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'
import {
    taskAttachmentSchema,
    usersSchema,
    type TaskAttachment,
} from '../schema.js'

export type TaskAttachmentUploader = {
    id: number
    firstname: string
    lastname: string
    email: string
}

export type TaskAttachmentWithUploader = TaskAttachment & {
    uploadedBy: TaskAttachmentUploader | null
}

@injectable()
export class TaskAttachmentsRepository {
    constructor(@inject(TYPES.DB) private db: DB) {}

    async listByTaskId(taskId: number): Promise<TaskAttachmentWithUploader[]> {
        const rows = await this.db
            .select({
                id: taskAttachmentSchema.id,
                taskId: taskAttachmentSchema.taskId,
                organizationId: taskAttachmentSchema.organizationId,
                fileName: taskAttachmentSchema.fileName,
                mimeType: taskAttachmentSchema.mimeType,
                sizeBytes: taskAttachmentSchema.sizeBytes,
                storedFileName: taskAttachmentSchema.storedFileName,
                uploadedByUserId: taskAttachmentSchema.uploadedByUserId,
                createdAt: taskAttachmentSchema.createdAt,
                uploaderFirstname: usersSchema.firstname,
                uploaderLastname: usersSchema.lastname,
                uploaderEmail: usersSchema.email,
            })
            .from(taskAttachmentSchema)
            .leftJoin(usersSchema, eq(taskAttachmentSchema.uploadedByUserId, usersSchema.id))
            .where(eq(taskAttachmentSchema.taskId, taskId))
            .orderBy(asc(taskAttachmentSchema.createdAt))
        return rows.map((r) => ({
            id: r.id,
            taskId: r.taskId,
            organizationId: r.organizationId,
            fileName: r.fileName,
            mimeType: r.mimeType,
            sizeBytes: r.sizeBytes,
            storedFileName: r.storedFileName,
            uploadedByUserId: r.uploadedByUserId,
            createdAt: r.createdAt,
            uploadedBy:
                r.uploadedByUserId != null
                    ? {
                          id: r.uploadedByUserId,
                          firstname: r.uploaderFirstname ?? '',
                          lastname: r.uploaderLastname ?? '',
                          email: r.uploaderEmail ?? '',
                      }
                    : null,
        }))
    }

    async getById(id: number): Promise<TaskAttachment | null> {
        const rows = await this.db
            .select()
            .from(taskAttachmentSchema)
            .where(eq(taskAttachmentSchema.id, id))
        return rows[0] ?? null
    }

    async insert(row: typeof taskAttachmentSchema.$inferInsert): Promise<TaskAttachment> {
        const [created] = await this.db.insert(taskAttachmentSchema).values(row).returning()
        return created
    }

    async getByIdWithUploader(id: number): Promise<TaskAttachmentWithUploader | null> {
        const rows = await this.db
            .select({
                id: taskAttachmentSchema.id,
                taskId: taskAttachmentSchema.taskId,
                organizationId: taskAttachmentSchema.organizationId,
                fileName: taskAttachmentSchema.fileName,
                mimeType: taskAttachmentSchema.mimeType,
                sizeBytes: taskAttachmentSchema.sizeBytes,
                storedFileName: taskAttachmentSchema.storedFileName,
                uploadedByUserId: taskAttachmentSchema.uploadedByUserId,
                createdAt: taskAttachmentSchema.createdAt,
                uploaderFirstname: usersSchema.firstname,
                uploaderLastname: usersSchema.lastname,
                uploaderEmail: usersSchema.email,
            })
            .from(taskAttachmentSchema)
            .leftJoin(usersSchema, eq(taskAttachmentSchema.uploadedByUserId, usersSchema.id))
            .where(eq(taskAttachmentSchema.id, id))
        const r = rows[0]
        if (!r) return null
        return {
            id: r.id,
            taskId: r.taskId,
            organizationId: r.organizationId,
            fileName: r.fileName,
            mimeType: r.mimeType,
            sizeBytes: r.sizeBytes,
            storedFileName: r.storedFileName,
            uploadedByUserId: r.uploadedByUserId,
            createdAt: r.createdAt,
            uploadedBy:
                r.uploadedByUserId != null
                    ? {
                          id: r.uploadedByUserId,
                          firstname: r.uploaderFirstname ?? '',
                          lastname: r.uploaderLastname ?? '',
                          email: r.uploaderEmail ?? '',
                      }
                    : null,
        }
    }

    async deleteById(id: number): Promise<void> {
        await this.db.delete(taskAttachmentSchema).where(eq(taskAttachmentSchema.id, id))
    }
}
