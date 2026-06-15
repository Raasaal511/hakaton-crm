import { cn } from 'shared/lib'
import { toYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import { TaskCalendarDayCell } from './TaskCalendarDayCell'
import { TaskCalendarRangeBar } from './TaskCalendarRangeBar'
import { getSegmentsForWeek } from './taskCalendarPlacement'
import type { CalendarGridCell, TaskCalendarDayChip, TaskCalendarPlacement } from './types'
import styles from './TaskCalendar.module.css'

type Props = {
  weekIndex: number
  weekCells: CalendarGridCell[]
  placement: TaskCalendarPlacement
  today: Date
  selectedYmd: string | null
  maxChipsPerDay: number
  weekMode?: boolean
  onSelectDay: (ymd: string) => void
  onOpenTask: (taskId: number) => void
}

export function TaskCalendarWeekRow({
  weekIndex,
  weekCells,
  placement,
  today,
  selectedYmd,
  maxChipsPerDay,
  weekMode = false,
  onSelectDay,
  onOpenTask,
}: Props) {
  const segments = getSegmentsForWeek(placement.rangeSegments, weekIndex)
  const barRows =
    segments.length > 0 ? Math.max(...segments.map((s) => s.row), 0) + 1 : 0

  return (
    <div className={cn(styles.weekRow, weekMode && styles.weekRowExpanded)}>
      <div className={styles.weekRowDays}>
        {weekCells.map((cell) => {
          const ymd = toYmd(cell.date)
          const isToday =
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getDate() === today.getDate()

          return (
            <TaskCalendarDayCell
              key={ymd}
              date={cell.date}
              outside={cell.outside}
              isToday={isToday}
              chips={placement.chipsByDay.get(ymd)}
              selected={selectedYmd === ymd}
              maxChipsPerDay={maxChipsPerDay}
              onSelectDay={onSelectDay}
              onOpenTask={onOpenTask}
            />
          )
        })}
      </div>
      {barRows > 0 ? (
        <div
          className={styles.weekRowBars}
          style={{ gridTemplateRows: `repeat(${barRows}, 1.5rem)` }}
        >
          {segments.map((seg) => (
            <TaskCalendarRangeBar
              key={`${seg.task.id}-${weekIndex}-${seg.row}-${seg.startCol}`}
              segment={seg}
              onOpenTask={onOpenTask}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
