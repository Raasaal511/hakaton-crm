/** Локальный календарный день → YYYY-MM-DD */
export function toYmd(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseYmd(s: string): Date | null {
  if (!s.trim()) return null
  const [y, m, d] = s.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Начало календарного дня (локально). */
export function startOfCalendarDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Сегодняшний день (локально). */
export function startOfToday(): Date {
  return startOfCalendarDay(new Date())
}

/**
 * Минимально допустимый день выбора: не раньше сегодня, но если в диапазоне уже есть
 * даты в прошлом (сохранённый срок) — не раньше самой ранней из них, чтобы можно было править.
 */
export function getEffectiveMinSelectableDay(
  today: Date,
  from: Date | null,
  to: Date | null,
): Date {
  const t = startOfCalendarDay(today).getTime()
  const times = [t]
  if (from) times.push(startOfCalendarDay(from).getTime())
  if (to) times.push(startOfCalendarDay(to).getTime())
  return new Date(Math.min(...times))
}

/** Сравнение только по календарной дате, −1 / 0 / 1 */
export function compareCalendarDay(a: Date, b: Date): number {
  const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return x === y ? 0 : x < y ? -1 : 1
}

const MONTHS_RU = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const

export const WEEKDAY_LABELS_RU_SHORT = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'] as const

export function formatMonthTitleRu(year: number, monthIndex: number): string {
  return `${MONTHS_RU[monthIndex]} ${year}`
}

export function formatDayFooterRu(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

/** Понедельный старт недели, сетка до 6×7 */
export function getCalendarCells(
  year: number,
  monthIndex: number,
): { date: Date; outside: boolean }[] {
  const first = new Date(year, monthIndex, 1)
  const mondayOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, monthIndex, 1 - mondayOffset)
  const cells: { date: Date; outside: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    cells.push({
      date,
      outside: date.getMonth() !== monthIndex,
    })
  }
  return trimTrailingWeeksOutsideMonth(cells, monthIndex, year)
}

/** Убирает нижние недели, где все дни уже из следующего месяца — меньше высоты */
function trimTrailingWeeksOutsideMonth(
  cells: { date: Date; outside: boolean }[],
  monthIndex: number,
  year: number,
): { date: Date; outside: boolean }[] {
  let result = cells
  while (result.length >= 7) {
    const chunk = result.slice(-7)
    const allOutsideShownMonth = chunk.every(
      (c) => c.date.getFullYear() !== year || c.date.getMonth() !== monthIndex,
    )
    if (allOutsideShownMonth) {
      result = result.slice(0, -7)
    } else {
      break
    }
  }
  return result
}


export type RangeTrackRole = 'none' | 'single' | 'start' | 'end' | 'middle'

export function getRangeTrackRole(
  day: Date,
  from: Date | null,
  to: Date | null,
): RangeTrackRole {
  if (!from) return 'none'
  const end = to ?? from
  if (sameCalendarDay(from, end)) {
    return sameCalendarDay(day, from) ? 'single' : 'none'
  }
  if (compareCalendarDay(day, from) < 0 || compareCalendarDay(day, end) > 0) {
    return 'none'
  }
  if (sameCalendarDay(day, from)) return 'start'
  if (sameCalendarDay(day, end)) return 'end'
  return 'middle'
}
