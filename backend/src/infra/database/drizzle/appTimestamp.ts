import { customType } from 'drizzle-orm/pg-core'

export function readNaiveTimestampUtcOffsetHours(): number {
  const raw = process.env.DB_NAIVE_TIMESTAMP_UTC_OFFSET_HOURS
  if (raw === undefined || raw === '') return 3
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : 3
}

/** Значение из PostgreSQL `timestamp without time zone` (Drizzle иначе дописывает +0000). */
function mapNaiveTimestampFromDriver(val: unknown): Date {
  if (val instanceof Date) return val
  if (val == null) return val as unknown as Date
  const s = String(val).trim()
  if (!s) return new Date(NaN)
  const iso = s.includes('T') ? s : s.replace(' ', 'T')
  if (/[zZ]$/.test(iso)) {
    return new Date(iso)
  }
  if (/[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso)
  }
  if (/[+-]\d{4}$/.test(iso)) {
    return new Date(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  }
  const h = readNaiveTimestampUtcOffsetHours()
  const absH = Math.abs(h)
  const sign = h >= 0 ? '+' : '-'
  const off = `${sign}${String(absH).padStart(2, '0')}:00`
  return new Date(`${iso}${off}`)
}

/** Instant → строка naive timestamp (календарные часы в поясе БД, по умолчанию UTC+3). */
export function dateInstantToNaiveDriverString(value: Date): string | null {
  if (Number.isNaN(value.getTime())) return null
  const h = readNaiveTimestampUtcOffsetHours()
  const shifted = new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours() + h,
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  )
  const y = shifted.getUTCFullYear()
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  const ss = String(shifted.getUTCSeconds()).padStart(2, '0')
  return `${y}-${mo}-${day} ${hh}:${mm}:${ss}`
}

/**
 * Замена `timestamp()` из drizzle: корректный `mapFromDriverValue` для наивных меток.
 * SQL-тип остаётся `timestamp`, миграции не меняются.
 */
export const appTimestamp = customType<{ data: Date; driverData: string }>({
  dataType() {
    return 'timestamp'
  },
  fromDriver(value) {
    return mapNaiveTimestampFromDriver(value)
  },
  toDriver(value) {
    if (value == null) return null as unknown as string
    if (value instanceof Date) {
      const s = dateInstantToNaiveDriverString(value)
      return (s ?? null) as unknown as string
    }
    return value as string
  },
})
