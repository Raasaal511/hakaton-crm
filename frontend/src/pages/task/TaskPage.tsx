import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  type CSSProperties,
} from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppLayout } from 'shared/ui'
import { useDebouncedCallback, isHtmlDescriptionEmpty, usePersistentToggle } from 'shared/lib'
import { normalizeTaskDateField } from 'shared/lib/taskDateTime'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksAPI } from 'shared/api/requests/tasks'
import { qk } from 'shared/api/queryKeys'
import { tagsAPI } from 'shared/api/requests/tags'
import { departmentsAPI } from 'shared/api/requests/departments'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { setCurrentOrganization } from 'shared/api/events/organization'
import { editTask } from 'shared/api/events/tasks'
import type { Task, TaskAttachment } from 'shared/types/tasks'
import type { Tag } from 'shared/types/tags'
import type { DepartmentMember } from 'shared/types/departments'
import { columnsAPI } from 'shared/api/requests/columns'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import type { Column } from 'shared/types/columns'
import type { Pipeline } from 'shared/types/pipelines'
import { userModel } from 'entities/user'
import { organizationModel } from 'entities/organization'
import { useCanManageDepartment } from 'shared/lib'
import { mergeDepartmentPolicies } from 'shared/lib/departmentPoliciesConfig'
import { TaskComments } from 'features/task/comments'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'
import styles from './TaskPage.module.css'

import { mergeTaskPreserveAttachments } from './lib/mergeTaskPreserveAttachments'
import { TaskTopBar } from './components/TaskTopBar'
import { TaskIdentityRow } from './components/TaskIdentityRow'
import { TaskActionsBar } from './components/TaskActionsBar'
import { TaskPropertiesPanel } from './components/TaskPropertiesPanel'
import { TaskDescriptionSection } from './components/TaskDescriptionSection'
import { BroadcastTrackerSection } from './components/BroadcastTrackerSection'
import { TaskAttachmentsSection } from './components/TaskAttachmentsSection'
import { SendBackDialog } from './components/SendBackDialog'
import { RejectFromReviewDialog } from './components/RejectFromReviewDialog'
import { TaskPageError, TaskPageLoading } from './components/TaskPageStates'
import { collapseConsecutiveDescriptionUpdates } from './history/collapseDescriptionActivity'
import { HistoryAside } from './history/HistoryAside'
import { HistoryEdgeHandle } from './history/HistoryEdgeHandle'

/** Название: чуть быстрее. Описание: реже → меньше записей «Обновление» в истории при наборе. */
const DEBOUNCE_NAME_MS = 600
const DEBOUNCE_DESCRIPTION_MS = 4500

/**
 * Справочники отдела (tags/columns/pipelines): кэш несколько минут.
 * Состав участников раздела для назначения исполнителей держим актуальнее (staleTime 0 у deptMembersQuery),
 * т.к. доска грузит членов отдельным запросом без этого кэша — иначе после добавления людей в раздел
 * на карточке задачи остаётся устаревший список до истечения TTL.
 */
const DEPT_RESOURCES_STALE_MS = 5 * 60_000

