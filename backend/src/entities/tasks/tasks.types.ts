import type { Task } from "../../infra/database/drizzle/schema.js";

export type CreateTaskDTO = {
    name: string
    columnId: number
    position: number
    organizationId: number
    description?: string | null
    responsibleId?: number | null
    /** Полный список исполнителей (primary + дополнительные). Первый id становится ведущим. */
    responsibleIds?: number[] | null
    startDate?: Date | null
    deadLine?: Date | null
    creatorId: number
    broadcastParentId?: number | null
}

export type CreateBroadcastTaskDTO = {
    name: string
    columnId: number
    position: number
    description?: string | null
    /** Список участников, каждому из которых создаётся своя копия задачи */
    memberIds: number[]
    startDate?: Date | null
    deadLine?: Date | null
    creatorId: number
    organizationId: number
    tagIds?: number[]
}

export type BroadcastChildInfo = {
    taskId: number
    userId: number
    completedAt: Date | null
    columnId: number
    columnName: string
    columnPosition: number
    /** id завершающей колонки воронки (null если задача вне воронки) */
    pipelineLastColumnId: number | null
    /** задача находится в колонке «На проверке» основной воронки */
    columnIsReview: boolean
}

export type BroadcastProgress = {
    total: number
    completed: number
    children: BroadcastChildInfo[]
}

export type UpdateTaskDTO = Partial<Pick<Task,
    'name' | 'description' | 'columnId' | 'responsibleId' | 'startDate' | 'deadLine' | 'position' | 'organizationId' | 'completedAt'
>> & {
    /** Полный список исполнителей (primary + дополнительные). Первый id становится ведущим. */
    responsibleIds?: number[] | null
}

/** Фильтр списка задач в колонке (канбан); все поля опциональны, комбинируются через AND. */
export type ColumnTaskListFilter = {
    /** Поиск по подстроке в названии и описании (без учёта регистра). */
    q?: string
    tagId?: number
    /** Ведущий исполнитель или соисполнитель. */
    responsibleId?: number
    /** Срок строго в прошлом и задан. */
    overdue?: boolean
    /** Скрыть завершённые: с датой завершения или в последней колонке воронки. */
    excludeCompleted?: boolean
}

/** Задача для календарного представления (укороченный DTO). */
export type CalendarTaskListItem = {
    id: number
    name: string
    startDate: Date | null
    deadLine: Date | null
    columnId: number
    columnName: string
    columnColor: string | null
    columnPosition: number
    columnPipelineId: number | null
    completedAt: Date | null
    creatorId: number | null
    responsibleId: number | null
    responsibleIds: number[]
    departmentId: number
    departmentName?: string
}
