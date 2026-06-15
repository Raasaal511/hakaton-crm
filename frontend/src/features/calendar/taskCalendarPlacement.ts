import { calendarKeyFromField } from 'shared/lib/formatTaskDateRange'
import {
  compareCalendarDay,
  getCalendarCells,
  parseYmd,
  toYmd,
} from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import type {
  CalendarDisplayMode,
  CalendarGridCell,
  TaskCalendarDayChip,
  TaskCalendarItem,
  TaskCalendarPlacement,
  TaskCalendarRangeSegment,
} from './types'

const MAX_CHIPS_PER_DAY = 3

function compareYmd(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

function enumerateYmdKeys(startKey: string, endKey: string): string[] {
  const start = parseYmd(startKey)
  const end = parseYmd(endKey)
  if (!start || !end) return []
  const keys: string[] = []
  const cursor = new Date(start)
  while (compareCalendarDay(cursor, end) <= 0) {
    keys.push(toYmd(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

export function splitCellsIntoWeeks(cells: CalendarGridCell[]): CalendarGridCell[][] {
  const weeks: CalendarGridCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }
  return weeks
}

function assignBarRows(segments: TaskCalendarRangeSegment[]): void {
  const byWeek = new Map<number, TaskCalendarRangeSegment[]>()
  for (const seg of segments) {
    const list = byWeek.get(seg.weekIndex) ?? []
    list.push(seg)
    byWeek.set(seg.weekIndex, list)
  }

  for (const list of byWeek.values()) {
    list.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol)
    const rowEnds: number[] = []
    for (const seg of list) {
      let row = 0
      while (row < rowEnds.length && seg.startCol <= rowEnds[row]!) {
        row++
      }
      seg.row = row
      rowEnds[row] = seg.endCol
    }
  }
}

function buildRangeSegments(
  weeks: CalendarGridCell[][],
  tasks: TaskCalendarItem[],
): TaskCalendarRangeSegment[] {
  const segments: TaskCalendarRangeSegment[] = []
  const labelShown = new Set<number>()

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex]!
    const weekYmds = week.map((c) => toYmd(c.date))

    for (const task of tasks) {
      const startKey = calendarKeyFromField(task.startDate)
      const endKey = calendarKeyFromField(task.deadLine)
      if (!startKey || !endKey || startKey === endKey) continue

      const rangeStart = startKey
      const rangeEnd = endKey

      let startCol = -1
      let endCol = -1
      for (let col = 0; col < weekYmds.length; col++) {
        const ymd = weekYmds[col]!
        if (compareYmd(ymd, rangeStart) >= 0 && compareYmd(ymd, rangeEnd) <= 0) {
          if (startCol < 0) startCol = col
          endCol = col
        }
      }

      if (startCol < 0) continue

      segments.push({
        task,
        weekIndex,
        startCol,
        endCol,
        row: 0,
        showLabel: !labelShown.has(task.id),
      })
      labelShown.add(task.id)
    }
  }

  assignBarRows(segments)
  return segments
}

export function buildTaskCalendarPlacement(
  tasks: TaskCalendarItem[],
  cells: CalendarGridCell[],
): TaskCalendarPlacement {
  const chipsByDay = new Map<string, TaskCalendarDayChip[]>()
  const tasksByDay = new Map<string, TaskCalendarItem[]>()

  const pushTaskOnDay = (ymd: string, task: TaskCalendarItem) => {
    const list = tasksByDay.get(ymd) ?? []
    if (!list.some((t) => t.id === task.id)) {
      list.push(task)
      tasksByDay.set(ymd, list)
    }
  }

  const pushChip = (ymd: string, chip: TaskCalendarDayChip) => {
    const list = chipsByDay.get(ymd) ?? []
    if (list.some((c) => c.task.id === chip.task.id)) return
    list.push(chip)
    chipsByDay.set(ymd, list)
  }

  for (const task of tasks) {
    const startKey = calendarKeyFromField(task.startDate)
    const endKey = calendarKeyFromField(task.deadLine)
    if (!startKey && !endKey) continue

    const rangeStart = startKey ?? endKey!
    const rangeEnd = endKey ?? startKey!

    for (const ymd of enumerateYmdKeys(rangeStart, rangeEnd)) {
      pushTaskOnDay(ymd, task)
    }

    if (rangeStart === rangeEnd) {
      pushChip(rangeStart, { task, showTitle: true })
    }
  }

  const weeks = splitCellsIntoWeeks(cells)
  const rangeSegments = buildRangeSegments(weeks, tasks)

  return { chipsByDay, tasksByDay, rangeSegments }
}

export function getVisibleChipsForDay(
  chips: TaskCalendarDayChip[] | undefined,
  max = MAX_CHIPS_PER_DAY,
): { visible: TaskCalendarDayChip[]; overflow: number } {
  if (!chips?.length) return { visible: [], overflow: 0 }
  if (chips.length <= max) return { visible: chips, overflow: 0 }
  return { visible: chips.slice(0, max), overflow: chips.length - max }
}

export function getSegmentsForWeek(
  segments: TaskCalendarRangeSegment[],
  weekIndex: number,
): TaskCalendarRangeSegment[] {
  return segments
    .filter((s) => s.weekIndex === weekIndex)
    .sort((a, b) => a.row - b.row || a.startCol - b.startCol)
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset)
  return d
}

export function getWeekCells(anchor: Date): CalendarGridCell[] {
  const weekStart = startOfWeekMonday(anchor)
  const focusMonth = anchor.getMonth()
  const focusYear = anchor.getFullYear()
  const cells: CalendarGridCell[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + i)
    cells.push({
      date,
      outside: date.getMonth() !== focusMonth || date.getFullYear() !== focusYear,
    })
  }
  return cells
}

const MONTHS_RU_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

export function formatDayTitleRu(anchor: Date): string {
  return `${anchor.getDate()} ${MONTHS_RU_GENITIVE[anchor.getMonth()]} ${anchor.getFullYear()}`
}

export function formatWeekTitleRu(anchor: Date): string {
  const cells = getWeekCells(anchor)
  const start = cells[0]!.date
  const end = cells[6]!.date
  const y = start.getFullYear()

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_RU_GENITIVE[start.getMonth()]} ${y}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} ${MONTHS_RU_GENITIVE[start.getMonth()]} – ${end.getDate()} ${MONTHS_RU_GENITIVE[end.getMonth()]} ${y}`
  }
  return `${start.getDate()} ${MONTHS_RU_GENITIVE[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()} ${MONTHS_RU_GENITIVE[end.getMonth()]} ${end.getFullYear()}`
}

export function getVisibleCalendarRange(
  anchor: Date,
  mode: CalendarDisplayMode = 'month',
): { from: string; to: string } {
  if (mode === 'day') {
    const ymd = toYmd(anchor)
    return { from: ymd, to: ymd }
  }

  if (mode === 'week') {
    const cells = getWeekCells(anchor)
    return { from: toYmd(cells[0]!.date), to: toYmd(cells[6]!.date) }
  }

  const year = anchor.getFullYear()
  const monthIndex = anchor.getMonth()
  const cells = getCalendarCells(year, monthIndex)
  if (!cells.length) {
    const from = toYmd(new Date(year, monthIndex, 1))
    return { from, to: from }
  }
  return { from: toYmd(cells[0]!.date), to: toYmd(cells[cells.length - 1]!.date) }
}
