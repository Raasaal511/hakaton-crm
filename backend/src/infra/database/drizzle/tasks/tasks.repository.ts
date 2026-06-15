import { inject, injectable } from "inversify";
import { TYPES } from "../../../../types";
import { DB } from "../client";
import { BroadcastChildInfo, BroadcastProgress, CalendarTaskListItem, ColumnTaskListFilter, CreateTaskDTO, ITaskRepository, UpdateTaskDTO } from "../../../../entities/tasks";
import { Task, Tag, taskSchema, columnSchema, taskTagsSchema, tagsSchema, Column, taskResponsiblesSchema, pipelinesSchema } from "../schema";
import { and, eq, isNull, asc, or, lt, max, inArray, exists, sql, count, ilike, isNotNull, type SQL } from "drizzle-orm";

@injectable()
export class TasksRepository implements ITaskRepository {
    constructor(@inject(TYPES.DB) private db: DB) { }

    /**
     * Условие видимости для не-менеджера: задача «моя», если я
     * — автор, ведущий исполнитель, или состою в task_responsibles.
     */
    private visibilityForUser(currentUserId: number): SQL {
        return or(
            eq(taskSchema.responsibleId, currentUserId),
            eq(taskSchema.creatorId, currentUserId),
            exists(
                this.db
                    .select({ one: sql`1` })
                    .from(taskResponsiblesSchema)
                    .where(
                        and(
                            eq(taskResponsiblesSchema.taskId, taskSchema.id),
                            eq(taskResponsiblesSchema.userId, currentUserId),
                        ),
                    ),
            ),
        )!
    }

    /**
     * Возвращает id всех исполнителей для списка задач: ведущий (tasks.responsible_id)
     * идёт первым, далее — из task_responsibles. Порядок внутри задач фиксирован.
     */
    private async getResponsibleIdsByTaskIds(
        taskIds: number[],
        primaryByTask: Map<number, number | null>,
    ): Promise<Map<number, number[]>> {
        const result = new Map<number, number[]>()
        if (!taskIds.length) return result

        const extraRows = await this.db
            .select({
                taskId: taskResponsiblesSchema.taskId,
                userId: taskResponsiblesSchema.userId,
            })
            .from(taskResponsiblesSchema)
            .where(inArray(taskResponsiblesSchema.taskId, taskIds))

        const extraByTask = new Map<number, number[]>()
        for (const row of extraRows) {
            const list = extraByTask.get(row.taskId) ?? []
            list.push(row.userId)
            extraByTask.set(row.taskId, list)
        }

        for (const taskId of taskIds) {
            const primary = primaryByTask.get(taskId) ?? null
            const extras = (extraByTask.get(taskId) ?? []).filter((id) => id !== primary)
            const sortedExtras = [...extras].sort((a, b) => a - b)
            const combined = primary != null ? [primary, ...sortedExtras] : sortedExtras
            result.set(taskId, combined)
        }
        return result
    }

    private async attachResponsibleIds<T extends { id: number; responsibleId: number | null }>(
        tasks: T[],
    ): Promise<(T & { responsibleIds: number[] })[]> {
        if (!tasks.length) return [] as (T & { responsibleIds: number[] })[]
        const primaryByTask = new Map<number, number | null>()
        for (const t of tasks) primaryByTask.set(t.id, t.responsibleId ?? null)
        const idsByTask = await this.getResponsibleIdsByTaskIds(
            tasks.map((t) => t.id),
            primaryByTask,
        )
        return tasks.map((t) => ({ ...t, responsibleIds: idsByTask.get(t.id) ?? [] }))
    }

