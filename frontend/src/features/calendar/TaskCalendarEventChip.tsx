import { cn } from 'shared/lib'
import { formatTaskDateRangeShort, isTaskDeadlineOverdue } from 'shared/lib/formatTaskDateRange'
import type { TaskCalendarDayChip } from './types'
import styles from './TaskCalendar.module.css'

type Props = {
  chip: TaskCalendarDayChip
  onOpenTask: (taskId: number) => void
}

export function TaskCalendarEventChip({ chip, onOpenTask }: Props) {
  const { task } = chip
  const overdue = isTaskDeadlineOverdue(task)
  const completed = Boolean(task.completedAt) || Boolean(task.inPipelineTerminalColumn)
  const rangeHint = formatTaskDateRangeShort(task)

  return (
    <button
      type="button"
      className={cn(
        styles.eventChip,
        overdue && styles.eventChipOverdue,
        completed && styles.eventChipCompleted,
      )}
      style={
        task.columnColor
          ? ({ '--chip-accent': task.columnColor } as React.CSSProperties)
          : undefined
      }
      title={[task.name, rangeHint].filter(Boolean).join(' · ')}
      onClick={(e) => {
        e.stopPropagation()
        onOpenTask(task.id)
      }}
    >
      <span className={styles.eventChipDot} aria-hidden />
      <span className={styles.eventChipTitle}>{task.name}</span>
    </button>
  )
}
