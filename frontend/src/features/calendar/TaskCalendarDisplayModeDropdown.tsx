import { useMemo } from 'react'
import { CalendarRange } from 'lucide-react'
import { cn } from 'shared/lib'
import { Dropdown, type DropdownItem } from 'shared/ui'
import type { CalendarDisplayMode } from './types'
import styles from './TaskCalendarDisplayModeDropdown.module.css'

const DISPLAY_MODE_ITEMS: DropdownItem[] = [
  { id: 'month', label: 'Месяц' },
  { id: 'week', label: 'Неделя' },
  { id: 'day', label: 'День' },
]

type Props = {
  value: CalendarDisplayMode
  onChange: (mode: CalendarDisplayMode) => void
  className?: string
}

export function TaskCalendarDisplayModeDropdown({ value, onChange, className }: Props) {
  const selectedLabel = useMemo(
    () => DISPLAY_MODE_ITEMS.find((item) => item.id === value)?.label ?? 'Месяц',
    [value],
  )

  return (
    <Dropdown
      items={DISPLAY_MODE_ITEMS}
      value={value}
      placeholder="Месяц"
      className={cn(styles.dropdown, className)}
      renderTrigger={({ open, toggle }) => (
        <button
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`Период: ${selectedLabel}`}
          onClick={toggle}
        >
          <CalendarRange size={15} strokeWidth={1.75} className={styles.triggerIcon} aria-hidden />
          <span className={styles.triggerLabel}>{selectedLabel}</span>
          <span className={styles.triggerChevron} aria-hidden>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="m4.25 6.25 3.75 3.75 3.75-3.75"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      )}
      onChange={(next) => {
        const raw = next == null ? 'month' : String(next)
        if (raw === 'month' || raw === 'week' || raw === 'day') onChange(raw)
      }}
    />
  )
}
