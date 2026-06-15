import { calendarKeyFromField, isTaskDeadlineOverdue } from 'shared/lib/formatTaskDateRange'
import {
  formatTaskTimeShort,
  isTaskDateAllDay,
  taskTimedLocalMs,
} from 'shared/lib/taskDateTime'
import { parseYmd, toYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import type { Column } from 'shared/types/columns'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'

export type TodayScheduleTaskLike = {
  id: number
  name: string
  startDate?: string | null
  deadLine?: string | null
  columnId: number
  completedAt?: string | null
  inPipelineTerminalColumn?: boolean
  columnName?: string | null
  columnColor?: string | null
  departmentName?: string | null
}

export type TodayScheduleItem = {
  taskId: number
  name: string
  /** HH:mm или null для all-day */
  timeLabel: string | null
  sortAt: number | null
  columnName: string | null
  columnColor: string | null
  departmentName: string | null
  section: 'timed' | 'allDay'
  isPast: boolean
  isOverdue: boolean
  /** Подпись для all-day: «Весь день» / «В периоде» */
  allDayHint?: string
}

export type TodayScheduleSections = {
  /** Выбранный день — сегодня: показываем «Сейчас» и делим прошлое/будущее */
  isLiveDay: boolean
  pastTimed: TodayScheduleItem[]
  upcomingTimed: TodayScheduleItem[]
  allDay: TodayScheduleItem[]
  totalCount: number
}

export function todayYmd(now: Date = new Date()): string {
  return toYmd(now)
}

function compareYmd(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/** Задача пересекает календарный день dayKey. */
export function taskTouchesDay(
  task: TodayScheduleTaskLike,
  dayKey: string,
): boolean {
  const startKey = calendarKeyFromField(task.startDate)
  const endKey = calendarKeyFromField(task.deadLine)
  if (!startKey && !endKey) return false
  if (startKey && endKey) {
    const lo = compareYmd(startKey, endKey) <= 0 ? startKey : endKey
    const hi = compareYmd(startKey, endKey) <= 0 ? endKey : startKey
    return compareYmd(dayKey, lo) >= 0 && compareYmd(dayKey, hi) <= 0
  }
  const single = startKey ?? endKey
  return single === dayKey
}

/** @deprecated use taskTouchesDay */
export const taskTouchesToday = taskTouchesDay

export function isTaskExcludedFromTodaySchedule(
  task: TodayScheduleTaskLike,
  columns?: Column[],
): boolean {
  if (task.completedAt != null && task.completedAt !== '') return true
  if (task.inPipelineTerminalColumn) return true
  if (columns?.length) {
    if (isTaskInCompletedPipelineColumn(task.columnId, columns)) return true
  }
  return false
}

function parseSortAt(iso: string | null | undefined): number | null {
  if (!iso || isTaskDateAllDay(iso)) return null
  return taskTimedLocalMs(iso)
}

function buildItem(
  task: TodayScheduleTaskLike,
  ctx: {
    dayKey: string
    isLiveDay: boolean
    now: number
    columnName: string | null
    columnColor: string | null
    departmentName: string | null
  },
): TodayScheduleItem | null {
  const { dayKey, isLiveDay, now, columnName, columnColor, departmentName } = ctx
  const startKey = calendarKeyFromField(task.startDate)
  const endKey = calendarKeyFromField(task.deadLine)
  const deadlineOnDay = endKey === dayKey
  const startOnDay = startKey === dayKey

  const deadlineTimed = deadlineOnDay && task.deadLine && !isTaskDateAllDay(task.deadLine)
  const startTimed =
    startOnDay && task.startDate && !isTaskDateAllDay(task.startDate) && !deadlineTimed

  if (deadlineTimed) {
    const sortAt = parseSortAt(task.deadLine)!
    const isPast = isLiveDay && sortAt < now
    return {
      taskId: task.id,
      name: task.name,
      timeLabel: formatTaskTimeShort(task.deadLine),
      sortAt,
      columnName,
      columnColor,
      departmentName,
      section: 'timed',
      isPast,
      isOverdue: isTaskDeadlineOverdue({ deadLine: task.deadLine }),
    }
  }

  if (startTimed) {
    const sortAt = parseSortAt(task.startDate)!
    const isPast = isLiveDay && sortAt < now
    return {
      taskId: task.id,
      name: task.name,
      timeLabel: formatTaskTimeShort(task.startDate),
      sortAt,
      columnName,
      columnColor,
      departmentName,
      section: 'timed',
      isPast,
      isOverdue: false,
    }
  }

  if (!taskTouchesDay(task, dayKey)) return null

  const span =
    startKey && endKey && startKey !== endKey
      ? compareYmd(startKey, endKey) !== 0
      : false

  return {
    taskId: task.id,
    name: task.name,
    timeLabel: null,
    sortAt: null,
    columnName,
    columnColor,
    departmentName,
    section: 'allDay',
    isPast: false,
    isOverdue:
      deadlineOnDay &&
      task.deadLine != null &&
      isTaskDeadlineOverdue({
        deadLine: task.deadLine,
        completedAt: task.completedAt,
        inPipelineTerminalColumn: task.inPipelineTerminalColumn,
      }),
    allDayHint: span ? 'В периоде' : 'Весь день',
  }
}

export function buildDaySchedule(
  tasks: TodayScheduleTaskLike[],
  dayKey: string,
  options?: {
    now?: Date
    columns?: Column[]
    columnById?: Map<number, Column>
  },
): TodayScheduleSections {
  const nowDate = options?.now ?? new Date()
  const isLiveDay = dayKey === todayYmd(nowDate)
  const now = nowDate.getTime()
  const columnById = options?.columnById

  const seen = new Set<number>()
  const pastTimed: TodayScheduleItem[] = []
  const upcomingTimed: TodayScheduleItem[] = []
  const allDay: TodayScheduleItem[] = []

  for (const task of tasks) {
    if (seen.has(task.id)) continue
    if (!taskTouchesDay(task, dayKey)) continue
    if (isTaskExcludedFromTodaySchedule(task, options?.columns)) continue

    const col = columnById?.get(task.columnId)
    const item = buildItem(task, {
      dayKey,
      isLiveDay,
      now,
      columnName: task.columnName ?? col?.name ?? null,
      columnColor: task.columnColor ?? col?.color ?? null,
      departmentName: task.departmentName ?? null,
    })
    if (!item) continue
    seen.add(task.id)

    if (item.section === 'allDay') {
      allDay.push(item)
    } else if (isLiveDay && item.isPast) {
      pastTimed.push(item)
    } else {
      upcomingTimed.push(item)
    }
  }

  const bySort = (a: TodayScheduleItem, b: TodayScheduleItem) =>
    (a.sortAt ?? 0) - (b.sortAt ?? 0)
  pastTimed.sort(bySort)
  upcomingTimed.sort(bySort)
  allDay.sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  return {
    isLiveDay,
    pastTimed,
    upcomingTimed,
    allDay,
    totalCount: pastTimed.length + upcomingTimed.length + allDay.length,
  }
}

/** @deprecated use buildDaySchedule */
export const buildTodaySchedule = buildDaySchedule

export function formatDayScheduleTitle(dayKey: string): string {
  const d = parseYmd(dayKey)
  if (!d) return dayKey
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** @deprecated use formatDayScheduleTitle */
export function formatTodayScheduleTitle(now: Date = new Date()): string {
  return formatDayScheduleTitle(todayYmd(now))
}
