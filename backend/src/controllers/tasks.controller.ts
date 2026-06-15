import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { inject, injectable } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { TasksService } from '../services/tasks.service.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validateParamId } from '../middlewares/validationMiddleware.js'
import { BadRequestError } from '../infra/libs/errors.js'
import type { BroadcastProgress, CalendarTaskListItem, ColumnTaskListFilter, CreateBroadcastTaskDTO, CreateTaskDTO, UpdateTaskDTO } from '../entities/tasks/index.js'
import type { Task, TaskAttachment } from '../infra/database/drizzle/schema.js'
import type { TaskCommentWithAuthor } from '../infra/database/drizzle/task-comments/task-comments.repository.js'
import {
    formatTaskDateTimeForApi,
    isTaskDeadlineOverdue,
    isValidTaskDate,
    parseTaskDateTimeFromApi,
} from '../utils/taskDateTime.js'

function parseColumnTaskListFilter(query: {
    q?: string
    tagId?: string
    responsibleId?: string
    overdue?: string
    excludeCompleted?: string
}): ColumnTaskListFilter | undefined {
    const filter: ColumnTaskListFilter = {}
    if (query.q != null && String(query.q).trim() !== '') {
        filter.q = String(query.q).trim().slice(0, 200)
    }
    if (query.tagId != null && String(query.tagId).trim() !== '') {
        const n = Math.floor(Number(query.tagId))
        if (!Number.isFinite(n) || n <= 0) {
            throw new BadRequestError('Некорректный tagId')
        }
        filter.tagId = n
    }
    if (query.responsibleId != null && String(query.responsibleId).trim() !== '') {
        const n = Math.floor(Number(query.responsibleId))
        if (!Number.isFinite(n) || n <= 0) {
            throw new BadRequestError('Некорректный responsibleId')
        }
        filter.responsibleId = n
    }
    const od = query.overdue
    if (od === '1' || od === 'true' || od === 'yes') {
        filter.overdue = true
    }
    const exc = query.excludeCompleted
    if (exc === '1' || exc === 'true' || exc === 'yes') {
        filter.excludeCompleted = true
    }
    return Object.keys(filter).length === 0 ? undefined : filter
}

@injectable()
export class TasksController {
    constructor(
        @inject(TYPES.TasksService) private tasksService: TasksService,
    ) { }

