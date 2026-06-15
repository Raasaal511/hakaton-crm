import { toYmd, parseYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'

/** Маркер «весь день» в API (полдень UTC = календарный день без времени). */
const ALL_DAY_ISO_RE = /^(\d{4}-\d{2}-\d{2})T12:00:00(?:\.\d{3})?Z$/i

const TIMED_ISO_RE =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i

export function isTaskDateAllDay(iso: string | null | undefined): boolean {
  if (iso == null || iso === '') return true
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true
  return ALL_DAY_ISO_RE.test(trimmed)
}

/** HH:mm из ISO timed — «стенные часы» в части T (как T12:00:00.000Z для all-day). */
export function taskDateWallClockHm(iso: string | null | undefined): string | null {
  if (iso == null || iso === '' || isTaskDateAllDay(iso)) return null
  const trimmed = iso.trim()
  const m = TIMED_ISO_RE.exec(trimmed)
  if (m) {
    const h = Number(m[2])
    const min = Number(m[3])
    if (
      Number.isFinite(h) &&
      Number.isFinite(min) &&
      h >= 0 &&
      h <= 23 &&
      min >= 0 &&
      min <= 59
    ) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
    }
    return null
  }
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${min}`
}

/** Минуты от полуночи для сетки дня (локальный календарный день + стенные часы). */
export function taskScheduleMinutesFromIso(iso: string | null | undefined): number | null {
  const hm = taskDateWallClockHm(iso)
  if (!hm) return null
  const [h, m] = hm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Момент для сравнения «прошло / просрочено» по локальному календарю и стенным часам. */
export function taskTimedLocalMs(iso: string | null | undefined): number | null {
  if (iso == null || iso === '' || isTaskDateAllDay(iso)) return null
  const ymd = taskDateYmd(iso)
  const hm = taskDateWallClockHm(iso)
  if (!ymd || !hm) return null
  const base = parseYmd(ymd)
  if (!base) return null
  const [h, m] = hm.split(':').map(Number)
  base.setHours(h || 0, m || 0, 0, 0)
  return base.getTime()
}

/** Календарный YYYY-MM-DD из ISO. */
export function taskDateYmd(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  const trimmed = iso.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const head = trimmed.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return head ?? ''
  return toYmd(d)
}

/** Локальное HH:mm для форм (совпадает с отображением в календаре). */
export function taskDateLocalTime(iso: string | null | undefined): string | null {
  return taskDateWallClockHm(iso)
}

/**
 * ISO для API: all-day → T12:00:00.000Z;
 * timed → время из пикера записывается в T как есть (без сдвига TZ).
 */
export function buildTaskDateTimeIso(
  ymd: string,
  timeHm: string | null | undefined,
  allDay: boolean,
): string {
  if (!ymd.trim()) return ''
  if (allDay || !timeHm?.trim()) return `${ymd}T12:00:00.000Z`
  const [h, m] = timeHm.split(':').map(Number)
  if (
    !Number.isFinite(h) ||
    !Number.isFinite(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    return `${ymd}T12:00:00.000Z`
  }
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${ymd}T${hh}:${mm}:00.000Z`
}

/** Нормализовать значение формы (YYYY-MM-DD или ISO) в канонический ISO для API. */
export function normalizeTaskDateField(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  const trimmed = value.trim()
  if (/\bNaN\b/i.test(trimmed) || /undefined/i.test(trimmed)) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return `${trimmed}T12:00:00.000Z`
  const ymd = taskDateYmd(trimmed)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  if (isTaskDateAllDay(trimmed)) return `${ymd}T12:00:00.000Z`
  const hm = taskDateWallClockHm(trimmed)
  if (!hm) return `${ymd}T12:00:00.000Z`
  return buildTaskDateTimeIso(ymd, hm, false)
}

export function formatTaskTimeShort(iso: string | null | undefined): string | null {
  const hm = taskDateWallClockHm(iso)
  return hm
}