    private async attachTagsToTasks<T extends { id: number }>(
        tasks: T[],
    ): Promise<(T & { tags: Tag[] })[]> {
        if (!tasks.length) return [] as (T & { tags: Tag[] })[]
        const taskIds = tasks.map((t) => t.id)
        const rows = await this.db
            .select({
                taskId: taskTagsSchema.taskId,
                tagId: tagsSchema.id,
                tagName: tagsSchema.name,
            })
            .from(taskTagsSchema)
            .innerJoin(tagsSchema, and(
                eq(taskTagsSchema.tagId, tagsSchema.id),
                isNull(tagsSchema.deletedAt),
            ))
            .where(inArray(taskTagsSchema.taskId, taskIds))
            .orderBy(asc(taskTagsSchema.taskId), asc(tagsSchema.id))

        const byTask = new Map<number, Tag[]>()
        for (const row of rows) {
            const list = byTask.get(row.taskId) ?? []
            list.push({ id: row.tagId, name: row.tagName } as Tag)
            byTask.set(row.taskId, list)
        }
        return tasks.map((t) => ({
            ...t,
            tags: byTask.get(t.id) ?? [],
        }))
    }

    /** Для набора pipelineId находит id и position последней колонки каждой воронки. */
    private async resolvePipelineLastColumns(
        pipelineIds: number[],
    ): Promise<Map<number, { columnId: number; position: number; isMainTemplate: boolean }>> {
        if (!pipelineIds.length) return new Map()
        const allCols = await this.db
            .select({
                pipelineId: columnSchema.pipelineId,
                columnId: columnSchema.id,
                position: columnSchema.position,
            })
            .from(columnSchema)
            .where(
                and(
                    inArray(columnSchema.pipelineId, pipelineIds),
                    isNull(columnSchema.deletedAt),
                ),
            )
        const pipelines = await this.db
            .select({ id: pipelinesSchema.id, isMainTemplate: pipelinesSchema.isMainTemplate })
            .from(pipelinesSchema)
            .where(inArray(pipelinesSchema.id, pipelineIds))
        const isMainMap = new Map(pipelines.map((p) => [p.id, Boolean(p.isMainTemplate)]))

        const best = new Map<number, { columnId: number; position: number; isMainTemplate: boolean }>()
        for (const col of allCols) {
            if (!col.pipelineId) continue
            const cur = best.get(col.pipelineId)
            if (!cur || col.position > cur.position) {
                best.set(col.pipelineId, {
                    columnId: col.columnId,
                    position: col.position,
                    isMainTemplate: isMainMap.get(col.pipelineId) ?? false,
                })
            }
        }
        return best
    }

    private async enrichBroadcastChildren(
        rows: Array<{
            taskId: number
            userId: number | null
            completedAt: Date | null
            columnId: number | null
            columnName: string | null
            columnPosition: number | null
            pipelineId: number | null
        }>,
    ): Promise<BroadcastChildInfo[]> {
        const pipelineIds = [...new Set(rows.map((r) => r.pipelineId).filter((id): id is number => id != null))]
        const lastColMap = await this.resolvePipelineLastColumns(pipelineIds)
        return rows.map((r) => {
            const pip = r.pipelineId != null ? lastColMap.get(r.pipelineId) : undefined
            const colPos = r.columnPosition ?? 0
            const columnIsReview = pip != null && pip.isMainTemplate && colPos === pip.position - 1
            return {
                taskId: r.taskId,
                userId: r.userId ?? 0,
                completedAt: r.completedAt,
                columnId: r.columnId ?? 0,
                columnName: r.columnName ?? '',
                columnPosition: colPos,
                pipelineLastColumnId: pip?.columnId ?? null,
                columnIsReview,
            }
        })
    }

    private async attachBroadcastProgress<T extends { id: number }>(
        tasks: T[],
    ): Promise<(T & { broadcastProgress: BroadcastProgress | null })[]> {
        if (!tasks.length) return tasks.map((t) => ({ ...t, broadcastProgress: null }))
        const taskIds = tasks.map((t) => t.id)
        const rows = await this.db
            .select({
                parentId: taskSchema.broadcastParentId,
                taskId: taskSchema.id,
                userId: taskSchema.responsibleId,
                completedAt: taskSchema.completedAt,
                columnId: columnSchema.id,
                columnName: columnSchema.name,
                columnPosition: columnSchema.position,
                pipelineId: columnSchema.pipelineId,
            })
            .from(taskSchema)
            .leftJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .where(
                and(
                    inArray(taskSchema.broadcastParentId, taskIds),
                    isNull(taskSchema.deletedAt),
                ),
            )
        const enriched = await this.enrichBroadcastChildren(rows)
        const byParent = new Map<number, BroadcastChildInfo[]>()
        for (let i = 0; i < rows.length; i++) {
            const parentId = rows[i]!.parentId
            if (parentId == null) continue
            const list = byParent.get(parentId) ?? []
            list.push(enriched[i]!)
            byParent.set(parentId, list)
        }
        return tasks.map((t) => {
            const children = byParent.get(t.id) ?? []
            if (!children.length) return { ...t, broadcastProgress: null }
            return {
                ...t,
                broadcastProgress: {
                    total: children.length,
                    completed: children.filter((c) => c.completedAt != null).length,
                    children,
                },
            }
        })
    }