    private normalizeDeadline(value: unknown): Date | null {
        if (value == null || value === '') return null
        if (value instanceof Date) {
            return isValidTaskDate(value) ? value : null
        }
        if (typeof value === 'string') {
            const trimmed = value.trim()
            if (!trimmed) return null
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return parseTaskDateTimeFromApi(`${trimmed}T12:00:00.000Z`)
            }
            return parseTaskDateTimeFromApi(trimmed)
        }
        return null
    }

    private serializeComment(c: TaskCommentWithAuthor) {
        return {
            id: c.id,
            taskId: c.taskId,
            authorId: c.authorId,
            author: c.author,
            body: c.body,
            createdAt: c.createdAt ? c.createdAt.toISOString() : null,
            updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null,
        }
    }

    private serializeAttachment(a: TaskAttachment & {
        uploadedBy?: { id: number; firstname: string; lastname: string; email: string } | null
    }) {
        return {
            id: a.id,
            fileName: a.fileName,
            mimeType: a.mimeType,
            sizeBytes: a.sizeBytes,
            uploadedByUserId: a.uploadedByUserId,
            uploadedBy: a.uploadedBy ?? null,
            createdAt: a.createdAt ? a.createdAt.toISOString() : null,
        }
    }

    private serializeTask<T extends {
        id: number
        responsibleId?: number | null
        startDate?: Date | null
        deadLine?: Date | null
        completedAt?: Date | null
        createdAt?: Date | null
        updatedAt?: Date | null
        deletedAt?: Date | null
        tags?: Array<{ id: number; name: string; createdAt?: Date | null; updatedAt?: Date | null; deletedAt?: Date | null }>
        responsibleIds?: number[]
    }>(task: T): T & {
        startDate: string | null
        deadLine: string | null
        completedAt: string | null
        responsibleIds: number[]
        tags?: Array<{ id: number; name: string }>
        attachments?: Array<ReturnType<TasksController['serializeAttachment']>>
    } {
        const { attachments, ...rest } = task as T & { attachments?: TaskAttachment[] }
        const tags = (task as { tags?: Array<{ id: number; name: string }> }).tags
        const responsibleIds = Array.isArray(task.responsibleIds)
            ? task.responsibleIds
            : task.responsibleId != null
                ? [task.responsibleId]
                : []
        const base = {
            ...rest,
            startDate: formatTaskDateTimeForApi(task.startDate),
            deadLine: formatTaskDateTimeForApi(task.deadLine),
            completedAt: task.completedAt ? task.completedAt.toISOString() : null,
            responsibleIds,
            ...(tags && { tags: tags.map((t) => ({ id: t.id, name: t.name })) }),
        } as T & {
            startDate: string | null
            deadLine: string | null
            completedAt: string | null
            responsibleIds: number[]
            tags?: Array<{ id: number; name: string }>
        }
        if (attachments != null) {
            return {
                ...base,
                attachments: attachments.map((a) => this.serializeAttachment(a)),
            }
        }
        return base
    }

    private serializeTaskWithBroadcast<T extends Parameters<TasksController['serializeTask']>[0] & { broadcastProgress?: BroadcastProgress | null }>(task: T) {
        const base = this.serializeTask(task)
        return {
            ...base,
            broadcastProgress: task.broadcastProgress
                ? this.serializeBroadcastProgress(task.broadcastProgress)
                : null,
        }
    }

    private serializeBroadcastProgress(progress: BroadcastProgress) {
        return {
            total: progress.total,
            completed: progress.completed,
            children: progress.children.map((c) => ({
                taskId: c.taskId,
                userId: c.userId,
                completedAt: c.completedAt ? c.completedAt.toISOString() : null,
                columnId: c.columnId,
                columnName: c.columnName,
                columnPosition: c.columnPosition,
                pipelineLastColumnId: c.pipelineLastColumnId,
                columnIsReview: c.columnIsReview,
            })),
        }
    }

    private serializeCalendarTask(
        task: CalendarTaskListItem & { inPipelineTerminalColumn?: boolean },
    ) {
        return {
            id: task.id,
            name: task.name,
            startDate: formatTaskDateTimeForApi(task.startDate),
            deadLine: formatTaskDateTimeForApi(task.deadLine),
            columnId: task.columnId,
            columnName: task.columnName,
            columnColor: task.columnColor,
            completedAt: task.completedAt ? task.completedAt.toISOString() : null,
            inPipelineTerminalColumn: Boolean(task.inPipelineTerminalColumn),
            departmentId: task.departmentId,
            departmentName: task.departmentName ?? null,
        }
    }

    private classifyTaskForUser(task: Task & { column?: { position?: number | null; pipelineId?: number | null } | null }, currentUserId: number, lastColumnByPipeline: Map<number, number>) {
        const isIncoming = task.responsibleId === currentUserId
        const isOutgoing = task.creatorId === currentUserId && task.responsibleId !== currentUserId

        let isOverdue = false
        if (task.deadLine) {
            isOverdue = isTaskDeadlineOverdue(task.deadLine)
        }

        let isCompleted = false
        const pipelineId = task.column?.pipelineId ?? undefined
        const lastPos = pipelineId != null ? lastColumnByPipeline.get(pipelineId) : undefined
        if (task.column?.position != null && lastPos != null) {
            isCompleted = task.column.position === lastPos
        }

        return {
            isIncoming,
            isOutgoing,
            isOverdue,
            isCompleted,
        }
    }

    getTasksByDepartmentId: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { departmentId: string } }>(
            '/departments/:departmentId/tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const tasks = await this.tasksService.getTasksByDepartmentId(
                    departmentId,
                    req.user!.id,
                )
                return reply.send(tasks.map((t) => this.serializeTask(t)))
            },
        )
    }

    getMyTasksByOrganization: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { organizationId: string }
            Querystring: { scope?: 'mine' | 'org' }
        }>(
            '/organizations/:organizationId/my-tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('organizationId', 'id организации'),
                ],
            },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const currentUserId = req.user!.id
                const scope = req.query?.scope === 'org' ? 'org' : 'mine'
                const payload = await this.tasksService.getMyTasksByOrganization(organizationId, currentUserId, {
                    scope,
                })

                const serializedTasks = payload.tasks.map((t) => this.serializeTask(t))

                return reply.send({
                    outgoing: serializedTasks.filter((t) =>
                        payload.classification.outgoing.has(t.id),
                    ),
                    incoming: serializedTasks.filter((t) =>
                        payload.classification.incoming.has(t.id),
                    ),
                    review: serializedTasks.filter((t) =>
                        payload.classification.review.has(t.id),
                    ),
                    completed: serializedTasks.filter((t) =>
                        payload.classification.completed.has(t.id),
                    ),
                    overdue: serializedTasks.filter((t) =>
                        payload.classification.overdue.has(t.id),
                    ),
                    organization: serializedTasks.filter((t) =>
                        payload.classification.organization.has(t.id),
                    ),
                })
            },
        )
    }

    getMyTasksByOrganizationPaginated: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { organizationId: string }
            Querystring: {
                page?: string
                pageSize?: string
                bucket?: string
                q?: string
                sort?: string
            }
        }>(
            '/organizations/:organizationId/my-tasks/page',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('organizationId', 'id организации'),
                ],
            },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const currentUserId = req.user!.id
                const page = Math.max(1, Number(req.query.page) || 1)
                const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12))
                const rawBucket = req.query.bucket
                const allowed = new Set([
                    'all',
                    'outgoing',
                    'incoming',
                    'review',
                    'completed',
                    'overdue',
                ])
                const bucket =
                    rawBucket != null && allowed.has(rawBucket)
                        ? (rawBucket as
                              | 'all'
                              | 'outgoing'
                              | 'incoming'
                              | 'review'
                              | 'completed'
                              | 'overdue')
                        : 'all'
                const q =
                    req.query.q != null && String(req.query.q).length > 0
                        ? String(req.query.q)
                        : undefined

                const rawSort = req.query.sort
                const listSort =
                    rawSort === 'deadline_asc' || rawSort === 'deadline_desc' ? rawSort : 'bucket'

                const result = await this.tasksService.getMyTasksByOrganizationPaginated(
                    organizationId,
                    currentUserId,
                    { page, pageSize, bucket, q, sort: listSort },
                )

                return reply.send({
                    rows: result.rows.map((r) => ({
                        task: this.serializeTask(r.task),
                        buckets: r.buckets,
                        organizationName: r.organizationName,
                    })),
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                })
            },
        )
    }

    getOverdueTasksByDepartmentId: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { departmentId: string } }>(
            '/departments/:departmentId/tasks/overdue',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('departmentId', 'id Раздела'),
                ],
            },
            async (req, reply) => {
                const departmentId = Number(req.params.departmentId)
                const tasks = await this.tasksService.getOverdueTasksByDepartmentId(
                    departmentId,
                    req.user!.id,
                )
                return reply.send(tasks.map((t) => this.serializeTask(t)))
            },
        )
    }

    getTasksByColumnId: FastifyPluginAsync = async (fastify) => {
        const MAX_PAGE = 200
        fastify.get<{
            Params: { columnId: string }
            Querystring: {
                limit?: string
                offset?: string
                q?: string
                tagId?: string
                responsibleId?: string
                overdue?: string
                excludeCompleted?: string
            }
        }>(
            '/columns/:columnId/tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const columnId = Number(req.params.columnId)
                const listFilter = parseColumnTaskListFilter(req.query)
                const limitRaw = req.query.limit
                if (limitRaw !== undefined && limitRaw !== '') {
                    const limit = Math.min(
                        MAX_PAGE,
                        Math.max(1, Math.floor(Number(limitRaw))),
                    )
                    if (!Number.isFinite(limit)) {
                        throw new BadRequestError('Некорректный limit')
                    }
                    const off = Math.max(0, Math.floor(Number(req.query.offset ?? 0)))
                    if (!Number.isFinite(off)) {
                        throw new BadRequestError('Некорректный offset')
                    }
                    const { items, total } = await this.tasksService.getTasksByColumnIdPaginated(
                        columnId,
                        req.user!.id,
                        off,
                        limit,
                        listFilter,
                    )
                    return reply.send({
                        items: items.map((t) => this.serializeTaskWithBroadcast(t)),
                        total,
                        /** Общее число задач в колонке (с учётом фильтров), не только в `items`. */
                        count: total,
                    })
                }
                const tasks = await this.tasksService.getTasksByColumnId(
                    columnId,
                    req.user!.id,
                    listFilter,
                )
                return reply.send(tasks.map((t) => this.serializeTaskWithBroadcast(t)))
            },
        )
    }

    getPipelineCalendarTasks: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { pipelineId: string }
            Querystring: {
                from?: string
                to?: string
                q?: string
                tagId?: string
                responsibleId?: string
                overdue?: string
                excludeCompleted?: string
            }
        }>(
            '/pipelines/:pipelineId/calendar-tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('pipelineId', 'id воронки'),
                ],
            },
            async (req, reply) => {
                const pipelineId = Number(req.params.pipelineId)
                const from = String(req.query.from ?? '').trim()
                const to = String(req.query.to ?? '').trim()
                if (!from || !to) {
                    throw new BadRequestError('Укажите from и to (YYYY-MM-DD)')
                }
                const listFilter = parseColumnTaskListFilter(req.query)
                const tasks = await this.tasksService.getPipelineCalendarTasks(
                    pipelineId,
                    req.user!.id,
                    from,
                    to,
                    listFilter,
                )
                return reply.send(tasks.map((t) => this.serializeCalendarTask(t)))
            },
        )
    }

    getOrganizationCalendarTasks: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { organizationId: string }
            Querystring: {
                from?: string
                to?: string
                scope?: string
                q?: string
                sort?: string
            }
        }>(
            '/organizations/:organizationId/calendar-tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('organizationId', 'id организации'),
                ],
            },
            async (req, reply) => {
                const organizationId = Number(req.params.organizationId)
                const from = String(req.query.from ?? '').trim()
                const to = String(req.query.to ?? '').trim()
                if (!from || !to) {
                    throw new BadRequestError('Укажите from и to (YYYY-MM-DD)')
                }
                const scope = req.query.scope === 'org' ? 'org' : 'mine'
                const rawSort = req.query.sort
                const sort =
                    rawSort === 'deadline_asc' || rawSort === 'deadline_desc' ? rawSort : undefined
                const q =
                    req.query.q != null && String(req.query.q).length > 0
                        ? String(req.query.q)
                        : undefined
                const tasks = await this.tasksService.getOrganizationCalendarTasks(
                    organizationId,
                    req.user!.id,
                    { from, to, scope, q, sort },
                )
                return reply.send(tasks.map((t) => this.serializeCalendarTask(t)))
            },
        )
    }

    getGlobalCalendarTasks: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Querystring: {
                from?: string
                to?: string
                organizationId?: string
                departmentId?: string
                bucket?: string
                involvement?: string
                q?: string
                sort?: string
            }
        }>(
            '/tasks/global/calendar',
            { preHandler: [authMiddleware] },
            async (req, reply) => {
                const from = String(req.query.from ?? '').trim()
                const to = String(req.query.to ?? '').trim()
                if (!from || !to) {
                    throw new BadRequestError('Укажите from и to (YYYY-MM-DD)')
                }
                const organizationId =
                    req.query.organizationId != null &&
                    String(req.query.organizationId).trim() !== '' &&
                    !Number.isNaN(Number(req.query.organizationId))
                        ? Number(req.query.organizationId)
                        : undefined
                const departmentId =
                    req.query.departmentId != null &&
                    String(req.query.departmentId).trim() !== '' &&
                    !Number.isNaN(Number(req.query.departmentId))
                        ? Number(req.query.departmentId)
                        : undefined
                const rawBucket = req.query.bucket
                const allowed = new Set([
                    'all',
                    'outgoing',
                    'incoming',
                    'review',
                    'completed',
                    'overdue',
                    'organization',
                ])
                const bucket =
                    rawBucket != null && allowed.has(rawBucket)
                        ? (rawBucket as
                              | 'all'
                              | 'outgoing'
                              | 'incoming'
                              | 'review'
                              | 'completed'
                              | 'overdue'
                              | 'organization')
                        : 'all'
                const rawInvolvement = req.query.involvement
                const allowedInvolvement = new Set(['all', 'created', 'assigned'])
                const involvement =
                    rawInvolvement != null && allowedInvolvement.has(rawInvolvement)
                        ? (rawInvolvement as 'all' | 'created' | 'assigned')
                        : 'all'
                const q =
                    req.query.q != null && String(req.query.q).length > 0
                        ? String(req.query.q)
                        : undefined
                const rawSort = req.query.sort
                const sort =
                    rawSort === 'deadline_asc' || rawSort === 'deadline_desc' ? rawSort : 'bucket'

                const tasks = await this.tasksService.getGlobalCalendarTasks(req.user!.id, {
                    from,
                    to,
                    organizationId,
                    departmentId,
                    bucket,
                    involvement,
                    q,
                    sort,
                })
                return reply.send(tasks.map((t) => this.serializeCalendarTask(t)))
            },
        )
    }

    getOverdueTasksByColumnId: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { columnId: string } }>(
            '/columns/:columnId/tasks/overdue',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const columnId = Number(req.params.columnId)
                const tasks = await this.tasksService.getOverdueTasksByColumnId(
                    columnId,
                    req.user!.id,
                )
                return reply.send(tasks.map((t) => this.serializeTask(t)))
            },
        )
    }

    getGlobalMyTasks: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Querystring: {
                page?: string
                pageSize?: string
                organizationId?: string
                departmentId?: string
                bucket?: string
                involvement?: string
                q?: string
                sort?: string
            }
        }>(
            '/tasks/global',
            { preHandler: [authMiddleware] },
            async (req, reply) => {
                const currentUserId = req.user!.id
                const page = Math.max(1, Number(req.query.page) || 1)
                const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12))
                const organizationId =
                    req.query.organizationId != null &&
                    String(req.query.organizationId).trim() !== '' &&
                    !Number.isNaN(Number(req.query.organizationId))
                        ? Number(req.query.organizationId)
                        : undefined
                const departmentId =
                    req.query.departmentId != null &&
                    String(req.query.departmentId).trim() !== '' &&
                    !Number.isNaN(Number(req.query.departmentId))
                        ? Number(req.query.departmentId)
                        : undefined
                const rawBucket = req.query.bucket
                const allowed = new Set([
                    'all',
                    'outgoing',
                    'incoming',
                    'review',
                    'completed',
                    'overdue',
                    'organization',
                ])
                const bucket =
                    rawBucket != null && allowed.has(rawBucket)
                        ? (rawBucket as
                              | 'all'
                              | 'outgoing'
                              | 'incoming'
                              | 'review'
                              | 'completed'
                              | 'overdue'
                              | 'organization')
                        : 'all'
                const rawInvolvement = req.query.involvement
                const allowedInvolvement = new Set(['all', 'created', 'assigned'])
                const involvement =
                    rawInvolvement != null && allowedInvolvement.has(rawInvolvement)
                        ? (rawInvolvement as 'all' | 'created' | 'assigned')
                        : 'all'
                const q = req.query.q != null && String(req.query.q).length > 0 ? String(req.query.q) : undefined

                const rawSort = req.query.sort
                const listSort =
                    rawSort === 'deadline_asc' || rawSort === 'deadline_desc' ? rawSort : 'bucket'

                const result = await this.tasksService.getGlobalMyTasksPage(currentUserId, {
                    page,
                    pageSize,
                    organizationId,
                    departmentId,
                    bucket,
                    involvement,
                    q,
                    sort: listSort,
                })
                return reply.send({
                    rows: result.rows.map((r) => ({
                        task: this.serializeTask(r.task),
                        buckets: r.buckets,
                        organizationName: r.organizationName,
                    })),
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    hasOrgScopeTask: result.hasOrgScopeTask,
                    failedOrganizationIds: result.failedOrganizationIds,
                })
            },
        )
    }

    getTaskById: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { id: string }
            Querystring: { includeAttachments?: string }
        }>(
            '/tasks/:id',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const raw = req.query?.includeAttachments
                const includeAttachments =
                    raw == null
                    || raw === ''
                    || (typeof raw === 'string' && !['0', 'false', 'no'].includes(raw.toLowerCase()))
                const task = await this.tasksService.getTaskById(taskId, req.user!.id, {
                    includeAttachments,
                })
                return reply.send(this.serializeTaskWithBroadcast(task))
            },
        )
    }

    getTaskActivity: FastifyPluginAsync = async (fastify) => {
        fastify.get<{
            Params: { id: string }
            Querystring: { limit?: string; beforeId?: string }
        }>(
            '/tasks/:id/activity',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const limitRaw = req.query?.limit
                const beforeRaw = req.query?.beforeId
                const limit = limitRaw != null && limitRaw !== '' ? Number(limitRaw) : undefined
                const beforeId = beforeRaw != null && beforeRaw !== '' ? Number(beforeRaw) : undefined
                const items = await this.tasksService.getTaskActivity(taskId, req.user!.id, {
                    limit: Number.isFinite(limit) ? limit : undefined,
                    beforeId: Number.isFinite(beforeId) ? beforeId : undefined,
                })
                return reply.send(
                    items.map((row) => ({
                        id: row.id,
                        taskId: row.taskId,
                        kind: row.kind,
                        payload: row.payload,
                        createdAt: row.createdAt ? row.createdAt.toISOString() : null,
                        actor: row.actor,
                    })),
                )
            },
        )
    }

    listTaskAttachments: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { id: string } }>(
            '/tasks/:id/attachments',
            {
                preHandler: [authMiddleware, validateParamId('id', 'id задачи')],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const items = await this.tasksService.listTaskAttachments(taskId, req.user!.id)
                return reply.send(items.map((a) => this.serializeAttachment(a)))
            },
        )
    }

    createTask: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { columnId: string }
            Body: Omit<CreateTaskDTO, 'columnId' | 'organizationId' | 'creatorId'>
        }>(
            '/columns/:columnId/tasks',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const columnId = Number(req.params.columnId)

                const dto: Omit<CreateTaskDTO, 'organizationId' | 'creatorId'> = {
                    ...req.body,
                    columnId,
                    startDate: this.normalizeDeadline(req.body.startDate),
                    deadLine: this.normalizeDeadline(req.body.deadLine),
                }
                const task = await this.tasksService.createTask(dto, req.user!.id)
                return reply.status(201).send(this.serializeTask(task))
            },
        )
    }

    createBroadcastTask: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { columnId: string }
            Body: Omit<CreateBroadcastTaskDTO, 'columnId' | 'organizationId' | 'creatorId'>
        }>(
            '/columns/:columnId/tasks/broadcast',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const columnId = Number(req.params.columnId)
                const dto: Omit<CreateBroadcastTaskDTO, 'organizationId' | 'creatorId'> = {
                    ...req.body,
                    columnId,
                    startDate: this.normalizeDeadline(req.body.startDate),
                    deadLine: this.normalizeDeadline(req.body.deadLine),
                }
                const task = await this.tasksService.createBroadcastTasks(dto, req.user!.id)
                const serialized = this.serializeTask(task)
                return reply.status(201).send({
                    ...serialized,
                    broadcastProgress: this.serializeBroadcastProgress(task.broadcastProgress),
                })
            },
        )
    }

    getBroadcastProgress: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { id: string } }>(
            '/tasks/:id/broadcast/progress',
            { preHandler: [authMiddleware, validateParamId('id', 'id задачи')] },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const task = await this.tasksService.ensureTaskExistPublic(taskId, req.user!.id)
                const progress = await this.tasksService.getBroadcastProgressPublic(task.id)
                return reply.send(this.serializeBroadcastProgress(progress))
            },
        )
    }

    addBroadcastMember: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { id: string }
            Body: { userId: number }
        }>(
            '/tasks/:id/broadcast/members',
            { preHandler: [authMiddleware, validateParamId('id', 'id задачи')] },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const userId = Number(req.body?.userId)
                if (!Number.isInteger(userId) || userId <= 0) {
                    throw new BadRequestError('Некорректный userId')
                }
                const progress = await this.tasksService.addBroadcastMember(taskId, userId, req.user!.id)
                return reply.status(201).send(this.serializeBroadcastProgress(progress))
            },
        )
    }

    removeBroadcastMember: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{
            Params: { id: string; userId: string }
        }>(
            '/tasks/:id/broadcast/members/:userId',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                    validateParamId('userId', 'id пользователя'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const userId = Number(req.params.userId)
                const progress = await this.tasksService.removeBroadcastMember(taskId, userId, req.user!.id)
                return reply.send(this.serializeBroadcastProgress(progress))
            },
        )
    }

    updateTask: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { id: string }
            Body: UpdateTaskDTO
        }>(
            '/tasks/:id',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const payload: UpdateTaskDTO = { ...req.body }
                delete (payload as { completedAt?: unknown }).completedAt
                if ('startDate' in req.body) {
                    payload.startDate = this.normalizeDeadline(req.body.startDate)
                }
                if ('deadLine' in req.body) {
                    payload.deadLine = this.normalizeDeadline(req.body.deadLine)
                }
                const task = await this.tasksService.updateTask(
                    payload,
                    taskId,
                    req.user!.id,
                )
                return reply.send(this.serializeTask(task))
            },
        )
    }

    setTaskResponsibles: FastifyPluginAsync = async (fastify) => {
        fastify.put<{
            Params: { id: string }
            Body: { responsibleIds?: unknown }
        }>(
            '/tasks/:id/responsibles',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const raw = req.body?.responsibleIds
                if (!Array.isArray(raw)) {
                    throw new BadRequestError('responsibleIds должен быть массивом')
                }
                const ids: number[] = []
                for (const v of raw) {
                    const n = Number(v)
                    if (!Number.isInteger(n)) {
                        throw new BadRequestError('responsibleIds должен содержать только id пользователей')
                    }
                    ids.push(n)
                }
                const result = await this.tasksService.setTaskResponsibles(
                    taskId,
                    ids,
                    req.user!.id,
                )
                const responsibleIds = result.primary != null
                    ? [result.primary, ...result.extras]
                    : []
                return reply.send({ responsibleIds })
            },
        )
    }

    sendBackTask: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { id: string }
            Body: { comment?: string }
        }>(
            '/tasks/:id/send-back',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const comment =
                    typeof req.body?.comment === 'string' ? req.body.comment.trim() : ''
                const task = await this.tasksService.sendBackTask(
                    taskId,
                    req.user!.id,
                    comment,
                )
                return reply.send(this.serializeTask(task))
            },
        )
    }

    rejectFromReview: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { id: string }
            Body: { comment?: string }
        }>(
            '/tasks/:id/reject-from-review',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const comment =
                    typeof req.body?.comment === 'string' ? req.body.comment.trim() : ''
                const task = await this.tasksService.rejectFromReview(
                    taskId,
                    req.user!.id,
                    comment,
                )
                return reply.send(this.serializeTask(task))
            },
        )
    }

    deleteTask: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{ Params: { id: string } }>(
            '/tasks/:id',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                await this.tasksService.deleteTask(taskId, req.user!.id)
                return reply.status(204).send()
            },
        )
    }

    placeTask: FastifyPluginAsync = async (fastify) => {
        fastify.post<{
            Params: { columnId: string; taskId: string }
            Body: { insertAfterTaskId: number | null }
        }>(
            '/columns/:columnId/tasks/:taskId/place',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                    validateParamId('taskId', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const targetColumnId = Number(req.params.columnId)
                const taskId = Number(req.params.taskId)
                const insert =
                    req.body == null
                        || typeof req.body !== 'object'
                        || !('insertAfterTaskId' in req.body)
                        ? (null as null)
                        : (req.body as { insertAfterTaskId: number | null }).insertAfterTaskId
                if (insert != null) {
                    if (typeof insert !== 'number' || !Number.isInteger(insert)) {
                        throw new BadRequestError('insertAfterTaskId: ожидается число или null')
                    }
                }
                const autoCompletedParent = await this.tasksService.placeTaskInColumn(
                    targetColumnId,
                    taskId,
                    insert,
                    req.user!.id,
                )
                return reply.send({ autoCompletedParent: autoCompletedParent ?? null })
            },
        )
    }

    reorderTasks: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { columnId: string }
            Body: { taskIds: number[] }
        }>(
            '/columns/:columnId/tasks/reorder',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('columnId', 'id колонки'),
                ],
            },
            async (req, reply) => {
                const columnId = Number(req.params.columnId)
                const { taskIds } = req.body
                if (!Array.isArray(taskIds)) {
                    throw new BadRequestError('taskIds должен быть массивом')
                }

                await this.tasksService.reorderTasks(
                    columnId,
                    taskIds,
                    req.user!.id,
                )

                return reply.status(204).send()
            },
        )
    }

    uploadTaskAttachment: FastifyPluginAsync = async (fastify) => {
        fastify.post<{ Params: { id: string } }>(
            '/tasks/:id/attachments',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const data = await req.file()
                if (!data) {
                    throw new BadRequestError('Файл не передан')
                }
                const tempPath = path.join(tmpdir(), `task-att-${randomUUID()}`)
                try {
                    await pipeline(data.file, createWriteStream(tempPath))
                    const attachment = await this.tasksService.addTaskAttachment(taskId, req.user!.id, {
                        tempPath,
                        filename: data.filename || 'file',
                    })
                    return reply.status(201).send(this.serializeAttachment(attachment))
                } catch (err) {
                    await fs.unlink(tempPath).catch(() => {})
                    throw err
                }
            },
        )
    }

    downloadTaskAttachment: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { id: string; attachmentId: string } }>(
            '/tasks/:id/attachments/:attachmentId/file',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                    validateParamId('attachmentId', 'id вложения'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const attachmentId = Number(req.params.attachmentId)
                const { row, absolutePath } = await this.tasksService.getAttachmentForDownload(
                    taskId,
                    attachmentId,
                    req.user!.id,
                )
                const stream = createReadStream(absolutePath)
                reply.type(row.mimeType ?? 'application/octet-stream')
                reply.header('X-Content-Type-Options', 'nosniff')
                const asciiName = row.fileName.replace(/[^\x20-\x7E]/g, '_')
                reply.header(
                    'Content-Disposition',
                    `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(row.fileName)}`,
                )
                return reply.send(stream)
            },
        )
    }

    deleteTaskAttachment: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{ Params: { id: string; attachmentId: string } }>(
            '/tasks/:id/attachments/:attachmentId',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                    validateParamId('attachmentId', 'id вложения'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const attachmentId = Number(req.params.attachmentId)
                await this.tasksService.deleteTaskAttachment(taskId, attachmentId, req.user!.id)
                return reply.status(204).send()
            },
        )
    }

    listTaskComments: FastifyPluginAsync = async (fastify) => {
        fastify.get<{ Params: { id: string } }>(
            '/tasks/:id/comments',
            {
                preHandler: [authMiddleware, validateParamId('id', 'id задачи')],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const items = await this.tasksService.listTaskComments(taskId, req.user!.id)
                return reply.send(items.map((c) => this.serializeComment(c)))
            },
        )
    }

    addTaskComment: FastifyPluginAsync = async (fastify) => {
        fastify.post<{ Params: { id: string }; Body: { body?: unknown } }>(
            '/tasks/:id/comments',
            {
                preHandler: [authMiddleware, validateParamId('id', 'id задачи')],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const rawBody = (req.body ?? {}) as { body?: unknown }
                if (typeof rawBody.body !== 'string') {
                    throw new BadRequestError('body: ожидается строка')
                }
                const created = await this.tasksService.addTaskComment(
                    taskId,
                    req.user!.id,
                    rawBody.body,
                )
                return reply.status(201).send(this.serializeComment(created))
            },
        )
    }

    updateTaskComment: FastifyPluginAsync = async (fastify) => {
        fastify.patch<{
            Params: { id: string; commentId: string }
            Body: { body?: unknown }
        }>(
            '/tasks/:id/comments/:commentId',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                    validateParamId('commentId', 'id комментария'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const commentId = Number(req.params.commentId)
                const rawBody = (req.body ?? {}) as { body?: unknown }
                if (typeof rawBody.body !== 'string') {
                    throw new BadRequestError('body: ожидается строка')
                }
                const updated = await this.tasksService.updateTaskComment(
                    taskId,
                    commentId,
                    req.user!.id,
                    rawBody.body,
                )
                return reply.send(this.serializeComment(updated))
            },
        )
    }

    deleteTaskComment: FastifyPluginAsync = async (fastify) => {
        fastify.delete<{ Params: { id: string; commentId: string } }>(
            '/tasks/:id/comments/:commentId',
            {
                preHandler: [
                    authMiddleware,
                    validateParamId('id', 'id задачи'),
                    validateParamId('commentId', 'id комментария'),
                ],
            },
            async (req, reply) => {
                const taskId = Number(req.params.id)
                const commentId = Number(req.params.commentId)
                await this.tasksService.deleteTaskComment(taskId, commentId, req.user!.id)
                return reply.status(204).send()
            },
        )
    }
}