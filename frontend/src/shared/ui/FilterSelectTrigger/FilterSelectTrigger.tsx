import type { ReactNode } from 'react'
import { cn } from 'shared/lib'
import styles from './FilterSelectTrigger.module.css'

export const filterSelectDropdownClassName = styles.dropdownWrap

type FilterSelectTriggerProps = {
  open: boolean
  selectedLabel: string
  toggle: () => void
  icon: ReactNode
  className?: string
  /** Уменьшенный триггер (плотные панели фильтров и т.п.). */
  compact?: boolean
}

export function FilterSelectTrigger({
  open,
  selectedLabel,
  toggle,
  icon,
  className,
  compact = false,
}: FilterSelectTriggerProps) {
  return (
    <button
      type="button"
      className={cn(
        styles.trigger,
        open && styles.triggerOpen,
        compact && styles.triggerCompact,
        className,
      )}
      onClick={toggle}
      title={selectedLabel}
    >
      <span className={cn(styles.icon, compact && styles.iconCompact)} aria-hidden>
        {icon}
      </span>
      <span className={cn(styles.text, compact && styles.textCompact)}>{selectedLabel}</span>
      <span
        className={cn(styles.chevron, open && styles.chevronOpen, compact && styles.chevronCompact)}
        aria-hidden
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
  )
}
