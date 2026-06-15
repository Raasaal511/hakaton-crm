import { useCallback, useMemo, useState } from 'react'
import {
  buildTaskDateTimeIso,
  isTaskDateAllDay,
  taskDateLocalTime,
  taskDateYmd,
} from 'shared/lib/taskDateTime'
import {
  compareCalendarDay,
  formatDayFooterRu,
  formatMonthTitleRu,
  getCalendarCells,
  getEffectiveMinSelectableDay,
  getRangeTrackRole,
  parseYmd,
  sameCalendarDay,
  toYmd,
  WEEKDAY_LABELS_RU_SHORT,
} from './dateRangeUtils'
import { TaskTimeField, TaskTimeModeToggle } from './TaskTimeField'
import styles from './TaskDateRangePicker.module.css'

export type TaskDateRangePickerProps = {
  /** ISO datetime, YYYY-MM-DD или пустая строка */
  startValue: string
  /** ISO datetime, YYYY-MM-DD или пустая строка */
  endValue: string
  onApply: (start: string | null, end: string | null) => void
  onDismiss: () => void
  className?: string
}

const DEFAULT_START_TIME = '09:00'
const DEFAULT_END_TIME = '18:00'

function initialAllDay(startValue: string, endValue: string): boolean {
  const hasStart = Boolean(startValue?.trim())
  const hasEnd = Boolean(endValue?.trim())
  if (!hasStart && !hasEnd) return true
  if (hasStart && !isTaskDateAllDay(startValue)) return false
  if (hasEnd && !isTaskDateAllDay(endValue)) return false
  return true
}

export function TaskDateRangePicker({
  startValue,
  endValue,
  onApply,
  onDismiss,
  className,
}: TaskDateRangePickerProps) {
  const initialFrom = parseYmd(taskDateYmd(startValue))
  const initialTo = parseYmd(taskDateYmd(endValue))

  const [viewYear, setViewYear] = useState(() => {
    const d = initialFrom ?? initialTo ?? new Date()
    return d.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = initialFrom ?? initialTo ?? new Date()
    return d.getMonth()
  })

  const [range, setRange] = useState<{ from: Date | null; to: Date | null }>({
    from: initialFrom,
    to: initialTo,
  })
  const from = range.from
  const to = range.to

  const [allDay, setAllDay] = useState(() => initialAllDay(startValue, endValue))
  const [startTime, setStartTime] = useState(
    () => taskDateLocalTime(startValue) ?? DEFAULT_START_TIME,
  )
  const [endTime, setEndTime] = useState(
    () => taskDateLocalTime(endValue) ?? DEFAULT_END_TIME,
  )

  const cells = useMemo(
    () => getCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  const onDayClick = useCallback((day: Date) => {
    setRange(({ from: prevFrom, to: prevTo }) => {
      const minDay = getEffectiveMinSelectableDay(new Date(), prevFrom, prevTo)
      if (compareCalendarDay(day, minDay) < 0) {
        return { from: prevFrom, to: prevTo }
      }
      if (!prevFrom || (prevFrom && prevTo)) {
        return { from: day, to: null }
      }
      if (compareCalendarDay(day, prevFrom) < 0) {
        return { from: day, to: prevFrom }
      }
      return { from: prevFrom, to: day }
    })
  }, [])

  const handleSave = () => {
    if (!from) {
      onApply(null, null)
      onDismiss()
      return
    }
    const endDay = to ?? from
    const startYmd = toYmd(from)
    const endYmd = toYmd(endDay)
    if (!startYmd || !endYmd) return

    const startIso = buildTaskDateTimeIso(startYmd, startTime, allDay)
    const endIso = buildTaskDateTimeIso(endYmd, endTime, allDay)
    onApply(startIso, endIso)
    onDismiss()
  }

  const handleCancel = () => {
    onDismiss()
  }

  const prevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const nextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const minSelectableDay = getEffectiveMinSelectableDay(new Date(), from, to)

  const footerStart = from ? formatDayFooterRu(from) : '—'
  const footerEnd = to ? formatDayFooterRu(to) : from ? formatDayFooterRu(from) : '—'
  const singleDaySelected =
    from != null && (to == null || sameCalendarDay(from, to))

  const footerTimeSuffix = !allDay && from ? ` · ${startTime} — ${endTime}` : ''

  const footerRangeLabel = !from
    ? 'Выберите даты'
    : singleDaySelected
      ? `${footerStart}${footerTimeSuffix}`
      : `${footerStart} — ${footerEnd}${footerTimeSuffix}`

  const rootClass = className ? `${styles.popover} ${className}` : styles.popover

  return (
    <div className={rootClass} role="dialog" aria-label="Выбор периода">
      <div className={styles.header}>
        <span className={styles.monthLabel}>
          {formatMonthTitleRu(viewYear, viewMonth)}
        </span>
        <div className={styles.navGroup}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={prevMonth}
            aria-label="Предыдущий месяц"
          >
            ‹
          </button>
          <button
            type="button"
            className={styles.navBtn}
            onClick={nextMonth}
            aria-label="Следующий месяц"
          >
            ›
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
          const role = getRangeTrackRole(date, from, to)
          const trackClasses = [styles.track]
          if (role === 'single') trackClasses.push(styles.trackSingle)
          else if (role === 'start') trackClasses.push(styles.trackStart)
          else if (role === 'end') trackClasses.push(styles.trackEnd)
          else if (role === 'middle') trackClasses.push(styles.trackMiddle)

          const capClass =
            role === 'single'
              ? styles.capSingle
              : role === 'start'
                ? styles.capStart
                : role === 'end'
                  ? styles.capEnd
                  : ''

          const isBeforeMin = compareCalendarDay(date, minSelectableDay) < 0

          return (
            <button
              key={toYmd(date)}
              type="button"
              disabled={isBeforeMin}
              title={isBeforeMin ? 'Нельзя выбрать прошедшую дату' : undefined}
              className={[
                styles.cell,
                outside ? styles.cellOutside : '',
                capClass,
                isBeforeMin ? styles.cellDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onDayClick(date)}
            >
              {role !== 'none' && <span className={trackClasses.join(' ')} />}
              <span className={styles.dayNum}>{date.getDate()}</span>
            </button>
          )
        })}
      </div>

      {from ? (
        <div className={styles.timeSection}>
          <TaskTimeModeToggle allDay={allDay} onChange={setAllDay} />
          {!allDay ? (
            <div className={styles.timeFieldsStack}>
              <TaskTimeField
                label="Начало"
                value={startTime}
                onChange={setStartTime}
              />
              <TaskTimeField
                label="Окончание"
                value={endTime}
                onChange={setEndTime}
              />
            </div>
          ) : (
            <p className={styles.timeSectionHint}>Без указания времени</p>
          )}
        </div>
      ) : (
        <div className={`${styles.timeSection} ${styles.timeSectionPlaceholder}`}>
          <TaskTimeModeToggle allDay={allDay} onChange={setAllDay} disabled />
          <p className={styles.timeSectionHint}>Выберите день в календаре</p>
        </div>
      )}

      <div className={styles.footerRow}>
        <div
          className={styles.footer}
          title={
            singleDaySelected
              ? `Дата: ${footerStart}${footerTimeSuffix}`
              : `Начало: ${footerStart}, конец: ${footerEnd}${footerTimeSuffix}`
          }
        >
          {footerRangeLabel}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={handleCancel}>
            Отмена
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            Сохранить
          </button>
        </div>
      </div>
    </div>
  )
}
