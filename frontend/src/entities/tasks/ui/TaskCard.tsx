import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Task } from 'shared/types/tasks'
import type { Tag } from 'shared/types/tags'
import type { DepartmentMember } from 'shared/types/departments'
import { formatTaskDateRangeShort, isTaskDeadlineOverdue } from 'shared/lib/formatTaskDateRange'
import { formatTaskTimeShort, taskDateYmd } from 'shared/lib/taskDateTime'
import { toYmd } from 'shared/ui/TaskDateRangePicker/dateRangeUtils'
import styles from './TaskCard.module.css'

function creatorDisplayShort(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  if (fn && ln) return `${fn} ${ln[0]}.`
  if (fn) return fn
  if (ln) return ln
  const email = (m.email ?? '').trim()
  if (email) return email
  return `Участник #${m.id}`
}

function creatorDisplayTitle(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  const namePart = [fn, ln].filter(Boolean).join(' ')
  const email = (m.email ?? '').trim()
  if (namePart) return email ? `Автор: ${namePart} (${email})` : `Автор: ${namePart}`
  if (email) return `Автор: ${email}`
  return `Автор: участник #${m.id}`
}

/** Совпадает с подписью на странице задачи, если автора нет в списке участников. */
function creatorFallbackShort(creatorId: number): string {
  return `ID ${creatorId}`
}

function creatorFallbackTitle(creatorId: number): string {
  return `Автор: ID ${creatorId}`
}

type TaskCardProps = {
  task: Task
  tags?: Tag[]
  /** Для обратной совместимости — единичный исполнитель. Если передан `responsibles`, он превалирует. */
  responsible?: DepartmentMember | null
  /** Полный список исполнителей задачи, включая ведущего (первым). */
  responsibles?: DepartmentMember[]
  creator?: DepartmentMember | null
  canDrag?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isFirstInColumn?: boolean
  /** В последней колонке воронки — срок не подсвечивается как просроченный */
  deadlineNeutral?: boolean
}

