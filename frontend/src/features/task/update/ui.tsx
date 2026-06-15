import { useState, useEffect } from 'react'
import { tasksAPI } from 'shared/api/requests/tasks'
import { tagsAPI } from 'shared/api/requests/tags'
import { editTask } from 'shared/api/events/tasks'
import { Button, Input, TaskDateRangePopover } from 'shared/ui'
import type { Task } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import type { Column } from 'shared/types/columns'
import { formatTaskDateRangeShort } from 'shared/lib/formatTaskDateRange'
import { normalizeTaskDateField } from 'shared/lib/taskDateTime'
import styles from 'shared/ui/Form.module.css'

type UpdateTaskFormProps = {
  task: Task
  departmentId: number
  organizationId: number
  members: DepartmentMember[]
  columns: Column[]
  onSuccess?: () => void
}

export function UpdateTaskForm({
  task,
  departmentId,
  organizationId,
  members,
  columns,
  onSuccess,
}: UpdateTaskFormProps) {
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description ?? '')
  const [startDate, setStartDate] = useState(task.startDate ?? '')
  const [deadLine, setDeadLine] = useState(task.deadLine ?? '')
  const [responsibleId, setResponsibleId] = useState<string>(
    task.responsibleId ? String(task.responsibleId) : '',
  )
  const [columnId, setColumnId] = useState<string>(String(task.columnId))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tagsLoading, setTagsLoading] = useState(false)
  const [availableTags, setAvailableTags] = useState<{ id: number; name: string }[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    () => task.tags?.map((t) => t.id) ?? [],
  )
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [datePickerKey, setDatePickerKey] = useState(0)

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  useEffect(() => {
    const loadTags = async () => {
      try {
        setTagsLoading(true)
        const deptTags = await tagsAPI.getByDepartment(departmentId)
        setAvailableTags(deptTags)
      } catch {
        // игнорируем, теги необязательны
      } finally {
        setTagsLoading(false)
      }
    }
    void loadTags()
  }, [departmentId])

  const handleAddTag = async () => {
    const trimmed = newTagName.trim()
    if (!trimmed) return
    try {
      setCreatingTag(true)
      const tag = await tagsAPI.create(organizationId, trimmed)
      setAvailableTags((prev) =>
        prev.some((t) => t.id === tag.id) ? prev : [...prev, { id: tag.id, name: tag.name }],
      )
      setSelectedTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]))
      setNewTagName('')
    } catch (err) {
      console.error(err)
    } finally {
      setCreatingTag(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const updated = await tasksAPI.update(task.id, {
        name: name.trim(),
        description: description.trim() || null,
        startDate: normalizeTaskDateField(startDate),
        deadLine: normalizeTaskDateField(deadLine),
        responsibleId: responsibleId ? Number(responsibleId) : null,
        columnId: Number(columnId),
      })
      await tagsAPI.setForTask(task.id, selectedTagIds)
      const tags = selectedTagIds.map((id) => {
        const t = availableTags.find((a) => a.id === id)
        return { id, name: t?.name ?? '', organizationId: task.organizationId }
      })
      editTask({ ...updated, tags })
      onSuccess?.()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="Название задачи"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <Input
        label="Описание"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className={styles.selectGroup}>
        <span className={styles.selectLabel}>Срок</span>
        <TaskDateRangePopover
          open={dateRangeOpen}
          onOpenChange={setDateRangeOpen}
          remountKey={datePickerKey}
          startValue={startDate}
          endValue={deadLine}
          onApply={(s, e) => {
            setStartDate(s ?? '')
            setDeadLine(e ?? '')
          }}
        >
          <button
            type="button"
            className={styles.rangeTrigger}
            onClick={() =>
              setDateRangeOpen((was) => {
                if (!was) setDatePickerKey((k) => k + 1)
                return !was
              })
            }
          >
            {formatTaskDateRangeShort({
              startDate: startDate || null,
              deadLine: deadLine || null,
            }) || 'Выбрать период'}
          </button>
        </TaskDateRangePopover>
      </div>
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel}>Исполнитель</label>
        <select
          value={responsibleId}
          onChange={(e) => setResponsibleId(e.target.value)}
          className={styles.select}
        >
          <option value="">Не назначен</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstname} {m.lastname} ({m.email})
            </option>
          ))}
        </select>
      </div>
      <div className={styles.selectGroup}>
        <label className={styles.selectLabel}>Колонка</label>
        <select
          value={columnId}
          onChange={(e) => setColumnId(e.target.value)}
          className={styles.select}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.selectGroup}>
        <span className={styles.selectLabel}>
          Теги {tagsLoading && ' (загрузка...)'}
        </span>
        {!!availableTags.length && (
          <div className={styles.checkboxList}>
            {availableTags.map((tag) => (
              <label key={tag.id} className={styles.checkboxItem}>
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                />
                <span>{tag.name}</span>
              </label>
            ))}
          </div>
        )}
        <div>
          <Input
            label="Новый тег"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
          />
          <Button
            type="button"
            onClick={handleAddTag}
            disabled={creatingTag || !newTagName.trim()}
          >
            {creatingTag ? 'Добавление...' : 'Добавить тег'}
          </Button>
        </div>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Сохранение...' : 'Сохранить'}
      </Button>
    </form>
  )
}

