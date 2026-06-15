import type { Tag } from './tags'

export type BroadcastChildInfo = {
  taskId: number
  userId: number
  completedAt: string | null
  columnId: number
  columnName: string
  columnPosition: number
  pipelineLastColumnId: number | null
  columnIsReview: boolean
}

export type BroadcastProgress = {
  total: number
  completed: number
  children: BroadcastChildInfo[]
}

export type TaskAttachmentUploader = {
  id: number
  firstname: string
  lastname: string
  email: string
}

export type TaskAttachment = {
  id: number
  fileName: string
  mimeType: string | null
  sizeBytes: number
  uploadedByUserId: number | null
  uploadedBy: TaskAttachmentUploader | null
  createdAt: string | null
}

export type TaskCommentAuthor = {
  id: number
  firstname: string
  lastname: string
  email: string
}

export type TaskComment = {
  id: number
  taskId: number
  authorId: number | null
  author: TaskCommentAuthor | null
  body: string
  createdAt: string | null
  updatedAt: string | null
}

export type Task = {
  id: number
  name: string
  description?: string | null
  columnId: number
  responsibleId?: number | null
  /** Полный список исполнителей: [responsibleId, ...co-responsibles]. Первый — ведущий. */
  responsibleIds?: number[]
  creatorId?: number | null
  startDate?: string | null
  deadLine?: string | null
  position: number
  organizationId: number
  departmentId?: number
  /** Название отдела (в т.ч. в сводке my-tasks для отображения) */
  departmentName?: string | null
  createdAt?: string
  updatedAt?: string
  /** Когда задача впервые попала в завершающую колонку (для автора поручения) */
  completedAt?: string | null
  /**
   * Ответ /organizations/:id/my-tasks: последняя колонка воронки (как в классификации «завершено»),
   * даже если completedAt ещё не проставлен.
   */
  inPipelineTerminalColumn?: boolean
  deletedAt?: string | null
  tags?: Tag[]
  attachments?: TaskAttachment[]
  /** Если задача — дочерняя копия рассылки, здесь хранится id родительской задачи */
  broadcastParentId?: number | null
  /** Для родительских задач-рассылок: прогресс выполнения участниками */
  broadcastProgress?: BroadcastProgress | null
}

/** Фильтр задач на канбан-доске воронки (query → GET /columns/:id/tasks). */
export type PipelineBoardTaskFilter = {
  q?: string
  tagId?: number
  responsibleId?: number
  overdue?: boolean
  /** Не показывать завершённые (дата завершения или последняя колонка воронки). */
  excludeCompleted?: boolean
}

export type CreateTaskDTO = {
  name: string
  columnId: number
  position: number
  description?: string | null
  responsibleId?: number | null
  responsibleIds?: number[] | null
  startDate?: string | null
  deadLine?: string | null
}

export type UpdateTaskDTO = {
  name?: string
  description?: string | null
  columnId?: number
  responsibleId?: number | null
  responsibleIds?: number[] | null
  startDate?: string | null
  deadLine?: string | null
  position?: number
}

