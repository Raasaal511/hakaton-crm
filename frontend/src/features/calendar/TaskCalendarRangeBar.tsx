import { cn } from 'shared/lib'
import { isTaskDeadlineOverdue } from 'shared/lib/formatTaskDateRange'
import type { TaskCalendarRangeSegment } from './types'
import styles from './TaskCalendar.module.css'

type Props = {
  segment: TaskCalendarRangeSegment
  onOpenTask: (taskId: number) => void
}

export function TaskCalendarRangeBar({ segment, onOpenTask }: Props) {
  const { task, startCol, endCol, row, showLabel } = segment
  const overdue = isTaskDeadlineOverdue(task)
  const completed = Boolean(task.completedAt) || Boolean(task.inPipelineTerminalColumn)
  const span = endCol - startCol + 1

  return (
    <button
      type="button"
      className={cn(
        styles.rangeBar,
        overdue && styles.rangeBarOverdue,
        completed && styles.rangeBarCompleted,
        !showLabel && styles.rangeBarContinuation,
      )}
      style={
        {
          gridColumn: `${startCol + 1} / span ${span}`,
          gridRow: row + 1,
          '--bar-accent': task.columnColor ?? undefined,
        } as React.CSSProperties
      }
      title={task.name}
      onClick={(e) => {
        e.stopPropagation()
        onOpenTask(task.id)
      }}
    >
      {showLabel ? (
        <>
          <span className={styles.rangeBarDot} aria-hidden />
          <span className={styles.rangeBarTitle}>{task.name}</span>
        </>
      ) : null}
    </button>
  )
}
