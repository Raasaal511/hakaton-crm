import { formatTaskDateRangeShort } from 'shared/lib/formatTaskDateRange'
import { cn } from 'shared/lib'
import { parseYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import { Button } from 'shared/ui'
import type { TaskCalendarDayChip } from './types'
import styles from './TaskCalendar.module.css'

type Props = {
  ymd: string
  chips: TaskCalendarDayChip[]
  canCreate: boolean
  sheet?: boolean
  onAddTask: (ymd: string) => void
  onOpenTask: (taskId: number) => void
  onClose: () => void
}

export function TaskCalendarDayPanel({
  ymd,
  chips,
  canCreate,
  sheet = false,
  onAddTask,
  onOpenTask,
  onClose,
}: Props) {
  const date = parseYmd(ymd)
  const title = date
    ? date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    : ymd

  return (
    <aside
      className={cn(styles.dayPanel, sheet && styles.dayPanelSheet)}
      aria-label={`Задачи на ${title}`}
    >
      {sheet ? (
        <div className={styles.dayPanelHandle} aria-hidden>
          <span className={styles.dayPanelHandleBar} />
        </div>
      ) : null}
      <div className={styles.dayPanelHead}>
        <h2 className={styles.dayPanelTitle}>{title}</h2>
        <button type="button" className={styles.dayPanelClose} onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      </div>
      {canCreate ? (
        <Button type="button" variant="primary" className={styles.dayPanelAdd} onClick={() => onAddTask(ymd)}>
          + Добавить задачу
        </Button>
      ) : null}
      <ul className={styles.dayPanelList}>
        {chips.length === 0 ? (
          <li className={styles.dayPanelEmpty}>Нет задач на этот день</li>
        ) : (
          chips.map((chip) => (
            <li key={chip.task.id}>
              <button
                type="button"
                className={styles.dayPanelItem}
                onClick={() => onOpenTask(chip.task.id)}
              >
                <span className={styles.dayPanelItemName}>{chip.task.name}</span>
                {chip.task.departmentName ? (
                  <span className={styles.dayPanelItemMeta}>{chip.task.departmentName}</span>
                ) : null}
                {formatTaskDateRangeShort(chip.task) ? (
                  <span className={styles.dayPanelItemMeta}>{formatTaskDateRangeShort(chip.task)}</span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  )
}
