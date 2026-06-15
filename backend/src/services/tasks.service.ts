import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import { CreateBroadcastTaskDTO, CreateTaskDTO, ITaskRepository, UpdateTaskDTO, type BroadcastProgress, type CalendarTaskListItem, type ColumnTaskListFilter } from "../entities/tasks";
import type { IAuthRepository } from "../entities/auth/index.js";
import type { IOrganizationRepository } from "../entities/organization/index.js";
import { Task, type Organization, type TaskAttachment, type Tag } from "../infra/database/drizzle/schema";
import { TaskAttachmentsRepository, type TaskAttachmentWithUploader } from "../infra/database/drizzle/task-attachments/task-attachments.repository.js";
import { TaskCommentsRepository, type TaskCommentWithAuthor } from "../infra/database/drizzle/task-comments/task-comments.repository.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../infra/libs/errors";
import { getTaskAttachmentsDir, sanitizeOriginalFileName } from "../infra/libs/taskUploadPaths.js";
import { assertAllowedTaskAttachmentUploadedFile } from "../infra/libs/taskAttachmentValidation.js";
import { DepartmentService } from "./department.service";
import { DepartmentAccessService } from "./department-access.service";
import type { OrganizationAccessService } from "./organization-access.service.js";
import type { IPipelinesRepository } from '../entities/pipelines/index.js'
import { IColumnsRepository } from "../entities/columnts";
import { validateNonEmptyString } from "../infra/libs/validation";
import { formatTaskDateTimeForApi, isTaskDeadlineOverdue } from "../utils/taskDateTime.js";
import type { OrganizationService } from "./organization.service.js";
import { TaskActivityService } from "./task-activity.service.js";
import { WebPushService } from "./web-push.service.js";
import { PolicyResolverService } from "./policy-resolver.service.js";
import type { ITagsRepository } from "../entities/tags/index.js";

/** Задача из getAllTasksByDepartmentId с `column` и хвостом getMyTasksByOrganization. */
type MyTasksOrgListItem = Task & {
  column?: { id: number; position: number; pipelineId: number | null } | null
  departmentId?: number
  departmentName?: string
  responsibleIds?: number[]
}

type GlobalTaskBucket = "outgoing" | "incoming" | "review" | "completed" | "overdue" | "organization"
type GlobalMyTasksInvolvement = "all" | "created" | "assigned"
/** Сортировка постраничных списков задач (query `sort`). */
type GlobalMyTasksListSort = "bucket" | "deadline_asc" | "deadline_desc"

export type GlobalMyTaskPageRow = {
  task: MyTasksOrgListItem
  buckets: GlobalTaskBucket[]
  organizationName: string
}

@injectable()
export class TasksService {
    constructor(
        @inject(TYPES.TasksRepository) private taskRepo: ITaskRepository,
        @inject(TYPES.TaskAttachmentsRepository) private taskAttachmentsRepo: TaskAttachmentsRepository,
        @inject(TYPES.TaskCommentsRepository) private taskCommentsRepo: TaskCommentsRepository,
        @inject(TYPES.DepartmentService) private departmentService: DepartmentService,
        @inject(TYPES.DepartmentAccessService) private departmentAccessService: DepartmentAccessService,
        @inject(TYPES.ColumnRepository) private columnRepo: IColumnsRepository,
        @inject(TYPES.PipelinesRepository) private pipelinesRepo: IPipelinesRepository,
        @inject(TYPES.OrganizationRepository) private organizationRepo: IOrganizationRepository,
        @inject(TYPES.OrganizationService) private organizationService: OrganizationService,
        @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
        @inject(TYPES.AuthRepository) private authRepo: IAuthRepository,
        @inject(TYPES.TaskActivityService) private taskActivity: TaskActivityService,
        @inject(TYPES.WebPushService) private webPush: WebPushService,
        @inject(TYPES.PolicyResolverService) private policyResolver: PolicyResolverService,
        @inject(TYPES.TagsRepository) private tagsRepo: ITagsRepository,
    ) { }

    private async canSeeAllTasksInDepartment(
        departmentId: number,
        currentUserId: number,
        pipelineId?: number | null,
    ): Promise<boolean> {
        return this.policyResolver.resolveMemberCapability(
            departmentId,
            pipelineId,
            currentUserId,
            'memberCanSeeAllTasks',
        )
    }

    private async canCreateTasksInDepartment(
        departmentId: number,
        currentUserId: number,
        pipelineId?: number | null,
    ): Promise<boolean> {
        return this.policyResolver.resolveMemberCapability(
            departmentId,
            pipelineId,
            currentUserId,
            'memberCanCreateTasks',
        )
    }

    private async isCompletedColumn(columnId: number): Promise<boolean> {
        return this.policyResolver.isCompletedColumn(columnId)
    }

    private async departmentIdForColumn(columnId: number | null | undefined): Promise<number | null> {
        if (columnId == null) return null
        const col = await this.columnRepo.getColumnById(columnId)
        return col?.departmentId ?? null
    }

    private async taskPushRefFromColumn(
        task: {
            id: number
            name: string
            responsibleId: number | null
            responsibleIds?: number[]
            columnId?: number | null
        },
        currentUserId: number,
    ) {
        const place = await this.resolveColumnPlace(task.columnId, currentUserId)
        return {
            id: task.id,
            name: task.name,
            responsibleId: task.responsibleId,
            responsibleIds: task.responsibleIds,
            columnId: task.columnId ?? null,
            departmentId: place?.departmentId ?? null,
            departmentName: place?.departmentName ?? null,
            pipelineName: place?.pipelineName ?? null,
            columnName: place?.columnName ?? null,
        }
    }

    private async ensureTaskExist(taskId: number): Promise<Task> {
        try {
            return await this.taskRepo.getTaskById(taskId)
        } catch {
            throw new NotFoundError('Такой задачи не существует')
        }
    }

    private async ensureAccessToColumn(columnId: number, currentUserId: number) {
        const column = await this.columnRepo.getColumnById(columnId)
        if (!column) throw new NotFoundError('Такой колонки не существует')
        const department = await this.departmentService.getDepartmentById(column.departmentId, currentUserId)
        return { column, department }
    }

    async getTaskById(taskId: number, currentUserId: number, options?: { includeAttachments?: boolean }) {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)

        const broadcastRaw = await this.taskRepo.getBroadcastProgress(taskId)
        const broadcastProgress = broadcastRaw.total > 0 ? broadcastRaw : null

