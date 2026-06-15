export type CalendarDisplayMode = 'month' | 'week' | 'day'

export type TaskCalendarItem = {
  id: number
  name: string
  startDate?: string | null
  deadLine?: string | null
  columnId: number
  columnName?: string | null
  columnColor?: string | null
  completedAt?: string | null
  inPipelineTerminalColumn?: boolean
  departmentId?: number
  departmentName?: string | null
}

export type TaskCalendarDayChip = {
  task: TaskCalendarItem
  showTitle: boolean
}

/** Сегмент полосы задачи с периодом «от–до» внутри одной недели сетки */
export type TaskCalendarRangeSegment = {
  task: TaskCalendarItem
  weekIndex: number
  startCol: number
  endCol: number
  row: number
  showLabel: boolean
}

export type CalendarGridCell = { date: Date; outside: boolean }

export type TaskCalendarPlacement = {
  chipsByDay: Map<string, TaskCalendarDayChip[]>
  tasksByDay: Map<string, TaskCalendarItem[]>
  rangeSegments: TaskCalendarRangeSegment[]
}
