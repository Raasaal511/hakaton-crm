import { useState, type MouseEvent } from 'react'
import { formatTaskDateRangeShort } from 'shared/lib/formatTaskDateRange'
import { TaskDateRangePopover } from './TaskDateRangePopover'
import styles from './TaskDateRangeToolbarPill.module.css'

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export type TaskDateRangeToolbarPillProps = {
  startValue: string
  endValue: string
  onApply: (start: string | null, end: string | null) => void
  /** Подпись, когда срок не задан */
  emptyLabel?: string
}

export function TaskDateRangeToolbarPill({
  startValue,
  endValue,
  onApply,
  emptyLabel = 'Даты',
}: TaskDateRangeToolbarPillProps) {
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [datePickerKey, setDatePickerKey] = useState(0)

  const dateRangeLabel = formatTaskDateRangeShort({
    startDate: startValue || null,
    deadLine: endValue || null,
  })
  const hasDateRange = Boolean(startValue || endValue)

  const togglePopover = () => {
    setDateRangeOpen((was) => {
      if (!was) setDatePickerKey((k) => k + 1)
      return !was
    })
  }

  const handleClearDateRange = (e: MouseEvent) => {
    e.stopPropagation()
    onApply(null, null)
    setDatePickerKey((k) => k + 1)
  }

  const handleApply = (s: string | null, e: string | null) => {
    onApply(s, e)
    setDatePickerKey((k) => k + 1)
  }

  return (
    <TaskDateRangePopover
      open={dateRangeOpen}
      onOpenChange={setDateRangeOpen}
      remountKey={datePickerKey}
      startValue={startValue}
      endValue={endValue}
      onApply={handleApply}
    >
      {hasDateRange ? (
        <span className={styles.dateChip}>
          <button
            type="button"
            className={styles.dateChipTrigger}
            title="Срок выполнения"
            onClick={togglePopover}
          >
            <CalendarIcon />
            {dateRangeLabel}
          </button>
          <button
            type="button"
            className={styles.dateRemove}
            onClick={handleClearDateRange}
            aria-label="Убрать срок"
            title="Убрать срок"
          >
            ×
          </button>
        </span>
      ) : (
        <button type="button" className={styles.pillButton} onClick={togglePopover}>
          <CalendarIcon />
          {emptyLabel}
        </button>
      )}
    </TaskDateRangePopover>
  )
}
