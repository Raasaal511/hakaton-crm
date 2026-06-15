import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CreateTaskForm } from 'features/task/create'
import type { DepartmentMember } from 'shared/types/departments'
import type { DepartmentPolicies } from 'shared/types/departmentPoliciesConfig'
import styles from './ColumnTasks.module.css'

export type CreateTaskDrawerProps = {
  open: boolean
  onClose: () => void
  columnId: number
  departmentId: number
  nextPosition: number
  /** Значение aria-labelledby: id заголовка «Новая задача» */
  titleId: string
  /** Подзаголовок «Колонка: …»; не показывается, если передан headerBelowTitle */
  columnTitle?: string
  /** Блок под заголовком (например выбор колонки при нескольких этапах) */
  headerBelowTitle?: ReactNode
  members: DepartmentMember[]
  isPersonalOrganization?: boolean
  currentUserId?: number
  /** Смена ключа привязана к remount формы */
  formMountKey?: number
  initialStartYmd?: string
  initialDeadLineYmd?: string
  /** По умолчанию совпадает с onClose */
  onSuccess?: () => void
  departmentPolicies?: DepartmentPolicies | null
}

/**
 * Панель создания задачи справа — тот же UI, что у колонок на канбан-доске.
 */
export function CreateTaskDrawer({
  open,
  onClose,
  columnId,
  departmentId,
  nextPosition,
  titleId,
  columnTitle,
  headerBelowTitle,
  members,
  isPersonalOrganization = false,
  currentUserId,
  formMountKey = 0,
  initialStartYmd = '',
  initialDeadLineYmd = '',
  onSuccess,
  departmentPolicies = null,
}: CreateTaskDrawerProps) {
  const handleSuccess = onSuccess ?? onClose
  const drawerPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusFirst = () => {
      const panel = drawerPanelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
      )
      const firstInput = Array.from(focusables).find(
        (el) =>
          el.tagName !== 'BUTTON' ||
          !el.getAttribute('aria-label')?.includes('Закрыть'),
      )
      ;(firstInput ?? focusables[0] ?? panel).focus?.()
    }
    const id = window.setTimeout(focusFirst, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const panel = drawerPanelRef.current
      if (!panel) return
      const nodes = panel.querySelectorAll<HTMLElement>(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
      )
      const focusable = Array.from(nodes).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      )
      if (focusable.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className={styles.createDrawerRoot} data-create-task-drawer>
      <button
        type="button"
        className={styles.createDrawerBackdrop}
        aria-label="Закрыть панель"
        onClick={onClose}
      />
      <aside
        className={styles.createDrawerPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={drawerPanelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.createDrawerHeader}>
          <div className={styles.createDrawerHeaderText}>
            <h2 id={titleId} className={styles.createDrawerTitle}>
              Новая задача
            </h2>
            {headerBelowTitle}
            {!headerBelowTitle && columnTitle ? (
              <p className={styles.createDrawerSubtitle}>Колонка: {columnTitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.createDrawerClose}
            aria-label="Закрыть"
            onClick={onClose}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={styles.createDrawerBody}>
          <CreateTaskForm
            key={`${columnId}-${formMountKey}`}
            columnId={columnId}
            departmentId={departmentId}
            nextPosition={nextPosition}
            members={members}
            isPersonalOrganization={isPersonalOrganization}
            currentUserId={currentUserId}
            layout="drawer"
            initialStartYmd={initialStartYmd}
            initialDeadLineYmd={initialDeadLineYmd}
            onSuccess={handleSuccess}
            onCancel={onClose}
            departmentPolicies={departmentPolicies}
          />
        </div>
      </aside>
    </div>,
    document.body,
  )
}