    async getBroadcastProgress(parentTaskId: number): Promise<BroadcastProgress> {
        const rows = await this.db
            .select({
                taskId: taskSchema.id,
                userId: taskSchema.responsibleId,
                completedAt: taskSchema.completedAt,
                columnId: columnSchema.id,
                columnName: columnSchema.name,
                columnPosition: columnSchema.position,
                pipelineId: columnSchema.pipelineId,
            })
            .from(taskSchema)
            .leftJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .where(
                and(
                    eq(taskSchema.broadcastParentId, parentTaskId),
                    isNull(taskSchema.deletedAt),
                ),
            )
        const children = await this.enrichBroadcastChildren(rows)
        return {
            total: children.length,
            completed: children.filter((c) => c.completedAt != null).length,
            children,
        }
    }

    async getBroadcastChildrenIds(parentId: number): Promise<number[]> {
        const rows = await this.db
            .select({ id: taskSchema.id })
            .from(taskSchema)
            .where(
                and(
                    eq(taskSchema.broadcastParentId, parentId),
                    isNull(taskSchema.deletedAt),
                ),
            )
        return rows.map((r) => r.id)
    }

    async updateBroadcastChildren(
        parentId: number,
        patch: Partial<Pick<typeof taskSchema.$inferSelect, 'name' | 'description' | 'startDate' | 'deadLine'>>,
    ): Promise<void> {
        const keys = Object.keys(patch)
        if (keys.length === 0) return
        await this.db
            .update(taskSchema)
            .set(patch)
            .where(
                and(
                    eq(taskSchema.broadcastParentId, parentId),
                    isNull(taskSchema.deletedAt),
                ),
            )
    }

    private calendarDateOverlapSql(fromYmd: string, toYmd: string): SQL {
        return sql`(
            (${taskSchema.startDate} IS NOT NULL OR ${taskSchema.deadLine} IS NOT NULL)
            AND COALESCE((${taskSchema.startDate})::date, (${taskSchema.deadLine})::date) <= ${toYmd}::date
            AND COALESCE((${taskSchema.deadLine})::date, (${taskSchema.startDate})::date) >= ${fromYmd}::date
        )`!
    }

    private columnTaskListFilterSql(filter?: ColumnTaskListFilter): SQL | undefined {
        if (!filter) return undefined
        const parts: SQL[] = []
        if (filter.q != null && filter.q.trim().length > 0) {
            const raw = filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')
            if (raw.length > 0) {
                const pattern = `%${raw}%`
                parts.push(
                    or(
                        ilike(taskSchema.name, pattern),
                        ilike(taskSchema.description, pattern),
                    )!,
                )
            }
        }
        if (filter.tagId != null && Number.isInteger(filter.tagId) && filter.tagId > 0) {
            parts.push(
                exists(
                    this.db
                        .select({ one: sql`1` })
                        .from(taskTagsSchema)
                        .where(
                            and(
                                eq(taskTagsSchema.taskId, taskSchema.id),
                                eq(taskTagsSchema.tagId, filter.tagId),
                            ),
                        ),
                )!,
            )
        }
        if (filter.responsibleId != null && Number.isInteger(filter.responsibleId) && filter.responsibleId > 0) {
            const rid = filter.responsibleId
            parts.push(
                or(
                    eq(taskSchema.responsibleId, rid),
                    exists(
                        this.db
                            .select({ one: sql`1` })
                            .from(taskResponsiblesSchema)
                            .where(
                                and(
                                    eq(taskResponsiblesSchema.taskId, taskSchema.id),
                                    eq(taskResponsiblesSchema.userId, rid),
                                ),
                            ),
                    ),
                )!,
            )
        }
        if (filter.overdue === true) {
            const now = new Date()
            parts.push(and(isNotNull(taskSchema.deadLine), lt(taskSchema.deadLine, now))!)
        }
        if (filter.excludeCompleted === true) {
            parts.push(
                and(
                    isNull(taskSchema.completedAt),
                    sql`NOT EXISTS (
                        SELECT 1 FROM ${columnSchema} AS col
                        WHERE col.id = ${taskSchema.columnId}
                        AND col.pipeline_id IS NOT NULL
                        AND col.position = (
                            SELECT MAX(c2.position) FROM ${columnSchema} AS c2
                            WHERE c2.pipeline_id = col.pipeline_id
                        )
                    )`,
                )!,
            )
        }
        if (parts.length === 0) return undefined
        return and(...parts)!
    }

