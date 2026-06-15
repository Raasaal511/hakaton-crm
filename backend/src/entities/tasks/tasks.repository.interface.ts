import type { Column, Tag, Task } from "../../infra/database/drizzle/schema.js";
import type { BroadcastProgress, CalendarTaskListItem, ColumnTaskListFilter, CreateTaskDTO, UpdateTaskDTO } from "./tasks.types.js";

export interface ITaskRepository {
    getAllTasksByColumnId(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        filter?: ColumnTaskListFilter,
    ): Promise<(Task & { tags: Tag[]; responsibleIds: number[]; broadcastProgress: BroadcastProgress | null })[]>
    countTasksInColumn(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        filter?: ColumnTaskListFilter,
    ): Promise<number>
    getTasksByColumnIdPaginated(
        columnId: number,
        currentUserId: number,
        canManage: boolean,
        offset: number,
        limit: number,
        filter?: ColumnTaskListFilter,
    ): Promise<(Task & { tags: Tag[]; responsibleIds: number[]; broadcastProgress: BroadcastProgress | null })[]>
    getBroadcastProgress(parentTaskId: number): Promise<BroadcastProgress>
    getBroadcastChildrenIds(parentId: number): Promise<number[]>
    updateBroadcastChildren(
        parentId: number,
        patch: Partial<Pick<Task, 'name' | 'description' | 'startDate' | 'deadLine'>>,
    ): Promise<void>
    getAllTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
    ): Promise<(Task & {
        tags: Tag[]
        responsibleIds: number[]
        column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
    })[]>
    getOverdueTasksByColumnId(columnId: number, currentUserId: number, canManage: boolean): Promise<(Task & { tags: Tag[]; responsibleIds: number[] })[]>
    getOverdueTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
    ): Promise<(Task & {
        tags: Tag[]
        responsibleIds: number[]
        column: Pick<Column, 'id' | 'position' | 'pipelineId'> | null
    })[]>
    getTaskById(taskId: number): Promise<Task & { departmentId: number; tags: Tag[]; responsibleIds: number[] }>
    createTask(dto: CreateTaskDTO): Promise<Task>
    updateTask(dto: UpdateTaskDTO, id: number): Promise<Task>
    setResponsibles(taskId: number, userIds: number[]): Promise<{ primary: number | null; extras: number[] }>
    softDeleteTask(taskId: number): Promise<void>
    reorderTask(columnId: number, taskIds: number[]): Promise<void>
    getOrderedTaskIdsInColumn(columnId: number): Promise<number[]>
    getMaxTaskPositionInColumn(columnId: number): Promise<number | null>

    placeTaskAtomic(input: {
        taskId: number
        sourceColumnId: number
        targetColumnId: number
        completedAt: Date | null | undefined
        sourceOrderedIds: number[]
        targetOrderedIds: number[]
    }): Promise<void>

    getCalendarTasksByPipelineId(
        pipelineId: number,
        currentUserId: number,
        canManage: boolean,
        fromYmd: string,
        toYmd: string,
        filter?: ColumnTaskListFilter,
    ): Promise<CalendarTaskListItem[]>

    getCalendarTasksByDepartmentId(
        departmentId: number,
        currentUserId: number,
        canManage: boolean,
        fromYmd: string,
        toYmd: string,
        filter?: ColumnTaskListFilter,
    ): Promise<CalendarTaskListItem[]>
}
