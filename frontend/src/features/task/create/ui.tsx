import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { tasksAPI } from 'shared/api/requests/tasks'
import { tagsAPI } from 'shared/api/requests/tags'
import { addTask } from 'shared/api/events/tasks'
import { Button, Dropdown, TaskDateRangeToolbarPill, type DropdownItem } from 'shared/ui'
import { normalizeTaskDateField } from 'shared/lib/taskDateTime'
import type { DepartmentMember } from 'shared/types/departments'
import type { DepartmentPolicies } from 'shared/types/departmentPoliciesConfig'
import { mergeDepartmentPolicies } from 'shared/lib/departmentPoliciesConfig'
import type { TaskAttachment } from 'shared/types/tasks'
import {
  sanitizeTaskDescriptionForReadonly,
  isSanitizedDescriptionEmpty,
} from '../description/sanitizeTaskDescriptionHtml'
import styles from './CreateTaskInlineForm.module.css'

/** Свернуть список исполнителей в одну строку при count > N (в панели создания не уезжает под футер) */
const ASSIGNEES_LIST_COLLAPSE_AFTER = 2

const TaskDescriptionEditor = lazy(async () => {
  const m = await import('../description/TaskDescriptionEditor')
  return { default: m.TaskDescriptionEditor }
})

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} КБ`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} МБ`
  return `${(mb / 1024).toFixed(1)} ГБ`
}

type DraftData = {
  name?: string
  description?: string
  startDate?: string
  deadLine?: string
  responsibleIds?: number[]
  selectedTagIds?: number[]
}

function readDraft(key: string): DraftData | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as DraftData) : null
  } catch {
    return null
  }
}

type CreateTaskFormProps = {
  columnId: number
  departmentId: number
  nextPosition: number
  onSuccess: () => void
  onCancel?: () => void
  members?: DepartmentMember[]
  /** Личное пространство: исполнитель всегда текущий пользователь */
  isPersonalOrganization?: boolean
  currentUserId?: number
  /** Полноэкранная правая панель вместо компактной карточки */
  layout?: 'drawer' | 'inline'
  /** Предзаполнение срока при создании из календаря (YYYY-MM-DD) */
  initialStartYmd?: string
  initialDeadLineYmd?: string
  departmentPolicies?: DepartmentPolicies | null
}