    private columnTasksWhere(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        filter?: ColumnTaskListFilter,
    ) {
        const conditions: SQL[] = [
            eq(taskSchema.columnId, columnId),
            isNull(taskSchema.deletedAt),
        ]
        if (canManage) {
            // Менеджеры видят все задачи, но не дочерние копии рассылок —
            // они отображаются внутри родительской карточки-трекера
            conditions.push(isNull(taskSchema.broadcastParentId))
        } else {
            conditions.push(this.visibilityForUser(currentUserId))
        }
        const filterSql = this.columnTaskListFilterSql(filter)
        if (filterSql) conditions.push(filterSql)
        return and(...conditions)!
    }

    async getAllTasksByColumnId(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        filter?: ColumnTaskListFilter,
    ): Promise<(Task & { tags: Tag[]; responsibleIds: number[]; broadcastProgress: BroadcastProgress | null })[]> {
        const whereClause = this.columnTasksWhere(columnId, currentUserId, canManage, filter)

        const tasks = await this.db
            .select()
            .from(taskSchema)
            .where(whereClause)
            .orderBy(asc(taskSchema.position), asc(taskSchema.id))

        const withResp = await this.attachResponsibleIds(tasks)
        const withTags = await this.attachTagsToTasks(withResp)
        return this.attachBroadcastProgress(withTags)
    }

    async countTasksInColumn(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        filter?: ColumnTaskListFilter,
    ): Promise<number> {
        const whereClause = this.columnTasksWhere(columnId, currentUserId, canManage, filter)

        const rows = await this.db
            .select({ n: count() })
            .from(taskSchema)
            .where(whereClause)
        return Number(rows[0]?.n ?? 0)
    }

    async getTasksByColumnIdPaginated(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        offset: number,
        limit: number,
        filter?: ColumnTaskListFilter,
    ): Promise<(Task & { tags: Tag[]; responsibleIds: number[]; broadcastProgress: BroadcastProgress | null })[]> {
        const whereClause = this.columnTasksWhere(columnId, currentUserId, canManage, filter)

        const tasks = await this.db
            .select()
            .from(taskSchema)
            .where(whereClause)
            .orderBy(asc(taskSchema.position), asc(taskSchema.id))
            .limit(limit)
            .offset(offset)

        const withResp = await this.attachResponsibleIds(tasks)
        const withTags = await this.attachTagsToTasks(withResp)
        return this.attachBroadcastProgress(withTags)
    }

    async getOverdueTasksByColumnId(columnId: number, currentUserId: number, canManage: boolean): Promise<(Task & { tags: Tag[]; responsibleIds: number[] })[]> {
        const now = new Date()
        const baseWhere = and(
            eq(taskSchema.columnId, columnId),
            isNull(taskSchema.deletedAt),
            lt(taskSchema.deadLine, now),
        )

        const whereClause = canManage
            ? baseWhere
            : and(baseWhere, this.visibilityForUser(currentUserId))

        const tasks = await this.db
            .select()
            .from(taskSchema)
            .where(whereClause)

        const withResp = await this.attachResponsibleIds(tasks)
        return this.attachTagsToTasks(withResp)
    }

