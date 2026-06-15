import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tasksAPI } from 'shared/api/requests/tasks'
import {
  buildDaySchedule,
  formatDayScheduleTitle,
  type TodayScheduleSections,
  type TodayScheduleTaskLike,
} from 'shared/lib/taskTodaySchedule'
import type { Column } from 'shared/types/columns'
import type { Task } from 'shared/types/tasks'
import type { TaskCalendarItem } from 'features/calendar/types'
import type { CalendarQueryScope } from 'features/calendar/useCalendarMonthQuery'

export type TodayScheduleScope =
  | {
      type: 'pipeline'
      tasks: Task[]
      columns: Column[]
    }
  | {
      type: 'calendar'
      scope: CalendarQueryScope
    }
  | {
      type: 'static'
      tasks: TodayScheduleTaskLike[]
      columns?: Column[]
    }

export function calendarItemToScheduleTask(item: TaskCalendarItem): TodayScheduleTaskLike {
  return {
    id: item.id,
    name: item.name,
    startDate: item.startDate,
    deadLine: item.deadLine,
    columnId: item.columnId,
    completedAt: item.completedAt,
    inPipelineTerminalColumn: item.inPipelineTerminalColumn,
    columnName: item.columnName,
    columnColor: item.columnColor,
    departmentName: item.departmentName,
  }
}

function dayCalendarQueryKey(scope: CalendarQueryScope, dayYmd: string) {
  return ['calendar-tasks-day', scope, dayYmd] as const
}

async function fetchDayCalendarTasks(
  scope: CalendarQueryScope,
  dayYmd: string,
): Promise<TaskCalendarItem[]> {
  if (scope.type === 'pipeline') {
    return tasksAPI.getPipelineCalendarTasks(scope.pipelineId, {
      from: dayYmd,
      to: dayYmd,
      filter: scope.filter,
    })
  }
  if (scope.type === 'organization') {
    return tasksAPI.getOrganizationCalendarTasks(scope.organizationId, {
      from: dayYmd,
      to: dayYmd,
      scope: scope.scope,
      q: scope.q,
      sort: scope.sort,
    })
  }
  return tasksAPI.getGlobalCalendarTasks({
    from: dayYmd,
    to: dayYmd,
    organizationId: scope.organizationId,
    departmentId: scope.departmentId,
    bucket: scope.bucket,
    involvement: scope.involvement,
    q: scope.q,
    sort: scope.sort,
  })
}

export function useDaySchedule(
  scope: TodayScheduleScope | null,
  dayYmd: string,
  options?: { enabled?: boolean },
): {
  sections: TodayScheduleSections
  loading: boolean
  dayLabel: string
} {
  const enabled = options?.enabled !== false && scope != null && dayYmd.length > 0

  const calendarScope = scope?.type === 'calendar' ? scope.scope : null

  const query = useQuery({
    queryKey:
      calendarScope != null
        ? dayCalendarQueryKey(calendarScope, dayYmd)
        : ['calendar-tasks-day', 'idle'],
    enabled: enabled && scope?.type === 'calendar',
    queryFn: () => fetchDayCalendarTasks(calendarScope!, dayYmd),
    staleTime: 30_000,
  })

  const sections = useMemo((): TodayScheduleSections => {
    if (!scope || !dayYmd) {
      return {
        isLiveDay: false,
        pastTimed: [],
        upcomingTimed: [],
        allDay: [],
        totalCount: 0,
      }
    }

    if (scope.type === 'pipeline') {
      const columnById = new Map(scope.columns.map((c) => [c.id, c]))
      return buildDaySchedule(scope.tasks, dayYmd, {
        columns: scope.columns,
        columnById,
      })
    }

    if (scope.type === 'static') {
      const columnById = scope.columns
        ? new Map(scope.columns.map((c) => [c.id, c]))
        : undefined
      return buildDaySchedule(scope.tasks, dayYmd, {
        columns: scope.columns,
        columnById,
      })
    }

    const items = (query.data ?? []).map(calendarItemToScheduleTask)
    return buildDaySchedule(items, dayYmd)
  }, [scope, dayYmd, query.data])

  const loading = scope?.type === 'calendar' && query.isPending

  return {
    sections,
    loading,
    dayLabel: formatDayScheduleTitle(dayYmd),
  }
}

/** @deprecated use useDaySchedule */
export const useTodaySchedule = useDaySchedule
