import { useQuery } from '@tanstack/react-query'
import { tasksAPI } from 'shared/api/requests/tasks'
import type { PipelineBoardTaskFilter } from 'shared/types/tasks'
import type { MyTasksListSortMode } from 'shared/lib/taskListSort'
import { getVisibleCalendarRange } from './taskCalendarPlacement'
import type { CalendarDisplayMode, TaskCalendarItem } from './types'

export type CalendarQueryScope =
  | { type: 'pipeline'; pipelineId: number; filter?: PipelineBoardTaskFilter }
  | {
      type: 'organization'
      organizationId: number
      scope?: 'mine' | 'org'
      q?: string
      sort?: MyTasksListSortMode
    }
  | {
      type: 'global'
      organizationId?: number
      departmentId?: number
      bucket?: string
      involvement?: string
      q?: string
      sort?: string
    }

function calendarQueryKey(
  scope: CalendarQueryScope,
  from: string,
  to: string,
  displayMode: CalendarDisplayMode,
) {
  return ['calendar-tasks', scope, displayMode, from, to] as const
}

export function useCalendarMonthQuery(
  anchor: Date,
  scope: CalendarQueryScope | null,
  displayMode: CalendarDisplayMode = 'month',
) {
  const range = getVisibleCalendarRange(anchor, displayMode)

  return useQuery({
    queryKey: scope
      ? calendarQueryKey(scope, range.from, range.to, displayMode)
      : ['calendar-tasks', 'idle'],
    enabled: scope != null,
    queryFn: async (): Promise<TaskCalendarItem[]> => {
      if (!scope) return []
      if (scope.type === 'pipeline') {
        return tasksAPI.getPipelineCalendarTasks(scope.pipelineId, {
          from: range.from,
          to: range.to,
          filter: scope.filter,
        })
      }
      if (scope.type === 'organization') {
        return tasksAPI.getOrganizationCalendarTasks(scope.organizationId, {
          from: range.from,
          to: range.to,
          scope: scope.scope,
          q: scope.q,
          sort: scope.sort,
        })
      }
      return tasksAPI.getGlobalCalendarTasks({
        from: range.from,
        to: range.to,
        organizationId: scope.organizationId,
        departmentId: scope.departmentId,
        bucket: scope.bucket,
        involvement: scope.involvement,
        q: scope.q,
        sort: scope.sort,
      })
    },
    staleTime: 30_000,
  })
}

export function calendarMonthQueryKey(
  scope: CalendarQueryScope,
  anchor: Date,
  displayMode: CalendarDisplayMode = 'month',
) {
  const range = getVisibleCalendarRange(anchor, displayMode)
  return calendarQueryKey(scope, range.from, range.to, displayMode)
}
