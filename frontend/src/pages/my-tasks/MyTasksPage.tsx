import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUpDown } from 'lucide-react'
import {
  TaskCalendar,
  TaskCalendarViewToggle,
  CalendarOrgQuickCreateDrawer,
  useCalendarDisplayMode,
  useCalendarMonthQuery,
  calendarMonthQueryKey,
  type MyTasksViewMode,
} from 'features/calendar'
import {
  AppLayout,
  Dropdown,
  FilterSelectTrigger,
  filterSelectDropdownClassName,
  PaginationBar,
  type DropdownItem,
} from 'shared/ui'
import { userModel } from 'entities/user'
import { organizationModel } from 'entities/organization'
import { ScopedTasksTable, type ScopedTasksTableRow } from 'entities/tasks'
import { tasksAPI } from 'shared/api/requests/tasks'
import { organizationsAPI } from 'shared/api/requests/organizations'
import type { Task } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import { formatTaskDateRangeShort, isTaskDeadlineOverdue } from 'shared/lib/formatTaskDateRange'
import { formatCompletionDate } from 'shared/lib/formatCompletionDate'
import { cn, useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import type { MyTasksListSortMode } from 'shared/lib/taskListSort'
import { MY_TASKS_COLUMN_VISIBLE, MY_TASKS_PAGE_SIZE } from 'shared/lib/myTasksPagination'
import { organizationPageMounted, organizationPageUnmounted } from 'pages/organization/model'
import styles from './MyTasksPage.module.css'

function mergeTaskLists(existing: Task[], incoming: Task[]): Task[] {
  const byId = new Map(existing.map((t) => [t.id, t]))
  for (const t of incoming) byId.set(t.id, t)
  return [...byId.values()].sort((a, b) => a.position - b.position || a.id - b.id)
}

function rowsToBuckets(rows: { task: Task; buckets: string[] }[]) {
  const outgoing: Task[] = []
  const incoming: Task[] = []
  const review: Task[] = []
  const completed: Task[] = []
  const overdue: Task[] = []
  for (const row of rows) {
    if (row.buckets.includes('outgoing')) outgoing.push(row.task)
    if (row.buckets.includes('incoming')) incoming.push(row.task)
    if (row.buckets.includes('review')) review.push(row.task)
    if (row.buckets.includes('completed')) completed.push(row.task)
    if (row.buckets.includes('overdue')) overdue.push(row.task)
  }
  return { outgoing, incoming, review, completed, overdue }
}

function mergeOrgMyTasksBuckets(
  buckets: { label: string; color: string; stageDone: boolean; tasks: Task[] }[],
): ScopedTasksTableRow[] {
  type Acc = { task: Task; labels: string[]; colors: string[]; stageDone: boolean }
  const byId = new Map<number, Acc>()
  for (const b of buckets) {
    for (const task of b.tasks) {
      const cur = byId.get(task.id)
      if (!cur) {
        byId.set(task.id, {
          task,
          labels: [b.label],
          colors: [b.color],
          stageDone: b.stageDone,
        })
      } else {
        if (!cur.labels.includes(b.label)) {
          cur.labels.push(b.label)
          cur.colors.push(b.color)
        }
        cur.stageDone = cur.stageDone || b.stageDone
      }
    }
  }
  const orderIdx = new Map(buckets.map((x, i) => [x.label, i] as const))
  return [...byId.values()]
    .sort((a, b) => {
      const ai = Math.min(...a.labels.map((l) => orderIdx.get(l) ?? 999))
      const bi = Math.min(...b.labels.map((l) => orderIdx.get(l) ?? 999))
      if (ai !== bi) return ai - bi
      return a.task.position - b.task.position || a.task.id - b.task.id
    })
    .map((r) => ({
      task: r.task,
      stageLabel: r.labels.join(', '),
      stageDone: r.stageDone,
      stageDotColor: r.colors[0],
    }))
}

export function MyTasksPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const organizationId = Number(id)
  const currentUser = userModel.selectors.useUser()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outgoing, setOutgoing] = useState<Task[]>([])
  const [incoming, setIncoming] = useState<Task[]>([])
  const [review, setReview] = useState<Task[]>([])
  const [completed, setCompleted] = useState<Task[]>([])
  const [overdue, setOverdue] = useState<Task[]>([])
  const [total, setTotal] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [boardPage, setBoardPage] = useState(1)
  const [boardLoadingMore, setBoardLoadingMore] = useState(false)
  const [orgMembers, setOrgMembers] = useState<DepartmentMember[]>([])
  const layoutStorageKey = `myOrgTasksLayout:${organizationId}`
  const listSortStorageKey = `myOrgTasksListSort:${organizationId}`
  const calendarDisplayModeStorageKey =
    organizationId > 0 ? `myOrgTasksCalendarMode:${organizationId}` : ''
  const [taskLayout, setTaskLayoutState] = useState<MyTasksViewMode>('board')
  const [listSort, setListSortState] = useState<MyTasksListSortMode>('bucket')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [calendarDisplayMode, setCalendarDisplayMode] = useCalendarDisplayMode(
    calendarDisplayModeStorageKey,
  )
  const [calendarCreateOpen, setCalendarCreateOpen] = useState(false)
  const [calendarCreateYmd, setCalendarCreateYmd] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    try {
      const v = localStorage.getItem(layoutStorageKey)
      if (v === 'list' || v === 'calendar') setTaskLayoutState(v)
      else setTaskLayoutState('board')
    } catch {
      setTaskLayoutState('board')
    }
  }, [layoutStorageKey])

  const setTaskLayout = useCallback(
    (mode: MyTasksViewMode) => {
      setTaskLayoutState(mode)
      try {
        localStorage.setItem(layoutStorageKey, mode)
      } catch {
        /* ignore */
      }
    },
    [layoutStorageKey],
  )

  const isMobileLayout = useMediaQuery(mediaMaxMobileQuery)

  useEffect(() => {
    try {
      const v = localStorage.getItem(listSortStorageKey)
      if (v === 'deadline_asc' || v === 'deadline_desc' || v === 'bucket') {
        setListSortState(v)
      } else {
        setListSortState('bucket')
      }
    } catch {
      setListSortState('bucket')
    }
  }, [listSortStorageKey])

  const setListSort = useCallback(
    (mode: MyTasksListSortMode) => {
      setListSortState(mode)
      try {
        localStorage.setItem(listSortStorageKey, mode)
      } catch {
        /* ignore */
      }
      setListPage(1)
      setBoardPage(1)
    },
    [listSortStorageKey],
  )

  useEffect(() => {
    if (!organizationId) return
    organizationsAPI
      .getMembers(organizationId)
      .then((list) =>
        setOrgMembers(
          list.map((m) => ({
            id: m.id,
            email: m.email,
            firstname: m.firstname ?? '',
            lastname: m.lastname ?? '',
            role: 'member' as const,
          })),
        ),
      )
      .catch(() => setOrgMembers([]))
  }, [organizationId])

  useEffect(() => {
    if (!organizationId) return
    organizationPageMounted({ organizationId })
    return () => organizationPageUnmounted()
  }, [organizationId])

  const effectiveTaskLayout: MyTasksViewMode =
    isMobileLayout && taskLayout === 'board' ? 'list' : taskLayout

  const calendarQueryScope =
    effectiveTaskLayout === 'calendar' && organizationId > 0
      ? {
          type: 'organization' as const,
          organizationId,
          scope: 'mine' as const,
          sort: listSort,
        }
      : null

  const calendarQuery = useCalendarMonthQuery(
    calendarMonth,
    calendarQueryScope,
    calendarDisplayMode,
  )

  useEffect(() => {
    if (!currentUser || !currentOrganization || effectiveTaskLayout !== 'list') return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await tasksAPI.getMyTasksByOrganizationPaginated(
          currentOrganization.id,
          {
            page: listPage,
            pageSize: MY_TASKS_PAGE_SIZE,
            sort: listSort,
          },
        )
        const buckets = rowsToBuckets(data.rows)

        if (!cancelled) {
          setOutgoing(buckets.outgoing)
          setIncoming(buckets.incoming)
          setReview(buckets.review)
          setCompleted(buckets.completed)
          setOverdue(buckets.overdue)
          setTotal(data.total)
          setListPage(data.page)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить задачи')
          setOutgoing([])
          setIncoming([])
          setReview([])
          setCompleted([])
          setOverdue([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [currentUser, currentOrganization, listPage, listSort, effectiveTaskLayout])

  useEffect(() => {
    if (!currentUser || !currentOrganization || effectiveTaskLayout !== 'board') return

    let cancelled = false
    const load = async () => {
      if (boardPage === 1) setLoading(true)
      else setBoardLoadingMore(true)
      setError(null)
      try {
        const data = await tasksAPI.getMyTasksByOrganizationPaginated(
          currentOrganization.id,
          {
            page: boardPage,
            pageSize: MY_TASKS_PAGE_SIZE,
            sort: listSort,
          },
        )
        const buckets = rowsToBuckets(data.rows)

        if (!cancelled) {
          if (boardPage === 1) {
            setOutgoing(buckets.outgoing)
            setIncoming(buckets.incoming)
            setReview(buckets.review)
            setCompleted(buckets.completed)
            setOverdue(buckets.overdue)
          } else {
            setOutgoing((prev) => mergeTaskLists(prev, buckets.outgoing))
            setIncoming((prev) => mergeTaskLists(prev, buckets.incoming))
            setReview((prev) => mergeTaskLists(prev, buckets.review))
            setCompleted((prev) => mergeTaskLists(prev, buckets.completed))
            setOverdue((prev) => mergeTaskLists(prev, buckets.overdue))
          }
          setTotal(data.total)
          setBoardPage(data.page)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Не удалось загрузить задачи')
          if (boardPage === 1) {
            setOutgoing([])
            setIncoming([])
            setReview([])
            setCompleted([])
            setOverdue([])
            setTotal(0)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setBoardLoadingMore(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [currentUser, currentOrganization, boardPage, listSort, effectiveTaskLayout])

  useEffect(() => {
    setListPage(1)
    setBoardPage(1)
    setOutgoing([])
    setIncoming([])
    setReview([])
    setCompleted([])
    setOverdue([])
    setTotal(0)
  }, [currentOrganization?.id])

  useEffect(() => {
    setListPage(1)
    setBoardPage(1)
  }, [listSort, effectiveTaskLayout])

  const isPersonal =
    Boolean(currentUser) &&
    currentOrganization != null &&
    currentOrganization.id === organizationId &&
    Boolean(currentOrganization.isPersonal)

  const listSortDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'bucket', label: 'По типу задачи' },
      { id: 'deadline_asc', label: 'Срок — сначала ближайшие' },
      { id: 'deadline_desc', label: 'Срок — сначала поздние' },
    ],
    [],
  )

  const tableRows = useMemo(() => {
    if (isPersonal) {
      return mergeOrgMyTasksBuckets([
        {
          label: 'Завершённые',
          color: 'var(--color-text-secondary)',
          stageDone: true,
          tasks: completed,
        },
        {
          label: 'Просроченные',
          color: 'var(--color-required)',
          stageDone: false,
          tasks: overdue,
        },
      ])
    }
    return mergeOrgMyTasksBuckets([
      {
        label: 'Исходящие',
        color: 'var(--color-accent)',
        stageDone: false,
        tasks: outgoing,
      },
      {
        label: 'Входящие',
        color: 'var(--color-accent)',
        stageDone: false,
        tasks: incoming,
      },
      {
        label: 'Проверка',
        color: 'var(--color-accent-secondary)',
        stageDone: false,
        tasks: review,
      },
      {
        label: 'Завершённые',
        color: 'var(--color-text-secondary)',
        stageDone: true,
        tasks: completed,
      },
      {
        label: 'Просроченные',
        color: 'var(--color-required)',
        stageDone: false,
        tasks: overdue,
      },
    ])
  }, [isPersonal, outgoing, incoming, review, completed, overdue])

  const totalPages = Math.max(1, Math.ceil(total / MY_TASKS_PAGE_SIZE) || 1)
  const boardHasMoreOnServer = boardPage * MY_TASKS_PAGE_SIZE < total

  const handleListPageChange = useCallback((nextPage: number) => {
    setListPage(nextPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleBoardLoadMore = useCallback(() => {
    if (boardLoadingMore || !boardHasMoreOnServer) return
    setBoardPage((p) => p + 1)
  }, [boardLoadingMore, boardHasMoreOnServer])

  if (!currentUser) {
    return (
      <AppLayout>
        <div className={styles.centered}>
          <h1 className={styles.title}>Мои задачи</h1>
          <p className={styles.text}>Авторизуйтесь, чтобы просматривать задачи.</p>
        </div>
      </AppLayout>
    )
  }

  if (!currentOrganization || currentOrganization.id !== organizationId) {
    return (
      <AppLayout>
        <div className={styles.centered}>
          <h1 className={styles.title}>Мои задачи</h1>
          <p className={styles.text}>Загрузка…</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div
        className={cn(
          styles.page,
          isMobileLayout && effectiveTaskLayout === 'calendar' && styles.pageCalendarMode,
        )}
      >
        <div className={styles.header}>
          <div>
            <h1 className={styles.pageTitle}>
              {isPersonal ? 'Личные задачи' : 'Мои задачи организации'}
            </h1>
            <p className={styles.pageSubtitle}>
              {isPersonal
                ? 'Завершённые и просроченные задачи в вашем личном пространстве.'
                : 'Входящие и порученные другим; завершённые и просроченные — в том числе по вашим поручениям (с меткой «Создано мной»).'}
            </p>
          </div>
          <div className={styles.headerAside}>
            <TaskCalendarViewToggle
              variant="myTasks"
              value={taskLayout}
              onChange={setTaskLayout}
              hideBoard={isMobileLayout}
              className={styles.viewToggle}
            />
            <div className={styles.headerMeta}>
              <span className={styles.metaItem}>Всего: {total}</span>
            </div>
          </div>
        </div>

        {effectiveTaskLayout === 'list' ? (
          <div className={styles.listSortBand}>
            <div className={styles.listSortBandIntro}>
              <span className={styles.listSortBandTitle}>Порядок в таблице</span>
            </div>
            <div className={styles.listSortBandControl}>
              <Dropdown
                items={listSortDropdownItems}
                value={listSort}
                placeholder="По типу"
                searchPlaceholder="Найти вариант…"
                size="large"
                renderTrigger={({ open, selectedLabel, toggle }) => (
                  <FilterSelectTrigger
                    open={open}
                    selectedLabel={selectedLabel || 'По типу'}
                    toggle={toggle}
                    icon={<ArrowUpDown size={16} strokeWidth={1.75} aria-hidden />}
                  />
                )}
                onChange={(value) => {
                  const raw = value == null ? 'bucket' : String(value)
                  if (raw === 'bucket' || raw === 'deadline_asc' || raw === 'deadline_desc') {
                    setListSort(raw as MyTasksListSortMode)
                  }
                }}
                className={filterSelectDropdownClassName}
              />
            </div>
          </div>
        ) : null}

        {error && <div className={styles.error}>{error}</div>}

        {effectiveTaskLayout === 'calendar' ? (
          <div className={styles.calendarWrap}>
            <TaskCalendar
              tasks={calendarQuery.data ?? []}
              loading={calendarQuery.isPending}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              displayMode={calendarDisplayMode}
              onDisplayModeChange={setCalendarDisplayMode}
              canCreate
              onAddTask={(ymd) => {
                setCalendarCreateYmd(ymd)
                setCalendarCreateOpen(true)
              }}
              onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
            />
          </div>
        ) : loading ? (
          <div className={styles.loading}>Загрузка задач...</div>
        ) : effectiveTaskLayout === 'list' ? (
          <ScopedTasksTable
            rows={tableRows}
            members={orgMembers}
            currentUser={
              currentUser
                ? {
                    id: currentUser.id,
                    firstname: currentUser.firstname ?? '',
                    lastname: currentUser.lastname ?? '',
                    email: currentUser.email ?? '',
                  }
                : null
            }
            isPersonalOrganization={isPersonal}
          />
        ) : (
          <div
            className={
              isPersonal ? `${styles.columnsGrid} ${styles.columnsGridPersonal}` : styles.columnsGrid
            }
          >
            {isPersonal ? (
              <>
                <TaskColumn
                  title="Завершённые"
                  items={completed}
                  emptyText="Нет завершённых задач"
                  currentUserId={currentUser.id}
                  showCompletedAt
                  listKey={`${organizationId}-done`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
                <TaskColumn
                  title="Просроченные"
                  items={overdue}
                  emptyText="Нет просроченных задач"
                  currentUserId={currentUser.id}
                  listKey={`${organizationId}-overdue`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
              </>
            ) : (
              <>
                <TaskColumn
                  title="Исходящие"
                  items={outgoing}
                  emptyText="Нет исходящих задач"
                  currentUserId={currentUser.id}
                  highlightCreated
                  listKey={`${organizationId}-out`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
                <TaskColumn
                  title="Входящие"
                  items={incoming}
                  emptyText="Нет входящих задач"
                  currentUserId={currentUser.id}
                  listKey={`${organizationId}-in`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
                <TaskColumn
                  title="Проверка"
                  items={review}
                  emptyText="Нет задач для проверки"
                  currentUserId={currentUser.id}
                  highlightCreated
                  listKey={`${organizationId}-review`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
                <TaskColumn
                  title="Завершённые"
                  items={completed}
                  emptyText="Нет завершённых задач"
                  currentUserId={currentUser.id}
                  highlightCreated
                  showCompletedAt
                  listKey={`${organizationId}-done`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
                <TaskColumn
                  title="Просроченные"
                  items={overdue}
                  emptyText="Нет просроченных задач"
                  currentUserId={currentUser.id}
                  highlightCreated
                  listKey={`${organizationId}-overdue`}
                  hasMoreOnServer={boardHasMoreOnServer}
                  loadingMore={boardLoadingMore}
                  onLoadMore={handleBoardLoadMore}
                />
              </>
            )}
          </div>
        )}

        {effectiveTaskLayout === 'list' ? (
          <PaginationBar
            page={listPage}
            totalPages={totalPages}
            totalItems={total}
            pageSize={MY_TASKS_PAGE_SIZE}
            onPageChange={handleListPageChange}
            disabled={loading}
          />
        ) : null}
      </div>
      <CalendarOrgQuickCreateDrawer
        open={calendarCreateOpen}
        onClose={() => setCalendarCreateOpen(false)}
        organizationId={organizationId}
        ymd={calendarCreateYmd}
        isPersonalOrganization={isPersonal}
        currentUserId={currentUser?.id}
        onCreated={() => {
          if (calendarQueryScope) {
            queryClient.invalidateQueries({
              queryKey: calendarMonthQueryKey(calendarQueryScope, calendarMonth, calendarDisplayMode),
            })
          }
        }}
      />
    </AppLayout>
  )
}

type TaskColumnProps = {
  title: string
  items: Task[]
  emptyText: string
  highlightCreated?: boolean
  /** Дата завершения для автора поручения */
  showCompletedAt?: boolean
  currentUserId: number
  listKey: string
  hasMoreOnServer?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
}

function TaskColumn({
  title,
  items,
  emptyText,
  highlightCreated,
  showCompletedAt,
  currentUserId,
  listKey,
  hasMoreOnServer = false,
  loadingMore = false,
  onLoadMore,
}: TaskColumnProps) {
  const navigate = useNavigate()
  const [visibleCount, setVisibleCount] = useState(MY_TASKS_COLUMN_VISIBLE)

  useEffect(() => {
    setVisibleCount(MY_TASKS_COLUMN_VISIBLE)
  }, [listKey])

  const shown = items.slice(0, Math.min(visibleCount, items.length))
  const hiddenInMemory = items.length - shown.length
  const canLoadFromServer = hasMoreOnServer && hiddenInMemory === 0
  const showMoreButton = hiddenInMemory > 0 || canLoadFromServer

  const handleShowMore = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    if (hiddenInMemory > 0) {
      setVisibleCount((c) => c + MY_TASKS_COLUMN_VISIBLE)
      return
    }
    onLoadMore?.()
  }

  return (
    <section className={styles.column}>
      <div className={styles.columnHeader}>
        <h2 className={styles.columnTitle}>{title}</h2>
        <span className={styles.columnCount}>{items.length}</span>
      </div>
      <div className={styles.columnBody}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>{emptyText}</p>
          </div>
        ) : (
          <>
            {shown.map((task) => {
              const dateLabel = formatTaskDateRangeShort(task)
              return (
              <article
                key={task.id}
                className={styles.taskCard}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <div className={styles.taskHeader}>
                  <span className={styles.taskId}>#{task.id}</span>
                  {dateLabel && (
                    <span
                      className={`${styles.taskDeadline} ${
                        isTaskDeadlineOverdue(task)
                          ? styles.taskDeadlineOverdue
                          : styles.taskDeadlineOnTrack
                      }`}
                    >
                      {dateLabel}
                    </span>
                  )}
                </div>
                <h3 className={styles.taskTitle}>{task.name}</h3>
                {highlightCreated && task.creatorId === currentUserId && (
                  <div className={styles.taskMeta}>
                    <span className={styles.metaBadgeCreated}>Создано мной</span>
                  </div>
                )}
                {showCompletedAt &&
                  task.creatorId === currentUserId &&
                  task.completedAt &&
                  formatCompletionDate(task.completedAt) && (
                    <div className={styles.taskMeta}>
                      <span className={styles.metaBadgeCompleted} title="Когда задача попала в завершающую колонку">
                        Завершена {formatCompletionDate(task.completedAt)}
                      </span>
                    </div>
                  )}
              </article>
            )})}
            {showMoreButton ? (
              <button
                type="button"
                className={styles.loadMoreBtn}
                disabled={loadingMore && hiddenInMemory === 0}
                onClick={handleShowMore}
              >
                {loadingMore && hiddenInMemory === 0
                  ? 'Загрузка…'
                  : hiddenInMemory > 0
                    ? `Показать ещё (${hiddenInMemory})`
                    : 'Загрузить ещё'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
