import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDndContext } from '@dnd-kit/core'
import { useVirtualizer } from '@tanstack/react-virtual'
import { tasksModel } from 'entities/tasks'
import { userModel } from 'entities/user'
import { EditTaskInlineForm } from 'features/task/update/inline'
import { tasksAPI } from 'shared/api/requests/tasks'
import { delTask } from 'shared/api/events/tasks'
import { SortableTaskCard } from './SortableTaskCard'
import { BroadcastGroupCard } from './BroadcastGroupCard'
import { CreateTaskDrawer } from './CreateTaskDrawer'
import { Button } from 'shared/ui'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'
import { makeTaskId } from 'shared/lib/dndIds'
import styles from './ColumnTasks.module.css'
import type { Task, PipelineBoardTaskFilter } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import type { DepartmentPolicies } from 'shared/types/departmentPoliciesConfig'
import type { Column } from 'shared/types/columns'

/** Начиная с этого числа карточек включаем виртуализацию. */
const VIRTUALIZE_THRESHOLD = 30
/** Приблизительная высота одной карточки в пикселях (оценка для useVirtualizer). */
const ESTIMATED_TASK_HEIGHT = 108
/** Сколько «лишних» карточек сверху/снизу держать в DOM. */
const VIRTUAL_OVERSCAN = 6

type ColumnTasksProps = {
  columnId: number
  departmentId: number
  /** Название колонки для шапки панели создания */
  columnTitle?: string
  organizationId?: number
  /** Личное пространство — исполнитель всегда текущий пользователь */
  isPersonalOrganization?: boolean
  canCreate: boolean
  members: DepartmentMember[]
  columns: Column[]
  /** Для прав: перетаскивание / редактирование / удаление */
  currentUserId?: number
  canManageDepartment?: boolean
  /** Активные фильтры канбана (серверная фильтрация списка в колонке). */
  boardFilter?: PipelineBoardTaskFilter
  departmentPolicies?: DepartmentPolicies | null
}

