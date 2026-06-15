import { useMemo, useState } from 'react'
import { cn } from 'shared/lib'
import {
  formatMonthTitleRu,
  getCalendarCells,
  parseYmd,
  sameCalendarDay,
  toYmd,
  WEEKDAY_LABELS_RU_SHORT,
} from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import styles from './TaskCalendarMonthJump.module.css'

export type TaskCalendarMonthJumpProps = {
  year: number
  monthIndex: number
  today: Date
  selectedYmd: string | null
  onPickDay: (date: Date) => void
}

export function TaskCalendarMonthJump({
  year,
  monthIndex,
  today,
  selectedYmd,
  onPickDay,
}: TaskCalendarMonthJumpProps) {
  const [viewYear, setViewYear] = useState(year)
  const [viewMonth, setViewMonth] = useState(monthIndex)

  const cells = useMemo(() => getCalendarCells(viewYear, viewMonth), [viewYear, viewMonth])
  const selectedDate = selectedYmd ? parseYmd(selectedYmd) : null

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const shiftYear = (delta: number) => {
    setViewYear((y) => y + delta)
  }

  return (
    <div className={styles.popover} role="dialog" aria-label="Перейти к дате">
      <div className={styles.header}>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={cn(styles.navBtn, styles.navBtnYear)}
            onClick={() => shiftYear(-1)}
            aria-label="На год назад"
          >
            «
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => shiftMonth(-1)}
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
        </div>
        <span className={styles.monthLabel}>{formatMonthTitleRu(viewYear, viewMonth)}</span>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => shiftMonth(1)}
            aria-label="Следующий месяц"
          >
            ›
          </button>
          <button
            type="button"
            className={cn(styles.navBtn, styles.navBtnYear)}
            onClick={() => shiftYear(1)}
            aria-label="На год вперёд"
          >
            »
          </button>
        </div>
      </div>

      <div className={styles.monthGrid}>
        {WEEKDAY_LABELS_RU_SHORT.map((w) => (
          <div key={w} className={styles.weekday}>
            {w}
          </div>
        ))}
        {cells.map(({ date, outside }) => {
          const isToday = sameCalendarDay(date, today)
          const isSelected = selectedDate != null && sameCalendarDay(date, selectedDate)

          return (
            <button
              key={toYmd(date)}
              type="button"
              className={cn(
                styles.cell,
                outside && styles.cellOutside,
                isToday && styles.cellToday,
                isSelected && styles.cellSelected,
              )}
              onClick={() => onPickDay(date)}
            >
              <span className={styles.dayNum}>{date.getDate()}</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