export function TaskCard({
  task,
  tags = [],
  responsible,
  responsibles,
  creator,
  canDrag = false,
  onEdit,
  onDelete,
  isFirstInColumn = false,
  deadlineNeutral = false,
}: TaskCardProps) {
  const formatCompletionShortDate = (iso: string | null | undefined): string | null => {
    if (iso == null || iso === '') return null
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownMenuRef = useRef<HTMLDivElement>(null)
  const dropdownBtnRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline)
    if (Number.isNaN(date.getTime())) {
      return null
    }

    const status: 'normal' | 'overdue' = isTaskDeadlineOverdue({ deadLine: deadline })
      ? 'overdue'
      : 'normal'

    const text = date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
    const timePart = formatTaskTimeShort(deadline)

    return { text: timePart ? `${text}, ${timePart}` : text, status }
  }

  const deadlineRaw = task.deadLine ? formatDeadline(task.deadLine) : null
  const deadlineInfo =
    deadlineRaw && deadlineNeutral ? { ...deadlineRaw, status: 'normal' as const } : deadlineRaw
  const rangeLabel = formatTaskDateRangeShort(task)
  const completionLabel = deadlineNeutral ? formatCompletionShortDate(task.completedAt) : null
  const todayKey = toYmd(new Date())
  const timedTodayBadge =
    task.deadLine &&
    taskDateYmd(task.deadLine) === todayKey &&
    formatTaskTimeShort(task.deadLine)

  const responsiblesList =
    responsibles && responsibles.length ? responsibles : responsible ? [responsible] : []
  const multiAssigneeFooter = responsiblesList.length > 1

  const showAuthor = creator != null || task.creatorId != null

  const updateDropdownPosition = useCallback(() => {
    const btn = dropdownBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = dropdownMenuRef.current?.getBoundingClientRect().width ?? 160
    const viewportPadding = 8
    let left = rect.right - menuWidth
    if (left < viewportPadding) left = viewportPadding
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - viewportPadding - menuWidth
    }
    setDropdownPos({
      top: rect.bottom + 4,
      left,
    })
  }, [])

  useLayoutEffect(() => {
    if (!showDropdown) {
      setDropdownPos(null)
      return
    }
    updateDropdownPosition()
    const onMove = () => updateDropdownPosition()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [showDropdown, updateDropdownPosition])

  useEffect(() => {
    if (!showDropdown) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (dropdownRef.current?.contains(target)) return
      if (dropdownMenuRef.current?.contains(target)) return
      setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.dropdown') || (e.target as Element).closest('.dropdownBtn')) {
      return
    }
    navigate(`/tasks/${task.id}`)
  }

  const cardContent = (
    <div
      className={`${styles.card} ${canDrag ? styles.draggable : ''} ${isFirstInColumn ? styles.firstInColumn : ''} ${showDropdown ? styles.cardDropdownOpen : ''}`}
      data-task-id={task.id}
      onClick={handleCardClick}
    >
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.taskId}>#{task.id}</div>
          {showAuthor ? (
            <div
              className={styles.creator}
              title={
                creator != null
                  ? creatorDisplayTitle(creator)
                  : task.creatorId != null
                    ? creatorFallbackTitle(task.creatorId)
                    : undefined
              }
            >
              <span className={styles.creatorLabel}>Автор:</span>
              <span className={styles.creatorName}>
                {creator != null
                  ? creatorDisplayShort(creator)
                  : task.creatorId != null
                    ? creatorFallbackShort(task.creatorId)
                    : null}
              </span>
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          <div className="dropdown" ref={dropdownRef}>
            <button
              ref={dropdownBtnRef}
              className="dropdownBtn"
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(!showDropdown)
              }}
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
            {showDropdown && dropdownPos && typeof document !== 'undefined'
              ? createPortal(
                <div
                  ref={dropdownMenuRef}
                  className={styles.dropdown}
                  style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    right: 'auto',
                    marginTop: 0,
                    width: 'max-content',
                    zIndex: 10000,
                  }}
                >
                <button
                  className={styles.dropdownItem}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/tasks/${task.id}`)
                    setShowDropdown(false)
                  }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      d="M7 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"
                    />
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      d="M7 5.25V7l1.5 1.5"
                    />
                  </svg>
                  Открыть
                </button>
                {onEdit && (
                  <button
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit()
                      setShowDropdown(false)
                    }}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                      <path
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.5 1.75a1.767 1.767 0 1 1 2.5 2.5L4.375 12.875 1.75 13.125l.25-2.625L10.5 1.75Z"
                      />
                    </svg>
                    Редактировать
                  </button>
                )}
                {onDelete && (
                  <button
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation()
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
                    Удалить
                  </button>
                )}
                </div>,
                document.body,
              )
              : null}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <h4 className={styles.title}>{task.name}</h4>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerTop}>
          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.slice(0, 3).map((tag) => (
                <span key={tag.id} className={styles.tag}>
                  {tag.name}
                </span>
              ))}
              {tags.length > 3 && (
                <span className={styles.tagMore}>+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div
          className={`${styles.footerBottom} ${multiAssigneeFooter ? styles.footerBottomStacked : ''}`}
        >
          <div className={styles.meta}>
            {completionLabel ? (
              <div className={styles.completedDate}>
                <svg width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden>
                  <circle cx="7" cy="7" r="5.25" stroke="currentColor" strokeWidth="1.25" />
                  <path
                    d="M4.875 7.125 6.3 8.55l2.85-2.85"
                    stroke="currentColor"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className={styles.completedDateLabel}>Завершена {completionLabel}</span>
              </div>
            ) : (
              rangeLabel && (
              <div
                className={`${styles.deadline} ${styles[`deadline_${deadlineInfo?.status ?? 'normal'}`]
                  }`}
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 14 14" aria-hidden>
                  <path
                    stroke="currentColor"
                    strokeWidth="1"
                    d="M7 1.75a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5Z"
                  />
                  <path
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    d="M7 4.375V7l1.75 1.75"
                  />
                </svg>
                <span className={styles.deadlineRange}>{rangeLabel}</span>
              </div>
              )
            )}
          </div>

          <div className={styles.assignee}>
            {(() => {
              const list = responsiblesList
              if (!list.length) {
                return (
                  <>
                    <div className={styles.avatarEmpty} title="Не назначен">
                      ?
                    </div>
                    <span className={styles.assigneeName}>Не назначен</span>
                  </>
                )
              }
              if (list.length === 1) {
                const m = list[0]
                return (
                  <>
                    <div
                      className={styles.avatar}
                      title={`${m.firstname} ${m.lastname}`}
                    >
                      {m.firstname?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className={styles.assigneeName}>
                      {m.firstname} {m.lastname}
                    </span>
                  </>
                )
              }
              const visible = list.slice(0, 3)
              const extra = list.length - visible.length
              return (
                <>
                  <div
                    className={styles.avatarStack}
                    title={list
                      .map((m) => `${m.firstname} ${m.lastname}`)
                      .join(', ')}
                  >
                    {visible.map((m) => (
                      <div
                        key={m.id}
                        className={`${styles.avatar} ${styles.avatarStacked}`}
                        title={`${m.firstname} ${m.lastname}`}
                      >
                        {m.firstname?.[0]?.toUpperCase() || 'U'}
                      </div>
                    ))}
                    {extra > 0 ? (
                      <div
                        className={`${styles.avatarExtra} ${styles.avatarStacked}`}
                        title={list
                          .slice(3)
                          .map((m) => `${m.firstname} ${m.lastname}`)
                          .join(', ')}
                      >
                        +{extra}
                      </div>
                    ) : null}
                  </div>
                  <span className={styles.assigneeName}>
                    {list.length} исполнителей
                  </span>
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )

  return cardContent
}