        const include = options?.includeAttachments !== false
        if (!include) {
            return { ...task, attachments: undefined, broadcastProgress }
        }
        const attachments = await this.taskAttachmentsRepo.listByTaskId(taskId)
        return { ...task, attachments, broadcastProgress }
    }

    async getTaskActivity(
        taskId: number,
        currentUserId: number,
        opts?: { limit?: number; beforeId?: number },
    ) {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const limit = Math.min(100, Math.max(1, opts?.limit ?? 50))
        return this.taskActivity.listForTask(taskId, {
            limit,
            beforeId: opts?.beforeId,
        })
    }

    /** Метаданные вложений задачи (без файлов); права как у просмотра задачи. */
    async listTaskAttachments(taskId: number, currentUserId: number): Promise<TaskAttachmentWithUploader[]> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        return this.taskAttachmentsRepo.listByTaskId(taskId)
    }

    /**
     * Прикреплять файлы могут менеджер отдела, автор задачи и любой исполнитель/соисполнитель.
     */
    private async assertCanAddTaskAttachment(taskId: number, currentUserId: number): Promise<Task> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        if (canManage) return task
        if (task.creatorId === currentUserId) return task
        const respIds = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
            ?? (task.responsibleId != null ? [task.responsibleId] : [])
        if (respIds.includes(currentUserId)) return task
        throw new ForbiddenError('Прикреплять файлы могут автор, исполнитель или менеджер отдела')
    }

    /**
     * @param input.tempPath — временный файл после multipart (поток); после успеха переименовывается в хранилище.
     */
    async addTaskAttachment(
        taskId: number,
        currentUserId: number,
        input: { tempPath: string; filename: string },
    ): Promise<TaskAttachmentWithUploader> {
        const task = await this.assertCanAddTaskAttachment(taskId, currentUserId)
        const safeName = sanitizeOriginalFileName(input.filename)
        const stat = await fs.stat(input.tempPath)
        const { mime } = await assertAllowedTaskAttachmentUploadedFile(input.tempPath, safeName, stat.size)
        const storedFileName = randomUUID()
        const dir = getTaskAttachmentsDir()
        await fs.mkdir(dir, { recursive: true })
        const diskPath = path.join(dir, storedFileName)
        try {
            await fs.rename(input.tempPath, diskPath)
        } catch {
            await fs.copyFile(input.tempPath, diskPath)
            await fs.unlink(input.tempPath).catch(() => {})
        }
        try {
            const inserted = await this.taskAttachmentsRepo.insert({
                taskId,
                organizationId: task.organizationId,
                fileName: safeName,
                mimeType: mime,
                sizeBytes: stat.size,
                storedFileName,
                uploadedByUserId: currentUserId,
            })
            const withUploader = await this.taskAttachmentsRepo.getByIdWithUploader(inserted.id)
            await this.taskActivity.append(taskId, currentUserId, 'attachment_added', {
                attachmentId: inserted.id,
                fileName: safeName,
            }).catch(() => undefined)
            return withUploader ?? { ...inserted, uploadedBy: null }
        } catch (e) {
            await fs.unlink(diskPath).catch(() => {})
            throw e
        }
    }

    /**
     * Удалить вложение могут: менеджер отдела, автор задачи, либо тот, кто его сам прикрепил.
     */
    async deleteTaskAttachment(taskId: number, attachmentId: number, currentUserId: number): Promise<void> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const row = await this.taskAttachmentsRepo.getById(attachmentId)
        if (!row || row.taskId !== taskId) {
            throw new NotFoundError('Вложение не найдено')
        }
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        const isAuthor = task.creatorId === currentUserId
        const isUploader = row.uploadedByUserId != null && row.uploadedByUserId === currentUserId
        if (!canManage && !isAuthor && !isUploader) {
            throw new ForbiddenError('Удалить вложение может только тот, кто его прикрепил, автор задачи или менеджер отдела')
        }
        await this.taskActivity.append(taskId, currentUserId, 'attachment_removed', {
            attachmentId,
            fileName: row.fileName,
        }).catch(() => undefined)
        const diskPath = path.join(getTaskAttachmentsDir(), row.storedFileName)
        await this.taskAttachmentsRepo.deleteById(attachmentId)
        await fs.unlink(diskPath).catch(() => {})
    }

    async getAttachmentForDownload(
        taskId: number,
        attachmentId: number,
        currentUserId: number,
    ): Promise<{ row: TaskAttachment; absolutePath: string }> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const row = await this.taskAttachmentsRepo.getById(attachmentId)
        if (!row || row.taskId !== taskId) {
            throw new NotFoundError('Вложение не найдено')
        }
        const absolutePath = path.join(getTaskAttachmentsDir(), row.storedFileName)
        try {
            await fs.access(absolutePath)
        } catch {
            throw new NotFoundError('Файл не найден на сервере')
        }
        return { row, absolutePath }
    }

    /**
     * Комментарии к задаче могут читать все, у кого есть доступ к задаче
     * (колонка/отдел/организация — через стандартный ensureAccessToColumn).
     */
    async listTaskComments(taskId: number, currentUserId: number): Promise<TaskCommentWithAuthor[]> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        return this.taskCommentsRepo.listByTaskId(taskId)
    }

    /**
     * Оставить комментарий могут автор, исполнитель/соисполнитель или
     * менеджер отдела. Комментарий не может быть пустым.
     */
    async addTaskComment(
        taskId: number,
        currentUserId: number,
        body: string,
    ): Promise<TaskCommentWithAuthor> {
        validateNonEmptyString(body, 'Комментарий')
        const trimmed = body.trim()
        if (trimmed.length > 4000) {
            throw new BadRequestError('Комментарий не может быть длиннее 4000 символов')
        }
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        const respIds = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
            ?? (task.responsibleId != null ? [task.responsibleId] : [])
        const isParticipant =
            task.creatorId === currentUserId || respIds.includes(currentUserId)
        if (!canManage && !isParticipant) {
            throw new ForbiddenError('Комментировать могут автор, исполнитель или менеджер отдела')
        }
        return this.taskCommentsRepo.insert({ taskId, authorId: currentUserId, body: trimmed })
    }

    /** Редактировать комментарий может только его автор. */
    async updateTaskComment(
        taskId: number,
        commentId: number,
        currentUserId: number,
        body: string,
    ): Promise<TaskCommentWithAuthor> {
        validateNonEmptyString(body, 'Комментарий')
        const trimmed = body.trim()
        if (trimmed.length > 4000) {
            throw new BadRequestError('Комментарий не может быть длиннее 4000 символов')
        }
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const existing = await this.taskCommentsRepo.getById(commentId)
        if (!existing || existing.taskId !== taskId) {
            throw new NotFoundError('Комментарий не найден')
        }
        if (existing.authorId !== currentUserId) {
            throw new ForbiddenError('Редактировать комментарий может только его автор')
        }
        await this.taskCommentsRepo.update(commentId, trimmed)
        const list = await this.taskCommentsRepo.listByTaskId(taskId)
        const updated = list.find((c) => c.id === commentId)
        if (!updated) throw new NotFoundError('Комментарий не найден')
        return updated
    }

    /** Удалить комментарий может его автор или менеджер отдела. */
    async deleteTaskComment(taskId: number, commentId: number, currentUserId: number): Promise<void> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const existing = await this.taskCommentsRepo.getById(commentId)
        if (!existing || existing.taskId !== taskId) {
            throw new NotFoundError('Комментарий не найден')
        }
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        if (!canManage && existing.authorId !== currentUserId) {
            throw new ForbiddenError('Удалять комментарий может автор или менеджер отдела')
        }
        await this.taskCommentsRepo.softDelete(commentId)
    }

    async getTasksByColumnId(columnId: number, currentUserId: number, filter?: ColumnTaskListFilter) {
        const { column, department } = await this.ensureAccessToColumn(columnId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(department.id, currentUserId, column.pipelineId)
        return this.taskRepo.getAllTasksByColumnId(columnId, currentUserId, canSeeAll, filter)
    }

    async getTasksByColumnIdPaginated(
        columnId: number,
        currentUserId: number,
        offset: number,
        limit: number,
        filter?: ColumnTaskListFilter,
    ) {
        const { column, department } = await this.ensureAccessToColumn(columnId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(department.id, currentUserId, column.pipelineId)
        const total = await this.taskRepo.countTasksInColumn(columnId, currentUserId, canSeeAll, filter)
        const items = await this.taskRepo.getTasksByColumnIdPaginated(
            columnId,
            currentUserId,
            canSeeAll,
            offset,
            limit,
            filter,
        )
        return { items, total }
    }

    async getTasksByDepartmentId(departmentId: number, currentUserId: number) {
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(department.id, currentUserId)
        return this.taskRepo.getAllTasksByDepartmentId(departmentId, currentUserId, canSeeAll)
    }

    async getOverdueTasksByColumnId(columnId: number, currentUserId: number) {
        const { column, department } = await this.ensureAccessToColumn(columnId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(department.id, currentUserId, column.pipelineId)
        return this.taskRepo.getOverdueTasksByColumnId(columnId, currentUserId, canSeeAll)
    }

    async getOverdueTasksByDepartmentId(departmentId: number, currentUserId: number) {
        const department = await this.departmentService.getDepartmentById(departmentId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(department.id, currentUserId)
        return this.taskRepo.getOverdueTasksByDepartmentId(departmentId, currentUserId, canSeeAll)
    }

    private parseCalendarRange(from: string, to: string): { fromYmd: string; toYmd: string } {
        const fromYmd = String(from ?? '').trim()
        const toYmd = String(to ?? '').trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
            throw new BadRequestError('Параметры from и to должны быть в формате YYYY-MM-DD')
        }
        if (fromYmd > toYmd) {
            throw new BadRequestError('from не может быть позже to')
        }
        return { fromYmd, toYmd }
    }

    private async enrichCalendarTasks(
        items: CalendarTaskListItem[],
    ): Promise<(CalendarTaskListItem & { inPipelineTerminalColumn: boolean })[]> {
        const pipelineIds = new Set<number>()
        for (const t of items) {
            if (t.columnPipelineId != null) pipelineIds.add(t.columnPipelineId)
        }
        const lastPosByPipeline = new Map<number, number>()
        for (const pid of pipelineIds) {
            const cols = await this.columnRepo.getColumnsByPipelineId(pid)
            if (cols.length > 0) {
                lastPosByPipeline.set(pid, Math.max(...cols.map((c) => c.position)))
            }
        }
        return items.map((t) => {
            const lastPos =
                t.columnPipelineId != null ? lastPosByPipeline.get(t.columnPipelineId) : undefined
            const inPipelineTerminalColumn =
                t.columnPipelineId != null &&
                lastPos != null &&
                t.columnPosition === lastPos
            return { ...t, inPipelineTerminalColumn }
        })
    }

    async getPipelineCalendarTasks(
        pipelineId: number,
        currentUserId: number,
        from: string,
        to: string,
        filter?: ColumnTaskListFilter,
    ) {
        const pipeline = await this.pipelinesRepo.getPipelineById(pipelineId)
        if (!pipeline) {
            throw new NotFoundError('Такой воронки не существует')
        }
        await this.departmentService.getDepartmentById(pipeline.departmentId, currentUserId)
        const canSeeAll = await this.canSeeAllTasksInDepartment(pipeline.departmentId, currentUserId, pipelineId)
        const { fromYmd, toYmd } = this.parseCalendarRange(from, to)
        const items = await this.taskRepo.getCalendarTasksByPipelineId(
            pipelineId,
            currentUserId,
            canSeeAll,
            fromYmd,
            toYmd,
            filter,
        )
        return this.enrichCalendarTasks(items)
    }

    async getOrganizationCalendarTasks(
        organizationId: number,
        currentUserId: number,
        input: {
            from: string
            to: string
            scope?: 'mine' | 'org'
            q?: string
            sort?: GlobalMyTasksListSort
        },
    ) {
        const scope = input.scope === 'org' ? 'org' : 'mine'
        const { fromYmd, toYmd } = this.parseCalendarRange(input.from, input.to)
        const departments = await this.departmentService.getDepartmentsByOrganizationId(
            organizationId,
            currentUserId,
        )
        if (!departments.length) return []

        const deptPermissions = await Promise.all(
            departments.map(async (d) => ({
                id: d.id,
                name: d.name,
                canSeeAll: await this.canSeeAllTasksInDepartment(d.id, currentUserId),
            })),
        )

        const batches = await Promise.all(
            deptPermissions.map((p) =>
                this.taskRepo.getCalendarTasksByDepartmentId(
                    p.id,
                    currentUserId,
                    p.canSeeAll,
                    fromYmd,
                    toYmd,
                ),
            ),
        )

        let merged: CalendarTaskListItem[] = batches.flatMap((tasks, i) =>
            tasks.map((t) => ({
                ...t,
                departmentName: deptPermissions[i]!.name,
            })),
        )

        if (scope === 'mine') {
            merged = merged.filter((t) => this.isTaskRelatedToUser(t, currentUserId))
        }

        const q = (input.q ?? '').trim().toLowerCase()
        if (q) {
            merged = merged.filter((t) => t.name.toLowerCase().includes(q))
        }

        const enriched = await this.enrichCalendarTasks(merged)
        if (input.sort === 'deadline_asc' || input.sort === 'deadline_desc') {
            const dir = input.sort === 'deadline_asc' ? 1 : -1
            enriched.sort((a, b) => {
                const ta = a.deadLine?.getTime() ?? a.startDate?.getTime() ?? 0
                const tb = b.deadLine?.getTime() ?? b.startDate?.getTime() ?? 0
                if (ta !== tb) return (ta - tb) * dir
                return a.id - b.id
            })
        }
        return enriched
    }

    async getGlobalCalendarTasks(
        currentUserId: number,
        input: {
            from: string
            to: string
            organizationId?: number
            departmentId?: number
            bucket?: 'all' | GlobalTaskBucket
            involvement?: GlobalMyTasksInvolvement
            q?: string
            sort?: GlobalMyTasksListSort
        },
    ) {
        const orgs = await this.organizationService.getUserOrganizations(currentUserId)
        const targetOrgs =
            input.organizationId != null
                ? orgs.filter((o) => o.id === input.organizationId)
                : orgs
        if (!targetOrgs.length) return []

        const batches = await Promise.all(
            targetOrgs.map((org) =>
                this.getOrganizationCalendarTasks(org.id, currentUserId, {
                    from: input.from,
                    to: input.to,
                    scope: 'org',
                }),
            ),
        )
        let merged = batches.flat()

        const bucket = input.bucket ?? 'all'
        if (bucket !== 'all') {
            const allowedIds = new Set<number>()
            for (const org of targetOrgs) {
                const payload = await this.getMyTasksByOrganization(org.id, currentUserId, {
                    scope: 'org',
                })
                const classification = payload.classification
                const bucketSet =
                    bucket === 'outgoing'
                        ? classification.outgoing
                        : bucket === 'incoming'
                          ? classification.incoming
                          : bucket === 'review'
                            ? classification.review
                            : bucket === 'completed'
                              ? classification.completed
                              : bucket === 'overdue'
                                ? classification.overdue
                                : classification.organization
                for (const id of bucketSet) allowedIds.add(id)
            }
            merged = merged.filter((t) => allowedIds.has(t.id))
        }

        const involvement = input.involvement ?? 'all'
        if (involvement === 'created') {
            merged = merged.filter((t) => t.creatorId === currentUserId)
        } else if (involvement === 'assigned') {
            merged = merged.filter((t) => this.getResponsibleIds(t).includes(currentUserId))
        }

        const departmentId = input.departmentId
        if (departmentId != null) {
            merged = merged.filter((t) => t.departmentId === departmentId)
        }

        const q = (input.q ?? '').trim().toLowerCase()
        if (q) {
            merged = merged.filter((t) => t.name.toLowerCase().includes(q))
        }

        if (input.sort === 'deadline_asc' || input.sort === 'deadline_desc') {
            const dir = input.sort === 'deadline_asc' ? 1 : -1
            merged.sort((a, b) => {
                const ta = a.deadLine?.getTime() ?? a.startDate?.getTime() ?? 0
                const tb = b.deadLine?.getTime() ?? b.startDate?.getTime() ?? 0
                if (ta !== tb) return (ta - tb) * dir
                return a.id - b.id
            })
        }

        return merged
    }

    async getMyTasksByOrganization(
        organizationId: number,
        currentUserId: number,
        options?: { scope: 'mine' | 'org' },
    ) {
        const scope = options?.scope === 'org' ? 'org' : 'mine'

        const departments = await this.departmentService.getDepartmentsByOrganizationId(organizationId, currentUserId);
        if (!departments.length) return this.emptyResponse();
    
        const deptPermissions = await Promise.all(
            departments.map(async d => ({
                id: d.id,
                canSeeAll: await this.canSeeAllTasksInDepartment(d.id, currentUserId)
            }))
        );
    
        const tasksByDept = await Promise.all(
            deptPermissions.map(p => this.taskRepo.getAllTasksByDepartmentId(p.id, currentUserId, p.canSeeAll))
        );
        let allTasks: MyTasksOrgListItem[] = tasksByDept.flatMap((tasks, i) => {
            const d = departments[i]!
            return tasks.map(
                (t) =>
                    ({
                        ...t,
                        departmentId: d.id,
                        departmentName: d.name,
                    }) as MyTasksOrgListItem,
            )
        })

        if (scope === 'mine') {
            allTasks = allTasks.filter((t) => this.isTaskRelatedToUser(t, currentUserId))
        }

        const columnLists = await Promise.all(
            departments.map((d) => this.columnRepo.getColumnsByDepartmentId(d.id)),
        );

        const lastPosByPipeline: Record<number, number> = {};
        for (const columns of columnLists) {
            for (const c of columns) {
                if (c.pipelineId == null) continue;
                const pipelineId = c.pipelineId;
                const prev = lastPosByPipeline[pipelineId];
                lastPosByPipeline[pipelineId] = prev == null ? c.position : Math.max(prev, c.position);
            }
        }

        const pipelineLists = await Promise.all(
            departments.map((d) => this.pipelinesRepo.getPipelinesByDepartmentId(d.id)),
        );
        const mainPipelineIds = new Set<number>();
        for (const list of pipelineLists) {
            for (const p of list) {
                if (p.isMainTemplate) mainPipelineIds.add(p.id);
            }
        }

        const reviewColPositionByPipeline: Record<number, number> = {};
        for (const columns of columnLists) {
            for (const c of columns) {
                if (c.pipelineId != null && mainPipelineIds.has(c.pipelineId) && c.position === TasksService.MAIN_REVIEW_COLUMN_POSITION) {
                    reviewColPositionByPipeline[c.pipelineId] = c.position;
                }
            }
        }
    
        const todayMidnight = new Date().setHours(0, 0, 0, 0);
        const canMonitorAsOrg =
            scope === 'org' && (await this.orgAccessService.canManageOrganization(organizationId, currentUserId))

        const classification = canMonitorAsOrg
            ? this.classifyMyTasksByOrganizationForOrgManager(
                  allTasks,
                  currentUserId,
                  lastPosByPipeline,
                  mainPipelineIds,
                  reviewColPositionByPipeline,
                  todayMidnight,
              )
            : this.classifyMyTasksByOrganizationPersonal(
                  allTasks,
                  currentUserId,
                  lastPosByPipeline,
                  mainPipelineIds,
                  reviewColPositionByPipeline,
                  todayMidnight,
              );

        const inAnyBucket = (id: number) =>
            classification.outgoing.has(id) ||
            classification.incoming.has(id) ||
            classification.completed.has(id) ||
            classification.overdue.has(id) ||
            classification.review.has(id);

        const organization = new Set<number>();
        for (const t of allTasks) {
            if (!inAnyBucket(t.id)) {
                organization.add(t.id);
            }
        }

        const tasksForResponse = allTasks.map((t) => {
            const pipelineId = t.column?.pipelineId
            const position = t.column?.position
            const lastPos = pipelineId != null ? lastPosByPipeline[pipelineId] : undefined
            const inPipelineTerminalColumn =
                pipelineId != null &&
                position != null &&
                lastPos != null &&
                position === lastPos
            return { ...t, inPipelineTerminalColumn }
        })

        return { tasks: tasksForResponse, classification: { ...classification, organization } };
    }

    private static readonly GLOBAL_BUCKET_PRIORITY: GlobalTaskBucket[] = [
        "overdue",
        "incoming",
        "review",
        "outgoing",
        "completed",
        "organization",
    ]

    private collectTaskBucketsForGlobal(
        taskId: number,
        classification: {
            outgoing: Set<number>
            incoming: Set<number>
            review: Set<number>
            completed: Set<number>
            overdue: Set<number>
            organization: Set<number>
        },
    ): GlobalTaskBucket[] {
        const b: GlobalTaskBucket[] = []
        if (classification.outgoing.has(taskId)) b.push("outgoing")
        if (classification.incoming.has(taskId)) b.push("incoming")
        if (classification.review.has(taskId)) b.push("review")
        if (classification.completed.has(taskId)) b.push("completed")
        if (classification.overdue.has(taskId)) b.push("overdue")
        if (classification.organization.has(taskId)) b.push("organization")
        return b.sort(
            (a, c) =>
                TasksService.GLOBAL_BUCKET_PRIORITY.indexOf(a) - TasksService.GLOBAL_BUCKET_PRIORITY.indexOf(c),
        )
    }

    private mergeGlobalResultsFromOrgs(
        orgs: Organization[],
        outcomes: PromiseSettledResult<Awaited<ReturnType<TasksService["getMyTasksByOrganization"]>>>[],
        failedOrganizationIds: number[],
    ): GlobalMyTaskPageRow[] {
        const map = new Map<number, GlobalMyTaskPageRow>()
        for (let i = 0; i < outcomes.length; i++) {
            const org = orgs[i]!
            const r = outcomes[i]!
            if (r.status === "rejected") {
                failedOrganizationIds.push(org.id)
                continue
            }
            const payload = r.value
            for (const task of payload.tasks) {
                const buckets = this.collectTaskBucketsForGlobal(task.id, payload.classification)
                if (buckets.length === 0) continue
                if (!map.has(task.id)) {
                    map.set(task.id, {
                        task,
                        buckets: [...buckets],
                        organizationName: org.name,
                    })
                }
            }
        }
        return Array.from(map.values())
    }

    private orderGlobalMyTaskRows(rows: GlobalMyTaskPageRow[], mode: GlobalMyTasksListSort): GlobalMyTaskPageRow[] {
        if (mode === "bucket") return this.sortGlobalMyTaskRows(rows)
        const dir = mode === "deadline_asc" ? "asc" : "desc"
        const deadlineMs = (t: MyTasksOrgListItem): number | null => {
            const d = t.deadLine
            if (d == null) return null
            const ms = d instanceof Date ? d.getTime() : new Date(d as unknown as string).getTime()
            return Number.isFinite(ms) ? ms : null
        }
        return [...rows].sort((a, b) => {
            const da = deadlineMs(a.task)
            const db = deadlineMs(b.task)
            const aNull = da == null
            const bNull = db == null
            if (aNull && bNull) return b.task.id - a.task.id
            if (aNull) return 1
            if (bNull) return -1
            if (da !== db) return dir === "asc" ? da - db : db - da
            return b.task.id - a.task.id
        })
    }

    private sortGlobalMyTaskRows(rows: GlobalMyTaskPageRow[]): GlobalMyTaskPageRow[] {
        const pr = (b: GlobalTaskBucket[]) => {
            for (const x of TasksService.GLOBAL_BUCKET_PRIORITY) {
                if (b.includes(x)) return x
            }
            return b[0] ?? "incoming"
        }
        return [...rows].sort((a, b) => {
            const pa = pr(a.buckets)
            const pb = pr(b.buckets)
            const ia = TasksService.GLOBAL_BUCKET_PRIORITY.indexOf(pa)
            const ib = TasksService.GLOBAL_BUCKET_PRIORITY.indexOf(pb)
            if (ia !== ib) return ia - ib
            const da = a.task.deadLine ? a.task.deadLine.getTime() : Number.POSITIVE_INFINITY
            const db = b.task.deadLine ? b.task.deadLine.getTime() : Number.POSITIVE_INFINITY
            if (da !== db) return da - db
            return b.task.id - a.task.id
        })
    }

    /**
     * Сводка «Все задачи» с пагинацией и фильтрами; scope=org по выбранным/всем пространствам.
     */
    async getGlobalMyTasksPage(
        currentUserId: number,
        input: {
            page: number
            pageSize: number
            organizationId?: number
            departmentId?: number
            bucket?: "all" | GlobalTaskBucket
            involvement?: GlobalMyTasksInvolvement
            q?: string
            sort?: GlobalMyTasksListSort
        },
    ): Promise<{
        rows: GlobalMyTaskPageRow[]
        total: number
        page: number
        pageSize: number
        hasOrgScopeTask: boolean
        failedOrganizationIds: number[]
    }> {
        const pageSize = Math.min(100, Math.max(1, input.pageSize || 12))
        let page = Math.max(1, input.page || 1)

        const orgs = await this.organizationService.getUserOrganizations(currentUserId)
        const targetOrgs =
            input.organizationId != null
                ? orgs.filter((o) => o.id === input.organizationId)
                : orgs
        if (targetOrgs.length === 0) {
            return {
                rows: [],
                total: 0,
                page: 1,
                pageSize,
                hasOrgScopeTask: false,
                failedOrganizationIds: [],
            }
        }

        const outcomes = await Promise.allSettled(
            targetOrgs.map((org) => this.getMyTasksByOrganization(org.id, currentUserId, { scope: "org" })),
        )
        const failedOrganizationIds: number[] = []
        const merged = this.mergeGlobalResultsFromOrgs(targetOrgs, outcomes, failedOrganizationIds)
        const sortMode: GlobalMyTasksListSort =
            input.sort === "deadline_asc" || input.sort === "deadline_desc" ? input.sort : "bucket"
        const sorted = this.orderGlobalMyTaskRows(merged, sortMode)

        const hasOrgScopeTask = sorted.some((r) => r.buckets.includes("organization"))

        const q = (input.q ?? "").trim().toLowerCase()
        const bucket = input.bucket ?? "all"
        const involvement = input.involvement ?? "all"
        const departmentId = input.departmentId

        const filtered = sorted.filter((row) => {
            if (bucket !== "all" && !row.buckets.includes(bucket as GlobalTaskBucket)) return false
            if (q && !row.task.name.toLowerCase().includes(q)) return false
            if (departmentId != null && row.task.departmentId !== departmentId) return false
            if (involvement === "created" && row.task.creatorId !== currentUserId) return false
            if (involvement === "assigned") {
                const responsibleIds = this.getResponsibleIds(row.task)
                if (!responsibleIds.includes(currentUserId)) return false
            }
            return true
        })

        const total = filtered.length
        const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1)
        if (page > maxPage) page = maxPage
        const start = (page - 1) * pageSize
        const pageRows = filtered.slice(start, start + pageSize)

        return {
            rows: pageRows,
            total,
            page,
            pageSize,
            hasOrgScopeTask,
            failedOrganizationIds,
        }
    }

    /**
     * Постраничные «Мои задачи» одной организации: только связанные с пользователем
     * (он автор или один из исполнителей). Применяется scope=mine — независимо
     * от роли пользователя в организации, чужие задачи не попадают.
     */
    async getMyTasksByOrganizationPaginated(
        organizationId: number,
        currentUserId: number,
        input: {
            page: number
            pageSize: number
            bucket?: 'all' | Exclude<GlobalTaskBucket, 'organization'>
            q?: string
            sort?: GlobalMyTasksListSort
        },
    ): Promise<{
        rows: GlobalMyTaskPageRow[]
        total: number
        page: number
        pageSize: number
    }> {
        const pageSize = Math.min(100, Math.max(1, input.pageSize || 12))
        let page = Math.max(1, input.page || 1)

        const org = await this.organizationRepo.getOrganizationById(organizationId)
        const organizationName = org?.name ?? ''

        const payload = await this.getMyTasksByOrganization(organizationId, currentUserId, {
            scope: 'mine',
        })

        const rowsAll: GlobalMyTaskPageRow[] = []
        for (const task of payload.tasks) {
            const buckets = this.collectTaskBucketsForGlobal(task.id, payload.classification)
                .filter((b): b is Exclude<GlobalTaskBucket, 'organization'> => b !== 'organization')
            if (buckets.length === 0) continue
            rowsAll.push({ task, buckets, organizationName })
        }

        const sortMode: GlobalMyTasksListSort =
            input.sort === "deadline_asc" || input.sort === "deadline_desc" ? input.sort : "bucket"
        const sorted = this.orderGlobalMyTaskRows(rowsAll, sortMode)

        const q = (input.q ?? '').trim().toLowerCase()
        const bucket = input.bucket ?? 'all'

        const filtered = sorted.filter((row) => {
            if (bucket !== 'all' && !row.buckets.includes(bucket as GlobalTaskBucket)) return false
            if (q && !row.task.name.toLowerCase().includes(q)) return false
            return true
        })

        const total = filtered.length
        const maxPage = Math.max(1, Math.ceil(total / pageSize) || 1)
        if (page > maxPage) page = maxPage
        const start = (page - 1) * pageSize
        const pageRows = filtered.slice(start, start + pageSize)

        return {
            rows: pageRows,
            total,
            page,
            pageSize,
        }
    }

    private getResponsibleIds(t: { responsibleIds?: number[]; responsibleId?: number | null }): number[] {
        if (Array.isArray(t.responsibleIds) && t.responsibleIds.length) return t.responsibleIds
        return t.responsibleId != null ? [t.responsibleId] : []
    }

    /** «Мои задачи» / scope=mine: только автор или исполнитель/соисполнитель. */
    private isTaskRelatedToUser(
        t: {
            creatorId?: number | null
            responsibleIds?: number[]
            responsibleId?: number | null
        },
        userId: number,
    ): boolean {
        if (t.creatorId === userId) return true
        return this.getResponsibleIds(t).includes(userId)
    }

    /** Личные корзины: входящие/исходящие/просроченные — относительно текущего пользователя. */
    private classifyMyTasksByOrganizationPersonal(
        allTasks: MyTasksOrgListItem[],
        currentUserId: number,
        lastPosByPipeline: Record<number, number>,
        mainPipelineIds: Set<number>,
        reviewColPositionByPipeline: Record<number, number>,
        todayMidnight: number,
    ): {
        outgoing: Set<number>
        incoming: Set<number>
        completed: Set<number>
        overdue: Set<number>
        review: Set<number>
    } {
        const classification = {
            outgoing: new Set<number>(),
            incoming: new Set<number>(),
            completed: new Set<number>(),
            overdue: new Set<number>(),
            review: new Set<number>(),
        }

        for (const t of allTasks) {
            const responsibleIds = this.getResponsibleIds(t)
            const isIncoming = responsibleIds.includes(currentUserId)
            const isOutgoing = t.creatorId === currentUserId

            const pipelineId = t.column?.pipelineId
            const position = t.column?.position
            const lastPos = pipelineId != null ? lastPosByPipeline[pipelineId] : undefined
            const isCompleted = position != null && lastPos != null && position === lastPos
            const isOverdue = t.deadLine != null && isTaskDeadlineOverdue(t.deadLine, new Date())

            const isOnReview =
                isOutgoing &&
                pipelineId != null &&
                mainPipelineIds.has(pipelineId) &&
                position != null &&
                reviewColPositionByPipeline[pipelineId] === position

            if (isOnReview) {
                classification.review.add(t.id)
                continue
            }

            if (isIncoming) {
                if (isCompleted) classification.completed.add(t.id)
                else if (isOverdue) classification.overdue.add(t.id)
                else classification.incoming.add(t.id)
            }

            if (isOutgoing) {
                if (!isIncoming) {
                    if (isCompleted) classification.completed.add(t.id)
                    else if (isOverdue) classification.overdue.add(t.id)
                    else classification.outgoing.add(t.id)
                } else if (!isCompleted && !isOverdue) {
                    classification.outgoing.add(t.id)
                }
            }
        }

        return classification
    }

    /**
     * Владелец / админ организации / root:
     * — «Проверка», «Завершённые», «Просроченные» — по всем видимым задачам;
     * — «Входящие» и «Исходящие» — только относительно текущего пользователя (как в личных корзинах).
     */
    private classifyMyTasksByOrganizationForOrgManager(
        allTasks: MyTasksOrgListItem[],
        currentUserId: number,
        lastPosByPipeline: Record<number, number>,
        mainPipelineIds: Set<number>,
        reviewColPositionByPipeline: Record<number, number>,
        todayMidnight: number,
    ): {
        outgoing: Set<number>
        incoming: Set<number>
        completed: Set<number>
        overdue: Set<number>
        review: Set<number>
    } {
        const classification = {
            outgoing: new Set<number>(),
            incoming: new Set<number>(),
            completed: new Set<number>(),
            overdue: new Set<number>(),
            review: new Set<number>(),
        }

        for (const t of allTasks) {
            const responsibleIds = this.getResponsibleIds(t)
            const pipelineId = t.column?.pipelineId
            const position = t.column?.position
            const lastPos = pipelineId != null ? lastPosByPipeline[pipelineId] : undefined
            const isCompleted = position != null && lastPos != null && position === lastPos
            const isOverdue = t.deadLine != null && isTaskDeadlineOverdue(t.deadLine, new Date())

            const isOnReview =
                pipelineId != null &&
                mainPipelineIds.has(pipelineId) &&
                position != null &&
                reviewColPositionByPipeline[pipelineId] === position

            if (isOnReview) {
                classification.review.add(t.id)
                continue
            }
            if (isCompleted) {
                classification.completed.add(t.id)
                continue
            }
            if (isOverdue) {
                classification.overdue.add(t.id)
                continue
            }

            const isIncoming = responsibleIds.includes(currentUserId)
            const isOutgoing = t.creatorId === currentUserId

            if (isIncoming) {
                if (isCompleted) classification.completed.add(t.id)
                else if (isOverdue) classification.overdue.add(t.id)
                else classification.incoming.add(t.id)
            }

            if (isOutgoing) {
                if (!isIncoming) {
                    if (isCompleted) classification.completed.add(t.id)
                    else if (isOverdue) classification.overdue.add(t.id)
                    else classification.outgoing.add(t.id)
                } else if (!isCompleted && !isOverdue) {
                    classification.outgoing.add(t.id)
                }
            }
        }

        return classification
    }

    private emptyResponse() {
        return {
            tasks: [] as MyTasksOrgListItem[],
            classification: {
                outgoing: new Set<number>(),
                incoming: new Set<number>(),
                completed: new Set<number>(),
                overdue: new Set<number>(),
                review: new Set<number>(),
                organization: new Set<number>(),
            },
        };
    }

    private sameIds(a: number[], b: number[]): boolean {
        if (a.length !== b.length) return false
        const sa = [...a].sort((x, y) => x - y)
        const sb = [...b].sort((x, y) => x - y)
        return sa.every((v, i) => v === sb[i])
    }

    private descriptionPreview(html: string | null | undefined): string {
        if (!html?.trim()) return ''
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (text.length <= 160) return text
        return `${text.slice(0, 160)}…`
    }

    private async resolveUserRefs(ids: number[]): Promise<{ id: number; firstname: string; lastname: string }[]> {
        const out: { id: number; firstname: string; lastname: string }[] = []
        for (const id of ids) {
            const u = await this.authRepo.getUserById(id)
            if (u) out.push({ id: u.id, firstname: u.firstname, lastname: u.lastname })
        }
        return out
    }

    private async resolveColumnPlace(
        columnId: number | null | undefined,
        currentUserId: number,
    ): Promise<{
        columnId: number | null
        columnName: string | null
        pipelineId: number | null
        pipelineName: string | null
        departmentId: number | null
        departmentName: string | null
    } | null> {
        if (columnId == null) return null
        const col = await this.columnRepo.getColumnById(columnId)
        if (!col) {
            return {
                columnId,
                columnName: null,
                pipelineId: null,
                pipelineName: null,
                departmentId: null,
                departmentName: null,
            }
        }
        const dept = await this.departmentService.getDepartmentById(col.departmentId, currentUserId)
        let pipelineName: string | null = null
        if (col.pipelineId != null) {
            const p = await this.pipelinesRepo.getPipelineById(col.pipelineId)
            pipelineName = p?.name ?? null
        }
        return {
            columnId: col.id,
            columnName: col.name,
            pipelineId: col.pipelineId ?? null,
            pipelineName,
            departmentId: dept.id,
            departmentName: dept.name,
        }
    }

    private async recordTaskCreated(
        task: Task & { departmentId: number; tags: Tag[]; responsibleIds?: number[] },
        currentUserId: number,
    ): Promise<void> {
        const place = task.columnId != null ? await this.resolveColumnPlace(task.columnId, currentUserId) : null
        const ids = task.responsibleIds ?? (task.responsibleId != null ? [task.responsibleId] : [])
        const assignees = await this.resolveUserRefs(ids)
        const tags = (task.tags ?? []).map((t) => ({ id: t.id, name: t.name }))
        await this.taskActivity.append(task.id, currentUserId, 'created', {
            snapshot: {
                name: task.name,
                column: place,
                assignees,
                tags,
                startDate: formatTaskDateTimeForApi(task.startDate),
                deadLine: formatTaskDateTimeForApi(task.deadLine),
                descriptionPreview: this.descriptionPreview(task.description) || null,
            },
        })
    }

    private async recordTaskUpdateActivity(
        beforeTask: Task & { departmentId?: number; tags?: Tag[]; responsibleIds?: number[] },
        afterTask: Task & { departmentId?: number; tags?: Tag[]; responsibleIds?: number[] },
        currentUserId: number,
    ): Promise<void> {
        const taskId = afterTask.id
        const beforeCol = beforeTask.columnId
        const afterCol = afterTask.columnId
        if (
            beforeCol != null &&
            afterCol != null &&
            beforeCol !== afterCol
        ) {
            const from = await this.resolveColumnPlace(beforeCol, currentUserId)
            const to = await this.resolveColumnPlace(afterCol, currentUserId)
            await this.taskActivity.append(taskId, currentUserId, 'moved', { from, to })
        }

        const br = beforeTask.responsibleIds ?? (beforeTask.responsibleId != null ? [beforeTask.responsibleId] : [])
        const ar = afterTask.responsibleIds ?? (afterTask.responsibleId != null ? [afterTask.responsibleId] : [])
        if (!this.sameIds(br, ar)) {
            await this.taskActivity.append(taskId, currentUserId, 'assignees', {
                before: await this.resolveUserRefs(br),
                after: await this.resolveUserRefs(ar),
            })
        }

        const changes: { field: string; label: string; from: string | null; to: string | null }[] = []
        if (beforeTask.name !== afterTask.name) {
            changes.push({ field: 'name', label: 'Название', from: beforeTask.name, to: afterTask.name })
        }
        const bd = beforeTask.description ?? null
        const ad = afterTask.description ?? null
        if (bd !== ad) {
            changes.push({
                field: 'description',
                label: 'Описание',
                from: null,
                to: null,
            })
        }
        const bs = formatTaskDateTimeForApi(beforeTask.startDate)
        const as = formatTaskDateTimeForApi(afterTask.startDate)
        if (bs !== as) {
            changes.push({ field: 'startDate', label: 'Дата начала', from: bs, to: as })
        }
        const bdl = formatTaskDateTimeForApi(beforeTask.deadLine)
        const adl = formatTaskDateTimeForApi(afterTask.deadLine)
        if (bdl !== adl) {
            changes.push({ field: 'deadLine', label: 'Срок', from: bdl, to: adl })
        }
        const bca = beforeTask.completedAt ? beforeTask.completedAt.toISOString() : null
        const aca = afterTask.completedAt ? afterTask.completedAt.toISOString() : null
        if (bca !== aca) {
            changes.push({ field: 'completedAt', label: 'Завершено', from: bca, to: aca })
        }
        if (beforeTask.organizationId !== afterTask.organizationId) {
            changes.push({
                field: 'organizationId',
                label: 'Организация',
                from: String(beforeTask.organizationId),
                to: String(afterTask.organizationId),
            })
        }
        if (beforeCol === afterCol && beforeTask.position !== afterTask.position) {
            changes.push({
                field: 'position',
                label: 'Порядок в колонке',
                from: String(beforeTask.position),
                to: String(afterTask.position),
            })
        }

        if (changes.length) {
            await this.taskActivity.append(taskId, currentUserId, 'updated', { changes })
        }
    }

    async createTask(dto: Omit<CreateTaskDTO, 'organizationId' | 'creatorId'>, currentUserId: number) {
        validateNonEmptyString(dto.name, 'Название задачи');

        const { column, department } = await this.ensureAccessToColumn(dto.columnId, currentUserId);
        if (!(await this.canCreateTasksInDepartment(department.id, currentUserId, column.pipelineId))) {
            throw new ForbiddenError('Создавать задачи в этом разделе запрещено настройками раздела')
        }
        if (await this.isCompletedColumn(dto.columnId)) {
            throw new BadRequestError('Нельзя создавать задачу в завершающей колонке воронки')
        }
        const org = await this.organizationRepo.getOrganizationById(department.organizationId);

        const normalizedIds = this.normalizeResponsibleIds(dto.responsibleIds ?? null, dto.responsibleId ?? null)
        const effectiveIds = org?.isPersonal ? [currentUserId] : normalizedIds
        const primary = effectiveIds.length ? effectiveIds[0] : null

        if (!(await this.policyResolver.canBypassTaskRules(currentUserId, department.organizationId))) {
            const deptPolicies = await this.policyResolver.getDepartmentPolicies(department.id)
            this.policyResolver.validateTaskRulesForCreateOrUpdate(
                deptPolicies,
                effectiveIds,
                dto.deadLine,
            )
        }

        const safeDto: CreateTaskDTO = {
            ...dto,
            responsibleId: primary,
            responsibleIds: undefined,
            organizationId: department.organizationId,
            creatorId: currentUserId,
        };
        const created = await this.taskRepo.createTask(safeDto);
        if (effectiveIds.length > 1) {
            await this.taskRepo.setResponsibles(created.id, effectiveIds)
        }
        const full = await this.taskRepo.getTaskById(created.id)
        await this.recordTaskCreated(full, currentUserId).catch(() => undefined)
        const pushRef = await this.taskPushRefFromColumn(full, currentUserId)
        this.webPush.notifyTaskCreated(pushRef, currentUserId)
        const assignToNotify = effectiveIds.filter((id) => id !== currentUserId)
        if (assignToNotify.length > 0) {
            this.webPush.notifyTaskAssigned(pushRef, assignToNotify, currentUserId)
        }
        return { ...created, responsibleIds: effectiveIds };
    }

    async createBroadcastTasks(
        dto: Omit<CreateBroadcastTaskDTO, 'organizationId' | 'creatorId'>,
        currentUserId: number,
    ): Promise<Task & { responsibleIds: number[]; broadcastProgress: BroadcastProgress }> {
        validateNonEmptyString(dto.name, 'Название задачи')

        const { column, department } = await this.ensureAccessToColumn(dto.columnId, currentUserId)
        if (!(await this.canCreateTasksInDepartment(department.id, currentUserId, column.pipelineId))) {
            throw new ForbiddenError('Создавать задачи в этом разделе запрещено настройками раздела')
        }
        if (await this.isCompletedColumn(dto.columnId)) {
            throw new BadRequestError('Нельзя создавать задачу в завершающей колонке воронки')
        }
        if (!Array.isArray(dto.memberIds) || dto.memberIds.length === 0) {
            throw new BadRequestError('Укажите хотя бы одного участника для рассылки')
        }

        const canManage =
            (await this.orgAccessService.canManageOrganization(department.organizationId, currentUserId)) ||
            (await this.departmentAccessService.canManageDepartment(department.id, currentUserId))
        if (!canManage) throw new ForbiddenError('Рассылку задач могут создавать только администраторы раздела или организации')

        const org = await this.organizationRepo.getOrganizationById(department.organizationId)
        const baseDto: CreateTaskDTO = {
            name: dto.name,
            columnId: dto.columnId,
            position: dto.position,
            organizationId: department.organizationId,
            description: dto.description ?? null,
            responsibleId: null,
            startDate: dto.startDate ?? null,
            deadLine: dto.deadLine ?? null,
            creatorId: currentUserId,
        }

        const parent = await this.taskRepo.createTask(baseDto)

        const uniqueIds = Array.from(new Set(dto.memberIds.filter((id) => Number.isInteger(id))))
        for (const memberId of uniqueIds) {
            const childDto: CreateTaskDTO = {
                ...baseDto,
                responsibleId: memberId,
                position: dto.position,
                broadcastParentId: parent.id,
            }
            const child = await this.taskRepo.createTask(childDto)
            if (Array.isArray(dto.tagIds) && dto.tagIds.length > 0) {
                await this.tagsRepo.setTagsForTask(child.id, dto.tagIds).catch(() => undefined)
            }
        }

        if (Array.isArray(dto.tagIds) && dto.tagIds.length > 0) {
            await this.tagsRepo.setTagsForTask(parent.id, dto.tagIds).catch(() => undefined)
        }

        const fullParent = await this.taskRepo.getTaskById(parent.id)
        await this.recordTaskCreated(fullParent, currentUserId).catch(() => undefined)
        this.webPush
            .notifyTaskAssigned(
                await this.taskPushRefFromColumn(fullParent, currentUserId),
                uniqueIds.filter((id) => id !== currentUserId),
                currentUserId,
            )

        const broadcastProgress = await this.taskRepo.getBroadcastProgress(parent.id)
        return { ...parent, responsibleIds: [], broadcastProgress }
    }

    /**
     * Приводим несколько источников исполнителей (старый `responsibleId`, новый массив)
     * к одному нормализованному списку без дубликатов. Первый id трактуется как ведущий.
     */
    private normalizeResponsibleIds(
        responsibleIds: number[] | null | undefined,
        fallbackResponsibleId: number | null | undefined,
    ): number[] {
        if (Array.isArray(responsibleIds)) {
            return Array.from(new Set(responsibleIds.filter((id) => Number.isInteger(id))))
        }
        if (fallbackResponsibleId != null && Number.isInteger(fallbackResponsibleId)) {
            return [fallbackResponsibleId]
        }
        return []
    }


    async assertCanEditTaskContent(taskId: number, currentUserId: number): Promise<Task> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        if (!canManage && task.creatorId !== currentUserId) {
            throw new ForbiddenError('Редактировать содержимое может только автор задачи')
        }
        return task
    }

    async updateTask(dto: UpdateTaskDTO, taskId: number, currentUserId: number) {
        const beforeTask = await this.ensureTaskExist(taskId)
        const beforeResponsibleIds = (beforeTask as typeof beforeTask & { responsibleIds?: number[] }).responsibleIds
            ?? (beforeTask.responsibleId != null ? [beforeTask.responsibleId] : [])
        const task = beforeTask
        const targetColumnId = dto.columnId ?? task.columnId
        await this.ensureAccessToColumn(targetColumnId!, currentUserId)

        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const sourceDeptId = sourceCol.departmentId

        const canManageSource = await this.canSeeAllTasksInDepartment(sourceDeptId, currentUserId)
        let canManageTarget = canManageSource
        if (dto.columnId !== undefined && dto.columnId !== task.columnId && dto.columnId != null) {
            const tc = await this.columnRepo.getColumnById(dto.columnId)
            if (tc) {
                canManageTarget = await this.canSeeAllTasksInDepartment(tc.departmentId, currentUserId)
            }
        }

        const isCreator = task.creatorId === currentUserId
        const taskResponsibleIds: number[] = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
            ?? (task.responsibleId != null ? [task.responsibleId] : [])
        const isResponsible = taskResponsibleIds.includes(currentUserId)

        const hasContentChange =
            dto.name !== undefined ||
            dto.description !== undefined ||
            dto.responsibleId !== undefined ||
            dto.responsibleIds !== undefined ||
            dto.startDate !== undefined ||
            dto.deadLine !== undefined ||
            dto.organizationId !== undefined

        const hasMoveChange =
            dto.columnId !== undefined || dto.position !== undefined

        if (hasContentChange && !canManageSource && !isCreator) {
            throw new ForbiddenError('Редактировать содержимое может только автор задачи')
        }

        if (hasMoveChange && !canManageSource && !canManageTarget && !isCreator && !isResponsible) {
            throw new ForbiddenError('Перемещать по колонкам может автор или исполнитель')
        }

        if (
            dto.columnId !== undefined &&
            dto.columnId !== task.columnId &&
            dto.columnId != null &&
            task.columnId != null
        ) {
            const toLast = await this.isCompletedColumn(dto.columnId)
            if (toLast) {
                const targetCol = await this.columnRepo.getColumnById(dto.columnId)
                if (targetCol?.pipelineId != null) {
                    const pipeline = await this.pipelinesRepo.getPipelineById(targetCol.pipelineId)
                    if (pipeline?.isMainTemplate) {
                        const samePerson =
                            task.creatorId != null && taskResponsibleIds.includes(task.creatorId)
                        if (!samePerson && !canManageTarget) {
                            if (
                                isResponsible &&
                                currentUserId !== task.creatorId
                            ) {
                                throw new ForbiddenError(
                                    'Исполнитель не может перевести задачу в «Завершенные»; завершить может автор задачи',
                                )
                            }
                        }
                    }
                }
            }
        }

        const org = await this.organizationRepo.getOrganizationById(task.organizationId)

        let normalizedIds: number[] | null = null
        if (dto.responsibleIds !== undefined || (org?.isPersonal && dto.responsibleId !== undefined)) {
            const raw = this.normalizeResponsibleIds(dto.responsibleIds, dto.responsibleId)
            normalizedIds = org?.isPersonal ? [currentUserId] : raw
        }

        const afterRespIds =
            normalizedIds ??
            ((task as typeof task & { responsibleIds?: number[] }).responsibleIds
                ?? (task.responsibleId != null ? [task.responsibleId] : []))
        const afterDeadLine = dto.deadLine !== undefined ? dto.deadLine : task.deadLine
        if (!(await this.policyResolver.canBypassTaskRules(currentUserId, task.organizationId))) {
            const deptPolicies = await this.policyResolver.getDepartmentPolicies(sourceDeptId)
            this.policyResolver.validateTaskRulesForCreateOrUpdate(
                deptPolicies,
                afterRespIds,
                afterDeadLine,
            )
            if (
                dto.columnId !== undefined &&
                dto.columnId !== task.columnId &&
                dto.columnId != null
            ) {
                const colPolicies = await this.policyResolver.getColumnPolicies(dto.columnId)
                this.policyResolver.validateColumnEnterRules(colPolicies, afterRespIds, afterDeadLine)
            }
        }

        const finalDto: UpdateTaskDTO = { ...dto }
        if (normalizedIds != null) {
            finalDto.responsibleId = normalizedIds[0] ?? null
        } else if (org?.isPersonal && dto.responsibleId !== undefined) {
            finalDto.responsibleId = currentUserId
        }
        delete finalDto.responsibleIds

        let completedAtPatch: Date | null | undefined = undefined
        if (
            dto.columnId !== undefined &&
            dto.columnId !== task.columnId &&
            task.columnId != null &&
            dto.columnId != null
        ) {
            const fromLast = await this.isCompletedColumn(task.columnId)
            const toLast = await this.isCompletedColumn(dto.columnId)
            if (!fromLast && toLast) {
                completedAtPatch = new Date()
            } else if (fromLast && !toLast) {
                completedAtPatch = null
            }
        }

        const merged: UpdateTaskDTO = { ...finalDto }
        if (completedAtPatch !== undefined) {
            merged.completedAt = completedAtPatch
        }

        const updated = await this.taskRepo.updateTask(merged, taskId)
        if (normalizedIds != null) {
            await this.taskRepo.setResponsibles(taskId, normalizedIds)
        }
        const afterTask = await this.taskRepo.getTaskById(taskId)
        // Пропагация изменяемых полей на все дочерние задачи рассылки
        if (!task.broadcastParentId) {
            await this.maybePropagateToChildren(taskId, merged).catch(() => undefined)
        }
        await this.recordTaskUpdateActivity(beforeTask, afterTask, currentUserId).catch(() => undefined)
        const pushRef = await this.taskPushRefFromColumn(afterTask, currentUserId)
        if (!beforeTask.completedAt && afterTask.completedAt) {
            this.webPush.notifyTaskCompleted(pushRef, currentUserId)
        }
        if (normalizedIds != null) {
            const afterIds = afterTask.responsibleIds ?? (afterTask.responsibleId != null ? [afterTask.responsibleId] : [])
            const newAssigneeIds = afterIds.filter((id) => !beforeResponsibleIds.includes(id))
            if (newAssigneeIds.length > 0) {
                this.webPush.notifyTaskAssigned(pushRef, newAssigneeIds, currentUserId)
            }
        }
        if (normalizedIds != null) {
            return { ...updated, responsibleIds: normalizedIds }
        }
        return updated
    }

    async setTaskResponsibles(taskId: number, userIds: number[], currentUserId: number) {
        const task = await this.assertCanEditTaskContent(taskId, currentUserId)
        const org = await this.organizationRepo.getOrganizationById(task.organizationId)
        const normalized = this.normalizeResponsibleIds(userIds, null)
        const effective = org?.isPersonal ? [currentUserId] : normalized
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (sourceCol && !(await this.policyResolver.canBypassTaskRules(currentUserId, task.organizationId))) {
            const deptPolicies = await this.policyResolver.getDepartmentPolicies(sourceCol.departmentId)
            this.policyResolver.validateTaskRulesForCreateOrUpdate(
                deptPolicies,
                effective,
                task.deadLine,
            )
        }
        const beforeIds = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
            ?? (task.responsibleId != null ? [task.responsibleId] : [])
        const result = await this.taskRepo.setResponsibles(taskId, effective)
        const afterTask = await this.taskRepo.getTaskById(taskId)
        const afterIds = afterTask.responsibleIds ?? (afterTask.responsibleId != null ? [afterTask.responsibleId] : [])
        if (!this.sameIds(beforeIds, afterIds)) {
            await this.taskActivity.append(taskId, currentUserId, 'assignees', {
                before: await this.resolveUserRefs(beforeIds),
                after: await this.resolveUserRefs(afterIds),
            }).catch(() => undefined)
        }
        const newAssigneeIds = afterIds.filter((id) => !beforeIds.includes(id))
        if (newAssigneeIds.length > 0) {
            const pushRef = await this.taskPushRefFromColumn(afterTask, currentUserId)
            this.webPush.notifyTaskAssigned(pushRef, newAssigneeIds, currentUserId)
        }
        return result
    }

    async deleteTask(taskId: number, currentUserId: number) {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const canManage = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        if (!canManage && task.creatorId !== currentUserId) {
            throw new ForbiddenError('Удалить может только автор задачи')
        }
        await this.taskActivity.append(taskId, currentUserId, 'deleted', { name: task.name }).catch(() => undefined)
        return await this.taskRepo.softDeleteTask(taskId)
    }

    async reorderTasks(columnId: number, taskIds: number[], currentUserId: number): Promise<void> {
        const { department } = await this.ensureAccessToColumn(columnId, currentUserId)
        const canManage = await this.canSeeAllTasksInDepartment(department.id, currentUserId)
        if (canManage) {
            await this.taskRepo.reorderTask(columnId, taskIds)
            return
        }
        for (const id of taskIds) {
            const t = await this.ensureTaskExist(id)
            if (t.columnId !== columnId) {
                throw new BadRequestError('Порядок можно менять только для задач из этой колонки')
            }
            const respIds = (t as typeof t & { responsibleIds?: number[] }).responsibleIds
                ?? (t.responsibleId != null ? [t.responsibleId] : [])
            const isCreator = t.creatorId === currentUserId
            const isResponsible = respIds.includes(currentUserId)
            if (!isCreator && !isResponsible) {
                throw new ForbiddenError('Менять порядок могут автор или исполнитель по каждой задаче в списке')
            }
        }
        await this.taskRepo.reorderTask(columnId, taskIds)
    }

    /**
     * Проверка прав на перемещение конкретной задачи по доске.
     * Авторизация per-task (а не per-id из списка порядка) — перенумерация соседей внутри
     * placeTaskInColumn делается без дополнительных проверок.
     */
    private async assertCanMoveTask(
        taskId: number,
        sourceColumnId: number,
        targetColumnId: number,
        currentUserId: number,
    ): Promise<{ task: Task; sourceDeptId: number; targetDeptId: number }> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(sourceColumnId, currentUserId)
        if (sourceColumnId !== targetColumnId) {
            await this.ensureAccessToColumn(targetColumnId, currentUserId)
        }
        const sourceCol = await this.columnRepo.getColumnById(sourceColumnId)
        if (!sourceCol) throw new NotFoundError('Колонка-источник не найдена')
        const targetCol = await this.columnRepo.getColumnById(targetColumnId)
        if (!targetCol) throw new NotFoundError('Целевая колонка не найдена')

        const canManageSource = await this.canSeeAllTasksInDepartment(sourceCol.departmentId, currentUserId, sourceCol.pipelineId)
        const canManageTarget = sourceCol.departmentId === targetCol.departmentId
            ? canManageSource
            : await this.canSeeAllTasksInDepartment(targetCol.departmentId, currentUserId)

        const respIds = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
            ?? (task.responsibleId != null ? [task.responsibleId] : [])
        const isCreator = task.creatorId === currentUserId
        const isResponsible = respIds.includes(currentUserId)

        if (!canManageSource && !canManageTarget && !isCreator && !isResponsible) {
            throw new ForbiddenError('Перемещать задачи могут автор, исполнитель или менеджер отдела')
        }

        return { task, sourceDeptId: sourceCol.departmentId, targetDeptId: targetCol.departmentId }
    }

    async placeTaskInColumn(
        targetColumnId: number,
        taskId: number,
        insertAfterTaskId: number | null,
        currentUserId: number,
    ): Promise<{ id: number; columnId: number } | null> {
        const task = await this.ensureTaskExist(taskId)
        if (task.columnId == null) {
            throw new BadRequestError('У задачи нет колонки')
        }
        const sourceColumnId = task.columnId

        const targetCol = await this.columnRepo.getColumnById(targetColumnId)
        if (!targetCol) throw new NotFoundError('Такой колонки не существует')
        const sourceCol = await this.columnRepo.getColumnById(sourceColumnId)
        if (!sourceCol) throw new NotFoundError('Колонка-источник не найдена')

        if (sourceCol.departmentId !== targetCol.departmentId) {
            throw new BadRequestError('Перемещать можно только внутри отдела')
        }
        if (sourceCol.pipelineId !== targetCol.pipelineId) {
            throw new BadRequestError('Перемещать можно только внутри одной воронки')
        }

        await this.assertCanMoveTask(taskId, sourceColumnId, targetColumnId, currentUserId)

        if (insertAfterTaskId != null && insertAfterTaskId === taskId) {
            throw new BadRequestError('Некорректный якорь для вставки')
        }

        // Доп. ограничение «Завершённой» колонки из updateTask — воспроизводим для нет-манеджеров
        if (sourceColumnId !== targetColumnId) {
            const canManageTarget = await this.canSeeAllTasksInDepartment(targetCol.departmentId, currentUserId)
            const toLast = await this.isCompletedColumn(targetColumnId)
            if (toLast && !canManageTarget) {
                const pipeline = targetCol.pipelineId != null
                    ? await this.pipelinesRepo.getPipelineById(targetCol.pipelineId)
                    : null
                if (pipeline?.isMainTemplate) {
                    const respIds = (task as typeof task & { responsibleIds?: number[] }).responsibleIds
                        ?? (task.responsibleId != null ? [task.responsibleId] : [])
                    const samePerson = task.creatorId != null && respIds.includes(task.creatorId)
                    const isCreator = task.creatorId === currentUserId
                    const isResponsible = respIds.includes(currentUserId)
                    if (!samePerson && isResponsible && !isCreator) {
                        throw new ForbiddenError(
                            'Исполнитель не может перевести задачу в «Завершенные»; завершить может автор задачи',
                        )
                    }
                }
            }
        }

        const buildTargetList = (withoutMoved: number[], after: number | null): number[] => {
            if (after === null) return [taskId, ...withoutMoved]
            const p = withoutMoved.indexOf(after)
            if (p < 0) throw new BadRequestError('Некорректная вставка: нет подходящей соседней задачи')
            return [...withoutMoved.slice(0, p + 1), taskId, ...withoutMoved.slice(p + 1)]
        }

        if (sourceColumnId === targetColumnId) {
            const ordered = await this.taskRepo.getOrderedTaskIdsInColumn(targetColumnId)
            if (!ordered.includes(taskId)) {
                throw new NotFoundError('Задача не в запрошенной колонке')
            }
            const noMoved = ordered.filter((id) => id !== taskId)
            if (insertAfterTaskId != null && !noMoved.includes(insertAfterTaskId)) {
                throw new BadRequestError('Некорректный якорь вставки')
            }
            const finalOrder = buildTargetList(noMoved, insertAfterTaskId)
            await this.taskRepo.placeTaskAtomic({
                taskId,
                sourceColumnId,
                targetColumnId,
                completedAt: undefined,
                sourceOrderedIds: [],
                targetOrderedIds: finalOrder,
            })
            return null
        }

        const sourceOrdered = await this.taskRepo.getOrderedTaskIdsInColumn(sourceColumnId)
        if (!sourceOrdered.includes(taskId)) {
            throw new BadRequestError('Задача не в исходной колонке')
        }
        const sourceWithoutMoved = sourceOrdered.filter((id) => id !== taskId)

        const targetOrdered = await this.taskRepo.getOrderedTaskIdsInColumn(targetColumnId)
        if (targetOrdered.includes(taskId)) {
            throw new BadRequestError('Задача уже есть в целевой колонке (несогласованное состояние)')
        }
        if (insertAfterTaskId != null && !targetOrdered.includes(insertAfterTaskId)) {
            throw new BadRequestError('Некорректный якорь в целевой колонке')
        }
        const finalTarget = buildTargetList(targetOrdered, insertAfterTaskId)

        let completedAt: Date | null | undefined = undefined
        const fromLast = await this.isCompletedColumn(sourceColumnId)
        const toLast = await this.isCompletedColumn(targetColumnId)
        if (!fromLast && toLast) completedAt = new Date()
        else if (fromLast && !toLast) completedAt = null

        await this.taskRepo.placeTaskAtomic({
            taskId,
            sourceColumnId,
            targetColumnId,
            completedAt,
            sourceOrderedIds: sourceWithoutMoved,
            targetOrderedIds: finalTarget,
        })
        const from = await this.resolveColumnPlace(sourceColumnId, currentUserId)
        const to = await this.resolveColumnPlace(targetColumnId, currentUserId)
        await this.taskActivity.append(taskId, currentUserId, 'moved', { from, to }).catch(() => undefined)
        const t = await this.taskRepo.getTaskById(taskId)
        const pushRef = await this.taskPushRefFromColumn(t, currentUserId)
        let autoCompletedParent: { id: number; columnId: number } | null = null
        if (completedAt != null) {
            this.webPush.notifyTaskCompleted(pushRef, currentUserId)
            autoCompletedParent = await this.maybeAutoCompleteParent(t, currentUserId).catch(() => null)
        } else if (sourceColumnId !== targetColumnId) {
            this.webPush.notifyDepartmentAdminsTaskMoved(pushRef, currentUserId)
        }
        return autoCompletedParent
    }

    /**
     * Если все дочерние задачи рассылки завершены, автоматически переносит
     * родительскую задачу в последнюю колонку её воронки.
     */
    private async maybeAutoCompleteParent(
        child: Task & { departmentId: number; broadcastParentId?: number | null },
        currentUserId: number,
    ): Promise<{ id: number; columnId: number } | null> {
        if (!child.broadcastParentId) return null

        const progress = await this.taskRepo.getBroadcastProgress(child.broadcastParentId)
        if (progress.total === 0 || progress.completed < progress.total) return null

        const parent = await this.taskRepo.getTaskById(child.broadcastParentId)
        if (parent.completedAt != null) return null // уже завершена

        const parentCol = parent.columnId
            ? await this.columnRepo.getColumnById(parent.columnId)
            : null
        if (!parentCol?.pipelineId) return null

        const pipelineCols = (await this.columnRepo.getColumnsByDepartmentId(parentCol.departmentId))
            .filter((c) => c.pipelineId === parentCol.pipelineId)
        if (pipelineCols.length === 0) return null

        const lastPos = Math.max(...pipelineCols.map((c) => c.position))
        const lastCol = pipelineCols.find((c) => c.position === lastPos)
        if (!lastCol || lastCol.id === parent.columnId) return null

        const maxPos = await this.taskRepo.getMaxTaskPositionInColumn(lastCol.id)
        const position = (maxPos ?? -1) + 1

        await this.taskRepo.updateTask(
            { columnId: lastCol.id, completedAt: new Date(), position },
            parent.id,
        )
        await this.taskActivity
            .append(parent.id, currentUserId, 'moved', {
                from: await this.resolveColumnPlace(parent.columnId!, currentUserId),
                to: await this.resolveColumnPlace(lastCol.id, currentUserId),
                auto: true,
            })
            .catch(() => undefined)

        return { id: parent.id, columnId: lastCol.id }
    }

    /** Распространяет изменяемые поля на все дочерние задачи рассылки (если они есть). */
    private async maybePropagateToChildren(
        parentId: number,
        patch: UpdateTaskDTO,
    ): Promise<void> {
        const propagatable: Partial<Pick<Task, 'name' | 'description' | 'startDate' | 'deadLine'>> = {}
        if (patch.name !== undefined) propagatable.name = patch.name
        if ('description' in patch) propagatable.description = patch.description as string | null
        if ('startDate' in patch) propagatable.startDate = patch.startDate as Date | null
        if ('deadLine' in patch) propagatable.deadLine = patch.deadLine as Date | null
        if (Object.keys(propagatable).length === 0) return
        await this.taskRepo.updateBroadcastChildren(parentId, propagatable)
    }

    /** Добавляет нового участника рассылки: создаёт дочернюю задачу. */
    async addBroadcastMember(
        parentTaskId: number,
        userId: number,
        currentUserId: number,
    ): Promise<BroadcastProgress> {
        const parent = await this.ensureTaskExist(parentTaskId)
        await this.ensureAccessToColumn(parent.columnId!, currentUserId)

        const canManage =
            (await this.orgAccessService.canManageOrganization(parent.organizationId, currentUserId)) ||
            (await this.departmentAccessService.canManageDepartment(
                (await this.columnRepo.getColumnById(parent.columnId!))!.departmentId,
                currentUserId,
            ))
        if (!canManage) throw new ForbiddenError('Управлять участниками рассылки могут только администраторы')

        const existing = await this.taskRepo.getBroadcastProgress(parentTaskId)
        if (existing.children.some((c) => c.userId === userId)) {
            throw new ConflictError('Этот участник уже в рассылке')
        }

        await this.orgAccessService.ensureUserInOrganization(parent.organizationId, userId)

        const maxPos = await this.taskRepo.getMaxTaskPositionInColumn(parent.columnId!)
        const child = await this.taskRepo.createTask({
            name: parent.name,
            columnId: parent.columnId!,
            position: (maxPos ?? -1) + 1,
            organizationId: parent.organizationId,
            description: parent.description ?? null,
            responsibleId: userId,
            startDate: parent.startDate ?? null,
            deadLine: parent.deadLine ?? null,
            creatorId: currentUserId,
            broadcastParentId: parentTaskId,
        })

        // Скопировать теги родителя на нового участника
        const parentTags = await this.tagsRepo.getTagsByTaskId(parentTaskId)
        if (parentTags.length > 0) {
            await this.tagsRepo.setTagsForTask(child.id, parentTags.map((t) => t.id)).catch(() => undefined)
        }

        this.webPush.notifyTaskAssigned(
            await this.taskPushRefFromColumn(parent, currentUserId),
            [userId],
            currentUserId,
        )

        return this.taskRepo.getBroadcastProgress(parentTaskId)
    }

    /** Удаляет участника рассылки: soft-delete дочерней задачи. */
    async removeBroadcastMember(
        parentTaskId: number,
        userId: number,
        currentUserId: number,
    ): Promise<BroadcastProgress> {
        const parent = await this.ensureTaskExist(parentTaskId)
        await this.ensureAccessToColumn(parent.columnId!, currentUserId)

        const canManage =
            (await this.orgAccessService.canManageOrganization(parent.organizationId, currentUserId)) ||
            (await this.departmentAccessService.canManageDepartment(
                (await this.columnRepo.getColumnById(parent.columnId!))!.departmentId,
                currentUserId,
            ))
        if (!canManage) throw new ForbiddenError('Управлять участниками рассылки могут только администраторы')

        const progress = await this.taskRepo.getBroadcastProgress(parentTaskId)
        const child = progress.children.find((c) => c.userId === userId)
        if (!child) throw new NotFoundError('Участник не найден в рассылке')

        await this.taskRepo.softDeleteTask(child.taskId)

        return this.taskRepo.getBroadcastProgress(parentTaskId)
    }

    /** Публичный доступ к id дочерних задач рассылки (используется в TagsService). */
    async getBroadcastChildrenIds(parentId: number): Promise<number[]> {
        return this.taskRepo.getBroadcastChildrenIds(parentId)
    }

    async ensureTaskExistPublic(taskId: number, currentUserId: number): Promise<Task> {
        const task = await this.ensureTaskExist(taskId)
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        return task
    }

    async getBroadcastProgressPublic(taskId: number): Promise<BroadcastProgress> {
        return this.taskRepo.getBroadcastProgress(taskId)
    }

    async sendBackTask(taskId: number, currentUserId: number, comment: string) {
        validateNonEmptyString(comment, 'Комментарий')
        const task = await this.ensureTaskExist(taskId)
        if (task.creatorId !== currentUserId) {
            throw new ForbiddenError('Вернуть задачу может только автор')
        }
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const pipelineId = sourceCol.pipelineId
        if (pipelineId == null) {
            throw new BadRequestError('Задача не находится в воронке')
        }
        const pipelineCols = (await this.columnRepo.getColumnsByDepartmentId(sourceCol.departmentId)).filter(
            (c) => c.pipelineId === pipelineId,
        )
        if (pipelineCols.length < 2) {
            throw new BadRequestError('Нельзя вернуть задачу: в воронке только одна колонка')
        }
        const lastPos = Math.max(...pipelineCols.map((c) => c.position))
        if (sourceCol.position !== lastPos) {
            throw new BadRequestError('Вернуть можно только задачу из завершающей колонки')
        }
        const firstPos = Math.min(...pipelineCols.map((c) => c.position))
        const firstCol = pipelineCols.find((c) => c.position === firstPos)!
        const maxTaskPos = await this.taskRepo.getMaxTaskPositionInColumn(firstCol.id)
        const nextPos = (maxTaskPos ?? -1) + 1
        const escaped = comment
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        const stamp = new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        const block = `<p><strong>Возврат автором</strong> (${stamp}): ${escaped}</p>`
        const base = task.description?.trim() ? task.description : ''
        const newDescription = base ? `${base}${block}` : block
        const updated = await this.taskRepo.updateTask(
            {
                columnId: firstCol.id,
                position: nextPos,
                description: newDescription,
                completedAt: null,
            },
            taskId,
        )
        await this.taskActivity.append(taskId, currentUserId, 'send_back', {
            comment: comment.trim(),
            from: await this.resolveColumnPlace(task.columnId!, currentUserId),
            to: await this.resolveColumnPlace(firstCol.id, currentUserId),
        }).catch(() => undefined)
        return updated
    }

    /** Колонка «На проверке» в основной воронке (position 0..3). */
    private static readonly MAIN_REVIEW_COLUMN_POSITION = 2

    /** Колонка «В работе» в основной воронке — цель при отклонении с проверки. */
    private static readonly MAIN_IN_PROGRESS_COLUMN_POSITION = 1

    async rejectFromReview(taskId: number, currentUserId: number, comment: string) {
        validateNonEmptyString(comment, 'Комментарий')
        const task = await this.ensureTaskExist(taskId)
        if (task.creatorId !== currentUserId) {
            throw new ForbiddenError('Отклонить с проверки может только автор задачи')
        }
        await this.ensureAccessToColumn(task.columnId!, currentUserId)
        const sourceCol = await this.columnRepo.getColumnById(task.columnId!)
        if (!sourceCol) throw new NotFoundError('Такой колонки не существует')
        const pipelineId = sourceCol.pipelineId
        if (pipelineId == null) {
            throw new BadRequestError('Задача не находится в воронке')
        }
        const pipeline = await this.pipelinesRepo.getPipelineById(pipelineId)
        if (!pipeline?.isMainTemplate) {
            throw new BadRequestError('Отклонить с проверки можно только задачу в колонке «На проверке» основной воронки')
        }
        if (sourceCol.position !== TasksService.MAIN_REVIEW_COLUMN_POSITION) {
            throw new BadRequestError('Отклонить с проверки можно только задачу в колонке «На проверке»')
        }
        const pipelineCols = (await this.columnRepo.getColumnsByDepartmentId(sourceCol.departmentId)).filter(
            (c) => c.pipelineId === pipelineId,
        )
        const inProgressCol = pipelineCols.find(
            (c) => c.position === TasksService.MAIN_IN_PROGRESS_COLUMN_POSITION,
        )
        if (!inProgressCol) {
            throw new BadRequestError('В воронке не найдена колонка «В работе»')
        }
        const maxTaskPos = await this.taskRepo.getMaxTaskPositionInColumn(inProgressCol.id)
        const nextPos = (maxTaskPos ?? -1) + 1
        const escaped = comment
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
        const stamp = new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
        const block = `<p><strong>Отклонение с проверки</strong> (${stamp}): ${escaped}</p>`
        const base = task.description?.trim() ? task.description : ''
        const newDescription = base ? `${base}${block}` : block
        const updated = await this.taskRepo.updateTask(
            {
                columnId: inProgressCol.id,
                position: nextPos,
                description: newDescription,
                completedAt: null,
            },
            taskId,
        )
        await this.taskActivity.append(taskId, currentUserId, 'reject_review', {
            comment: comment.trim(),
            from: await this.resolveColumnPlace(task.columnId!, currentUserId),
            to: await this.resolveColumnPlace(inProgressCol.id, currentUserId),
        }).catch(() => undefined)
        return updated
    }
}