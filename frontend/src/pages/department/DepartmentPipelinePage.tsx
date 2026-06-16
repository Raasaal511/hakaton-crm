import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate } from 'react-router-dom'
import { useUnit } from 'effector-react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { AppLayout, InlineEdit, Button, PipelineBoardSkeleton, PageHeader, Dropdown, FilterSelectTrigger, filterSelectDropdownClassName, type DropdownItem } from 'shared/ui'
import { List, ListFilter, Settings, UserPlus, ArrowUpDown, Plus, X } from 'lucide-react'
import {
  TaskCalendar,
  TaskCalendarViewToggle,
  useCalendarDisplayMode,
  useCalendarMonthQuery,
  calendarMonthQueryKey,
  type BoardViewMode,
} from 'features/calendar'
import { CreateColumnForm } from 'features/column/create'
import { CreateTaskForm } from 'features/task/create'
import { columnsAPI } from 'shared/api/requests/columns'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { editColumn, delColumn, reorderColumns } from 'shared/api/events/columns'
import {
  clearTasks,
  reorderTasks,
  editTask,
  setTasksForColumns,
  setColumnTaskTotals,
  moveColumnTaskTotal,
} from 'shared/api/events/tasks'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { columnsModel, BoardColumn } from 'entities/columns'
import columnStyles from 'entities/columns/ui/BoardColumn.module.css'
import {
  ColumnTasks,
  tasksModel,
  PipelineBoardTaskTable,
  PipelineBoardListLoadMore,
  CreateTaskDrawer,
} from 'entities/tasks'
import drawerChromeStyles from '../../entities/tasks/ui/ColumnTasks.module.css'
import { TaskCard } from 'entities/tasks/ui/TaskCard'
import { tasksAPI } from 'shared/api/requests/tasks'
import { tagsAPI } from 'shared/api/requests/tags'
import { userModel } from 'entities/user'
import {
  useCanManageDepartment,
  useDeleteWithConfirm,
  cn,
  useMediaQuery,
  mediaMaxMobileQuery,
  useBottomSheetDrag,
} from 'shared/lib'
import { parseColId, parseTaskId } from 'shared/lib/dndIds'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'
import { compareTaskRowsByDeadline, type PipelineBoardListSortMode } from 'shared/lib/taskListSort'
import { pipelineModel } from 'entities/pipeline'
import { pipelineBoardMounted, departmentPageUnmounted } from './model'
import styles from './DepartmentPage.module.css'
import type { Task, PipelineBoardTaskFilter } from 'shared/types/tasks'
import type { Tag } from 'shared/types/tags'
import type { Column } from 'shared/types/columns'
import type { Pipeline } from 'shared/types/pipelines'
import type { DepartmentMember } from 'shared/types/departments'

function snapshotTasksState(state: Record<number, Task[]>): Record<number, Task[]> {
  const next: Record<number, Task[]> = {}
  for (const [k, v] of Object.entries(state)) {
    next[Number(k)] = [...v]
  }
  return next
}

