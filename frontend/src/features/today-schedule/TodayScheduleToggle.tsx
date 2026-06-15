import { CalendarClock } from 'lucide-react'
import { cn } from 'shared/lib'
import styles from './TodayScheduleRail.module.css'

type Props = {
  count: number
  open: boolean
  onClick: () => void
  className?: string
}

export function TodayScheduleToggle({ count, open, onClick, className }: Props) {
  return (
    <button
      type="button"
      className={cn(styles.toggleBtn, open && styles.toggleBtnActive, className)}
      onClick={onClick}
      aria-expanded={open}
      aria-label={`Задачи на сегодня${count > 0 ? `, ${count}` : ''}`}
    >
      <CalendarClock size={16} strokeWidth={2} aria-hidden />
      <span className={styles.toggleLabel}>Сегодня</span>
      {count > 0 ? <span className={styles.toggleBadge}>{count}</span> : null}
    </button>
  )
}
