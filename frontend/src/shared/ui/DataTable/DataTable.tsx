import { useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, MoreHorizontal, Trash2, Tag, UserCheck } from 'lucide-react'
import styles from './DataTable.module.css'

export type SortDir = 'asc' | 'desc' | null

export type ColumnDef<T> = {
  key: string
  header: string
  width?: number | string
  minWidth?: number
  sortable?: boolean
  renderCell: (row: T, index: number) => ReactNode
}

export type BulkAction = {
  id: string
  label: string
  icon?: ReactNode
  variant?: 'default' | 'danger'
  onClick: (selectedIds: string[]) => void
}

export type DataTableProps<T extends { id: string }> = {
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  emptyState?: ReactNode
  bulkActions?: BulkAction[]
  onRowClick?: (row: T) => void
  activeRowId?: string
  sortKey?: string
  sortDir?: SortDir
  onSort?: (key: string, dir: SortDir) => void
  rowClassName?: (row: T) => string
  skeletonRows?: number
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  emptyState,
  bulkActions = [],
  onRowClick,
  activeRowId,
  sortKey,
  sortDir,
  onSort,
  rowClassName,
  skeletonRows = 8,
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null)

  const allSelected = data.length > 0 && selectedIds.size === data.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(data.map((r) => r.id)))
    setLastSelectedIdx(null)
  }, [allSelected, data])

  const toggleRow = useCallback(
    (id: string, idx: number, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (shiftKey && lastSelectedIdx !== null) {
          const [lo, hi] = [Math.min(idx, lastSelectedIdx), Math.max(idx, lastSelectedIdx)]
          const rangeIds = data.slice(lo, hi + 1).map((r) => r.id)
          const adding = !prev.has(id)
          rangeIds.forEach((rid) => (adding ? next.add(rid) : next.delete(rid)))
        } else {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        }
        return next
      })
      setLastSelectedIdx(idx)
    },
    [data, lastSelectedIdx],
  )

  const handleSort = useCallback(
    (key: string) => {
      if (!onSort) return
      if (sortKey !== key) return onSort(key, 'asc')
      if (sortDir === 'asc') return onSort(key, 'desc')
      onSort(key, null)
    },
    [sortKey, sortDir, onSort],
  )

  const clearSelection = () => setSelectedIds(new Set())

  return (
    <div className={styles.wrapper}>
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkCount}>{selectedIds.size} выбрано</span>
          <div className={styles.bulkActions}>
            {bulkActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={`${styles.bulkAction} ${action.variant === 'danger' ? styles.bulkActionDanger : ''}`}
                onClick={() => {
                  action.onClick(Array.from(selectedIds))
                  clearSelection()
                }}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.bulkClear}
            onClick={clearSelection}
            aria-label="Снять выделение"
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              <th className={styles.thCheck}>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={toggleAll}
                    aria-label="Выбрать все"
                  />
                </label>
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.th} ${col.sortable ? styles.thSortable : ''}`}
                  style={{
                    width: col.width,
                    minWidth: col.minWidth,
                  } as CSSProperties}
                  onClick={() => col.sortable && handleSort(col.key)}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  <span className={styles.thContent}>
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        active={sortKey === col.key}
                        dir={sortKey === col.key ? (sortDir ?? null) : null}
                      />
                    )}
                  </span>
                </th>
              ))}
              <th className={styles.thActions} aria-label="Действия" />
            </tr>
          </thead>

          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <tr key={i} className={styles.skeletonRow}>
                    <td className={styles.tdCheck}><div className={styles.skelCheck} /></td>
                    {columns.map((col) => (
                      <td key={col.key} className={styles.td}>
                        <div
                          className={styles.skelCell}
                          style={{ width: `${55 + Math.random() * 40}%` }}
                        />
                      </td>
                    ))}
                    <td className={styles.tdActions} />
                  </tr>
                ))
              : data.map((row, idx) => {
                  const selected = selectedIds.has(row.id)
                  const active = activeRowId === row.id
                  return (
                    <tr
                      key={row.id}
                      className={`${styles.tr} ${selected ? styles.trSelected : ''} ${active ? styles.trActive : ''} ${rowClassName?.(row) ?? ''}`}
                      onClick={(e) => {
                        const target = e.target as HTMLElement
                        if (target instanceof HTMLInputElement && target.type === 'checkbox') return
                        if (target.closest('input[type=checkbox]')) return
                        if (target.closest(`.${styles.actionsCell}`)) return
                        onRowClick?.(row)
                      }}
                    >
                      <td
                        className={styles.tdCheck}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleRow(row.id, idx, e.shiftKey)
                        }}
                      >
                        <label className={styles.checkLabel}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={selected}
                            onChange={() => {}}
                            aria-label={`Выбрать строку ${idx + 1}`}
                          />
                        </label>
                      </td>
                      {columns.map((col) => (
                        <td key={col.key} className={styles.td}>
                          {col.renderCell(row, idx)}
                        </td>
                      ))}
                      <td className={`${styles.tdActions} ${styles.actionsCell}`}>
                        <button
                          type="button"
                          className={styles.rowMoreBtn}
                          aria-label="Больше действий"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal size={15} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>

        {!loading && data.length === 0 && (
          <div className={styles.emptyState}>
            {emptyState ?? (
              <div className={styles.emptyDefault}>
                <span className={styles.emptyIcon}>📭</span>
                <p className={styles.emptyTitle}>Нет данных</p>
                <p className={styles.emptyText}>Здесь пока ничего нет</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} strokeWidth={2} className={styles.sortIcon} />
  if (dir === 'asc') return <ChevronUp size={12} strokeWidth={2.5} className={`${styles.sortIcon} ${styles.sortIconActive}`} />
  if (dir === 'desc') return <ChevronDown size={12} strokeWidth={2.5} className={`${styles.sortIcon} ${styles.sortIconActive}`} />
  return <ChevronsUpDown size={12} strokeWidth={2} className={styles.sortIcon} />
}
