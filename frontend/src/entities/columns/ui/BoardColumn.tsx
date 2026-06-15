import { useState, type ReactNode, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { tasksModel } from 'entities/tasks'
import { InlineEdit } from 'shared/ui'
import { columnsAPI } from 'shared/api/requests/columns'
import { editColumn } from 'shared/api/events/columns'
import type { Column } from 'shared/types/columns'
import styles from './BoardColumn.module.css'

type BoardColumnProps = {
  column: Column
  /** Переименование, удаление, перетаскивание колонки */
  canManageStructure?: boolean
  /** Цвет колонки (для основной воронки можно только это) */
  canManageColor?: boolean
  onRename?: (newName: string) => Promise<void>
  onDelete?: () => void
  children?: ReactNode
}

export function BoardColumn({
  column,
  canManageStructure = false,
  canManageColor = false,
  onRename,
  onDelete,
  children,
}: BoardColumnProps) {
  const { total: taskCountTotal } = tasksModel.selectors.useColumnTaskMeta(column.id)
  const [collapsed, setCollapsed] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isUpdatingColor, setIsUpdatingColor] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const titleWrapperRef = useRef<HTMLDivElement>(null)
  const COLOR_PRESETS = ['#6366F1', '#EC4899', '#22C55E', '#F97316', '#0EA5E9', '#A855F7', '#EF4444'] as const

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col-${column.id}`,
    disabled: !canManageStructure,
  })

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `col-${column.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'transform 120ms ease-out' : transition ?? 'transform 180ms ease',
    opacity: isDragging ? 0 : 1,
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={`${styles.column} ${isDragging ? styles.columnDragging : ''}`}
    >
      <div
        className={styles.header}
        style={
          column.color
            ? {
                background: `
                  linear-gradient(
                    180deg,
                    color-mix(in srgb, var(--color-surface) 100%, ${column.color} 30%) 0%,
                    color-mix(in srgb, var(--color-bg-secondary) 70%, ${column.color} 80%) 100%
                  )
                `,
              }
            : undefined
        }
      >
        <div className={styles.headerLeft}>
          {canManageStructure ? (
            <div
              className={styles.dragHandle}
              {...attributes}
              {...listeners}
              title="Перетащить колонку"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" strokeWidth="1.5" d="M2 4h10M2 7h10M2 10h10" />
              </svg>
            </div>
          ) : (
            <div className={styles.dragHandlePlaceholder} aria-hidden />
          )}
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(!collapsed)}
          >
            <svg 
              className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}
              width="16" height="16" fill="none" viewBox="0 0 16 16"
            >
              <path
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 4l4 4-4 4"
              />
            </svg>
          </button>
          {(column.color || canManageColor) && (
            <span
              className={`${column.color ? styles.colorDot : styles.colorDotUnset} ${
                !canManageColor ? styles.colorDotReadonly : ''
              }`}
              style={column.color ? { backgroundColor: column.color } : undefined}
              onClick={canManageColor ? () => setShowDropdown(!showDropdown) : undefined}
              title={canManageColor ? 'Изменить цвет колонки' : undefined}
              role={canManageColor ? 'button' : undefined}
              tabIndex={canManageColor ? 0 : undefined}
            />
          )}
          <div ref={titleWrapperRef}>
            {canManageStructure && onRename ? (
              <InlineEdit
                value={column.name}
                onSave={onRename}
                className={styles.title}
              />
            ) : (
              <span className={styles.titleStatic}>{column.name}</span>
            )}
          </div>
          {taskCountTotal != null ? (
            <div className={styles.badge}>{taskCountTotal}</div>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          {(canManageStructure || canManageColor) && (
            <div className={styles.dropdownWrapper} ref={dropdownRef}>
              <button
                className={styles.dropdownBtn}
                onClick={() => setShowDropdown(!showDropdown)}
                title="Действия"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                  <path
                    stroke="currentColor"
                    strokeWidth="1.5"
                    d="M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  />
                </svg>
              </button>
              {showDropdown && (
                <div className={styles.dropdown}>
                  {canManageStructure && onRename && (
                    <button
                      type="button"
                      className={styles.dropdownItem}
                      onClick={() => {
                        setShowDropdown(false)
                        const target = titleWrapperRef.current?.querySelector('div')
                        if (target instanceof HTMLElement) {
                          target.click()
                        }
                      }}
                    >
                      Переименовать колонку
                    </button>
                  )}
                  {canManageColor && (
                    <div className={styles.dropdownItem}>
                      <span>Цвет колонки</span>
                      <div className={styles.colorPalette}>
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`${styles.colorSwatch} ${
                              (column.color ?? '').toLowerCase() === c.toLowerCase()
                                ? styles.colorSwatchActive
                                : ''
                            }`}
                            style={{ backgroundColor: c }}
                            disabled={isUpdatingColor}
                            onClick={async () => {
                              try {
                                setIsUpdatingColor(true)
                                const updated = await columnsAPI.update(
                                  column.departmentId,
                                  column.id,
                                  { color: c },
                                )
                                editColumn(updated)
                              } finally {
                                setIsUpdatingColor(false)
                              }
                            }}
                            title={c}
                          />
                        ))}
                        <button
                          type="button"
                          className={styles.colorReset}
                          disabled={isUpdatingColor || !column.color}
                          onClick={async () => {
                            try {
                              setIsUpdatingColor(true)
                              const updated = await columnsAPI.update(
                                column.departmentId,
                                column.id,
                                { color: null },
                              )
                              editColumn(updated)
                            } finally {
                              setIsUpdatingColor(false)
                            }
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                  {canManageStructure && onDelete && (
                    <button
                      className={styles.dropdownItem}
                      onClick={() => {
                        onDelete()
                        setShowDropdown(false)
                      }}
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                        <path
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M1.75 3.5h10.5M5.25 3.5V2.625a.875.875 0 0 1 .875-.875h1.75a.875.875 0 0 1 .875.875V3.5M5.25 6.125v3.5M8.75 6.125v3.5M2.625 3.5h8.75l-.438 7.875a.875.875 0 0 1-.875.875H3.938a.875.875 0 0 1-.875-.875L2.625 3.5Z"
                        />
                      </svg>
                      Удалить колонку
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className={styles.content}>
          <div
            ref={setDroppableRef}
            className={`${styles.tasksList} ${isOver ? styles.tasksListOver : ''}`}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  )
}