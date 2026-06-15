import {
  formatTaskTimeShort,
  isTaskDateAllDay,
  taskDateYmd,
  taskTimedLocalMs,
} from './taskDateTime'

const shortOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

export function formatTaskDatePart(iso: string): string {
  const head = iso.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) {
    const [y, m, d] = head.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', shortOpts)
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('ru-RU', shortOpts)
}

function formatTaskDateTimeLabel(iso: string | null | undefined): string | null {
  if (iso == null || iso === '') return null
  const datePart = formatTaskDatePart(iso)
  const timePart = formatTaskTimeShort(iso)
  return timePart ? `${datePart}, ${timePart}` : datePart
}

/** Календарный день для сравнения «одна дата или период» (API и формы отдают YYYY-MM-DD или ISO). */
export function calendarKeyFromField(v: string | null | undefined): string | null {
  if (v == null || v === '') return null
  const head = v.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Просрочка по календарному дню дедлайна (только `deadLine`), без учёта завершённых и «хвоста» воронки. */
export function isTaskDeadlineOverdue(task: {
  deadLine?: string | null
  completedAt?: string | null
  inPipelineTerminalColumn?: boolean
}): boolean {
  if (task.inPipelineTerminalColumn) return false
  if (task.completedAt != null && task.completedAt !== '') return false
  if (task.deadLine == null || task.deadLine === '') return false
  const now = new Date()
  if (isTaskDateAllDay(task.deadLine)) {
    const d = new Date(task.deadLine)
    if (Number.isNaN(d.getTime())) return false
    const deadlineMidnight = new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    ).getTime()
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    return deadlineMidnight < todayMidnight
  }
  const deadlineMs = taskTimedLocalMs(task.deadLine)
  if (deadlineMs == null) return false
  return deadlineMs < now.getTime()
}

/** «От» и «до» для карточек и списков; просрочка по-прежнему по deadLine. Одна дата — без дублирования. */
export function formatTaskDateRangeShort(task: {
  startDate?: string | null
  deadLine?: string | null
}): string | null {
  const s = formatTaskDateTimeLabel(task.startDate)
  const e = formatTaskDateTimeLabel(task.deadLine)
  if (s && e) {
    const sk = taskDateYmd(task.startDate)
    const ek = taskDateYmd(task.deadLine)
    const sameDay = sk && ek && sk === ek
    const startTime = formatTaskTimeShort(task.startDate)
    const endTime = formatTaskTimeShort(task.deadLine)
    const sameTime = sameDay && startTime === endTime
    if (sameDay && (sameTime || (!startTime && !endTime))) {
      return e
    }
    // Одна дата, разное время → "8 июн., 09:00 — 18:00"
    if (sameDay && startTime && endTime) {
      return `${formatTaskDatePart(task.startDate!)}, ${startTime} — ${endTime}`
    }
    return `${s} — ${e}`
  }
  if (e) return e
  if (s) return s
  return null
}