export function CreateTaskForm({
  columnId,
  departmentId,
  nextPosition,
  onSuccess,
  onCancel,
  members = [],
  isPersonalOrganization = false,
  currentUserId,
  layout = 'inline',
  initialStartYmd = '',
  initialDeadLineYmd = '',
  departmentPolicies: departmentPoliciesProp = null,
}: CreateTaskFormProps) {
  const deptPolicies = mergeDepartmentPolicies(departmentPoliciesProp)
  const requireResponsible = deptPolicies.taskRules.requireResponsible && !isPersonalOrganization
  const requireDeadLine = deptPolicies.taskRules.requireDeadLine
  const draftKey = `task-draft:${columnId}`
  const [initialDraft] = useState<DraftData | null>(() => {
    if (isPersonalOrganization) return null
    return readDraft(draftKey)
  })
  const hasDraft = !!(
    initialDraft?.name ||
    initialDraft?.description ||
    initialDraft?.startDate ||
    initialDraft?.deadLine ||
    initialDraft?.responsibleIds?.length ||
    initialDraft?.selectedTagIds?.length
  )
  const [name, setName] = useState(initialDraft?.name ?? '')
  const [description, setDescription] = useState(initialDraft?.description ?? '')
  const [startDate, setStartDate] = useState(initialDraft?.startDate || initialStartYmd)
  const [deadLine, setDeadLine] = useState(initialDraft?.deadLine || initialDeadLineYmd)
  const [responsibleIds, setResponsibleIds] = useState<number[]>(initialDraft?.responsibleIds ?? [])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [_tagsLoading, setTagsLoading] = useState(false)
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string }[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialDraft?.selectedTagIds ?? [])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [attachDrag, setAttachDrag] = useState(false)
  const [draftRestored, setDraftRestored] = useState(hasDraft)
  const [editorResetKey, setEditorResetKey] = useState(0)
  const [broadcastMode, setBroadcastMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDrawer = layout === 'drawer'

  const addPendingFiles = (files: File[]) => {
    if (files.length === 0) return
    setPendingFiles((prev) => {
      const next = [...prev]
      for (const f of files) {
        const dup = next.some((p) => p.name === f.name && p.size === f.size)
        if (!dup) next.push(f)
      }
      return next
    })
  }

  const removePendingAt = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  const loadTags = async () => {
    try {
      setTagsLoading(true)
      const tags = await tagsAPI.getByDepartment(departmentId)
      setAvailableTags(tags)
    } catch {
      // тихо игнорируем, теги не обязательны
    } finally {
      setTagsLoading(false)
    }
  }

  useEffect(() => {
    void loadTags()
  }, [departmentId])

  useEffect(() => {
    if (isPersonalOrganization && currentUserId != null) {
      setResponsibleIds([currentUserId])
    }
  }, [isPersonalOrganization, currentUserId])

  useEffect(() => {
    if (isPersonalOrganization) return
    const hasData = !!(name || description || startDate || deadLine || responsibleIds.length || selectedTagIds.length)
    if (hasData) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ name, description, startDate, deadLine, responsibleIds, selectedTagIds }))
      } catch {}
    } else {
      localStorage.removeItem(draftKey)
    }
  }, [name, description, startDate, deadLine, responsibleIds, selectedTagIds, isPersonalOrganization, draftKey])

  const clearDraft = () => {
    localStorage.removeItem(draftKey)
    setName('')
    setDescription('')
    setStartDate(initialStartYmd)
    setDeadLine(initialDeadLineYmd)
    setResponsibleIds(isPersonalOrganization && currentUserId != null ? [currentUserId] : [])
    setSelectedTagIds([])
    setDraftRestored(false)
    setEditorResetKey((k) => k + 1)
  }

  const responsibleMembers = useMemo(
    () =>
      responsibleIds
        .map((id) => members.find((m) => m.id === id))
        .filter((m): m is DepartmentMember => m != null),
    [members, responsibleIds],
  )

  const allDeptAlreadyAssigned =
    members.length > 0 && members.every((m) => responsibleIds.includes(m.id))

  const assigneesCount = responsibleMembers.length
  const assigneesNeedsCollapse =
    !isPersonalOrganization && assigneesCount > ASSIGNEES_LIST_COLLAPSE_AFTER

  const prevAssigneesCountRef = useRef(0)
  const [assigneesListExpanded, setAssigneesListExpanded] = useState(true)

  useEffect(() => {
    if (isPersonalOrganization) {
      setAssigneesListExpanded(true)
      prevAssigneesCountRef.current = assigneesCount
      return
    }
    const prev = prevAssigneesCountRef.current
    if (assigneesCount <= ASSIGNEES_LIST_COLLAPSE_AFTER) {
      setAssigneesListExpanded(true)
    } else if (
      prev <= ASSIGNEES_LIST_COLLAPSE_AFTER &&
      assigneesCount > ASSIGNEES_LIST_COLLAPSE_AFTER
    ) {
      setAssigneesListExpanded(false)
    }
    prevAssigneesCountRef.current = assigneesCount
  }, [isPersonalOrganization, assigneesCount])

  const assigneesSummaryTitle = useMemo(
    () =>
      responsibleMembers
        .map((m) => `${m.firstname} ${m.lastname}`.trim() || m.email || `ID ${m.id}`)
        .join(', '),
    [responsibleMembers],
  )

  const assigneesDismissRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!assigneesNeedsCollapse || !assigneesListExpanded) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (assigneesDismissRootRef.current?.contains(t)) return
      if (t instanceof Element) {
        if (t.closest('[data-dropdown-menu-portal]')) return
        if (t.closest('[data-date-range-popover]')) return
      }
      setAssigneesListExpanded(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [assigneesNeedsCollapse, assigneesListExpanded])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError('Название задачи обязательно')
      return
    }

    if (broadcastMode) {
      if (responsibleIds.length === 0) {
        setError('Выберите участников для рассылки задачи')
        return
      }
    } else {
      const resolvedIdsPreview =
        isPersonalOrganization && currentUserId != null ? [currentUserId] : responsibleIds
      if (requireResponsible && resolvedIdsPreview.length === 0) {
        setError('По правилам раздела необходимо назначить исполнителя')
        return
      }
      if (requireDeadLine && !normalizeTaskDateField(deadLine)) {
        setError('По правилам раздела необходимо указать срок')
        return
      }
    }

    setError('')
    setLoading(true)
    try {
      const descriptionPayload = isDrawer
        ? (() => {
            const safe = sanitizeTaskDescriptionForReadonly(description)
            return isSanitizedDescriptionEmpty(safe) ? null : safe
          })()
        : description.trim() || null

      if (broadcastMode) {
        const task = await tasksAPI.createBroadcast(columnId, {
          name: trimmedName,
          position: nextPosition,
          description: descriptionPayload,
          startDate: normalizeTaskDateField(startDate),
          deadLine: normalizeTaskDateField(deadLine),
          memberIds: responsibleIds,
          tagIds: selectedTagIds.length ? selectedTagIds : undefined,
        })
        const tags = selectedTagIds.map((id) => {
          const t = availableTags.find((a) => a.id === id)
          return { id, name: t?.name ?? '', organizationId: task.organizationId }
        })
        addTask({ ...task, tags })
        localStorage.removeItem(draftKey)
        onSuccess()
        return
      }

      const resolvedIds =
        isPersonalOrganization && currentUserId != null
          ? [currentUserId]
          : responsibleIds

      const task = await tasksAPI.create(columnId, {
        name: trimmedName,
        position: nextPosition,
        description: descriptionPayload,
        startDate: normalizeTaskDateField(startDate),
        deadLine: normalizeTaskDateField(deadLine),
        responsibleId: resolvedIds[0] ?? null,
        responsibleIds: resolvedIds,
      })
      if (selectedTagIds.length) {
        await tagsAPI.setForTask(task.id, selectedTagIds)
      }
      const uploadedAttachments: TaskAttachment[] = []
      for (const file of pendingFiles) {
        const created = await tasksAPI.uploadAttachment(task.id, file)
        uploadedAttachments.push(created)
      }
      const tags = selectedTagIds.map((id) => {
        const t = availableTags.find((a) => a.id === id)
        return { id, name: t?.name ?? '', organizationId: task.organizationId }
      })
      addTask({
        ...task,
        tags,
        attachments:
          uploadedAttachments.length > 0 ? uploadedAttachments : (task.attachments ?? []),
      })
      localStorage.removeItem(draftKey)
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  const formClass = isDrawer ? `${styles.card} ${styles.cardDrawer}` : styles.card

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (!isDrawer || e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    if (loading) return
    e.currentTarget.requestSubmit()
  }

  return (
    <div className={isDrawer ? styles.containerDrawer : styles.container}>
      <form className={formClass} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
        {draftRestored && (
          <div className={styles.draftBanner}>
            <span>Черновик восстановлен</span>
            <button type="button" className={styles.draftClearBtn} onClick={clearDraft}>
              Очистить
            </button>
          </div>
        )}
        <div className={styles.fieldBlock}>
          <label className={styles.fieldLabel} htmlFor="create-task-title">
            Название
          </label>
          <input
            id="create-task-title"
            className={isDrawer ? styles.titleInputDrawer : styles.titleInput}
            placeholder="Название задачи"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={isDrawer}
          />
        </div>

        <div className={styles.fieldBlock}>
          <label className={styles.fieldLabel} htmlFor="create-task-description">
            Описание
          </label>
          {isDrawer ? (
            <div className={styles.descriptionEditorMount} id="create-task-description">
              <Suspense
                fallback={<div className={styles.descriptionEditorLoading}>Загрузка редактора…</div>}
              >
                <TaskDescriptionEditor key={editorResetKey} initialHtml={description} onChange={setDescription} />
              </Suspense>
            </div>
          ) : (
            <textarea
              id="create-task-description"
              className={styles.descriptionInput}
              placeholder="Описание задачи"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          )}
        </div>

        {isDrawer ? (
          <div className={styles.attachmentsBlock}>
            <label className={styles.fieldLabel}>Вложения</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className={styles.attachInputHidden}
              onChange={(e) => {
                const list = e.target.files
                if (list?.length) addPendingFiles(Array.from(list))
                e.target.value = ''
              }}
            />
            <div
              className={`${styles.attachDropZone} ${attachDrag ? styles.attachDropZoneActive : ''}`}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setAttachDrag(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (e.currentTarget === e.target) setAttachDrag(false)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setAttachDrag(false)
                const list = e.dataTransfer.files
                if (list?.length) addPendingFiles(Array.from(list))
              }}
            >
              <div className={styles.attachDropInner}>
                <span className={styles.attachDropIcon} aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <div className={styles.attachDropText}>
                  <span className={styles.attachDropTitle}>
                    Перетащите файлы сюда или выберите с диска
                  </span>
                  <span className={styles.attachDropHint}>До 50 МБ на файл</span>
                </div>
                <button
                  type="button"
                  className={styles.attachPickBtn}
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выбрать файлы
                </button>
              </div>
            </div>
            {pendingFiles.length > 0 ? (
              <ul className={styles.pendingFilesList}>
                {pendingFiles.map((file, i) => (
                  <li key={`${file.name}-${file.size}-${i}`} className={styles.pendingFileRow}>
                    <span className={styles.pendingFileName} title={file.name}>
                      {file.name}
                    </span>
                    <span className={styles.pendingFileSize}>{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className={styles.pendingFileRemove}
                      disabled={loading}
                      onClick={() => removePendingAt(i)}
                      aria-label={`Удалить ${file.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className={styles.toolbar}>
          <div className={styles.tagsRow}>
            <Dropdown
              items={availableTags.map(
                (tag): DropdownItem => ({ id: tag.id, label: tag.name }),
              )}
              multiple
              menuPlacement="above"
              value={selectedTagIds}
              placeholder="+ Добавить метку"
              onChange={(val) => {
                const ids = Array.isArray(val) ? val.map((v) => Number(v)) : []
                setSelectedTagIds(ids)
              }}
              renderTrigger={({ toggle }) => (
                <button type="button" className={styles.pillButton} onClick={toggle}>
                  + Добавить метку
                </button>
              )}
            />
            {selectedTagIds.map((tagId) => {
              const tag = availableTags.find((t) => t.id === tagId)
              return tag ? (
                <span key={tag.id} className={styles.tagChip}>
                  {tag.name}
                  <button
                    type="button"
                    className={styles.tagRemove}
                    onClick={() => toggleTag(tag.id)}
                    aria-label={`Удалить ${tag.name}`}
                  >
                    ×
                  </button>
                </span>
              ) : null
            })}
          </div>
          <TaskDateRangeToolbarPill
            startValue={startDate}
            endValue={deadLine}
            emptyLabel="Дата"
            onApply={(s, e) => {
              setStartDate(s ?? '')
              setDeadLine(e ?? '')
            }}
          />
          {!isPersonalOrganization && (
            <button
              type="button"
              className={`${styles.pillButton} ${broadcastMode ? styles.broadcastToggleActive : ''}`}
              onClick={() => setBroadcastMode((v) => !v)}
              title={broadcastMode ? 'Режим рассылки включён — каждый участник получит свою копию задачи' : 'Включить рассылку — создать задачи для нескольких участников'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {broadcastMode ? `Раздельная задача · ${responsibleIds.length} уч.` : 'Раздельная задача'}
            </button>
          )}
          {!isPersonalOrganization && (
            <div
              ref={assigneesDismissRootRef}
              className={
                assigneesNeedsCollapse && assigneesListExpanded
                  ? `${styles.assigneesBlock} ${styles.assigneesBlockRaised}`
                  : styles.assigneesBlock
              }
            >
              <div className={styles.assigneesToolbarRow}>
                <Dropdown
                  items={members
                    .filter((m) => !responsibleIds.includes(m.id))
                    .map(
                    (m): DropdownItem => ({
                      id: m.id,
                      label: `${m.firstname} ${m.lastname}`,
                      avatarInitial: m.firstname?.[0]?.toUpperCase() || '?',
                    }),
                    )}
                  multiple
                  menuPlacement="above"
                  value={responsibleIds}
                  placeholder="Исполнители"
                  onChange={(val) => {
                    const ids = Array.isArray(val)
                      ? val.map((v) => Number(v)).filter((v) => Number.isInteger(v))
                      : val != null
                        ? [Number(val)]
                        : []
                    setResponsibleIds(ids)
                  }}
                  renderTrigger={({ toggle }) => (
                    <button type="button" className={styles.pillButton} onClick={toggle}>
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {responsibleIds.length
                        ? `Исполнителей: ${responsibleIds.length}`
                        : requireResponsible
                          ? 'Исполнитель *'
                          : 'Исполнитель'}
                    </button>
                  )}
                />
                {members.length > 1 && !allDeptAlreadyAssigned ? (
                  <button
                    type="button"
                    className={styles.pillButton}
                    onClick={() => setResponsibleIds(members.map((m) => m.id))}
                    title="Назначить исполнителями всех сотрудников отдела"
                  >
                    Весь отдел
                  </button>
                ) : null}
              </div>
              {assigneesCount > 0 ? (
                <div className={styles.assigneesSelected}>
                  {assigneesNeedsCollapse ? (
                    <div className={styles.assigneesSummaryAnchor}>
                      <button
                        type="button"
                        className={styles.assigneesSummaryBtn}
                        onClick={() => setAssigneesListExpanded((v) => !v)}
                        aria-expanded={assigneesListExpanded}
                        title={assigneesSummaryTitle}
                      >
                        <span className={styles.assigneesSummaryStack} aria-hidden>
                          {responsibleMembers.slice(0, 3).map((m) => (
                            <span key={m.id} className={styles.assigneesSummaryAvatar}>
                              {m.firstname?.[0]?.toUpperCase() || '?'}
                            </span>
                          ))}
                          {assigneesCount > 3 ? (
                            <span className={styles.assigneesSummaryExtra}>
                              +{assigneesCount - 3}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.assigneesSummaryLabel}>
                          {allDeptAlreadyAssigned
                            ? `Весь отдел · ${assigneesCount}`
                            : `${assigneesCount} исполнителей`}
                        </span>
                        <svg
                          className={
                            assigneesListExpanded
                              ? `${styles.assigneesSummaryChevron} ${styles.assigneesSummaryChevronOpen}`
                              : styles.assigneesSummaryChevron
                          }
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {assigneesListExpanded ? (
                        <div className={styles.assigneesExpandedPanel}>
                          <ul className={styles.assigneesList}>
                            {responsibleMembers.map((m) => (
                              <li
                                key={m.id}
                                className={styles.assigneeRow}
                                title={`${m.firstname} ${m.lastname}${m.email ? ` (${m.email})` : ''}`}
                              >
                                <span className={styles.assigneeRowAvatar} aria-hidden>
                                  {m.firstname?.[0]?.toUpperCase() || '?'}
                                </span>
                                <span className={styles.assigneeRowName}>
                                  {m.firstname} {m.lastname}
                                </span>
                                <button
                                  type="button"
                                  className={styles.assigneeRowRemove}
                                  onClick={() =>
                                    setResponsibleIds((prev) => prev.filter((id) => id !== m.id))
                                  }
                                  aria-label={`Убрать исполнителя ${m.firstname} ${m.lastname}`}
                                  title="Убрать исполнителя"
                                >
                                  ×
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <ul className={styles.assigneesList}>
                      {responsibleMembers.map((m) => (
                        <li
                          key={m.id}
                          className={styles.assigneeRow}
                          title={`${m.firstname} ${m.lastname}${m.email ? ` (${m.email})` : ''}`}
                        >
                          <span className={styles.assigneeRowAvatar} aria-hidden>
                            {m.firstname?.[0]?.toUpperCase() || '?'}
                          </span>
                          <span className={styles.assigneeRowName}>
                            {m.firstname} {m.lastname}
                          </span>
                          <button
                            type="button"
                            className={styles.assigneeRowRemove}
                            onClick={() =>
                              setResponsibleIds((prev) => prev.filter((id) => id !== m.id))
                            }
                            aria-label={`Убрать исполнителя ${m.firstname} ${m.lastname}`}
                            title="Убрать исполнителя"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {broadcastMode && responsibleIds.length > 0 && (
          <div className={styles.broadcastPreview}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Будет создано {responsibleIds.length} {responsibleIds.length === 1 ? 'задача' : responsibleIds.length < 5 ? 'задачи' : 'задач'} — по одной для каждого участника
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={isDrawer ? `${styles.actions} ${styles.actionsDrawer}` : styles.actions}>
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              className={isDrawer ? styles.drawerActionBtn : undefined}
            >
              Отмена
            </Button>
          )}
          <Button type="submit" disabled={loading} className={isDrawer ? styles.drawerActionBtn : undefined}>
            {loading
              ? 'Создание...'
              : broadcastMode
                ? `Разослать (${responsibleIds.length || '?'})`
                : 'Создать задачу'}
          </Button>
        </div>
      </form>
    </div>
  )
}
