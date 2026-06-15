import { readNaiveTimestampUtcOffsetHours } from '../infra/database/drizzle/appTimestamp.js'

const ALL_DAY_ISO_RE = /^(\d{4}-\d{2}-\d{2})T12:00:00(?:\.\d{3})?Z$/i

/** Стенные часы в T (как на фронте); Z или offset опциональны. */
const TIMED_WALL_ISO_RE =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i

const CORRUPT_DATE_RE = /\bNaN\b|undefined/i

function pad2(n: number): string {
    return String(n).padStart(2, '0')
}

function offsetSuffix(): string {
    const h = readNaiveTimestampUtcOffsetHours()
    const sign = h >= 0 ? '+' : '-'
    return `${sign}${pad2(Math.abs(h))}:00`
}

/** Маркер «весь день» (Date после appTimestamp / API T12:00:00.000Z). */
export function isTaskDateAllDay(deadLine: Date): boolean {
    const off = readNaiveTimestampUtcOffsetHours()
    return (
        deadLine.getUTCMinutes() === 0 &&
        deadLine.getUTCSeconds() === 0 &&
        deadLine.getUTCMilliseconds() === 0 &&
        deadLine.getUTCHours() + off === 12
    )
}

function wallClockFromInstant(d: Date): { y: number; mo: number; day: number; h: number; mi: number } {
    const off = readNaiveTimestampUtcOffsetHours()
    const shifted = new Date(
        Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate(),
            d.getUTCHours() + off,
            d.getUTCMinutes(),
            d.getUTCSeconds(),
            d.getUTCMilliseconds(),
        ),
    )
    return {
        y: shifted.getUTCFullYear(),
        mo: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        h: shifted.getUTCHours(),
        mi: shifted.getUTCMinutes(),
    }
}

function isFiniteWallParts(parts: { y: number; mo: number; day: number; h?: number; mi?: number }): boolean {
    const { y, mo, day, h, mi } = parts
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return false
    if (mo < 1 || mo > 12 || day < 1 || day > 31) return false
    if (h != null && (!Number.isFinite(h) || h < 0 || h > 23)) return false
    if (mi != null && (!Number.isFinite(mi) || mi < 0 || mi > 59)) return false
    return true
}

/** Date (из БД) → ISO для API: стенные часы в части T, как на фронте. */
export function formatTaskDateTimeForApi(d: Date | null | undefined): string | null {
    if (d == null || Number.isNaN(d.getTime())) return null
    if (isTaskDateAllDay(d)) {
        const parts = wallClockFromInstant(d)
        if (!isFiniteWallParts(parts)) return null
        const { y, mo, day } = parts
        return `${y}-${pad2(mo)}-${pad2(day)}T12:00:00.000Z`
    }
    const parts = wallClockFromInstant(d)
    if (!isFiniteWallParts(parts)) return null
    const { y, mo, day, h, mi } = parts
    return `${y}-${pad2(mo)}-${pad2(day)}T${pad2(h)}:${pad2(mi)}:00.000Z`
}

/** ISO из API → Date для записи в naive timestamp (Москва); null если не разобрать. */
export function parseTaskDateTimeFromApi(value: string): Date | null {
    const trimmed = value.trim()
    if (!trimmed || CORRUPT_DATE_RE.test(trimmed)) return null
    if (ALL_DAY_ISO_RE.test(trimmed)) {
        const head = trimmed.split('T')[0]!
        const [y, mo, day] = head.split('-').map(Number)
        if (!isFiniteWallParts({ y, mo, day })) return null
        const parsed = new Date(`${head}T12:00:00${offsetSuffix()}`)
        return isValidTaskDate(parsed) ? parsed : null
    }
    const m = TIMED_WALL_ISO_RE.exec(trimmed)
    if (m) {
        const y = Number(m[1])
        const mo = Number(m[2])
        const day = Number(m[3])
        const h = Number(m[4])
        const mi = Number(m[5])
        if (!isFiniteWallParts({ y, mo, day, h, mi })) return null
        const parsed = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${offsetSuffix()}`)
        return isValidTaskDate(parsed) ? parsed : null
    }
    if (/^\d{4}-\d{2}-\d{2}T/i.test(trimmed)) return null
    const parsed = new Date(trimmed)
    return isValidTaskDate(parsed) ? parsed : null
}

export function isValidTaskDate(d: Date | null | undefined): d is Date {
    return d != null && !Number.isNaN(d.getTime())
}

/** Просрочка: all-day — по календарному дню, с временем — по локальному моменту стенных часов. */
export function isTaskDeadlineOverdue(deadLine: Date, now: Date = new Date()): boolean {
    if (isTaskDateAllDay(deadLine)) {
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const { y, mo, day } = wallClockFromInstant(deadLine)
        const deadlineMidnight = new Date(y, mo - 1, day).getTime()
        return deadlineMidnight < todayMidnight
    }
    const { y, mo, day, h, mi } = wallClockFromInstant(deadLine)
    const deadlineMs = new Date(y, mo - 1, day, h, mi, 0, 0).getTime()
    return deadlineMs < now.getTime()
}
