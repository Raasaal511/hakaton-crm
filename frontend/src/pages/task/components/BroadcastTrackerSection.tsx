import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { tasksAPI } from 'shared/api/requests/tasks'
import type { BroadcastProgress, BroadcastChildInfo } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import styles from './BroadcastTrackerSection.module.css'

type ChildStatus = 'completed' | 'inprogress' | 'pending'

function childStatus(child: BroadcastChildInfo): ChildStatus {
  if (child.completedAt != null) return 'completed'
  if (child.columnPosition > 0) return 'inprogress'
  return 'pending'
}

function memberName(m: DepartmentMember | undefined, userId: number): string {
  if (!m) return `Участник #${userId}`
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ')
  return m.email ?? `Участник #${userId}`
}

function memberInitial(m: DepartmentMember | undefined): string {
  return (m?.firstname?.[0] ?? m?.email?.[0] ?? '?').toUpperCase()
}

const STATUS_LABEL: Record<ChildStatus, string> = {
  completed: 'Выполнено',
  inprogress: 'В работе',
  pending: 'Не начато',
}

type Props = {
  taskId: number
  progress: BroadcastProgress
  members: DepartmentMember[]
  canManage: boolean
  onProgressChange: (next: BroadcastProgress) => void
}

export function BroadcastTrackerSection({ taskId, progress, members, canManage, onProgressChange }: Props) {
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const [addQuery, setAddQuery] = useState('')
  const [addBusy, setAddBusy] = useState<number | null>(null)
  const [removeBusy, setRemoveBusy] = useState<number | null>(null)
  const [approveBusy, setApproveBusy] = useState<number | null>(null)
  const [error, setError] = useState('')
  const addRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { total, completed, children } = progress
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const existingUserIds = new Set(children.map((c) => c.userId))
  const availableToAdd = members.filter((m) => !existingUserIds.has(m.id))
  const filtered = addQuery.trim()
    ? availableToAdd.filter((m) => {
        const q = addQuery.trim().toLowerCase()
        return (
          m.firstname?.toLowerCase().includes(q) ||
          m.lastname?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
        )
      })
    : availableToAdd

  useEffect(() => {
    if (!addOpen) return
    setTimeout(() => inputRef.current?.focus(), 0)
    const onDown = (e: MouseEvent) => {
      if (!addRef.current?.contains(e.target as Node)) setAddOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [addOpen])

  const handleAdd = useCallback(
    async (userId: number) => {
      setAddBusy(userId)
      setError('')
      try {
        const next = await tasksAPI.addBroadcastMember(taskId, userId)
        onProgressChange(next)
        setAddOpen(false)
        setAddQuery('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка добавления')
      } finally {
        setAddBusy(null)
      }
    },
    [taskId, onProgressChange],
  )

  const handleRemove = useCallback(
    async (userId: number) => {
      setRemoveBusy(userId)
      setError('')
      try {
        const next = await tasksAPI.removeBroadcastMember(taskId, userId)
        onProgressChange(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка удаления')
      } finally {
        setRemoveBusy(null)
      }
    },
    [taskId, onProgressChange],
  )

  const handleApproveChild = useCallback(
    async (child: BroadcastChildInfo) => {
      if (!child.pipelineLastColumnId) return
      setApproveBusy(child.taskId)
      setError('')
      try {
        await tasksAPI.placeInColumn(child.pipelineLastColumnId, child.taskId, { insertAfterTaskId: null })
        // Обновляем прогресс — refetch через getBroadcastProgress
        const next = await tasksAPI.getBroadcastProgress(taskId)
        onProgressChange(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка завершения задачи')
      } finally {
        setApproveBusy(null)
      }
    },
    [taskId, onProgressChange],
  )

  const sorted = [...children].sort((a, b) => {
    const order: Record<ChildStatus, number> = { completed: 2, inprogress: 1, pending: 0 }
    return order[childStatus(b)] - order[childStatus(a)]
  })

  const byStatus: Record<ChildStatus, BroadcastChildInfo[]> = {
    inprogress: sorted.filter((c) => childStatus(c) === 'inprogress'),
    pending: sorted.filter((c) => childStatus(c) === 'pending'),
    completed: sorted.filter((c) => childStatus(c) === 'completed'),
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.icon} aria-hidden>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span className={styles.title}>Раздельная задача задачи</span>
          <span className={styles.countBadge}>{total} участников</span>

          {canManage && (
            <div className={styles.addWrap} ref={addRef}>
              <button
                type="button"
                className={styles.addBtn}
                onClick={() => setAddOpen((v) => !v)}
                aria-label="Добавить участника"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Добавить участника
              </button>

              {addOpen && (
                <div className={styles.addDropdown}>
                  <input
                    ref={inputRef}
                    className={styles.addSearch}
                    placeholder="Поиск по имени или email…"
                    value={addQuery}
                    onChange={(e) => setAddQuery(e.target.value)}
                  />
                  <ul className={styles.addList}>
                    {filtered.length === 0 && (
                      <li className={styles.addEmpty}>
                        {availableToAdd.length === 0 ? 'Все участники отдела уже добавлены' : 'Никого не найдено'}
                      </li>
                    )}
                    {filtered.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={styles.addMemberRow}
                          disabled={addBusy === m.id}
                          onClick={() => handleAdd(m.id)}
                        >
                          <span className={styles.addAvatar}>{memberInitial(m)}</span>
                          <span className={styles.addMemberName}>{memberName(m, m.id)}</span>
                          {addBusy === m.id
                            ? <span className={styles.addSpinner} aria-hidden />
                            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.addIcon} aria-hidden><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          }
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.progressRow}>
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
          <span className={styles.progressLabel}>
            <strong>{completed}</strong> / {total}
            <span className={styles.progressPct}>{pct}%</span>
          </span>
        </div>

        {canManage && (
          <p className={styles.propagationNote}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Изменения названия, описания, дат и меток автоматически применяются ко всем участникам
          </p>
        )}
      </header>

      {error && <p className={styles.sectionError}>{error}</p>}

      <div className={styles.groups}>
        {(Object.entries(byStatus) as [ChildStatus, BroadcastChildInfo[]][]).map(([status, group]) => {
          if (!group.length) return null
          return (
            <div key={status} className={styles.group}>
              <p className={styles.groupLabel}>
                <span className={`${styles.groupDot} ${styles[`dot_${status}`]}`} aria-hidden />
                {STATUS_LABEL[status]}
                <span className={styles.groupCount}>{group.length}</span>
              </p>
              <ul className={styles.memberList}>
                {group.map((child) => {
                  const member = members.find((m) => m.id === child.userId)
                  return (
                    <li key={child.taskId}>
                      <div className={styles.memberRow}>
                        <span className={`${styles.avatar} ${styles[`avatar_${status}`]}`} aria-hidden>
                          {memberInitial(member)}
                        </span>
                        <button
                          type="button"
                          className={styles.memberNameBtn}
                          onClick={() => navigate(`/tasks/${child.taskId}`)}
                          title="Открыть задачу участника"
                        >
                          {memberName(member, child.userId)}
                        </button>
                        <span className={styles.memberColumn}>{child.columnName}</span>
                        {canManage && child.columnIsReview && (
                          <button
                            type="button"
                            className={styles.approveBtn}
                            disabled={approveBusy === child.taskId}
                            onClick={() => handleApproveChild(child)}
                            title="Принять и завершить задачу"
                          >
                            {approveBusy === child.taskId
                              ? <span className={styles.addSpinner} aria-hidden />
                              : <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Завершить
                                </>
                            }
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            className={styles.removeBtn}
                            disabled={removeBusy === child.userId}
                            onClick={() => handleRemove(child.userId)}
                            title="Удалить из рассылки"
                            aria-label={`Удалить ${memberName(member, child.userId)} из рассылки`}
                          >
                            {removeBusy === child.userId
                              ? <span className={styles.addSpinner} aria-hidden />
                              : '×'}
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
    </section>
  )
}
