import { useMemo } from 'react'
import { cn } from 'shared/lib'
import { toYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import { TaskCalendarEventChip } from './TaskCalendarEventChip'
import { getVisibleChipsForDay } from './taskCalendarPlacement'
import type { TaskCalendarDayChip } from './types'
import styles from './TaskCalendar.module.css'

type Props = {
  date: Date
  outside: boolean
  isToday: boolean
  chips: TaskCalendarDayChip[] | undefined
  selected: boolean
  maxChipsPerDay: number
  onSelectDay: (ymd: string) => void
  onOpenTask: (taskId: number) => void
}

export function TaskCalendarDayCell({
  date,
  outside,
  isToday,
  chips,
  selected,
  maxChipsPerDay,
  onSelectDay,
  onOpenTask,
}: Props) {
  const ymd = toYmd(date)
  const dayNum = date.getDate()
  const { visible, overflow } = useMemo(
    () => getVisibleChipsForDay(chips, maxChipsPerDay),
    [chips, maxChipsPerDay],
  )

  return (
    <div
      className={cn(
        styles.dayCell,
        outside && styles.dayCellOutside,
        selected && styles.dayCellSelected,
      )}
      role="gridcell"
      tabIndex={-1}
      onClick={() => onSelectDay(ymd)}
    >
      <div className={styles.dayCellHead}>
        <span className={cn(styles.dayNum, isToday && styles.dayNumToday)}>{dayNum}</span>
      </div>
      <div className={styles.dayEvents}>
        {visible.map((chip) => (
          <TaskCalendarEventChip key={`${chip.task.id}-${ymd}`} chip={chip} onOpenTask={onOpenTask} />
        ))}
        {overflow > 0 ? (
          <button
            type="button"
            className={styles.dayMoreBtn}
            onClick={(e) => {
              e.stopPropagation()
              onSelectDay(ymd)
            }}
          >
            +{overflow} ещё
          </button>
        ) : null}
      </div>
    </div>
  )
}
