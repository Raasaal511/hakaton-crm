import type {
  Task,
  TaskAttachment,
  TaskComment,
  CreateTaskDTO,
  UpdateTaskDTO,
  PipelineBoardTaskFilter,
} from 'shared/types/tasks'
import type { TaskActivityItem } from 'shared/types/taskActivity'
import type { MyTasksListSortMode } from 'shared/lib/taskListSort'
import type { TaskCalendarItem } from 'features/calendar'
import { axiosAPI } from '../axios'

function pipelineBoardFilterParams(filter?: PipelineBoardTaskFilter): Record<string, string | number> {
  const p: Record<string, string | number> = {}
  if (!filter) return p
  if (filter.q != null && filter.q.trim() !== '') {
    p.q = filter.q.trim().slice(0, 200)
  }
  if (filter.tagId != null && filter.tagId > 0) {
    p.tagId = filter.tagId
  }
  if (filter.responsibleId != null && filter.responsibleId > 0) {
    p.responsibleId = filter.responsibleId
  }
  if (filter.overdue === true) {
    p.overdue = '1'
  }
  if (filter.excludeCompleted === true) {
    p.excludeCompleted = '1'
  }
  return p
}

export const tasksAPI = {
  /** limit/offset: ответ { items, total, count }. Фильтры уходят query-параметрами на сервер. */
  getByColumnPaginated: async (
    columnId: number,
    params: { limit: number; offset: number; filter?: PipelineBoardTaskFilter },
  ) => {
    const { data } = await axiosAPI.get<{ items: Task[]; total: number; count?: number }>(
      `/columns/${columnId}/tasks`,
      {
        params: {
          limit: params.limit,
          offset: params.offset,
          ...pipelineBoardFilterParams(params.filter),
        },
      },
    )
    const total = data.count ?? data.total
    return { items: data.items, total }
  },

  getById: async (id: number, options?: { includeAttachments?: boolean }) => {
    const { data } = await axiosAPI.get<Task>(`/tasks/${id}`, {
      params:
        options?.includeAttachments === false ? { includeAttachments: 'false' } : undefined,
    })
    return data
  },

  listActivity: async (taskId: number, params?: { limit?: number; beforeId?: number }) => {
    const { data } = await axiosAPI.get<TaskActivityItem[]>(`/tasks/${taskId}/activity`, {
      params,
    })
    return data
  },

  listAttachments: async (taskId: number) => {
    const { data } = await axiosAPI.get<TaskAttachment[]>(`/tasks/${taskId}/attachments`)
    return data
  },

  create: async (columnId: number, dto: Omit<CreateTaskDTO, 'columnId'>) => {
    const { data } = await axiosAPI.post<Task>(`/columns/${columnId}/tasks`, dto)
    return data
  },

  getBroadcastProgress: async (taskId: number) => {
    const { data } = await axiosAPI.get<import('shared/types/tasks').BroadcastProgress>(
      `/tasks/${taskId}/broadcast/progress`,
    )
    return data
  },

  addBroadcastMember: async (taskId: number, userId: number) => {
    const { data } = await axiosAPI.post<import('shared/types/tasks').BroadcastProgress>(
      `/tasks/${taskId}/broadcast/members`,
      { userId },
    )
    return data
  },

  removeBroadcastMember: async (taskId: number, userId: number) => {
    const { data } = await axiosAPI.delete<import('shared/types/tasks').BroadcastProgress>(
      `/tasks/${taskId}/broadcast/members/${userId}`,
    )
    return data
  },

  createBroadcast: async (
    columnId: number,
    dto: {
      name: string
      description?: string | null
      startDate?: string | null
      deadLine?: string | null
      position: number
      memberIds: number[]
      tagIds?: number[]
    },
  ) => {
    const { data } = await axiosAPI.post<Task>(`/columns/${columnId}/tasks/broadcast`, dto)
    return data
  },

  update: async (id: number, dto: UpdateTaskDTO) => {
    const { data } = await axiosAPI.patch<Task>(`/tasks/${id}`, dto)
    return data
  },

  setResponsibles: async (id: number, responsibleIds: number[]) => {
    const { data } = await axiosAPI.put<{ responsibleIds: number[] }>(
      `/tasks/${id}/responsibles`,
      { responsibleIds },
    )
    return data.responsibleIds
  },

  sendBack: async (id: number, comment: string) => {
    const { data } = await axiosAPI.post<Task>(`/tasks/${id}/send-back`, { comment })
    return data
  },

  rejectFromReview: async (id: number, comment: string) => {
    const { data } = await axiosAPI.post<Task>(`/tasks/${id}/reject-from-review`, { comment })
    return data
  },

  delete: async (id: number) => {
    await axiosAPI.delete(`/tasks/${id}`)
  },

  /**
   * Переставить задачу: сразу после `insertAfterTaskId` (null = в начало).
   * Сервер сам пересчитает position по всем задачам колонок.
   */
  placeInColumn: async (
    columnId: number,
    taskId: number,
    params: { insertAfterTaskId: number | null },
  ): Promise<{ autoCompletedParent: { id: number; columnId: number } | null }> => {
    const { data } = await axiosAPI.post<{ autoCompletedParent: { id: number; columnId: number } | null }>(
      `/columns/${columnId}/tasks/${taskId}/place`,
      { insertAfterTaskId: params.insertAfterTaskId },
    )
    return data
  },

  uploadAttachment: async (taskId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await axiosAPI.post<TaskAttachment>(`/tasks/${taskId}/attachments`, formData)
    return data
  },

  deleteAttachment: async (taskId: number, attachmentId: number) => {
    await axiosAPI.delete(`/tasks/${taskId}/attachments/${attachmentId}`)
  },

  getAttachmentBlob: async (taskId: number, attachmentId: number) => {
    const { data } = await axiosAPI.get<Blob>(`/tasks/${taskId}/attachments/${attachmentId}/file`, {
      responseType: 'blob',
    })
    return data
  },

  listComments: async (taskId: number) => {
    const { data } = await axiosAPI.get<TaskComment[]>(`/tasks/${taskId}/comments`)
    return data
  },

  addComment: async (taskId: number, body: string) => {
    const { data } = await axiosAPI.post<TaskComment>(`/tasks/${taskId}/comments`, { body })
    return data
  },

  updateComment: async (taskId: number, commentId: number, body: string) => {
    const { data } = await axiosAPI.patch<TaskComment>(
      `/tasks/${taskId}/comments/${commentId}`,
      { body },
    )
    return data
  },

  deleteComment: async (taskId: number, commentId: number) => {
    await axiosAPI.delete(`/tasks/${taskId}/comments/${commentId}`)
  },

  /** Сводка «Все задачи» с пагинацией и фильтрами (см. GET /tasks/global). */
  getGlobalMyTasks: async (params: {
    page?: number
    pageSize?: number
    organizationId?: number
    departmentId?: number
    bucket?:
      | 'all'
      | 'outgoing'
      | 'incoming'
      | 'review'
      | 'completed'
      | 'overdue'
      | 'organization'
    involvement?: 'all' | 'created' | 'assigned'
    q?: string
    sort?: MyTasksListSortMode
  }) => {
    const { data } = await axiosAPI.get<{
      rows: { task: Task; buckets: string[]; organizationName: string }[]
      total: number
      page: number
      pageSize: number
      hasOrgScopeTask: boolean
      failedOrganizationIds: number[]
    }>('/tasks/global', {
      params: Object.fromEntries(
        Object.entries({
          page: params.page,
          pageSize: params.pageSize,
          organizationId: params.organizationId,
          departmentId: params.departmentId,
          bucket: params.bucket === 'all' || params.bucket == null ? undefined : params.bucket,
          involvement:
            params.involvement === 'all' || params.involvement == null
              ? undefined
              : params.involvement,
          q: params.q,
          sort:
            params.sort === 'deadline_asc' || params.sort === 'deadline_desc'
              ? params.sort
              : undefined,
        }).filter(([, v]) => v != null && v !== ''),
      ),
    })
    return data
  },

  /**
   * Постраничные «Мои задачи» одной организации: только задачи, где пользователь
   * автор или один из исполнителей. Не зависит от роли в организации.
   */
  getMyTasksByOrganizationPaginated: async (
    organizationId: number,
    params: {
      page?: number
      pageSize?: number
      bucket?: 'all' | 'outgoing' | 'incoming' | 'review' | 'completed' | 'overdue'
      q?: string
      sort?: MyTasksListSortMode
    },
  ) => {
    const { data } = await axiosAPI.get<{
      rows: { task: Task; buckets: string[]; organizationName: string }[]
      total: number
      page: number
      pageSize: number
    }>(`/organizations/${organizationId}/my-tasks/page`, {
      params: Object.fromEntries(
        Object.entries({
          page: params.page,
          pageSize: params.pageSize,
          bucket: params.bucket === 'all' || params.bucket == null ? undefined : params.bucket,
          q: params.q,
          sort:
            params.sort === 'deadline_asc' || params.sort === 'deadline_desc'
              ? params.sort
              : undefined,
        }).filter(([, v]) => v != null && v !== ''),
      ),
    })
    return data
  },

  getPipelineCalendarTasks: async (
    pipelineId: number,
    params: { from: string; to: string; filter?: PipelineBoardTaskFilter },
  ) => {
    const { data } = await axiosAPI.get<TaskCalendarItem[]>(
      `/pipelines/${pipelineId}/calendar-tasks`,
      {
        params: {
          from: params.from,
          to: params.to,
          ...pipelineBoardFilterParams(params.filter),
        },
      },
    )
    return data
  },

  getOrganizationCalendarTasks: async (
    organizationId: number,
    params: {
      from: string
      to: string
      scope?: 'mine' | 'org'
      q?: string
      sort?: MyTasksListSortMode
    },
  ) => {
    const { data } = await axiosAPI.get<TaskCalendarItem[]>(
      `/organizations/${organizationId}/calendar-tasks`,
      {
        params: Object.fromEntries(
          Object.entries({
            from: params.from,
            to: params.to,
            scope: params.scope,
            q: params.q,
            sort:
              params.sort === 'deadline_asc' || params.sort === 'deadline_desc'
                ? params.sort
                : undefined,
          }).filter(([, v]) => v != null && v !== ''),
        ),
      },
    )
    return data
  },

  getGlobalCalendarTasks: async (params: {
    from: string
    to: string
    organizationId?: number
    departmentId?: number
    bucket?: string
    involvement?: string
    q?: string
    sort?: string
  }) => {
    const { data } = await axiosAPI.get<TaskCalendarItem[]>(`/tasks/global/calendar`, {
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v != null && v !== ''),
      ),
    })
    return data
  },

  getMyTasksByOrganization: async (
    organizationId: number,
    options?: { scope?: 'mine' | 'org' },
  ) => {
    const { data } = await axiosAPI.get<{
      outgoing: Task[]
      incoming: Task[]
      review: Task[]
      completed: Task[]
      overdue: Task[]
      organization?: Task[]
    }>(
      `/organizations/${organizationId}/my-tasks`,
      options?.scope != null ? { params: { scope: options.scope } } : undefined,
    )
    return {
      ...data,
      organization: data.organization ?? [],
    }
  },
}