    async getAllTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
    ): Promise<(Task & {
        tags: Tag[]
        responsibleIds: number[]
        column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
    })[]> {
        const rows = await this.db
            .select({
                id: taskSchema.id,
                name: taskSchema.name,
                description: taskSchema.description,
                columnId: taskSchema.columnId,
                responsibleId: taskSchema.responsibleId,
                creatorId: taskSchema.creatorId,
                startDate: taskSchema.startDate,
                deadLine: taskSchema.deadLine,
                position: taskSchema.position,
                organizationId: taskSchema.organizationId,
                createdAt: taskSchema.createdAt,
                updatedAt: taskSchema.updatedAt,
                deletedAt: taskSchema.deletedAt,
                completedAt: taskSchema.completedAt,
                broadcastParentId: taskSchema.broadcastParentId,
                columnPosition: columnSchema.position,
                columnPipelineId: columnSchema.pipelineId,
                tagId: tagsSchema.id,
                tagName: tagsSchema.name,
            })
            .from(taskSchema)
            .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .leftJoin(taskTagsSchema, eq(taskSchema.id, taskTagsSchema.taskId))
            .leftJoin(tagsSchema, and(
                eq(taskTagsSchema.tagId, tagsSchema.id),
                isNull(tagsSchema.deletedAt),
            ))
            .where(
                and(
                    eq(columnSchema.departmentId, departmentId),
                    isNull(columnSchema.deletedAt),
                    isNull(taskSchema.deletedAt),
                    canManage ? undefined : this.visibilityForUser(currentUserId),
                ),
            )
            .orderBy(asc(columnSchema.position), asc(taskSchema.position))

        const byId = new Map<number, Task & {
            tags: Tag[]
            column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
        }>()
        for (const row of rows) {
            const task = {
                id: row.id,
                name: row.name,
                description: row.description,
                columnId: row.columnId,
                responsibleId: row.responsibleId,
                creatorId: row.creatorId,
                startDate: row.startDate,
                deadLine: row.deadLine,
                position: row.position,
                organizationId: row.organizationId,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                deletedAt: row.deletedAt,
                completedAt: row.completedAt,
            } as Task
            if (!byId.has(row.id)) {
                byId.set(row.id, {
                    ...task,
                    tags: [],
                    column: row.columnId != null
                        ? {
                            id: row.columnId,
                            position: row.columnPosition,
                            pipelineId: row.columnPipelineId,
                        }
                        : null,
                })
            }
            if (row.tagId != null && row.tagName != null) {
                byId.get(row.id)!.tags.push({ id: row.tagId, name: row.tagName } as Tag)
            }
        }
        const tasks = Array.from(byId.values())
        return this.attachResponsibleIds(tasks)
    }

    async getOverdueTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
    ): Promise<(Task & {
        tags: Tag[]
        responsibleIds: number[]
        column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
    })[]> {
        const now = new Date()
        const rows = await this.db
            .select({
                id: taskSchema.id,
                name: taskSchema.name,
                description: taskSchema.description,
                columnId: taskSchema.columnId,
                responsibleId: taskSchema.responsibleId,
                creatorId: taskSchema.creatorId,
                startDate: taskSchema.startDate,
                deadLine: taskSchema.deadLine,
                position: taskSchema.position,
                organizationId: taskSchema.organizationId,
                createdAt: taskSchema.createdAt,
                updatedAt: taskSchema.updatedAt,
                deletedAt: taskSchema.deletedAt,
                completedAt: taskSchema.completedAt,
                columnPosition: columnSchema.position,
                columnPipelineId: columnSchema.pipelineId,
                tagId: tagsSchema.id,
                tagName: tagsSchema.name,
            })
            .from(taskSchema)
            .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .leftJoin(taskTagsSchema, eq(taskSchema.id, taskTagsSchema.taskId))
            .leftJoin(tagsSchema, and(
                eq(taskTagsSchema.tagId, tagsSchema.id),
                isNull(tagsSchema.deletedAt),
            ))
            .where(
                and(
                    eq(columnSchema.departmentId, departmentId),
                    isNull(columnSchema.deletedAt),
                    isNull(taskSchema.deletedAt),
                    lt(taskSchema.deadLine, now),
                    canManage ? undefined : this.visibilityForUser(currentUserId),
                ),
            )
            .orderBy(asc(columnSchema.position), asc(taskSchema.position))

        const byId = new Map<number, Task & {
            tags: Tag[]
            column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
        }>()
        for (const row of rows) {
            const task = {
                id: row.id,
                name: row.name,
                description: row.description,
                columnId: row.columnId,
                responsibleId: row.responsibleId,
                creatorId: row.creatorId,
                startDate: row.startDate,
                deadLine: row.deadLine,
                position: row.position,
                organizationId: row.organizationId,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                deletedAt: row.deletedAt,
                completedAt: row.completedAt,
            } as Task
            if (!byId.has(row.id)) {
                byId.set(row.id, {
                    ...task,
                    tags: [],
                    column: row.columnId != null
                        ? {
                            id: row.columnId,
                            position: row.columnPosition,
                            pipelineId: row.columnPipelineId,
                        }
                        : null,
                })
            }
            if (row.tagId != null && row.tagName != null) {
                byId.get(row.id)!.tags.push({ id: row.tagId, name: row.tagName } as Tag)
            }
        }
        const tasks = Array.from(byId.values())
        return this.attachResponsibleIds(tasks)
    }

    async getTaskById(taskId: number): Promise<Task & { departmentId: number; tags: Tag[]; responsibleIds: number[] }> {
        const rows = await this.db
            .select({
                id: taskSchema.id,
                name: taskSchema.name,
                description: taskSchema.description,
                columnId: taskSchema.columnId,
                responsibleId: taskSchema.responsibleId,
                creatorId: taskSchema.creatorId,
                startDate: taskSchema.startDate,
                deadLine: taskSchema.deadLine,
                position: taskSchema.position,
                organizationId: taskSchema.organizationId,
                createdAt: taskSchema.createdAt,
                updatedAt: taskSchema.updatedAt,
                deletedAt: taskSchema.deletedAt,
                completedAt: taskSchema.completedAt,
                broadcastParentId: taskSchema.broadcastParentId,
                departmentId: columnSchema.departmentId,
                tagId: tagsSchema.id,
                tagName: tagsSchema.name,
            })
            .from(taskSchema)
            .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .leftJoin(taskTagsSchema, eq(taskSchema.id, taskTagsSchema.taskId))
            .leftJoin(tagsSchema, and(
                eq(taskTagsSchema.tagId, tagsSchema.id),
                isNull(tagsSchema.deletedAt),
            ))
            .where(and(
                eq(taskSchema.id, taskId),
                isNull(taskSchema.deletedAt),
            ))
        if (rows.length === 0) throw new Error('Task not found')
        const { tagId: _, tagName: __, ...task } = rows[0]
        const tags: Tag[] = rows
            .filter((r) => r.tagId != null && r.tagName != null)
            .map((r) => ({ id: r.tagId!, name: r.tagName! } as Tag))
        const [withResponsibles] = await this.attachResponsibleIds([task as Task & { departmentId: number }])
        return { ...withResponsibles, tags } as Task & { departmentId: number; tags: Tag[]; responsibleIds: number[] }
    }

    async createTask(dto: CreateTaskDTO): Promise<Task> {
        const [task] = await this.db
            .insert(taskSchema)
            .values(dto)
            .returning()

        return task
    }

    async updateTask(dto: UpdateTaskDTO, id: number): Promise<Task> {
        const [task] = await this.db
            .update(taskSchema)
            .set(dto)
            .where(eq(taskSchema.id, id))
            .returning()
        return task
    }

    async setResponsibles(taskId: number, userIds: number[]): Promise<{ primary: number | null; extras: number[] }> {
        const unique = Array.from(new Set(userIds.filter((id) => Number.isInteger(id))))
        const primary = unique.length ? unique[0] : null
        const extras = unique.slice(1)

        await this.db.transaction(async (tx) => {
            await tx
                .update(taskSchema)
                .set({ responsibleId: primary })
                .where(eq(taskSchema.id, taskId))

            await tx
                .delete(taskResponsiblesSchema)
                .where(eq(taskResponsiblesSchema.taskId, taskId))

            if (extras.length) {
                await tx
                    .insert(taskResponsiblesSchema)
                    .values(extras.map((userId) => ({ taskId, userId })))
            }
        })

        return { primary, extras }
    }

    async softDeleteTask(taskId: number): Promise<void> {
        await this.db
            .update(taskSchema)
            .set({ deletedAt: new Date() })
            .where(eq(taskSchema.id, taskId))
    }

    async getOrderedTaskIdsInColumn(columnId: number): Promise<number[]> {
        const rows = await this.db
            .select({ id: taskSchema.id })
            .from(taskSchema)
            .where(and(eq(taskSchema.columnId, columnId), isNull(taskSchema.deletedAt)))
            .orderBy(asc(taskSchema.position), asc(taskSchema.id))
        return rows.map((r) => r.id)
    }

    async reorderTask(columnId: number, taskIds: number[]): Promise<void> {
        if (taskIds.length === 0) return
        await this.db.transaction(async (tx) => {
            const existing = await tx
                .select({ id: taskSchema.id })
                .from(taskSchema)
                .where(
                    and(
                        inArray(taskSchema.id, taskIds),
                        eq(taskSchema.columnId, columnId),
                        isNull(taskSchema.deletedAt),
                    ),
                )
            const existingIds = new Set(existing.map((r) => r.id))
            const missing = taskIds.filter((id) => !existingIds.has(id))
            if (missing.length > 0) {
                throw new Error(
                    `Некоторые задачи не принадлежат колонке ${columnId} или удалены: ${missing.join(', ')}`,
                )
            }
            for (let i = 0; i < taskIds.length; i++) {
                await tx
                    .update(taskSchema)
                    .set({ position: i, updatedAt: new Date() })
                    .where(
                        and(
                            eq(taskSchema.id, taskIds[i]),
                            eq(taskSchema.columnId, columnId),
                            isNull(taskSchema.deletedAt),
                        ),
                    )
            }
        })
    }

    async placeTaskAtomic(input: {
        taskId: number
        sourceColumnId: number
        targetColumnId: number
        completedAt: Date | null | undefined
        sourceOrderedIds: number[]
        targetOrderedIds: number[]
    }): Promise<void> {
        const {
            taskId,
            sourceColumnId,
            targetColumnId,
            completedAt,
            sourceOrderedIds,
            targetOrderedIds,
        } = input
        await this.db.transaction(async (tx) => {
            const now = new Date()
            if (sourceColumnId !== targetColumnId) {
                const patch: Record<string, unknown> = {
                    columnId: targetColumnId,
                    updatedAt: now,
                }
                if (completedAt !== undefined) {
                    patch.completedAt = completedAt
                }
                await tx
                    .update(taskSchema)
                    .set(patch)
                    .where(
                        and(
                            eq(taskSchema.id, taskId),
                            isNull(taskSchema.deletedAt),
                        ),
                    )
                for (let i = 0; i < sourceOrderedIds.length; i++) {
                    await tx
                        .update(taskSchema)
                        .set({ position: i, updatedAt: now })
                        .where(
                            and(
                                eq(taskSchema.id, sourceOrderedIds[i]),
                                eq(taskSchema.columnId, sourceColumnId),
                                isNull(taskSchema.deletedAt),
                            ),
                        )
                }
            }
            for (let i = 0; i < targetOrderedIds.length; i++) {
                await tx
                    .update(taskSchema)
                    .set({ position: i, updatedAt: now })
                    .where(
                        and(
                            eq(taskSchema.id, targetOrderedIds[i]),
                            eq(taskSchema.columnId, targetColumnId),
                            isNull(taskSchema.deletedAt),
                        ),
                    )
            }
        })
    }

    private async mapRowsToCalendarTasks(
        rows: {
            id: number
            name: string
            startDate: Date | null
            deadLine: Date | null
            columnId: number | null
            columnName: string
            columnColor: string | null
            columnPosition: number
            columnPipelineId: number | null
            completedAt: Date | null
            creatorId: number | null
            responsibleId: number | null
            departmentId: number
        }[],
    ): Promise<CalendarTaskListItem[]> {
        const tasks = rows.filter((r) => r.columnId != null).map((r) => ({
            id: r.id,
            name: r.name,
            startDate: r.startDate,
            deadLine: r.deadLine,
            columnId: r.columnId!,
            columnName: r.columnName,
            columnColor: r.columnColor,
            columnPosition: r.columnPosition,
            columnPipelineId: r.columnPipelineId,
            completedAt: r.completedAt,
            creatorId: r.creatorId,
            responsibleId: r.responsibleId,
            departmentId: r.departmentId,
        }))
        const withResp = await this.attachResponsibleIds(
            tasks.map((t) => ({
                id: t.id,
                responsibleId: t.responsibleId,
            })),
        )
        const respById = new Map(withResp.map((t) => [t.id, t.responsibleIds]))
        return tasks.map((t) => ({
            ...t,
            responsibleIds: respById.get(t.id) ?? [],
        }))
    }

    async getCalendarTasksByPipelineId(
        pipelineId: number,
        currentUserId: number,
        canManage: boolean,
        fromYmd: string,
        toYmd: string,
        filter?: ColumnTaskListFilter,
    ): Promise<CalendarTaskListItem[]> {
        const conditions: SQL[] = [
            eq(columnSchema.pipelineId, pipelineId),
            isNull(columnSchema.deletedAt),
            isNull(taskSchema.deletedAt),
            this.calendarDateOverlapSql(fromYmd, toYmd),
        ]
        if (!canManage) conditions.push(this.visibilityForUser(currentUserId))
        const filterSql = this.columnTaskListFilterSql(filter)
        if (filterSql) conditions.push(filterSql)

        const rows = await this.db
            .select({
                id: taskSchema.id,
                name: taskSchema.name,
                startDate: taskSchema.startDate,
                deadLine: taskSchema.deadLine,
                columnId: taskSchema.columnId,
                columnName: columnSchema.name,
                columnColor: columnSchema.color,
                columnPosition: columnSchema.position,
                columnPipelineId: columnSchema.pipelineId,
                completedAt: taskSchema.completedAt,
                creatorId: taskSchema.creatorId,
                responsibleId: taskSchema.responsibleId,
                departmentId: columnSchema.departmentId,
            })
            .from(taskSchema)
            .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .where(and(...conditions)!)
            .orderBy(asc(taskSchema.deadLine), asc(taskSchema.id))

        return this.mapRowsToCalendarTasks(rows)
    }

    async getCalendarTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
        fromYmd: string,
        toYmd: string,
        filter?: ColumnTaskListFilter,
    ): Promise<CalendarTaskListItem[]> {
        const conditions: SQL[] = [
            eq(columnSchema.departmentId, departmentId),
            isNull(columnSchema.deletedAt),
            isNull(taskSchema.deletedAt),
            this.calendarDateOverlapSql(fromYmd, toYmd),
        ]
        if (!canManage) conditions.push(this.visibilityForUser(currentUserId))
        const filterSql = this.columnTaskListFilterSql(filter)
        if (filterSql) conditions.push(filterSql)

        const rows = await this.db
            .select({
                id: taskSchema.id,
                name: taskSchema.name,
                startDate: taskSchema.startDate,
                deadLine: taskSchema.deadLine,
                columnId: taskSchema.columnId,
                columnName: columnSchema.name,
                columnColor: columnSchema.color,
                columnPosition: columnSchema.position,
                columnPipelineId: columnSchema.pipelineId,
                completedAt: taskSchema.completedAt,
                creatorId: taskSchema.creatorId,
                responsibleId: taskSchema.responsibleId,
                departmentId: columnSchema.departmentId,
            })
            .from(taskSchema)
            .innerJoin(columnSchema, eq(taskSchema.columnId, columnSchema.id))
            .where(and(...conditions)!)
            .orderBy(asc(taskSchema.deadLine), asc(taskSchema.id))

        return this.mapRowsToCalendarTasks(rows)
    }

    async getMaxTaskPositionInColumn(columnId: number): Promise<number | null> {
        const rows = await this.db
            .select({ maxPos: max(taskSchema.position) })
            .from(taskSchema)
            .where(and(eq(taskSchema.columnId, columnId), isNull(taskSchema.deletedAt)))
        const v = rows[0]?.maxPos
        if (v == null || v === undefined) return null
        return Number(v)
    }
}