export function ColumnTasks({
  columnId,
  departmentId,
  columnTitle = '',
  isPersonalOrganization = false,
  canCreate,
  members,
  columns,
  currentUserId,
  canManageDepartment = false,
  boardFilter = {},
  departmentPolicies = null,
}: ColumnTasksProps) {
  const navigate = useNavigate()
  const currentUser = userModel.selectors.useUser()
  const tasks = tasksModel.selectors.useTasksByColumn(columnId)
  const { total, loaded } = tasksModel.selectors.useColumnTaskMeta(columnId)
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [appending, setAppending] = useState(false)
  const [appendError, setAppendError] = useState<string | null>(null)

  const hasMoreOnServer = total != null && loaded < total
  const remainingOnServer = hasMoreOnServer ? total! - loaded : 0

  /** dnd-kit требует, чтобы все id были в items, иначе не анимирует раздвижение.
   *  Во время drag мы отключаем виртуализацию, поэтому DOM-узлы также доступны для hit-testing. */
  const sortableItemIds = useMemo(
    () =>
      tasks
        .filter((task) => !(editingTask && editingTask.id === task.id))
        .map((task) => makeTaskId(task.id)),
    [tasks, editingTask],
  )

  const firstDraggableRowIndex = useMemo(
    () => tasks.findIndex((task) => !(editingTask && editingTask.id === task.id)),
    [tasks, editingTask],
  )

  const nextPosition = useMemo(
    () => (tasks.length ? Math.max(...tasks.map((t) => t.position)) + 1 : 0),
    [tasks],
  )

  const deadlineNeutralColumn = useMemo(
    () => isTaskInCompletedPipelineColumn(columnId, columns),
    [columnId, columns],
  )

  /** Последняя колонка воронки — в ней нельзя создавать новые задачи */
  const canAddTaskHere = canCreate && !deadlineNeutralColumn

  const getResponsibleForTask = useCallback(
    (task: Task): DepartmentMember | null => {
      if (task.responsibleId != null) {
        const fromDept = members.find((m) => m.id === task.responsibleId)
        if (fromDept) return fromDept
      }
      if (
        isPersonalOrganization &&
        currentUser != null &&
        currentUserId === currentUser.id &&
        (task.responsibleId == null || task.responsibleId === currentUser.id)
      ) {
        return {
          id: currentUser.id,
          email: currentUser.email,
          firstname: currentUser.firstname,
          lastname: currentUser.lastname,
          role: 'member',
        }
      }
      return null
    },
    [members, isPersonalOrganization, currentUser, currentUserId],
  )

  const getResponsiblesForTask = useCallback(
    (task: Task): DepartmentMember[] => {
      const ids = task.responsibleIds && task.responsibleIds.length
        ? task.responsibleIds
        : task.responsibleId != null
          ? [task.responsibleId]
          : []
      const list: DepartmentMember[] = []
      for (const id of ids) {
        const fromDept = members.find((m) => m.id === id)
        if (fromDept) {
          list.push(fromDept)
          continue
        }
        if (currentUser != null && currentUser.id === id) {
          list.push({
            id: currentUser.id,
            email: currentUser.email,
            firstname: currentUser.firstname,
            lastname: currentUser.lastname,
            role: 'member',
          })
        }
      }
      return list
    },
    [members, currentUser],
  )

  const getCreatorForTask = useCallback(
    (task: Task): DepartmentMember | null => {
      if (task.creatorId == null) return null
      const fromDept = members.find((m) => m.id === task.creatorId)
      if (fromDept) return fromDept
      if (currentUser != null && task.creatorId === currentUser.id) {
        return {
          id: currentUser.id,
          email: currentUser.email,
          firstname: currentUser.firstname,
          lastname: currentUser.lastname,
          role: 'member',
        }
      }
      return null
    },
    [members, currentUser],
  )

  const canEditTask = (t: Task) =>
    canManageDepartment ||
    (currentUserId != null && t.creatorId === currentUserId)

  const canDragTask = (t: Task) => {
    if (canManageDepartment) return true
    if (currentUserId == null) return false
    if (t.creatorId === currentUserId) return true
    const ids = t.responsibleIds && t.responsibleIds.length
      ? t.responsibleIds
      : t.responsibleId != null
        ? [t.responsibleId]
        : []
    return ids.includes(currentUserId)
  }

  const canDeleteTask = (t: Task) =>
    canManageDepartment ||
    (currentUserId != null && t.creatorId === currentUserId)

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Удалить задачу "${task.name}"?`)) return

    try {
      await tasksAPI.delete(task.id)
      delTask(task.id)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  useEffect(() => {
    if (!canAddTaskHere && showCreate) setShowCreate(false)
  }, [canAddTaskHere, showCreate])

  /** Читаем активное перетаскивание у ближайшего DndContext, чтобы временно отключать виртуализацию. */
  const { active: activeDnd } = useDndContext()
  const isDragging = activeDnd != null

  const tasksListRef = useRef<HTMLDivElement | null>(null)
  const shouldVirtualize = !isDragging && tasks.length >= VIRTUALIZE_THRESHOLD

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => tasksListRef.current,
    estimateSize: () => ESTIMATED_TASK_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
    getItemKey: (index) => {
      const t = tasks[index]
      return t ? t.id : index
    },
  })

  const handleAppend = useCallback(() => {
    if (appending || !hasMoreOnServer) return
    setAppending(true)
    setAppendError(null)
    tasksModel
      .appendColumnTasksPageFx({ columnId, filter: boardFilter })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Не удалось загрузить ещё задачи'
        setAppendError(msg)
      })
      .finally(() => {
        setAppending(false)
      })
  }, [appending, hasMoreOnServer, columnId, boardFilter])

  const renderTaskCard = (task: Task, index: number) => {
    const isEditing = editingTask != null && editingTask.id === task.id

    // Родительская карточка-трекер рассылки: показываем BroadcastGroupCard
    if (task.broadcastProgress != null) {
      return (
        <BroadcastGroupCard
          task={task}
          members={members}
          canDrag={canDragTask(task)}
          onEdit={canEditTask(task) ? () => navigate(`/tasks/${task.id}`) : undefined}
          onDelete={canDeleteTask(task) ? () => handleDeleteTask(task) : undefined}
        />
      )
    }

    if (isEditing && canEditTask(task)) {
      return (
        <EditTaskInlineForm
          task={task}
          departmentId={departmentId}
          members={members}
          isPersonalOrganization={isPersonalOrganization}
          currentUserId={currentUserId}
          onCancel={() => setEditingTask(null)}
        />
      )
    }
    return (
      <SortableTaskCard
        task={task}
        tags={task.tags ?? []}
        responsible={getResponsibleForTask(task)}
        responsibles={getResponsiblesForTask(task)}
        creator={getCreatorForTask(task)}
        canDrag={canDragTask(task)}
        onEdit={!isEditing && canEditTask(task) ? () => setEditingTask(task) : undefined}
        onDelete={!isEditing && canDeleteTask(task) ? () => handleDeleteTask(task) : undefined}
        isFirstInColumn={index === firstDraggableRowIndex}
        deadlineNeutral={deadlineNeutralColumn}
      />
    )
  }

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  return (
    <div className={styles.wrapper}>
      <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
        <div
          className={styles.tasksList}
          ref={tasksListRef}
          data-virtualized={shouldVirtualize || undefined}
        >
          {tasks.length === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} aria-hidden>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </span>
              <p className={styles.emptyMessage}>Нет задач в колонке</p>
            </div>
          )}

          {shouldVirtualize ? (
            <div
              className={styles.virtualInner}
              style={{ height: `${totalSize}px`, position: 'relative' }}
            >
              {virtualItems.map((vi) => {
                const task = tasks[vi.index]
                if (!task) return null
                return (
                  <div
                    key={task.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    className={styles.virtualItem}
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    {renderTaskCard(task, vi.index)}
                  </div>
                )
              })}
            </div>
          ) : (
            tasks.map((task, index) => (
              <div key={task.id}>{renderTaskCard(task, index)}</div>
            ))
          )}

          {appending ? (
            <div className={styles.infiniteLoading} aria-live="polite">
              Загрузка…
            </div>
          ) : null}
        </div>
      </SortableContext>

      {appendError ? (
        <div className={styles.appendError} role="alert">
          <span>{appendError}</span>
          <button
            type="button"
            className={styles.appendErrorRetry}
            onClick={handleAppend}
            disabled={appending}
          >
            Повторить
          </button>
        </div>
      ) : null}

      {hasMoreOnServer && remainingOnServer > 0 ? (
        <div className={styles.showMore}>
          <button
            type="button"
            className={styles.showMoreBtn}
            disabled={appending}
            onClick={handleAppend}
          >
            <span className={styles.showMoreIcon} aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
            <span className={styles.showMoreLabel}>Показать ещё</span>
            <span className={styles.showMoreBadge}>{remainingOnServer}</span>
          </button>
        </div>
      ) : null}

      {canAddTaskHere ? (
        <div className={styles.addTaskSection}>
          <Button
            variant="ghost"
            onClick={() => setShowCreate(true)}
            className={styles.addTaskBtn}
          >
            + Добавить задачу
          </Button>
        </div>
      ) : null}

      <CreateTaskDrawer
        open={Boolean(showCreate && canAddTaskHere && !editingTask)}
        onClose={() => setShowCreate(false)}
        columnId={columnId}
        departmentId={departmentId}
        nextPosition={nextPosition}
        titleId={`create-task-drawer-title-${columnId}`}
        columnTitle={columnTitle}
        members={members}
        isPersonalOrganization={isPersonalOrganization}
        currentUserId={currentUserId}
        departmentPolicies={departmentPolicies}
      />
    </div>
  )
}
