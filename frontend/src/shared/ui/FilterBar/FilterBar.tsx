import type { ReactNode } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import styles from './FilterBar.module.css'

export type FilterChip = {
  id: string
  label: string
  value?: string
  removable?: boolean
}

export type FilterBarProps = {
  chips?: FilterChip[]
  onRemoveChip?: (id: string) => void
  onClearAll?: () => void
  children?: ReactNode
  totalCount?: number
  filteredCount?: number
  className?: string
}

export function FilterBar({
  chips = [],
  onRemoveChip,
  onClearAll,
  children,
  totalCount,
  filteredCount,
  className = '',
}: FilterBarProps) {
  const hasFilters = chips.length > 0

  return (
    <div className={`${styles.filterBar} ${className}`}>
      <div className={styles.filterIcon}>
        <SlidersHorizontal size={14} strokeWidth={2} />
      </div>

      <div className={styles.controls}>
        {children}
      </div>

      {hasFilters && (
        <div className={styles.chips} role="list" aria-label="Активные фильтры">
          {chips.map((chip) => (
            <span key={chip.id} className={styles.chip} role="listitem">
              <span className={styles.chipLabel}>
                {chip.label}
                {chip.value && <span className={styles.chipValue}>: {chip.value}</span>}
              </span>
              {chip.removable !== false && onRemoveChip && (
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => onRemoveChip(chip.id)}
                  aria-label={`Убрать фильтр ${chip.label}`}
                >
                  <X size={10} strokeWidth={3} />
                </button>
              )}
            </span>
          ))}
          {onClearAll && (
            <button
              type="button"
              className={styles.clearAll}
              onClick={onClearAll}
            >
              Сбросить всё
            </button>
          )}
        </div>
      )}

      {(totalCount !== undefined || filteredCount !== undefined) && (
        <span className={styles.count}>
          {filteredCount !== undefined && totalCount !== undefined
            ? `${filteredCount} из ${totalCount}`
            : totalCount !== undefined
              ? `${totalCount}`
              : `${filteredCount}`
          }
        </span>
      )}
    </div>
  )
}