export function DepartmentPipelinePage() {
  const { id, pipelineId: pipelineIdParam } = useParams<{ id: string; pipelineId: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)
  const pipelineId = Number(pipelineIdParam)

  const [showAddColumn, setShowAddColumn] = useState(false)
  const [activeColumnId, setActiveColumnId] = useState<number | null>(null)
  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [boardNotice, setBoardNotice] = useState<string | null>(null)
  const { deleteError } = useDeleteWithConfirm()

  const boardRef = useRef<HTMLDivElement>(null)
  const scrollbarTrackRef = useRef<HTMLDivElement>(null)
  const [scrollbarThumb, setScrollbarThumb] = useState({ left: 0, width: 0 })
  const thumbDragRef = useRef({ active: false, startX: 0, startScrollLeft: 0 })
  const taskDragSourceColumnRef = useRef<number | null>(null)
  const tasksSnapshotBeforeDragRef = useRef<Record<number, Task[]> | null>(null)

  const totalsSnapshotBeforeDragRef = useRef<Record<number, number> | null>(null)
  const lastTaskDragOverKeyRef = useRef<string>('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const placeInFlightRef = useRef<boolean>(false)

  const [boardSearch, setBoardSearch] = useState('')
  const [debouncedBoardSearch, setDebouncedBoardSearch] = useState('')
  const [filterTagId, setFilterTagId] = useState<number | undefined>(undefined)
  const [filterResponsibleId, setFilterResponsibleId] = useState<number | undefined>(undefined)
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false)
  const [filterHideCompleted, setFilterHideCompleted] = useState(false)
  const [departmentTags, setDepartmentTags] = useState<Tag[]>([])
  const [boardFiltersOpen, setBoardFiltersOpen] = useState(false)
  const boardFiltersShellRef = useRef<HTMLDivElement>(null)

  const boardLayoutStorageKey =
    departmentId > 0 && pipelineId > 0 ? `boardLayout:${departmentId}:${pipelineId}` : ''
  const boardListSortStorageKey =
    departmentId > 0 && pipelineId > 0 ? `boardListSort:${departmentId}:${pipelineId}` : ''
  const calendarDisplayModeStorageKey =
    departmentId > 0 && pipelineId > 0
      ? `calendarDisplayMode:${departmentId}:${pipelineId}`
      : ''

  const [boardLayout, setBoardLayoutState] = useState<BoardViewMode>('kanban')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [calendarDisplayMode, setCalendarDisplayMode] = useCalendarDisplayMode(
    calendarDisplayModeStorageKey,
  )
  const [calendarCreateYmd, setCalendarCreateYmd] = useState('')
  const [boardListSort, setBoardListSortState] = useState<PipelineBoardListSortMode>('column')

  useEffect(() => {
    if (!boardLayoutStorageKey) return
    try {
      const v = localStorage.getItem(boardLayoutStorageKey)
      if (v === 'list' || v === 'calendar') setBoardLayoutState(v)
      else setBoardLayoutState('kanban')
    } catch {
      setBoardLayoutState('kanban')
    }
  }, [boardLayoutStorageKey])

  useEffect(() => {
    if (!boardListSortStorageKey) return
    try {
      const v = localStorage.getItem(boardListSortStorageKey)
      if (v === 'deadline_asc' || v === 'deadline_desc' || v === 'column') {
        setBoardListSortState(v)
      } else {
        setBoardListSortState('column')
      }
    } catch {
      setBoardListSortState('column')
    }
  }, [boardListSortStorageKey])

  const setBoardLayout = useCallback(
    (mode: BoardViewMode) => {
      setBoardLayoutState(mode)
      if (!boardLayoutStorageKey) return
      try {
        localStorage.setItem(boardLayoutStorageKey, mode)
      } catch {
        /* ignore */
      }
    },
    [boardLayoutStorageKey],
  )

  const setBoardListSort = useCallback(
    (mode: PipelineBoardListSortMode) => {
      setBoardListSortState(mode)
      if (!boardListSortStorageKey) return
      try {
        localStorage.setItem(boardListSortStorageKey, mode)
      } catch {
        /* ignore */
      }
    },
    [boardListSortStorageKey],
  )

  const isMobileLayout = useMediaQuery(mediaMaxMobileQuery)
  const effectiveBoardLayout: BoardViewMode =
    isMobileLayout && boardLayout === 'kanban' ? 'list' : boardLayout

  const queryClient = useQueryClient()

  const tasksBoardState = useUnit(tasksModel.$tasksStore)
  const listFetchPending = useUnit(tasksModel.fetchPipelineColumnTasksFirstPageFx.pending)

  const department = departmentModel.selectors.useCurrentDepartment()
  const members = departmentModel.selectors.useDepartmentMembers()
  const columns = columnsModel.selectors.useColumns()
  const currentUser = userModel.selectors.useUser()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const organizations = organizationModel.selectors.useOrganizations()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const {
    canManageDepartment,
    canManageMembers,
    canManagePipelines,
    canManageColumns,
    canSeeAllTasks,
    canCreateTasks: canCreateTasksInDept,
  } = useCanManageDepartment(orgMembers, members, currentUser?.id, department?.permissions)

  const departmentOrg = department
    ? organizations.find((o) => o.id === department.organizationId) ??
      (currentOrganization?.id === department.organizationId ? currentOrganization : null)
    : null
  const showDepartmentMembersNav = Boolean(departmentOrg && !departmentOrg.isPersonal)

  const resolveResponsibleForTaskCard = useCallback(
    (task: Task): DepartmentMember | null => {
      if (task.responsibleId != null) {
        const m = members.find((x) => x.id === task.responsibleId)
        if (m) return m
      }
      if (
        departmentOrg?.isPersonal &&
        currentUser != null &&
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
    [members, departmentOrg?.isPersonal, currentUser],
  )

  const resolveCreatorForTaskCard = useCallback(
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

  const resolveResponsiblesForTaskCard = useCallback(
    (task: Task): DepartmentMember[] => {
      const ids =
        task.responsibleIds && task.responsibleIds.length
          ? task.responsibleIds
          : task.responsibleId != null
            ? [task.responsibleId]
            : []
      const list: DepartmentMember[] = []
      for (const memberId of ids) {
        const fromDept = members.find((m) => m.id === memberId)
        if (fromDept) {
          list.push(fromDept)
          continue
        }
        if (currentUser != null && currentUser.id === memberId) {
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

  const canMoveTaskOnBoard = useCallback(
    (task: Task) => {
      if (!currentUser) return false
      if (canSeeAllTasks) return true
      if (task.creatorId === currentUser.id) return true
      const ids = task.responsibleIds && task.responsibleIds.length
        ? task.responsibleIds
        : task.responsibleId != null
          ? [task.responsibleId]
          : []
      return ids.includes(currentUser.id)
    },
    [currentUser, canSeeAllTasks],
  )

  const pipelineLocked = Boolean(pipeline?.isMainTemplate)
  const canManageStructure = canManageColumns && !pipelineLocked
  const canManageColor = canManageColumns

  const visibleColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  )

  const columnIds = useMemo(() => visibleColumns.map((c) => c.id), [visibleColumns])
  const columnIdsKey = columnIds.join(',')

  const pipelineBoardFilter = useMemo((): PipelineBoardTaskFilter => {
    const f: PipelineBoardTaskFilter = {}
    if (debouncedBoardSearch) f.q = debouncedBoardSearch.slice(0, 200)
    if (filterTagId != null && filterTagId > 0) f.tagId = filterTagId
    if (filterResponsibleId != null && filterResponsibleId > 0) f.responsibleId = filterResponsibleId
    if (filterOverdueOnly) f.overdue = true
    if (filterHideCompleted) f.excludeCompleted = true
    return f
  }, [debouncedBoardSearch, filterTagId, filterResponsibleId, filterOverdueOnly, filterHideCompleted])

  const pipelineBoardFilterKey = useMemo(
    () => JSON.stringify(pipelineBoardFilter),
    [pipelineBoardFilter],
  )

  const calendarQueryScope =
    effectiveBoardLayout === 'calendar' && pipelineId > 0
      ? ({ type: 'pipeline' as const, pipelineId, filter: pipelineBoardFilter })
      : null

  const calendarQuery = useCalendarMonthQuery(
    calendarMonth,
    calendarQueryScope,
    calendarDisplayMode,
  )

  const pipelineBoardTaskTableRows = useMemo(() => {
    const rows: { task: Task; column: Column }[] = []
    for (const column of visibleColumns) {
      const tasks = tasksBoardState[column.id] ?? []
      const sorted = [...tasks].sort((a, b) =>
        a.position !== b.position ? a.position - b.position : a.id - b.id,
      )
      for (const task of sorted) {
        rows.push({ task, column })
      }
    }
    if (boardListSort === 'deadline_asc') {
      return [...rows].sort((a, b) => compareTaskRowsByDeadline(a.task, b.task, 'asc'))
    }
    if (boardListSort === 'deadline_desc') {
      return [...rows].sort((a, b) => compareTaskRowsByDeadline(a.task, b.task, 'desc'))
    }
    return rows
  }, [visibleColumns, tasksBoardState, boardListSort])

  const sortedBoardMembers = useMemo(
    () =>
      [...members].sort((a, b) =>
        `${a.lastname} ${a.firstname}`.localeCompare(`${b.lastname} ${b.firstname}`, 'ru'),
      ),
    [members],
  )

  const sortedDepartmentTags = useMemo(
    () => [...departmentTags].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [departmentTags],
  )

  const tagDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все теги' },
      ...sortedDepartmentTags.map((t) => ({
        id: t.id,
        label: t.name,
        avatarInitial: (t.name.trim().charAt(0) || '#').toUpperCase(),
      })),
    ],
    [sortedDepartmentTags],
  )

  const memberDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все исполнители' },
      ...sortedBoardMembers.map((m) => ({
        id: m.id,
        label: `${m.firstname} ${m.lastname}`.trim() || m.email,
        avatarInitial: m.firstname?.[0]?.toUpperCase() || '?',
      })),
    ],
    [sortedBoardMembers],
  )

  const boardListSortDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'column', label: 'По колонкам воронки' },
      { id: 'deadline_asc', label: 'Срок — сначала ближайшие' },
      { id: 'deadline_desc', label: 'Срок — сначала поздние' },
    ],
    [],
  )

  const hasActiveBoardFilter = useMemo(
    () =>
      debouncedBoardSearch.length > 0 ||
      (filterTagId != null && filterTagId > 0) ||
      (filterResponsibleId != null && filterResponsibleId > 0) ||
      filterOverdueOnly ||
      filterHideCompleted,
    [debouncedBoardSearch, filterTagId, filterResponsibleId, filterOverdueOnly, filterHideCompleted],
  )

  const columnSortableIds = useMemo(
    () => visibleColumns.map((c) => `col-${c.id}`),
    [visibleColumns],
  )
  /** Актуальный снимок задач по колонкам (без подписки — снижает ререндеры доски). */
  const getTasksByColumn = useCallback((): Record<number, Task[]> => {
    return tasksModel.$tasksStore.getState() as Record<number, Task[]>
  }, [])

  const canMoveTaskToColumn = useCallback(
    (task: Task, targetColumnId: number) => {
      if (!canMoveTaskOnBoard(task)) return false
      if (task.columnId == null) return false
      if (!pipeline?.isMainTemplate || visibleColumns.length === 0) return true
      const lastPos = Math.max(...visibleColumns.map((c) => c.position))
      const lastCol = visibleColumns.find((c) => c.position === lastPos)
      if (!lastCol || targetColumnId !== lastCol.id) return true
      const samePerson = task.creatorId != null && task.creatorId === task.responsibleId
      if (samePerson || canSeeAllTasks) return true
      if (currentUser && task.creatorId === currentUser.id) return true
      if (
        currentUser &&
        task.responsibleId === currentUser.id &&
        task.creatorId !== currentUser.id
      ) {
        return false
      }
      return true
    },
    [canMoveTaskOnBoard, pipeline?.isMainTemplate, visibleColumns, canSeeAllTasks, currentUser],
  )

  const getListMoveColumnsForTask = useCallback(
    (task: Task): Column[] => {
      if (visibleColumns.length === 0) return []
      if (!pipeline?.isMainTemplate) return visibleColumns
      const lastPos = Math.max(...visibleColumns.map((c) => c.position))
      const lastCol = visibleColumns.find((c) => c.position === lastPos)
      if (!lastCol) return visibleColumns
      const samePerson = task.creatorId != null && task.creatorId === task.responsibleId
      if (samePerson || canSeeAllTasks || (currentUser && task.creatorId === currentUser.id)) {
        return visibleColumns
      }
      if (
        currentUser &&
        task.responsibleId === currentUser.id &&
        task.creatorId !== currentUser.id
      ) {
        return visibleColumns.filter((c) => c.id !== lastCol.id)
      }
      return visibleColumns
    },
    [visibleColumns, pipeline?.isMainTemplate, canSeeAllTasks, currentUser],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const canCreateTasks = canCreateTasksInDept

  const creatableColumns = useMemo(() => {
    const sorted = [...visibleColumns].sort((a, b) => a.position - b.position)
    return sorted.filter((c) => !isTaskInCompletedPipelineColumn(c.id, visibleColumns))
  }, [visibleColumns])

  const [listCreateSheetOpen, setListCreateSheetOpen] = useState(false)
  const [listCreateColumnId, setListCreateColumnId] = useState<number | null>(null)
  const [listCreateFormMountKey, setListCreateFormMountKey] = useState(0)

  const listCreateColumnDropdownItems = useMemo<DropdownItem[]>(
    () => creatableColumns.map((c) => ({ id: c.id, label: c.name })),
    [creatableColumns],
  )

  const listCreateNextPosition = useMemo(() => {
    if (listCreateColumnId == null) return 0
    const tasks = tasksBoardState[listCreateColumnId] ?? []
    return tasks.length ? Math.max(...tasks.map((t) => t.position)) + 1 : 0
  }, [listCreateColumnId, tasksBoardState])

  const listCreateTargetColumn = useMemo(
    () => visibleColumns.find((c) => c.id === listCreateColumnId) ?? null,
    [visibleColumns, listCreateColumnId],
  )

  const openListCreateSheet = useCallback((presetYmd?: string) => {
    const firstId = creatableColumns[0]?.id ?? null
    setListCreateColumnId(firstId)
    setCalendarCreateYmd(presetYmd ?? '')
    setListCreateFormMountKey((k) => k + 1)
    setListCreateSheetOpen(true)
  }, [creatableColumns])

  useEffect(() => {
    if (!listCreateSheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListCreateSheetOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [listCreateSheetOpen])

  useEffect(() => {
    if (!listCreateSheetOpen || listCreateColumnId == null) return
    if (!creatableColumns.some((c) => c.id === listCreateColumnId)) {
      const next = creatableColumns[0]?.id ?? null
      setListCreateColumnId(next)
      if (next == null) setListCreateSheetOpen(false)
    }
  }, [listCreateSheetOpen, listCreateColumnId, creatableColumns])

  const filterSheetDrag = useBottomSheetDrag({
    open: boardFiltersOpen,
    onClose: () => setBoardFiltersOpen(false),
  })

  const listCreateSheetDrag = useBottomSheetDrag({
    open: listCreateSheetOpen && isMobileLayout,
    onClose: () => setListCreateSheetOpen(false),
  })

  const canUseListCreateSheet = useMemo(
    () => canCreateTasks && creatableColumns.length > 0,
    [canCreateTasks, creatableColumns.length],
  )

  const showListCreateChrome = useMemo(
    () => effectiveBoardLayout === 'list' && canUseListCreateSheet,
    [effectiveBoardLayout, canUseListCreateSheet],
  )

  const showMobileListCreate = isMobileLayout && showListCreateChrome

  const activeColumn = useMemo(
    () => (activeColumnId == null ? null : visibleColumns.find((c) => c.id === activeColumnId) ?? null),
    [activeColumnId, visibleColumns],
  )

  const dndModifiers = useMemo(
    () => [
      ({ transform }: { transform: { x: number; y: number; scaleX: number; scaleY: number } }) =>
        activeColumnId == null
          ? transform
          : {
            ...transform,
            y: 0,
          },
    ],
    [activeColumnId],
  )

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedBoardSearch(boardSearch.trim()), 400)
    return () => window.clearTimeout(t)
  }, [boardSearch])

  useEffect(() => {
    if (!boardFiltersOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('[data-dropdown-menu-portal]')) return
      const el = boardFiltersShellRef.current
      if (el && el.contains(t as Node)) return
      setBoardFiltersOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBoardFiltersOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [boardFiltersOpen])

  useEffect(() => {
    if (!departmentId) return
    tagsAPI.getByDepartment(departmentId).then(setDepartmentTags).catch(() => setDepartmentTags([]))
  }, [departmentId])

  useEffect(() => {
    if (!departmentId || !pipelineId) return
    pipelineBoardMounted({ departmentId, pipelineId })
    return () => departmentPageUnmounted()
  }, [departmentId, pipelineId])

  useEffect(() => {
    if (!departmentId || columnIds.length === 0) return
    clearTasks()
    tasksModel.fetchPipelineColumnTasksFirstPageFx({
      columnIds,
      filter: pipelineBoardFilter,
    })
  }, [departmentId, columnIdsKey, columnIds, pipelineBoardFilterKey])

  useEffect(() => {
    if (!departmentId || !pipelineId) return

    setPipelineError(null)
    const cached = pipelineModel.$pipelinesByDepartment.getState()[departmentId] ?? []

    if (cached.length > 0) {
      const found = cached.find((p) => p.id === pipelineId) ?? null
      setPipeline(found)
      if (!found) {
        setPipelineError('Воронка не найдена или была удалена')
      }
      return
    }

    pipelinesAPI
      .getAll(departmentId)
      .then((list) => {
        pipelineModel.setPipelines({ departmentId, pipelines: list })
        const found = list.find((p) => p.id === pipelineId) ?? null
        setPipeline(found)
        if (!found) {
          setPipelineError('Воронка не найдена или была удалена')
        }
      })
      .catch(() => {
        setPipelineError('Не удалось загрузить воронку')
      })
  }, [departmentId, pipelineId])

  useEffect(() => {
    const content = pipeline?.name?.trim() ? `${pipeline.name.trim()} - Meridian` : 'Meridian'
    const descriptionMeta = document.querySelector('meta[name="description"]')

    document.title = content
    if (!descriptionMeta) return

    const previousDescription = descriptionMeta.getAttribute('content') ?? ''
    descriptionMeta.setAttribute('content', content)

    return () => {
      document.title = 'Meridian'
      descriptionMeta.setAttribute('content', previousDescription)
    }
  }, [pipeline?.name])

  const findColumnIdByTaskId = (taskId: number): number | null => {
    const snapshot = getTasksByColumn()
    for (const [colId, tasks] of Object.entries(snapshot)) {
      if ((tasks ?? []).some((t: Task) => t.id === taskId)) {
        return Number(colId)
      }
    }
    return null
  }

  const findTaskById = (taskId: number): Task | null => {
    const snapshot = getTasksByColumn()
    for (const tasks of Object.values(snapshot)) {
      const t = (tasks ?? []).find((x: Task) => x.id === taskId)
      if (t) return t
    }
    return null
  }

  const handlePipelineListMoveTask = useCallback(
    (taskId: number, targetColumnId: number) => {
      if (placeInFlightRef.current) return
      const draggedTask = findTaskById(taskId)
      if (!draggedTask || !canMoveTaskOnBoard(draggedTask)) return
      if (!canMoveTaskToColumn(draggedTask, targetColumnId)) return
      const currentCol = findColumnIdByTaskId(taskId)
      if (currentCol == null || currentCol === targetColumnId) return

      const snapshot = getTasksByColumn()
      const snapshotForRollback = snapshotTasksState(snapshot)
      const totalsForRollback = {
        ...(tasksModel.$columnTaskTotals.getState() as Record<number, number>),
      }

      const sourceIds = (snapshot[currentCol] ?? [])
        .filter((t) => t.id !== taskId)
        .map((t) => t.id)
      const targetList = (snapshot[targetColumnId] ?? []).filter((t) => t.id !== taskId)
      const targetIds = [...targetList.map((t) => t.id), taskId]

      reorderTasks({ columnId: currentCol, taskIds: sourceIds })
      reorderTasks({ columnId: targetColumnId, taskIds: targetIds })
      editTask({ ...draggedTask, columnId: targetColumnId, position: targetList.length })
      moveColumnTaskTotal({ from: currentCol, to: targetColumnId })

      const insertAfterTaskId: number | null =
        targetList.length > 0 ? targetList[targetList.length - 1]!.id : null

      placeInFlightRef.current = true
      tasksAPI
        .placeInColumn(targetColumnId, taskId, { insertAfterTaskId })
        .then(({ autoCompletedParent }) => {
          if (autoCompletedParent) {
            const stored = findTaskById(autoCompletedParent.id)
            if (stored && stored.columnId !== autoCompletedParent.columnId) {
              editTask({ ...stored, columnId: autoCompletedParent.columnId, completedAt: new Date().toISOString() })
              moveColumnTaskTotal({ from: stored.columnId, to: autoCompletedParent.columnId })
            }
          }
        })
        .catch((err: unknown) => {
          setTasksForColumns(snapshotForRollback)
          setColumnTaskTotals(totalsForRollback)
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Не удалось переместить задачу'
          setBoardNotice(msg)
        })
        .finally(() => {
          placeInFlightRef.current = false
        })
    },
    [canMoveTaskOnBoard, canMoveTaskToColumn, getTasksByColumn, findTaskById],
  )

  const updateScrollbar = useCallback(() => {
    const board = boardRef.current
    const track = scrollbarTrackRef.current
    if (!board || !track) return
    const trackWidth = track.offsetWidth
    const scrollWidth = board.scrollWidth
    const clientWidth = board.clientWidth
    const scrollLeft = board.scrollLeft
    const maxScroll = Math.max(0, scrollWidth - clientWidth)
    if (maxScroll <= 0) {
      setScrollbarThumb({ left: 0, width: trackWidth })
      return
    }
    const thumbWidth = Math.max(24, (clientWidth / scrollWidth) * trackWidth)
    const thumbLeft = (scrollLeft / maxScroll) * (trackWidth - thumbWidth)
    setScrollbarThumb({ left: thumbLeft, width: thumbWidth })
  }, [])

  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    updateScrollbar()
    board.addEventListener('scroll', updateScrollbar)
    const ro = new ResizeObserver(updateScrollbar)
    ro.observe(board)
    if (scrollbarTrackRef.current) ro.observe(scrollbarTrackRef.current)
    return () => {
      board.removeEventListener('scroll', updateScrollbar)
      ro.disconnect()
    }
  }, [updateScrollbar, visibleColumns.length, effectiveBoardLayout])

  const handleScrollbarTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const board = boardRef.current
      const track = scrollbarTrackRef.current
      if (!board || !track || e.target !== track) return
      const rect = track.getBoundingClientRect()
      const x = e.clientX - rect.left
      const trackWidth = track.offsetWidth
      const scrollWidth = board.scrollWidth
      const clientWidth = board.clientWidth
      const maxScroll = Math.max(0, scrollWidth - clientWidth)
      if (maxScroll <= 0) return
      const clickRatio = x / trackWidth
      const scrollLeft = clickRatio * maxScroll
      board.scrollLeft = scrollLeft
    },
    []
  )

  const handleScrollbarThumbMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const board = boardRef.current
    const track = scrollbarTrackRef.current
    if (!board || !track) return
    thumbDragRef.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: board.scrollLeft,
    }
    const onMouseMove = (moveE: MouseEvent) => {
      if (!thumbDragRef.current.active) return
      const trackWidth = track.offsetWidth
      const scrollWidth = board.scrollWidth
      const clientWidth = board.clientWidth
      const maxScroll = Math.max(0, scrollWidth - clientWidth)
      if (maxScroll <= 0) return
      const thumbWidth = Math.max(24, (clientWidth / scrollWidth) * trackWidth)
      const deltaX = moveE.clientX - thumbDragRef.current.startX
      const deltaScroll = (deltaX / (trackWidth - thumbWidth)) * maxScroll
      board.scrollLeft = Math.max(0, Math.min(maxScroll, thumbDragRef.current.startScrollLeft + deltaScroll))
    }
    const onMouseUp = () => {
      thumbDragRef.current.active = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  const activeTaskDeadlineNeutral = useMemo(
    () =>
      activeTask != null &&
      isTaskInCompletedPipelineColumn(activeTask.columnId, visibleColumns),
    [activeTask, visibleColumns],
  )

  const handleDragStart = (event: DragStartEvent) => {
    // Пока предыдущий placeInColumn-запрос в полёте — не стартуем новый drag,
    // чтобы избежать гонок за итоговый порядок.
    if (placeInFlightRef.current) {
      return
    }
    const id = String(event.active.id)
    if (id.startsWith('col-')) {
      setActiveColumnId(parseColId(id))
      return
    }
    if (id.startsWith('task-')) {
      const taskId = parseTaskId(id)
      const snapshot = getTasksByColumn()
      const col = findColumnIdByTaskId(taskId)
      const task = findTaskById(taskId)
      setActiveTask(task)
      taskDragSourceColumnRef.current = col
      tasksSnapshotBeforeDragRef.current = snapshotTasksState(snapshot)
      totalsSnapshotBeforeDragRef.current = {
        ...(tasksModel.$columnTaskTotals.getState() as Record<number, number>),
      }
      lastTaskDragOverKeyRef.current = ''
    }
  }

  /** При переносе в другую колонку — сразу перемещаем задачу в стор, чтобы dnd-kit раздвигал карточки. */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    const activeId = String(active.id)
    if (!activeId.startsWith('task-') || !over) return

    const taskId = parseTaskId(active.id)
    if (!taskId) return

    const draggedTask = findTaskById(taskId)
    if (!draggedTask || !canMoveTaskOnBoard(draggedTask)) return

    const overId = String(over.id)
    let targetColumnId: number

    if (overId.startsWith('col-')) {
      targetColumnId = parseColId(over.id)
    } else if (overId.startsWith('task-')) {
      const overColId = findColumnIdByTaskId(parseTaskId(over.id))
      if (!overColId) return
      targetColumnId = overColId
    } else {
      return
    }

    if (!canMoveTaskToColumn(draggedTask, targetColumnId)) return

    const currentCol = findColumnIdByTaskId(taskId)
    if (currentCol == null || currentCol === targetColumnId) return

    const dedupeKey = `${taskId}|${currentCol}|${targetColumnId}`
    if (dedupeKey === lastTaskDragOverKeyRef.current) return
    lastTaskDragOverKeyRef.current = dedupeKey

    const snapshot = getTasksByColumn()
    const sourceIds = (snapshot[currentCol] ?? []).filter((t) => t.id !== taskId).map((t) => t.id)
    const targetList = (snapshot[targetColumnId] ?? []).filter((t) => t.id !== taskId)
    const targetIds = [...targetList.map((t) => t.id), taskId]

    reorderTasks({ columnId: currentCol, taskIds: sourceIds })
    reorderTasks({ columnId: targetColumnId, taskIds: targetIds })
    editTask({ ...draggedTask, columnId: targetColumnId, position: targetList.length })
    // Явно корректируем счётчики: sample на clock=editTask не видит старую колонку,
    // т.к. $tasksStore уже обновлён. Без этого в исходной колонке появляется лишний
    // «Загрузить ещё», счётчик которого растёт на каждое перетаскивание.
    moveColumnTaskTotal({ from: currentCol, to: targetColumnId })
  }

  const clearTaskDragRefs = () => {
    taskDragSourceColumnRef.current = null
    tasksSnapshotBeforeDragRef.current = null
    totalsSnapshotBeforeDragRef.current = null
    lastTaskDragOverKeyRef.current = ''
    setActiveTask(null)
  }

  const handleDragCancel = () => {
    setActiveColumnId(null)
    if (tasksSnapshotBeforeDragRef.current) {
      setTasksForColumns(tasksSnapshotBeforeDragRef.current)
    }
    if (totalsSnapshotBeforeDragRef.current) {
      setColumnTaskTotals(totalsSnapshotBeforeDragRef.current)
    }
    clearTaskDragRefs()
  }

  const handleDelete = async (column: Column) => {
    if (!confirm(`Удалить колонку "${column.name}"?`)) return

    try {
      await columnsAPI.delete(departmentId, column.id)
      delColumn(column.id)
    } catch (error) {
      console.error('Failed to delete column:', error)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveColumnId(null)
    const activeId = String(active.id)

    if (activeId.startsWith('col-')) {
      if (!over) return
      const overId = String(over.id)
      if (!canManageColumns || pipelineLocked) return
      const oldIndex = columnSortableIds.indexOf(activeId)
      const newIndex = columnSortableIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1 || active.id === over.id) return
      const previousOrder = [...columnIds]
      const newOrder = arrayMove(columnIds, oldIndex, newIndex)
      reorderColumns(newOrder)
      columnsAPI.reorder(departmentId, newOrder).catch(() => {
        reorderColumns(previousOrder)
      })
      return
    }

    if (activeId.startsWith('task-')) {
      const taskId = parseTaskId(active.id)
      if (!taskId) {
        clearTaskDragRefs()
        return
      }

      if (!over) {
        if (tasksSnapshotBeforeDragRef.current) {
          setTasksForColumns(tasksSnapshotBeforeDragRef.current)
        }
        if (totalsSnapshotBeforeDragRef.current) {
          setColumnTaskTotals(totalsSnapshotBeforeDragRef.current)
        }
        clearTaskDragRefs()
        return
      }

      const startedSource = taskDragSourceColumnRef.current
      const snapshotForRollback = tasksSnapshotBeforeDragRef.current
      const totalsForRollback = totalsSnapshotBeforeDragRef.current
      const draggedTask = findTaskById(taskId)
      if (!draggedTask || startedSource == null) {
        clearTaskDragRefs()
        return
      }
      if (!canMoveTaskOnBoard(draggedTask)) {
        clearTaskDragRefs()
        return
      }

      const overId = String(over.id)

      // Определяем целевую колонку ВСЕГДА по over.id (а не по текущему положению задачи в сторе) —
      // это чиню кейс «быстрого» drop без предшествующего dragOver, когда задача ещё в источнике.
      let targetColumnId: number
      if (overId.startsWith('task-')) {
        const overTaskId = parseTaskId(over.id)
        const resolved = findColumnIdByTaskId(overTaskId)
        if (resolved == null) {
          clearTaskDragRefs()
          return
        }
        targetColumnId = resolved
      } else if (overId.startsWith('col-')) {
        targetColumnId = parseColId(over.id)
      } else {
        clearTaskDragRefs()
        return
      }

      if (!canMoveTaskToColumn(draggedTask, targetColumnId)) {
        clearTaskDragRefs()
        return
      }

      // Сначала, если задача ещё не перенесена в target (быстрый drop) — синхронно перекладываем в сторе.
      let snapshot = getTasksByColumn()
      const currentCol = findColumnIdByTaskId(taskId) ?? startedSource
      if (currentCol !== targetColumnId) {
        const sourceIds = (snapshot[currentCol] ?? [])
          .filter((t) => t.id !== taskId)
          .map((t) => t.id)
        const targetList = (snapshot[targetColumnId] ?? []).filter((t) => t.id !== taskId)
        const targetIds = [...targetList.map((t) => t.id), taskId]
        reorderTasks({ columnId: currentCol, taskIds: sourceIds })
        reorderTasks({ columnId: targetColumnId, taskIds: targetIds })
        editTask({ ...draggedTask, columnId: targetColumnId, position: targetList.length })
        // Явно двигаем счётчики: sample({ clock: editTask }) читает state ПОСЛЕ .on и
        // не ловит смену колонки. Без этого в исходной колонке «зависает» лишний total.
        moveColumnTaskTotal({ from: currentCol, to: targetColumnId })
        snapshot = getTasksByColumn()
      }

      const currentTasks = snapshot[targetColumnId] ?? []
      const currentIds = currentTasks.map((t: Task) => t.id)
      const activeIndex = currentIds.indexOf(taskId)
      if (activeIndex === -1) {
        clearTaskDragRefs()
        return
      }

      let overIndex: number
      if (overId.startsWith('task-')) {
        const overTaskId = parseTaskId(over.id)
        overIndex = currentIds.indexOf(overTaskId)
        if (overIndex === -1) overIndex = activeIndex
      } else if (overId.startsWith('col-')) {
        // Drop в пустую область колонки. Для same-column это означает «в конец», но
        // при пагинации мы не видим серверный хвост — чтобы не отправить задачу
        // в середину списка вместо конца, не реагируем на такой drop, если есть
        // неподгруженные задачи.
        const totals = tasksModel.$columnTaskTotals.getState()
        const total = totals[targetColumnId]
        const allLoaded = total == null || currentIds.length >= total
        if (!allLoaded && targetColumnId === startedSource) {
          if (snapshotForRollback) setTasksForColumns(snapshotForRollback)
          if (totalsForRollback) setColumnTaskTotals(totalsForRollback)
          clearTaskDragRefs()
          return
        }
        overIndex = currentIds.length - 1
      } else {
        clearTaskDragRefs()
        return
      }

      const isCrossColumn = targetColumnId !== startedSource

      if (!isCrossColumn && activeIndex === overIndex) {
        clearTaskDragRefs()
        return
      }

      const newOrder = arrayMove(currentIds, activeIndex, overIndex)
      reorderTasks({ columnId: targetColumnId, taskIds: newOrder })
      const newIndex = newOrder.indexOf(taskId)
      const insertAfterTaskId: number | null = newIndex > 0 ? newOrder[newIndex - 1]! : null

      placeInFlightRef.current = true
      tasksAPI
        .placeInColumn(targetColumnId, taskId, { insertAfterTaskId })
        .then(({ autoCompletedParent }) => {
          if (autoCompletedParent) {
            const stored = findTaskById(autoCompletedParent.id)
            if (stored && stored.columnId !== autoCompletedParent.columnId) {
              editTask({ ...stored, columnId: autoCompletedParent.columnId, completedAt: new Date().toISOString() })
              moveColumnTaskTotal({ from: stored.columnId, to: autoCompletedParent.columnId })
            }
          }
        })
        .catch((err: unknown) => {
          if (snapshotForRollback) setTasksForColumns(snapshotForRollback)
          if (totalsForRollback) setColumnTaskTotals(totalsForRollback)
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Не удалось переместить задачу'
          setBoardNotice(msg)
        })
        .finally(() => {
          placeInFlightRef.current = false
        })

      clearTaskDragRefs()
    }
  }

  const handlePipelineNameSave = async (newName: string) => {
    if (!pipeline) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed === pipeline.name) return
    try {
      const updated = await pipelinesAPI.update(pipeline.id, trimmed)
      setPipeline(updated)
      pipelineModel.editPipeline(updated)
    } catch (error) {
      console.error('Failed to update pipeline name:', error)
      setPipelineError('Не удалось сохранить название воронки')
    }
  }

  const handleClearBoardFilter = useCallback(() => {
    setBoardSearch('')
    setDebouncedBoardSearch('')
    setFilterTagId(undefined)
    setFilterResponsibleId(undefined)
    setFilterOverdueOnly(false)
    setFilterHideCompleted(false)
    setBoardFiltersOpen(false)
  }, [])

  const handleAddColumnClick = () => {
    setShowAddColumn(true)
  }

  const getColumnRenameHandler = (column: Column) => {
    return async (newName: string) => {
      try {
        const updated = await (columnsAPI as any).update(departmentId, column.id, {
          name: newName,
        })
        editColumn(updated)
      } catch (error) {
        console.error('Failed to update column name:', error)
      }
    }
  }

  const getColumnDeleteHandler = (column: Column) => {
    return () => {
      handleDelete(column)
    }
  }

  const handleCloseAddColumn = () => {
    setShowAddColumn(false)
  }

  if (!department) {
    return (
      <AppLayout>
        <PipelineBoardSkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title={pipeline?.name ?? '…'}
          titleNode={
            canManagePipelines && !pipelineLocked ? (
              <InlineEdit
                value={pipeline?.name ?? ''}
                onSave={handlePipelineNameSave}
                className={styles.pageTitle}
                placeholder="Название воронки"
              />
            ) : undefined
          }
          breadcrumb={[
            { label: department.name, href: `/departments/${departmentId}` },
            { label: 'Воронки' },
          ]}
          description={
            visibleColumns.length > 0
              ? `${visibleColumns.length} колонок · ${
                  Object.values(tasksBoardState).reduce((s, t) => s + (t?.length ?? 0), 0)
                } задач`
              : undefined
          }
          actions={
            <div className={styles.boardHeaderActions}>
              <TaskCalendarViewToggle
                variant="board"
                value={boardLayout}
                onChange={setBoardLayout}
                hideKanban={isMobileLayout}
                className={styles.boardLayoutToggle}
              />
              <div className={styles.boardFiltersShell} ref={boardFiltersShellRef}>
                <Button
                  variant={boardFiltersOpen || hasActiveBoardFilter ? 'secondary' : 'ghost'}
                  size="sm"
                  iconLeft={<ListFilter size={14} />}
                  aria-label="Фильтры задач на доске"
                  aria-expanded={boardFiltersOpen}
                  aria-controls="board-filters-panel"
                  className={cn(
                    styles.boardFiltersIconBtn,
                    hasActiveBoardFilter && styles.boardFiltersActiveDot,
                  )}
                  onClick={() => setBoardFiltersOpen((v) => !v)}
                >
                  Фильтры
                  {hasActiveBoardFilter && (
                    <span className={styles.boardFiltersHeaderDot} aria-hidden />
                  )}
                </Button>

                {boardFiltersOpen ? (
                  <div
                    id="board-filters-panel"
                    className={cn(
                      styles.boardFiltersPopover,
                      styles.bottomSheetDragTransition,
                      filterSheetDrag.isDragging && styles.bottomSheetDragTransitionDragging,
                    )}
                    style={filterSheetDrag.sheetStyle}
                    role="region"
                    aria-label="Фильтры доски"
                  >
                    <div
                      className={styles.boardFiltersSheetHandle}
                      aria-label="Потяните вниз, чтобы закрыть"
                      {...filterSheetDrag.handleBindings}
                    >
                      <span className={styles.boardFiltersSheetHandleBar} aria-hidden />
                    </div>
                    <div className={styles.boardFiltersSheetBody}>
                      <div className={styles.boardFiltersPanelHeader}>
                        <span className={styles.boardFiltersPanelTitle}>Фильтры доски</span>
                        <button
                          type="button"
                          className={styles.boardFiltersPanelClose}
                          aria-label="Закрыть фильтры"
                          onClick={() => setBoardFiltersOpen(false)}
                        >
                          <X size={16} strokeWidth={2} />
                        </button>
                      </div>

                      <label className={styles.boardFiltersSearchLabel}>
                        <span className={styles.srOnly}>Поиск задач на доске</span>
                        <svg
                          className={styles.boardFiltersSearchIcon}
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <input
                          type="search"
                          className={styles.boardFiltersSearchInput}
                          placeholder="Название или описание…"
                          value={boardSearch}
                          onChange={(e) => setBoardSearch(e.target.value)}
                          autoComplete="off"
                        />
                      </label>

                    <div className={styles.boardFiltersGrid}>
                      {effectiveBoardLayout === 'list' ? (
                        <div className={cn(styles.boardFilterBlock, styles.boardFilterBlockSort)}>
                          <span className={styles.boardFilterHeading}>Порядок в таблице</span>
                          <Dropdown
                            items={boardListSortDropdownItems}
                            value={boardListSort}
                            placeholder="По колонкам"
                            searchPlaceholder="Найти…"
                            menuPlacement="above"
                            renderTrigger={({ open, selectedLabel, toggle }) => (
                              <FilterSelectTrigger
                                compact
                                open={open}
                                selectedLabel={selectedLabel || 'По колонкам'}
                                toggle={toggle}
                                icon={<ArrowUpDown size={14} strokeWidth={1.75} aria-hidden />}
                              />
                            )}
                            onChange={(value) => {
                              const raw = value == null ? 'column' : String(value)
                              if (
                                raw === 'column' ||
                                raw === 'deadline_asc' ||
                                raw === 'deadline_desc'
                              ) {
                                setBoardListSort(raw as PipelineBoardListSortMode)
                              }
                            }}
                            className={filterSelectDropdownClassName}
                          />
                        </div>
                      ) : null}
                      <div className={styles.boardFilterBlock}>
                        <span className={styles.boardFilterHeading}>Тег</span>
                        <Dropdown
                          items={tagDropdownItems}
                          value={filterTagId ?? 'all'}
                          placeholder="Все теги"
                          searchPlaceholder="Поиск тега…"
                          className={filterSelectDropdownClassName}
                          renderTrigger={({ open, selectedLabel, toggle }) => (
                            <FilterSelectTrigger
                              compact
                              open={open}
                              selectedLabel={selectedLabel || 'Все теги'}
                              toggle={toggle}
                              icon={
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                  <path
                                    d="M3.25 5.25h4.2l6.3 6.3v4.2h-4.2l-6.3-6.3v-4.2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.35"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M9.15 4.9a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2Z"
                                    stroke="currentColor"
                                    strokeWidth="1.2"
                                  />
                                </svg>
                              }
                            />
                          )}
                          onChange={(value) => {
                            const raw = value == null ? 'all' : String(value)
                            if (raw === 'all') setFilterTagId(undefined)
                            else setFilterTagId(Number(raw))
                          }}
                        />
                      </div>

                      <div className={styles.boardFilterBlock}>
                        <span className={styles.boardFilterHeading}>Исполнитель</span>
                        <Dropdown
                          items={memberDropdownItems}
                          value={filterResponsibleId ?? 'all'}
                          placeholder="Все исполнители"
                          searchPlaceholder="Поиск исполнителя…"
                          className={filterSelectDropdownClassName}
                          renderTrigger={({ open, selectedLabel, toggle }) => (
                            <FilterSelectTrigger
                              compact
                              open={open}
                              selectedLabel={selectedLabel || 'Все исполнители'}
                              toggle={toggle}
                              icon={
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                  <path
                                    d="M5.5 6.25a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10.75 6.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5Z"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                  />
                                  <path
                                    d="M2.75 12.75a2.75 2.75 0 0 1 5.5 0M8.5 12.75a2.25 2.25 0 0 1 4.5 0"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              }
                            />
                          )}
                          onChange={(value) => {
                            const raw = value == null ? 'all' : String(value)
                            if (raw === 'all') setFilterResponsibleId(undefined)
                            else setFilterResponsibleId(Number(raw))
                          }}
                        />
                      </div>

                      <div className={styles.boardFilterBlock}>
                        <span className={styles.boardFilterHeading}>Срок и статус</span>
                        <div className={styles.boardFilterChecklist}>
                        <label className={styles.boardFilterDueRow}>
                          <input
                            type="checkbox"
                            checked={filterOverdueOnly}
                            onChange={(e) => setFilterOverdueOnly(e.target.checked)}
                          />
                          Только просроченные
                        </label>
                        <label className={styles.boardFilterDueRow}>
                          <input
                            type="checkbox"
                            checked={filterHideCompleted}
                            onChange={(e) => setFilterHideCompleted(e.target.checked)}
                          />
                          Скрыть завершённые
                        </label>
                        </div>
                      </div>
                    </div>

                    {hasActiveBoardFilter ? (
                      <div className={styles.boardFiltersActions}>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleClearBoardFilter}
                          className={styles.boardFiltersPanelReset}
                        >
                          Сбросить фильтры
                        </Button>
                      </div>
                    ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              {showDepartmentMembersNav && canManageMembers && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<UserPlus size={14} />}
                  title="Участники отдела"
                  onClick={() => navigate(`/departments/${departmentId}/members`)}
                >
                  Участники
                </Button>
              )}
              {pipeline && canManagePipelines && !pipelineLocked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<Settings size={14} />}
                  title="Настройки воронки"
                  onClick={() =>
                    navigate(`/departments/${departmentId}/pipelines/${pipeline.id}/settings`)
                  }
                >
                  Настройки
                </Button>
              ) : null}
              {!isMobileLayout &&
              canManagePipelines &&
              !pipelineLocked &&
              effectiveBoardLayout === 'kanban' ? (
                <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={handleAddColumnClick}>
                  Добавить колонку
                </Button>
              ) : null}
              {!isMobileLayout && showListCreateChrome ? (
                <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openListCreateSheet()}>
                  Добавить задачу
                </Button>
              ) : null}
            </div>
          }
        />
        {(pipelineError || boardNotice || deleteError) && (
          <div style={{ padding: '0 1.5rem' }}>
            {pipelineError && <p className={styles.error}>{pipelineError}</p>}
            {boardNotice && <p className={styles.error} role="alert">{boardNotice}</p>}
            {deleteError && <p className={styles.error}>{deleteError}</p>}
          </div>
        )}

        <div className={styles.boardWrapper}>
          {effectiveBoardLayout === 'calendar' ? (
            <div className={styles.boardCalendarScroll}>
              <TaskCalendar
                tasks={calendarQuery.data ?? []}
                loading={calendarQuery.isPending}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                displayMode={calendarDisplayMode}
                onDisplayModeChange={setCalendarDisplayMode}
                canCreate={canCreateTasks}
                onAddTask={(ymd) => openListCreateSheet(ymd)}
                onOpenTask={(taskId) => navigate(`/tasks/${taskId}`)}
              />
            </div>
          ) : effectiveBoardLayout === 'list' ? (
            <div
              className={cn(
                styles.boardListScroll,
                showMobileListCreate && styles.boardListScrollFabPad,
              )}
            >
              {listFetchPending ? (
                <PipelineBoardSkeleton />
              ) : (
                <>
                  <PipelineBoardTaskTable
                    rows={pipelineBoardTaskTableRows}
                    members={members}
                    columns={visibleColumns}
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
                    isPersonalOrganization={Boolean(departmentOrg?.isPersonal)}
                    getListStageMoveColumns={getListMoveColumnsForTask}
                    canChangeListTaskStage={canMoveTaskOnBoard}
                    onListTaskMoveToColumn={handlePipelineListMoveTask}
                  />
                  <PipelineBoardListLoadMore
                    columnIds={columnIds}
                    boardFilter={pipelineBoardFilter}
                  />
                </>
              )}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              modifiers={dndModifiers}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={columnSortableIds}
                strategy={horizontalListSortingStrategy}
              >
                <div ref={boardRef} className={styles.board}>
                  {visibleColumns.map((column) => (
                    <BoardColumn
                      key={column.id}
                      column={column}
                      canManageStructure={canManageStructure}
                      canManageColor={canManageColor}
                      onRename={canManageStructure ? getColumnRenameHandler(column) : undefined}
                      onDelete={canManageStructure ? getColumnDeleteHandler(column) : undefined}
                    >
                      <ColumnTasks
                        columnId={column.id}
                        departmentId={departmentId}
                        columnTitle={column.name}
                        organizationId={department.organizationId}
                        isPersonalOrganization={Boolean(departmentOrg?.isPersonal)}
                        canCreate={canCreateTasks}
                        members={members}
                        columns={visibleColumns}
                        currentUserId={currentUser?.id}
                      departmentPolicies={department?.policies ?? null}
                        canManageDepartment={canSeeAllTasks}
                        boardFilter={pipelineBoardFilter}
                      />
                    </BoardColumn>
                  ))}
                </div>
              </SortableContext>
              <div className={styles.boardScrollbar} aria-hidden>
                <div
                  ref={scrollbarTrackRef}
                  className={styles.boardScrollbarTrack}
                  role="scrollbar"
                  aria-orientation="horizontal"
                  tabIndex={-1}
                  onMouseDown={handleScrollbarTrackClick}
                >
                  <div
                    className={styles.boardScrollbarThumb}
                    style={{
                      width: scrollbarThumb.width,
                      transform: `translateX(${scrollbarThumb.left}px)`,
                    }}
                    onMouseDown={handleScrollbarThumbMouseDown}
                  />
                </div>
              </div>

              <DragOverlay
                dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                }}
              >
                {activeColumn ? (
                  <div className={columnStyles.column}>
                    <div className={columnStyles.header}>
                      <div className={columnStyles.headerLeft}>
                        <div className={columnStyles.dragHandle}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 14 14">
                            <path stroke="currentColor" strokeWidth="1.5" d="M2 4h10M2 7h10M2 10h10" />
                          </svg>
                        </div>
                        {activeColumn.color && (
                          <span
                            className={columnStyles.colorDot}
                            style={{ backgroundColor: activeColumn.color }}
                          />
                        )}
                        <div className={columnStyles.title}>
                          {activeColumn.name}
                        </div>
                        <div className={columnStyles.badge}>
                          {(getTasksByColumn()[activeColumn.id] ?? []).length}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeTask ? (
                  <div className={styles.dragOverlay}>
                    <TaskCard
                      task={activeTask}
                      tags={activeTask.tags ?? []}
                      responsible={resolveResponsibleForTaskCard(activeTask)}
                      responsibles={resolveResponsiblesForTaskCard(activeTask)}
                      creator={resolveCreatorForTaskCard(activeTask)}
                      canDrag={false}
                      deadlineNeutral={activeTaskDeadlineNeutral}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {showMobileListCreate && !listCreateSheetOpen ? (
          <button
            type="button"
            className={styles.listCreateFab}
            onClick={() => openListCreateSheet()}
            aria-label="Новая задача"
          >
            <Plus size={26} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
        {listCreateSheetOpen &&
        listCreateColumnId != null &&
        department &&
        canUseListCreateSheet &&
        isMobileLayout
          ? createPortal(
              <div className={styles.listCreateSheetRoot} data-list-create-sheet>
                <div
                  className={cn(
                    styles.listCreateSheetPanel,
                    styles.bottomSheetDragTransition,
                    listCreateSheetDrag.isDragging && styles.bottomSheetDragTransitionDragging,
                  )}
                  style={listCreateSheetDrag.sheetStyle}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pipeline-list-create-title"
                >
                  <div
                    className={styles.listCreateSheetHandle}
                    aria-label="Потяните вниз, чтобы закрыть"
                    {...listCreateSheetDrag.handleBindings}
                  >
                    <span className={styles.listCreateSheetHandleBar} aria-hidden />
                  </div>
                  <div className={styles.listCreateSheetHead}>
                    <div className={styles.listCreateSheetHeadText}>
                      <h2
                        id="pipeline-list-create-title"
                        className={styles.listCreateSheetTitle}
                      >
                        Новая задача
                      </h2>
                      {creatableColumns.length > 1 ? (
                        <div className={styles.listCreateSheetColumnField}>
                          <span className={styles.listCreateSheetFieldLabel}>Колонка</span>
                          <Dropdown
                            items={listCreateColumnDropdownItems}
                            value={listCreateColumnId}
                            placeholder="Колонка"
                            searchPlaceholder="Найти колонку…"
                            className={filterSelectDropdownClassName}
                            renderTrigger={({ open, selectedLabel, toggle }) => (
                              <FilterSelectTrigger
                                compact
                                open={open}
                                selectedLabel={
                                  selectedLabel ||
                                  listCreateTargetColumn?.name ||
                                  'Колонка'
                                }
                                toggle={toggle}
                                icon={<List size={14} strokeWidth={1.75} aria-hidden />}
                              />
                            )}
                            onChange={(value) => {
                              const raw = value == null ? NaN : Number(value)
                              if (Number.isFinite(raw)) {
                                setListCreateColumnId(raw)
                                setListCreateFormMountKey((k) => k + 1)
                              }
                            }}
                          />
                        </div>
                      ) : listCreateTargetColumn ? (
                        <p className={styles.listCreateSheetSubtitle}>
                          Колонка: {listCreateTargetColumn.name}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className={styles.listCreateSheetClose}
                      aria-label="Закрыть"
                      onClick={() => setListCreateSheetOpen(false)}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.25"
                        aria-hidden
                      >
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className={styles.listCreateSheetBody}>
                    <CreateTaskForm
                      key={`${listCreateColumnId}-${listCreateFormMountKey}`}
                      columnId={listCreateColumnId}
                      departmentId={departmentId}
                      nextPosition={listCreateNextPosition}
                      members={members}
                      isPersonalOrganization={Boolean(departmentOrg?.isPersonal)}
                      currentUserId={currentUser?.id}
                      departmentPolicies={department?.policies ?? null}
                      layout="drawer"
                      initialStartYmd={calendarCreateYmd}
                      initialDeadLineYmd={calendarCreateYmd}
                      onSuccess={() => {
                        if (calendarQueryScope) {
                          queryClient.invalidateQueries({
                            queryKey: calendarMonthQueryKey(calendarQueryScope, calendarMonth, calendarDisplayMode),
                          })
                        }
                        setListCreateSheetOpen(false)
                      }}
                      onCancel={() => setListCreateSheetOpen(false)}
                    />
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
        <CreateTaskDrawer
          open={Boolean(
            listCreateSheetOpen &&
              listCreateColumnId != null &&
              department &&
              canUseListCreateSheet &&
              !isMobileLayout,
          )}
          onClose={() => setListCreateSheetOpen(false)}
          onSuccess={() => {
            if (calendarQueryScope) {
              queryClient.invalidateQueries({
                queryKey: calendarMonthQueryKey(calendarQueryScope, calendarMonth, calendarDisplayMode),
              })
            }
            setListCreateSheetOpen(false)
          }}
          columnId={listCreateColumnId ?? 0}
          departmentId={departmentId}
          nextPosition={listCreateNextPosition}
          titleId="pipeline-list-create-drawer-title"
          columnTitle={
            creatableColumns.length <= 1 ? listCreateTargetColumn?.name : undefined
          }
          headerBelowTitle={
            creatableColumns.length > 1 ? (
              <div className={drawerChromeStyles.createDrawerColumnField}>
                <span className={drawerChromeStyles.createDrawerFieldLabel}>Колонка</span>
                <Dropdown
                  items={listCreateColumnDropdownItems}
                  value={listCreateColumnId ?? 0}
                  placeholder="Колонка"
                  searchPlaceholder="Найти колонку…"
                  className={filterSelectDropdownClassName}
                  renderTrigger={({ open, selectedLabel, toggle }) => (
                    <FilterSelectTrigger
                      compact
                      open={open}
                      selectedLabel={
                        selectedLabel ||
                        listCreateTargetColumn?.name ||
                        'Колонка'
                      }
                      toggle={toggle}
                      icon={<List size={14} strokeWidth={1.75} aria-hidden />}
                    />
                  )}
                  onChange={(value) => {
                    const raw = value == null ? NaN : Number(value)
                    if (Number.isFinite(raw)) {
                      setListCreateColumnId(raw)
                      setListCreateFormMountKey((k) => k + 1)
                    }
                  }}
                />
              </div>
            ) : undefined
          }
          members={members}
          isPersonalOrganization={Boolean(departmentOrg?.isPersonal)}
          currentUserId={currentUser?.id}
          formMountKey={listCreateFormMountKey}
          initialStartYmd={calendarCreateYmd}
          initialDeadLineYmd={calendarCreateYmd}
        />
      </div>

      {showAddColumn && !pipelineLocked && (
        <div className={styles.modal}>
          <div className={styles.modalOverlay} onClick={handleCloseAddColumn} />
          <div className={styles.modalContent}>
            <CreateColumnForm
              departmentId={departmentId}
              nextPosition={columns.length}
              pipelineId={pipelineId}
              onClose={handleCloseAddColumn}
            />
          </div>
        </div>
      )}

    </AppLayout>
  )
}