export function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const taskId = Number(id)

  const [task, setTask] = useState<Task | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editDeadLine, setEditDeadLine] = useState('')
  const [editResponsibleIds, setEditResponsibleIds] = useState<number[]>([])
  const [editTagIds, setEditTagIds] = useState<number[]>([])
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [sendBackComment, setSendBackComment] = useState('')
  const [sendBackBusy, setSendBackBusy] = useState(false)
  const [rejectFromReviewOpen, setRejectFromReviewOpen] = useState(false)
  const [rejectFromReviewComment, setRejectFromReviewComment] = useState('')
  const [rejectFromReviewBusy, setRejectFromReviewBusy] = useState(false)
  /** Без localStorage: убрана синхронная запись и возможные гонки с кликами по ручке истории. */
  const [historyOpen, setHistoryOpen] = useState(true)
  const [approveBusy, setApproveBusy] = useState(false)
  const [attachmentsOpen, , toggleAttachmentsOpen] = usePersistentToggle(
    'task-page:attachments-open',
    false,
  )

  const taskRef = useRef<Task | null>(null)
  taskRef.current = task

  /** Последнее сохранённое на сервере описание по id задачи (для noop и flush при смене карточки). */
  const serverDescriptionByTaskIdRef = useRef<Map<number, string | null>>(new Map())
  const descriptionDraftTaskIdRef = useRef<number | null>(null)
  const prevSyncedTaskIdRef = useRef<number | null>(null)

  const queryClient = useQueryClient()

  const invalidateTaskActivity = useCallback(() => {
    if (Number.isFinite(taskId)) {
      void queryClient.invalidateQueries({ queryKey: qk.taskActivity(taskId) })
    }
  }, [queryClient, taskId])

  const attachmentsQuery = useQuery({
    queryKey: Number.isFinite(taskId)
      ? qk.taskAttachments(taskId)
      : ['task', null, 'attachments'],
    queryFn: () => tasksAPI.listAttachments(taskId),
    /** Счётчик в шапке секции: грузим список сразу, не только после раскрытия. */
    enabled: Number.isFinite(taskId),
    staleTime: 60_000,
  })

  const attachments: TaskAttachment[] = attachmentsQuery.data ?? []
  const attachmentsListError = attachmentsQuery.isError
    ? attachmentsQuery.error instanceof Error
      ? attachmentsQuery.error.message
      : 'Не удалось загрузить вложения'
    : ''
  const attachmentsListLoading = attachmentsQuery.isFetching && !attachmentsQuery.isSuccess

  const activityQuery = useQuery({
    queryKey: Number.isFinite(taskId) ? qk.taskActivity(taskId) : ['task', null, 'activity'],
    queryFn: () => tasksAPI.listActivity(taskId),
    /** Параллельно с getById: раньше ждали task, из‑за этого лента истории открывалась с задержкой. */
    enabled: Number.isFinite(taskId),
    staleTime: 15_000,
  })

  const activityItems = activityQuery.data ?? []

  const displayActivityItems = useMemo(
    () => collapseConsecutiveDescriptionUpdates(activityItems),
    [activityItems],
  )

  const setAttachmentsCache = useCallback(
    (updater: (prev: TaskAttachment[]) => TaskAttachment[]) => {
      queryClient.setQueryData<TaskAttachment[]>(qk.taskAttachments(taskId), (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient, taskId],
  )

  const uploadMutation = useMutation({
    mutationFn: (file: File) => tasksAPI.uploadAttachment(taskId, file),
    onSuccess: (created) => {
      setAttachmentsCache((prev) => [...prev, created])
      invalidateTaskActivity()
    },
  })

  const attachUploading = uploadMutation.isPending

  const currentUser = userModel.selectors.useUser()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()

  const departmentId = task?.departmentId

  const deptQuery = useQuery({
    queryKey: departmentId != null ? qk.dept(departmentId) : ['dept', null],
    queryFn: () => departmentsAPI.getById(departmentId!),
    enabled: departmentId != null,
    staleTime: DEPT_RESOURCES_STALE_MS,
  })

  const deptPolicies = mergeDepartmentPolicies(deptQuery.data?.policies)

  const deptMembersQuery = useQuery({
    queryKey: departmentId != null ? qk.deptMembers(departmentId) : ['dept', null, 'members'],
    queryFn: () => departmentsAPI.getMembers(departmentId!),
    enabled: departmentId != null,
    staleTime: 0,
    gcTime: DEPT_RESOURCES_STALE_MS,
  })

  const deptTagsQuery = useQuery({
    queryKey: departmentId != null ? qk.deptTags(departmentId) : ['dept', null, 'tags'],
    queryFn: () => tagsAPI.getByDepartment(departmentId!),
    enabled: departmentId != null,
    staleTime: DEPT_RESOURCES_STALE_MS,
  })

  const deptColumnsQuery = useQuery({
    queryKey: departmentId != null ? qk.deptColumns(departmentId) : ['dept', null, 'columns'],
    queryFn: () => columnsAPI.getAll(departmentId!),
    enabled: departmentId != null,
    staleTime: DEPT_RESOURCES_STALE_MS,
  })

  const deptPipelinesQuery = useQuery({
    queryKey: departmentId != null ? qk.deptPipelines(departmentId) : ['dept', null, 'pipelines'],
    queryFn: () => pipelinesAPI.getAll(departmentId!),
    enabled: departmentId != null,
    staleTime: DEPT_RESOURCES_STALE_MS,
  })

  const members: DepartmentMember[] = deptMembersQuery.data ?? []
  const availableTags: Tag[] = deptTagsQuery.data ?? []
  const columns: Column[] = deptColumnsQuery.data ?? []
  const pipelines: Pipeline[] = deptPipelinesQuery.data ?? []

  /**
   * Контекст организации для сайдбара. При прямом заходе на /tasks/:id
   * текущая организация может не совпадать с организацией задачи. Сетевой запрос
   * запускается только в этом случае; данные кладутся в effector-стор для остальных
   * потребителей (сайдбар и т.п.).
   */
  const organizationId = task?.organizationId
  const orgQuery = useQuery({
    queryKey: organizationId != null ? qk.organization(organizationId) : ['organization', null],
    queryFn: () => organizationsAPI.getById(organizationId!),
    enabled:
      organizationId != null &&
      (currentOrganization == null || currentOrganization.id !== organizationId),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (orgQuery.data) {
      setCurrentOrganization(orgQuery.data)
    }
  }, [orgQuery.data])

  const orgIsPersonal = Boolean(
    organizationId != null && currentOrganization?.id === organizationId
      ? currentOrganization.isPersonal
      : orgQuery.data?.isPersonal,
  )

  const { canManageDepartment } = useCanManageDepartment(
    orgMembers,
    members,
    currentUser?.id,
  )

  const canEditContent =
    !!canManageDepartment ||
    (currentUser != null && task != null && task.creatorId === currentUser.id)

  const canMoveTask =
    !!canManageDepartment ||
    (currentUser != null &&
      task != null &&
      (task.creatorId === currentUser.id ||
        task.responsibleId === currentUser.id ||
        Boolean(task.responsibleIds?.includes(currentUser.id))))

  const canDeleteTask =
    !!canManageDepartment ||
    (currentUser != null && task != null && task.creatorId === currentUser.id)

  const taskResponsibleIds = useMemo<number[]>(() => {
    if (!task) return []
    if (task.responsibleIds && task.responsibleIds.length) return task.responsibleIds
    return task.responsibleId != null ? [task.responsibleId] : []
  }, [task])

  const canComment =
    !!canManageDepartment ||
    (currentUser != null &&
      task != null &&
      (task.creatorId === currentUser.id || taskResponsibleIds.includes(currentUser.id)))

  /** Прикреплять файлы могут все, кто имеет отношение к задаче: автор, исполнители или менеджер. */
  const canUploadAttachment = canComment

  const saveTask = useCallback(
    async (payload: {
      name?: string
      description?: string | null
      startDate?: string | null
      deadLine?: string | null
      responsibleIds?: number[]
      columnId?: number
      tagIds?: number[]
    }) => {
      const t = taskRef.current
      if (!t) return
      const touchesContent =
        payload.name !== undefined ||
        payload.description !== undefined ||
        payload.startDate !== undefined ||
        payload.deadLine !== undefined ||
        payload.responsibleIds !== undefined ||
        payload.tagIds !== undefined
      const touchesMove = payload.columnId !== undefined
      if (touchesContent && !canEditContent) return
      if (touchesMove && !canMoveTask) return
      setSaveStatus('saving')
      setError('')
      try {
        const { tagIds, responsibleIds, ...taskPayload } = payload
        if (Object.keys(taskPayload).length > 0) {
          const apiPayload = { ...taskPayload } as Parameters<typeof tasksAPI.update>[1]
          if ('deadLine' in taskPayload) {
            apiPayload.deadLine = normalizeTaskDateField(taskPayload.deadLine ?? null)
          }
          if ('startDate' in taskPayload) {
            apiPayload.startDate = normalizeTaskDateField(taskPayload.startDate ?? null)
          }
          const updated = await tasksAPI.update(t.id, apiPayload)
          if ('description' in taskPayload) {
            serverDescriptionByTaskIdRef.current.set(updated.id, updated.description ?? null)
          }
          setTask((prev) => mergeTaskPreserveAttachments(prev, updated))
        }
        if (responsibleIds !== undefined) {
          const nextIds = await tasksAPI.setResponsibles(t.id, responsibleIds)
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  responsibleIds: nextIds,
                  responsibleId: nextIds[0] ?? null,
                }
              : prev,
          )
        }
        if (tagIds !== undefined) {
          await tagsAPI.setForTask(t.id, tagIds)
          const updatedTags = tagIds.map((id) => {
            const tag = availableTags.find((a) => a.id === id)
            return { id, name: tag?.name ?? '', organizationId: t.organizationId }
          })
          setTags(updatedTags)
        }
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
        invalidateTaskActivity()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения')
        setSaveStatus('error')
      }
    },
    [availableTags, canEditContent, canMoveTask, invalidateTaskActivity],
  )

  const textFieldsRef = useRef({ name: '', description: '' })
  const descriptionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistDescriptionForTask = useCallback(
    async (targetId: number, html: string) => {
      if (!canEditContent) return
      const next = isHtmlDescriptionEmpty(html) ? null : html
      const prev = serverDescriptionByTaskIdRef.current.get(targetId) ?? null
      if (next === prev) return
      setSaveStatus('saving')
      setError('')
      try {
        const updated = await tasksAPI.update(targetId, { description: next })
        serverDescriptionByTaskIdRef.current.set(targetId, updated.description ?? null)
        setTask((prevTask) => {
          if (prevTask?.id !== targetId) return prevTask
          return mergeTaskPreserveAttachments(prevTask, updated)
        })
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
        void queryClient.invalidateQueries({ queryKey: qk.taskActivity(targetId) })
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения')
        setSaveStatus('error')
      }
    },
    [canEditContent, queryClient],
  )

  const clearDescriptionSaveTimer = useCallback(() => {
    if (descriptionSaveTimerRef.current) {
      clearTimeout(descriptionSaveTimerRef.current)
      descriptionSaveTimerRef.current = null
    }
  }, [])

  const flushPendingDescription = useCallback(() => {
    clearDescriptionSaveTimer()
    const tid = descriptionDraftTaskIdRef.current
    if (tid == null || !Number.isFinite(tid)) return
    const html = textFieldsRef.current.description
    void persistDescriptionForTask(tid, html)
  }, [clearDescriptionSaveTimer, persistDescriptionForTask])

  const flushPendingDescriptionRef = useRef(flushPendingDescription)
  flushPendingDescriptionRef.current = flushPendingDescription

  const scheduleDescriptionSave = useCallback(() => {
    clearDescriptionSaveTimer()
    descriptionSaveTimerRef.current = setTimeout(() => {
      descriptionSaveTimerRef.current = null
      const tid = descriptionDraftTaskIdRef.current
      const cur = taskRef.current
      if (tid == null || !cur || cur.id !== tid) return
      const html = textFieldsRef.current.description
      void persistDescriptionForTask(tid, html)
    }, DEBOUNCE_DESCRIPTION_MS)
  }, [clearDescriptionSaveTimer, persistDescriptionForTask])

  const debouncedSaveName = useDebouncedCallback(() => {
    const cur = taskRef.current
    if (!cur) return
    const { name } = textFieldsRef.current
    const trimmed = name.trim() || cur.name
    if (trimmed === cur.name) return
    void saveTask({ name: trimmed })
  }, DEBOUNCE_NAME_MS)

  /**
   * При переходе между задачами React Router не перемонтирует TaskPage — и
   * historyOpen, выставленный пользователем «закрыто» на прошлой задаче, переходит
   * на следующую. Поэтому при смене taskId возвращаем панель к состоянию по умолчанию.
   */
  useEffect(() => {
    setHistoryOpen(true)
  }, [taskId])

  /** Заголовок вкладки: название задачи (включая то, что в поле имени до сохранения). */
  useEffect(() => {
    const appTitle = 'Meridian'

    const restoreTitle = () => {
      document.title = appTitle
    }

    if (!Number.isFinite(taskId) || taskId <= 0) {
      restoreTitle()
      return restoreTitle
    }

    const taskMatchesRoute = task != null && task.id === taskId
    if (!taskMatchesRoute) {
      document.title = `Задача - ${appTitle}`
      return restoreTitle
    }

    const name = editName.trim() || task.name?.trim() || 'Без названия'
    document.title = `${name} - ${appTitle}`

    return restoreTitle
  }, [taskId, task, editName])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingDescriptionRef.current()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    const loadTaskData = async () => {
      if (!taskId) return

      try {
        setLoading(true)
        const taskData = await tasksAPI.getById(taskId, { includeAttachments: false })
        setTask(taskData)
        if (taskData.departmentId != null) {
          void queryClient.invalidateQueries({ queryKey: [...qk.dept(taskData.departmentId)] })
        }

        // Организация (если задача из другой), справочники отдела и список вложений
        // подгружаются через TanStack Query — см. useQuery выше.

        setTags(taskData.tags ?? [])
        setEditName(taskData.name)
        setEditDescription(taskData.description ?? '')
        setEditStartDate(taskData.startDate ?? '')
        setEditDeadLine(taskData.deadLine ?? '')
        setEditResponsibleIds(
          taskData.responsibleIds && taskData.responsibleIds.length
            ? taskData.responsibleIds
            : taskData.responsibleId != null
              ? [taskData.responsibleId]
              : [],
        )
        setEditTagIds((taskData.tags ?? []).map((t) => t.id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка загрузки задачи')
      } finally {
        setLoading(false)
      }
    }

    loadTaskData()
  }, [taskId, queryClient])

  /** Только смена id: сохранить описание предыдущей задачи до перезаписи полей. */
  useEffect(() => {
    const incomingId = task?.id
    if (incomingId == null || !Number.isFinite(incomingId)) return

    const prevId = prevSyncedTaskIdRef.current

    if (prevId != null && prevId !== incomingId && canEditContent) {
      clearDescriptionSaveTimer()
      const capturedHtml = textFieldsRef.current.description
      void persistDescriptionForTask(prevId, capturedHtml)
    }

    prevSyncedTaskIdRef.current = incomingId
  }, [task?.id, canEditContent, clearDescriptionSaveTimer, persistDescriptionForTask])

  /**
   * Синхронизация полей только при смене id задачи (deps только task?.id).
   * Данные берём из taskRef, чтобы не дергать эффект при каждом PATCH той же задачи.
   */
  useEffect(() => {
    const tid = task?.id
    if (tid == null || !Number.isFinite(tid)) return
    const t = taskRef.current
    if (!t || t.id !== tid) return

    descriptionDraftTaskIdRef.current = t.id
    serverDescriptionByTaskIdRef.current.set(t.id, t.description ?? null)

    setEditName(t.name)
    setEditDescription(t.description ?? '')
    setEditStartDate(t.startDate ?? '')
    setEditDeadLine(t.deadLine ?? '')
    setEditResponsibleIds(
      t.responsibleIds && t.responsibleIds.length
        ? t.responsibleIds
        : t.responsibleId != null
          ? [t.responsibleId]
          : [],
    )
    setEditTagIds((t.tags ?? []).map((x) => x.id))
    textFieldsRef.current = { name: t.name, description: t.description ?? '' }
  }, [task?.id])

  const handleNameChange = (value: string) => {
    setEditName(value)
    textFieldsRef.current = { ...textFieldsRef.current, name: value }
    debouncedSaveName()
  }

  const handleDescriptionChange = (value: string) => {
    setEditDescription(value)
    textFieldsRef.current = { ...textFieldsRef.current, description: value }
    scheduleDescriptionSave()
  }

  const applyDateRange = (start: string | null, end: string | null) => {
    setEditStartDate(start ?? '')
    setEditDeadLine(end ?? '')
    saveTask({ startDate: start, deadLine: end })
  }

  const handleResponsiblesChange = (val: string | number | (string | number)[] | null) => {
    const ids = Array.isArray(val)
      ? val.map((v) => Number(v)).filter((v) => Number.isInteger(v))
      : val != null
        ? [Number(val)]
        : []
    setEditResponsibleIds(ids)
    saveTask({ responsibleIds: ids })
  }

  const handleRemoveResponsible = (userId: number) => {
    const next = editResponsibleIds.filter((id) => id !== userId)
    setEditResponsibleIds(next)
    saveTask({ responsibleIds: next })
  }

  const handleAssignWholeDepartment = () => {
    if (!members.length) return
    const ids = members.map((m) => m.id)
    setEditResponsibleIds(ids)
    saveTask({ responsibleIds: ids })
  }

  const handleTagsChange = (val: string | number | (string | number)[] | null) => {
    const ids = Array.isArray(val) ? val.map((v) => Number(v)) : val != null ? [Number(val)] : []
    setEditTagIds(ids)
    saveTask({ tagIds: ids })
  }

  const handleRemoveTag = (tagId: number) => {
    const next = editTagIds.filter((id) => id !== tagId)
    setEditTagIds(next)
    setTags((prev) => prev.filter((t) => t.id !== tagId))
    saveTask({ tagIds: next })
  }

  const handleConfirmSendBack = async () => {
    if (!task) return
    const text = sendBackComment.trim()
    if (!text) {
      setError('Укажите комментарий для исполнителя')
      return
    }
    setSendBackBusy(true)
    setError('')
    try {
      const updated = await tasksAPI.sendBack(task.id, text)
      setTask((prev) => mergeTaskPreserveAttachments(prev, updated))
      editTask(updated)
      setEditDescription(updated.description ?? '')
      setSendBackOpen(false)
      setSendBackComment('')
      invalidateTaskActivity()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось вернуть задачу')
    } finally {
      setSendBackBusy(false)
    }
  }

  const handleConfirmRejectFromReview = async () => {
    if (!task) return
    const text = rejectFromReviewComment.trim()
    if (!text) {
      setError('Укажите комментарий для исполнителя')
      return
    }
    setRejectFromReviewBusy(true)
    setError('')
    try {
      const updated = await tasksAPI.rejectFromReview(task.id, text)
      setTask((prev) => mergeTaskPreserveAttachments(prev, updated))
      editTask(updated)
      setEditDescription(updated.description ?? '')
      setRejectFromReviewOpen(false)
      setRejectFromReviewComment('')
      invalidateTaskActivity()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось вернуть задачу на доработку')
    } finally {
      setRejectFromReviewBusy(false)
    }
  }

  const handleApproveFromReview = async () => {
    if (!task || !completedColumnId) return
    setApproveBusy(true)
    setError('')
    try {
      const updated = await tasksAPI.update(task.id, { columnId: completedColumnId })
      setTask((prev) => mergeTaskPreserveAttachments(prev, updated))
      editTask(updated)
      invalidateTaskActivity()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось завершить задачу')
    } finally {
      setApproveBusy(false)
    }
  }

  const uploadTaskFiles = async (files: File[]) => {
    if (!task || files.length === 0) return
    setError('')
    try {
      for (const file of files) {
        await uploadMutation.mutateAsync(file)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл')
    }
  }

  const onAttachmentDeleted = (id: number) => {
    setAttachmentsCache((prev) => prev.filter((a) => a.id !== id))
    invalidateTaskActivity()
  }

  const responsibleMembers = useMemo(() => {
    return editResponsibleIds
      .map((id) => {
        const fromDept = members.find((m) => m.id === id)
        if (fromDept) return fromDept
        if (currentUser && currentUser.id === id) {
          return {
            id: currentUser.id,
            email: currentUser.email,
            firstname: currentUser.firstname,
            lastname: currentUser.lastname,
            role: 'member' as const,
          } satisfies DepartmentMember
        }
        return null
      })
      .filter((m): m is DepartmentMember => m != null)
  }, [editResponsibleIds, members, currentUser])

  const unassignedMembers = useMemo(
    () => members.filter((m) => !editResponsibleIds.includes(m.id)),
    [members, editResponsibleIds],
  )

  const creator = task?.creatorId != null
    ? members.find((m) => m.id === task.creatorId)
    : null

  const creatorLabel = creator
    ? `${creator.firstname} ${creator.lastname}`.trim() || creator.email
    : task?.creatorId != null
      ? `ID ${task.creatorId}`
      : 'Не указан'

  const currentColumn = task ? columns.find((c) => c.id === task.columnId) ?? null : null
  const currentPipeline = useMemo(() => {
    if (!currentColumn?.pipelineId) return undefined
    return pipelines.find((p) => p.id === currentColumn.pipelineId)
  }, [pipelines, currentColumn?.pipelineId])

  const statusColumns = useMemo(() => {
    const currentPipelineId = currentColumn?.pipelineId
    if (currentPipelineId == null) {
      return currentColumn ? [currentColumn] : []
    }
    return columns.filter((c) => c.pipelineId === currentPipelineId)
  }, [columns, currentColumn])

  const moveColumnsForDropdown = useMemo(() => {
    if (!task || !currentUser || statusColumns.length === 0) return statusColumns
    if (!currentPipeline?.isMainTemplate) return statusColumns
    const lastPos = Math.max(...statusColumns.map((c) => c.position))
    const lastCol = statusColumns.find((c) => c.position === lastPos)
    if (!lastCol) return statusColumns
    const samePerson = task.creatorId != null && task.creatorId === task.responsibleId
    if (samePerson || canManageDepartment || task.creatorId === currentUser.id) {
      return statusColumns
    }
    if (task.responsibleId === currentUser.id && task.creatorId !== currentUser.id) {
      return statusColumns.filter((c) => c.id !== lastCol.id)
    }
    return statusColumns
  }, [statusColumns, task, currentUser, currentPipeline, canManageDepartment])

  const taskInCompletedColumn = useMemo(
    () =>
      task != null && task.columnId != null
        ? isTaskInCompletedPipelineColumn(task.columnId, columns)
        : false,
    [task, columns],
  )

  const canSendBackTask =
    !!task && !!currentUser && task.creatorId === currentUser.id && taskInCompletedColumn

  const canRejectFromReview =
    !!task &&
    !!currentUser &&
    task.creatorId === currentUser.id &&
    Boolean(currentPipeline?.isMainTemplate) &&
    currentColumn?.position === 2

  const canApproveFromReview = canRejectFromReview

  const completedColumnId = useMemo(() => {
    if (!currentPipeline?.isMainTemplate || statusColumns.length === 0) return null
    const lastPos = Math.max(...statusColumns.map((c) => c.position))
    return statusColumns.find((c) => c.position === lastPos)?.id ?? null
  }, [currentPipeline, statusColumns])

  const taskAccentStyle = useMemo((): CSSProperties | undefined => {
    const hex = currentColumn?.color?.trim()
    if (!hex) return undefined
    return { ['--task-accent' as string]: hex }
  }, [currentColumn?.color])

  /**
   * Боковая панель истории и её свернутая ручка зависят только от taskId из URL,
   * поэтому рендерим их и во время загрузки задачи — пользователь видит панель
   * сразу, а внутренний `isLoading` показывает прогресс по самой ленте.
   */
  const historyAsideNode =
    historyOpen && Number.isFinite(taskId) ? (
      <HistoryAside
        taskId={taskId}
        items={displayActivityItems}
        isLoading={activityQuery.isLoading}
        isError={activityQuery.isError}
        onClose={() => setHistoryOpen(false)}
        onRetry={() => {
          void activityQuery.refetch()
        }}
      />
    ) : null

  const edgeHandleNode = !historyOpen ? (
    <HistoryEdgeHandle
      count={displayActivityItems.length}
      onOpen={() => setHistoryOpen(true)}
    />
  ) : null

  if (loading) {
    return (
      <TaskPageLoading
        aside={historyAsideNode}
        edgeHandle={edgeHandleNode}
        withAside={historyOpen}
      />
    )
  }

  if (error || !task) {
    return <TaskPageError message={error} onBack={() => navigate(-1)} />
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <TaskTopBar
          task={task}
          saveStatus={saveStatus}
          canDeleteTask={canDeleteTask}
          onBack={() => navigate(-1)}
          onTaskDeleted={() => navigate(-1)}
        />

        <div className={`${styles.workspace} ${historyOpen ? styles.workspaceWithAside : ''}`}>
          <div className={styles.workspaceMain}>
            <article className={styles.mainSection} style={taskAccentStyle}>
              <div className={styles.heroAccent} aria-hidden />
              <div className={styles.mainSectionInner}>
                <div className={styles.taskHeader}>
                  <TaskIdentityRow
                    task={task}
                    currentColumn={currentColumn}
                    statusColumns={statusColumns}
                    moveColumnsForDropdown={moveColumnsForDropdown}
                    canMoveTask={canMoveTask}
                    creatorLabel={creatorLabel}
                    creatorEmail={creator?.email}
                    onChangeColumn={(columnId) => saveTask({ columnId })}
                    canSendBack={canSendBackTask}
                    onSendBack={() => {
                      setSendBackComment('')
                      setSendBackOpen(true)
                    }}
                  />

                  <TaskActionsBar
                    canApproveFromReview={canApproveFromReview}
                    canRejectFromReview={canRejectFromReview}
                    approveBusy={approveBusy}
                    onApprove={handleApproveFromReview}
                    onOpenReject={() => {
                      setRejectFromReviewComment('')
                      setRejectFromReviewOpen(true)
                    }}
                  />

                  <input
                    className={styles.titleInput}
                    value={editName}
                    readOnly={!canEditContent}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Название задачи"
                  />

                  <TaskPropertiesPanel
                    isBroadcast={task.broadcastProgress != null}
                    task={task}
                    tags={tags}
                    availableTags={availableTags}
                    editTagIds={editTagIds}
                    editStartDate={editStartDate}
                    editDeadLine={editDeadLine}
                    members={members}
                    responsibleMembers={responsibleMembers}
                    editResponsibleIds={editResponsibleIds}
                    unassignedMembers={unassignedMembers}
                    canEditContent={canEditContent}
                    orgIsPersonal={orgIsPersonal}
                    onTagsChange={handleTagsChange}
                    onRemoveTag={handleRemoveTag}
                    onApplyDateRange={applyDateRange}
                    onResponsiblesChange={handleResponsiblesChange}
                    onRemoveResponsible={handleRemoveResponsible}
                    onAssignWholeDepartment={handleAssignWholeDepartment}
                    requireResponsible={
                      deptPolicies.taskRules.requireResponsible && !orgIsPersonal
                    }
                    requireDeadLine={deptPolicies.taskRules.requireDeadLine}
                  />
                </div>

                {task.broadcastProgress != null && (
                  <BroadcastTrackerSection
                    taskId={task.id}
                    progress={task.broadcastProgress}
                    members={members}
                    canManage={!!canManageDepartment}
                    onProgressChange={(next) =>
                      setTask((prev) => prev ? { ...prev, broadcastProgress: next } : prev)
                    }
                  />
                )}

                <TaskDescriptionSection
                  taskId={task.id}
                  description={task.description}
                  editDescription={editDescription}
                  canEditContent={canEditContent}
                  onChange={handleDescriptionChange}
                  onFlushDescription={flushPendingDescription}
                />

                <TaskAttachmentsSection
                  taskId={task.id}
                  attachments={attachments}
                  attachmentsOpen={attachmentsOpen}
                  onToggleOpen={toggleAttachmentsOpen}
                  attachmentsListLoading={attachmentsListLoading}
                  attachmentsListError={attachmentsListError}
                  attachmentsListSuccess={attachmentsQuery.isSuccess}
                  attachUploading={attachUploading}
                  canEditContent={canEditContent}
                  canUploadAttachment={canUploadAttachment}
                  currentUserId={currentUser?.id}
                  onUploadFiles={uploadTaskFiles}
                  onAttachmentDeleted={onAttachmentDeleted}
                />

                <TaskComments
                  taskId={task.id}
                  canComment={canComment}
                  canModerate={!!canManageDepartment}
                  currentUserId={currentUser?.id ?? null}
                  currentUserInitial={currentUser?.firstname?.[0]}
                />
              </div>
            </article>
          </div>

          {historyAsideNode}
        </div>

        {edgeHandleNode}

        <SendBackDialog
          open={sendBackOpen}
          comment={sendBackComment}
          busy={sendBackBusy}
          onCommentChange={setSendBackComment}
          onClose={() => setSendBackOpen(false)}
          onConfirm={handleConfirmSendBack}
        />

        <RejectFromReviewDialog
          open={rejectFromReviewOpen}
          comment={rejectFromReviewComment}
          busy={rejectFromReviewBusy}
          onCommentChange={setRejectFromReviewComment}
          onClose={() => setRejectFromReviewOpen(false)}
          onConfirm={handleConfirmRejectFromReview}
        />
      </div>
    </AppLayout>
  )
}
