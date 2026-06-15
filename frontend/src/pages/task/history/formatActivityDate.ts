import { format, isValid, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { isTaskDateAllDay, taskDateWallClockHm } from 'shared/lib/taskDateTime'

export function parseActivityDateString(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null

  /** Даты задачи на бэкенде часто как `…T12:00:00.000Z` — показываем календарный день без сдвига TZ. */
  const noonUtc = /^(\d{4})-(\d{2})-(\d{2})T12:00:00(?:\.\d{3})?Z$/i.exec(s)
  if (noonUtc) {
    const y = Number(noonUtc[1])
    const m = Number(noonUtc[2]) - 1
    const day = Number(noonUtc[3])
    const d = new Date(y, m, day)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }

  try {
    const iso = parseISO(s)
    if (isValid(iso)) return iso
  } catch {
    /* ignore */
  }

  const t = new Date(s)
  return Number.isNaN(t.getTime()) ? null : t
}

/**
 * Значение поля в diff активности: человекочитаемые даты для ISO из API.
 */
export function formatActivityDiffValue(
  field: string | undefined,
  value: string | null | undefined,
): string {
  if (value == null || value === '') return '—'

  const trimmed = value.trim()
  const d = parseActivityDateString(trimmed)
  if (!d || !isValid(d)) return value

  if (field === 'startDate' || field === 'deadLine') {
    const trimmed = value.trim()
    if (isTaskDateAllDay(trimmed)) {
      const head = trimmed.split('T')[0]
      const [y, m, day] = head.split('-').map(Number)
      const cal = new Date(y, m - 1, day)
      return format(cal, 'd MMMM yyyy', { locale: ru })
    }
    const hm = taskDateWallClockHm(trimmed)
    const head = trimmed.split('T')[0]
    const [y, m, day] = head.split('-').map(Number)
    const cal = new Date(y, m - 1, day)
    const datePart = format(cal, 'd MMMM yyyy', { locale: ru })
    return hm ? `${datePart}, ${hm}` : datePart
  }
  if (field === 'completedAt') {
    return format(d, 'd MMMM yyyy, HH:mm', { locale: ru })
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const isCalendarDeadline = /^(\d{4})-(\d{2})-(\d{2})T12:00:00(?:\.\d{3})?Z$/i.test(trimmed)
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    if (isCalendarDeadline || isDateOnly) {
      return format(d, 'd MMMM yyyy', { locale: ru })
    }
    return format(d, 'd MMMM yyyy, HH:mm', { locale: ru })
  }

  return value
}

/** Даты в snapshot события `created` (строка из API или YYYY-MM-DD). */
export function formatActivitySnapshotDate(value: unknown): string {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  return formatActivityDiffValue(undefined, s)
}
