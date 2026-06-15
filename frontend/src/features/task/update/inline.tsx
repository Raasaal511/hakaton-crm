import { useEffect, useState } from 'react'
import { tasksAPI } from 'shared/api/requests/tasks'
import { tagsAPI } from 'shared/api/requests/tags'
import { editTask } from 'shared/api/events/tasks'
import { Button, Dropdown, TaskDateRangeToolbarPill, type DropdownItem } from 'shared/ui'
import { normalizeTaskDateField } from 'shared/lib/taskDateTime'
import type { Task } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import styles from '../create/CreateTaskInlineForm.module.css'

type EditTaskInlineFormProps = {
  task: Task
  departmentId: number
  members: DepartmentMember[]
  isPersonalOrganization?: boolean
  currentUserId?: number
  onCancel: () => void
}

export function EditTaskInlineForm({
  task,
  departmentId,
  members,
  isPersonalOrganization = false,
  currentUserId,
  onCancel,
}: EditTaskInlineFormProps) {
  const [name, setName] = useState(task.name)
  const [startDate, setStartDate] = useState(task.startDate ?? '')
  const [deadLine, setDeadLine] = useState(task.deadLine ?? '')
  const [responsibleIds, setResponsibleIds] = useState<number[]>(() =>
    task.responsibleIds && task.responsibleIds.length
      ? task.responsibleIds
      : task.responsibleId != null
        ? [task.responsibleId]
        : [],
  )
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string }[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    () => task.tags?.map((t) => t.id) ?? [],
  )
  const [_tagsLoading, setTagsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  useEffect(() => {
    const load = async () => {
      try {
        setTagsLoading(true)
        const deptTags = await tagsAPI.getByDepartment(departmentId)
        setAvailableTags(deptTags)
      } catch {
        // ignore
      } finally {
        setTagsLoading(false)
      }
    }

    void load()
  }, [departmentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const resolvedIds =
        isPersonalOrganization && currentUserId != null
          ? [currentUserId]
          : responsibleIds

      const updated = await tasksAPI.update(task.id, {
        name: name.trim(),
        startDate: normalizeTaskDateField(startDate),
        deadLine: normalizeTaskDateField(deadLine),
        responsibleId: resolvedIds[0] ?? null,
        responsibleIds: resolvedIds,
      })
      await tagsAPI.setForTask(task.id, selectedTagIds)
      const tags = selectedTagIds.map((id) => {
        const t = availableTags.find((a) => a.id === id)
        return { id, name: t?.name ?? '', organizationId: task.organizationId }
      })
      editTask({ ...updated, tags, responsibleIds: resolvedIds })
      onCancel()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.container}>
      <div className={styles.card}>
        <input
          className={styles.titleInput}
          placeholder="Название задачи"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className={styles.toolbar}>
          <div className={styles.tagsRow}>
            <Dropdown
              items={availableTags.map(
                (tag): DropdownItem => ({ id: tag.id, label: tag.name }),
              )}
              multiple
              value={selectedTagIds}
              placeholder="+ Добавить метку"
              onChange={(val) => {
                const ids = Array.isArray(val) ? val.map((v) => Number(v)) : []
                setSelectedTagIds(ids)
              }}
              renderTrigger={({ toggle }) => (
                <button
                  type="button"
                  className={styles.pillButton}
                  onClick={toggle}
                >
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
            emptyLabel="Даты"
            onApply={(s, e) => {
              setStartDate(s ?? '')
              setDeadLine(e ?? '')
            }}
          />
          {!isPersonalOrganization && (
            <>
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
                  <button
                    type="button"
                    className={styles.pillButton}
                    onClick={toggle}
                  >
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {responsibleIds.length
                      ? `Исполнителей: ${responsibleIds.length}`
                      : 'Исполнитель'}
                  </button>
                )}
              />
              {members.length > 1 && !members.every((m) => responsibleIds.includes(m.id)) ? (
                <button
                  type="button"
                  className={styles.pillButton}
                  onClick={() => setResponsibleIds(members.map((m) => m.id))}
                  title="Назначить исполнителями всех сотрудников отдела"
                >
                  Весь отдел
                </button>
              ) : null}
              {responsibleIds
                .map((id) => members.find((m) => m.id === id))
                .filter((m): m is DepartmentMember => m != null)
                .map((m) => (
                  <span key={m.id} className={styles.tagChip}>
                    {m.firstname} {m.lastname}
                    <button
                      type="button"
                      className={styles.tagRemove}
                      onClick={() =>
                        setResponsibleIds((prev) => prev.filter((id) => id !== m.id))
                      }
                      aria-label={`Убрать ${m.firstname} ${m.lastname}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
            </>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        </div>
      </div>
    </form>
  )
}

