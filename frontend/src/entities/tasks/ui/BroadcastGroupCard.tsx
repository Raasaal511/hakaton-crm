import { useState, useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { tasksAPI } from 'shared/api/requests/tasks'
import { editTask } from 'shared/api/events/tasks'
import type { Task, BroadcastChildInfo } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import { formatTaskDateRangeShort } from 'shared/lib/formatTaskDateRange'
import styles from './BroadcastGroupCard.module.css'
import drawerStyles from './ColumnTasks.module.css'

type ChildStatus = 'completed' | 'inprogress' | 'pending'

function childStatus(child: BroadcastChildInfo): ChildStatus {
  if (child.completedAt != null) return 'completed'
  if (child.columnPosition > 0) return 'inprogress'
  return 'pending'
}

function memberInitial(m: DepartmentMember | undefined): string {
  return (m?.firstname?.[0] ?? m?.email?.[0] ?? '?').toUpperCase()
}

function memberDisplayName(m: DepartmentMember | undefined, userId: number): string {
  if (!m) return `Участник #${userId}`
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ')
  return m.email ?? `Участник #${userId}`
}

const STATUS_LABEL: Record<ChildStatus, string> = {
  completed: 'Выполнено',
  inprogress: 'В работе',
  pending: 'Не начато',
}

type BroadcastGroupCardProps = {
  task: Task
  members: DepartmentMember[]
  canDrag?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function BroadcastGroupCard({
  task,
  members,
  canDrag = false,
  onEdit,
  onDelete,
}: BroadcastGroupCardProps) {
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [approveBusy, setApproveBusy] = useState<number | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  const handleApprove = useCallback(async (child: BroadcastChildInfo) => {
    if (!child.pipelineLastColumnId) return
    setApproveBusy(child.taskId)
    try {
      const result = await tasksAPI.placeInColumn(child.pipelineLastColumnId, child.taskId, { insertAfterTaskId: null })
      const now = new Date().toISOString()
      const updatedChildren = (task.broadcastProgress?.children ?? []).map((c) =>
        c.taskId === child.taskId ? { ...c, completedAt: now, columnIsReview: false } : c,
      )
      const newCompleted = updatedChildren.filter((c) => c.completedAt != null).length
      const updatedProgress = { ...task.broadcastProgress!, completed: newCompleted, children: updatedChildren }
      const updatedTask = result.autoCompletedParent
        ? { ...task, columnId: result.autoCompletedParent.columnId, completedAt: now, broadcastProgress: updatedProgress }
        : { ...task, broadcastProgress: updatedProgress }
      editTask(updatedTask)
    } catch {
      // ошибка игнорируется — UI не ломается
    } finally {
      setApproveBusy(null)
    }
  }, [task])

  const progress = task.broadcastProgress
  const total = progress?.total ?? 0
  const completed = progress?.completed ?? 0
  const children = progress?.children ?? []
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const rangeLabel = formatTaskDateRangeShort(task)

  const sortedChildren = [...children].sort((a, b) => {
    const order: Record<ChildStatus, number> = { completed: 2, inprogress: 1, pending: 0 }
    return order[childStatus(b)] - order[childStatus(a)]
  })

  const byStatus = {
    inprogress: sortedChildren.filter((c) => childStatus(c) === 'inprogress'),
    pending: sortedChildren.filter((c) => childStatus(c) === 'pending'),
    completed: sortedChildren.filter((c) => childStatus(c) === 'completed'),
  }

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setDrawerOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-navigate]')) return
    setDrawerOpen(true)
  }, [])

  const drawer = drawerOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className={drawerStyles.createDrawerRoot} data-broadcast-drawer>
          <button
            type="button"
            className={drawerStyles.createDrawerBackdrop}
            aria-label="Закрыть"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            ref={drawerRef}
            className={drawerStyles.createDrawerPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Трекер рассылки"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={drawerStyles.createDrawerHeader}>
              <div className={drawerStyles.createDrawerHeaderText}>
                <div className={styles.drawerBadgeRow}>
                  <span className={styles.badge} aria-label="Раздельная задача">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>
                    Раздельная задача
                  </span>
                  <span className={styles.drawerTotalBadge}>{total} участников</span>
                </div>
                <h2 className={drawerStyles.createDrawerTitle}>{task.name}</h2>
                {rangeLabel && (
                  <p className={drawerStyles.createDrawerSubtitle}>{rangeLabel}</p>
                )}
              </div>
              <div className={styles.drawerHeaderActions}>
                {onEdit && (
                  <button
                    type="button"
                    className={styles.drawerEditBtn}
                    onClick={() => { setDrawerOpen(false); onEdit() }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Редактировать
                  </button>
                )}
                <button
                  type="button"
                  className={drawerStyles.createDrawerClose}
                  aria-label="Закрыть"
                  onClick={() => setDrawerOpen(false)}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className={`${drawerStyles.createDrawerBody} ${styles.drawerBody}`}>
              {/* Progress */}
              <div className={styles.drawerProgress}>
                <div className={styles.progressHeader}>
                  <span className={styles.progressLabel}>
                    <strong>{completed}</strong> / {total} выполнено
                  </span>
                  <span className={styles.progressPct}>{pct}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>

              {/* Groups */}
              {(Object.entries(byStatus) as [ChildStatus, BroadcastChildInfo[]][]).map(([status, group]) => {
                if (!group.length) return null
                return (
                  <div key={status} className={styles.drawerGroup}>
                    <p className={styles.drawerGroupLabel}>
                      <span className={`${styles.groupDot} ${styles[`dot_${status}`]}`} aria-hidden />
                      {STATUS_LABEL[status]}
                      <span className={styles.groupCount}>{group.length}</span>
                    </p>
                    <ul className={styles.drawerMemberList}>
                      {group.map((child) => {
                        const member = members.find((m) => m.id === child.userId)
                        const isBusy = approveBusy === child.taskId
                        return (
                          <li key={child.taskId}>
                            <div className={styles.drawerMemberRow}>
                              <button
                                type="button"
                                className={styles.drawerMemberRowInner}
                                onClick={() => { setDrawerOpen(false); navigate(`/tasks/${child.taskId}`) }}
                              >
                                <span className={`${styles.drawerAvatar} ${styles[`avatarStatus_${status}`]}`} aria-hidden>
                                  {memberInitial(member)}
                                </span>
                                <span className={styles.drawerMemberName}>
                                  {memberDisplayName(member, child.userId)}
                                </span>
                                <span className={styles.drawerMemberColumn}>{child.columnName}</span>
                              </button>
                              {child.columnIsReview && (
                                <button
                                  type="button"
                                  className={styles.drawerApproveBtn}
                                  disabled={isBusy}
                                  onClick={() => handleApprove(child)}
                                  title="Принять и завершить задачу"
                                >
                                  {isBusy
                                    ? <span className={styles.approveSpinner} aria-hidden />
                                    : <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Завершить
                                      </>
                                  }
                                </button>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          </aside>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div
        className={`${styles.card} ${canDrag ? styles.cardDraggable : ''}`}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setDrawerOpen(true)}
        aria-label={`Раздельная задача: ${task.name}`}
      >
        <div className={styles.header}>
          <span className={styles.badge} aria-label="Задача-Раздельная задача">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            Раздельная задача
          </span>

          {(onEdit || onDelete) && (
            <div className={styles.menuWrap} data-no-navigate>
              <button
                type="button"
                className={styles.menuBtn}
                onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v) }}
                aria-label="Действия"
              >
                ···
              </button>
              {showMenu && (
                <div className={styles.menuDropdown}>
                  {onEdit && (
                    <button type="button" className={styles.menuItem} onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit() }}>
                      Редактировать
                    </button>
                  )}
                  {onDelete && (
                    <button type="button" className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete() }}>
                      Удалить
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className={styles.title}>{task.name}</p>
        {rangeLabel && <p className={styles.dateRange}>{rangeLabel}</p>}

        <div className={styles.progressSection}>
          <div className={styles.progressHeader}>
            <span className={styles.progressLabel}>
              {completed} <span className={styles.progressSep}>/</span> {total} выполнено
            </span>
            <span className={styles.progressPct}>{pct}%</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className={styles.avatarRow}>
          {sortedChildren.slice(0, 6).map((child) => {
            const member = members.find((m) => m.id === child.userId)
            const status = childStatus(child)
            return (
              <span
                key={child.taskId}
                className={`${styles.avatar} ${styles[`avatarStatus_${status}`]}`}
                title={`${memberDisplayName(member, child.userId)} — ${child.columnName}`}
              >
                {memberInitial(member)}
                {status === 'completed' && (
                  <span className={styles.avatarCheck} aria-hidden>✓</span>
                )}
              </span>
            )
          })}
          {children.length > 6 && (
            <span className={styles.avatarExtra}>+{children.length - 6}</span>
          )}
          <span className={styles.openHint}>Нажмите для просмотра →</span>
        </div>
      </div>

      {drawer}
    </>
  )
}
