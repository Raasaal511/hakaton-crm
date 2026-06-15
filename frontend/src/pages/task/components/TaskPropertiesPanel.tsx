import { useState, type MouseEvent } from 'react'
import { Dropdown, TaskDateRangePopover, type DropdownItem } from 'shared/ui'
import { formatTaskDateRangeShort } from 'shared/lib/formatTaskDateRange'
import type { Tag } from 'shared/types/tags'
import type { Task } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import { userModel } from 'entities/user'
import styles from '../TaskPage.module.css'
import { TaskAssigneesBlock } from './TaskAssigneesBlock'

type Props = {
  task: Task
  tags: Tag[]
  availableTags: Tag[]
  editTagIds: number[]
  editStartDate: string
  editDeadLine: string
  members: DepartmentMember[]
  responsibleMembers: DepartmentMember[]
  editResponsibleIds: number[]
  unassignedMembers: DepartmentMember[]
  canEditContent: boolean
  orgIsPersonal: boolean
  onTagsChange: (val: string | number | (string | number)[] | null) => void
  onRemoveTag: (tagId: number) => void
  onApplyDateRange: (start: string | null, end: string | null) => void
  onResponsiblesChange: (val: string | number | (string | number)[] | null) => void
  onRemoveResponsible: (userId: number) => void
  onAssignWholeDepartment: () => void
  requireResponsible?: boolean
  requireDeadLine?: boolean
  /** Для задач-рассылок: скрыть блок исполнителей (управляется через трекер рассылки) */
  isBroadcast?: boolean
}

export function TaskPropertiesPanel({
  task,
  tags,
  availableTags,
  editTagIds,
  editStartDate,
  editDeadLine,
  members,
  responsibleMembers,
  editResponsibleIds,
  unassignedMembers,
  canEditContent,
  orgIsPersonal,
  onTagsChange,
  onRemoveTag,
  onApplyDateRange,
  onResponsiblesChange,
  onRemoveResponsible,
  onAssignWholeDepartment,
  requireResponsible = false,
  requireDeadLine = false,
  isBroadcast = false,
}: Props) {
  const currentUser = userModel.selectors.useUser()
  const [dateRangeOpen, setDateRangeOpen] = useState(false)
  const [datePickerKey, setDatePickerKey] = useState(0)

  const dateRangeLabel = formatTaskDateRangeShort({
    startDate: editStartDate || null,
    deadLine: editDeadLine || null,
  })
  const hasDateRange = Boolean(editStartDate || editDeadLine)

  const handleClearDateRange = (e: MouseEvent) => {
    e.stopPropagation()
    onApplyDateRange(null, null)
    setDatePickerKey((k) => k + 1)
  }

  const personalAssigneePill =
    orgIsPersonal && currentUser ? (
      <span
        className={`${styles.pill} ${styles.pillAssignee}`}
        title="В личном пространстве вы всегда исполнитель"
      >
        <span className={styles.pillAvatar}>
          {currentUser.firstname?.[0]?.toUpperCase() || '?'}
        </span>
        Вы
      </span>
    ) : null

  return (
    <div className={styles.propertiesPanel}>
      <div className={styles.pillsRow}>
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={`${styles.pill} ${styles.pillTag}`}
            title={tag.name}
          >
            <span className={styles.pillTagLabel}>{tag.name}</span>
            {canEditContent ? (
              <button
                type="button"
                className={styles.pillTagRemove}
                onClick={() => onRemoveTag(tag.id)}
                aria-label={`Удалить метку ${tag.name}`}
                title="Удалить метку"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {canEditContent ? (
          <TaskDateRangePopover
            open={dateRangeOpen}
            onOpenChange={setDateRangeOpen}
            remountKey={datePickerKey}
            startValue={editStartDate}
            endValue={editDeadLine}
            onApply={(s, e) => {
              onApplyDateRange(s, e)
              setDatePickerKey((k) => k + 1)
            }}
          >
            <span className={`${styles.pill} ${styles.pillDate} ${styles.pillDateEditable}`}>
              <button
                type="button"
                className={styles.pillDateTrigger}
                title={requireDeadLine ? 'Срок выполнения (обязательно)' : 'Срок выполнения'}
                onClick={() =>
                  setDateRangeOpen((was) => {
                    if (!was) setDatePickerKey((k) => k + 1)
                    return !was
                  })
                }
              >
                <span className={styles.pillDateLabel}>
                  {dateRangeLabel || (requireDeadLine ? 'Срок *' : 'Срок')}
                </span>
              </button>
              {hasDateRange ? (
                <button
                  type="button"
                  className={styles.pillDateRemove}
                  onClick={handleClearDateRange}
                  aria-label="Убрать срок"
                  title="Убрать срок"
                >
                  ×
                </button>
              ) : null}
            </span>
          </TaskDateRangePopover>
        ) : (
          <span className={`${styles.pill} ${styles.pillDate}`} title="Срок">
            <span className={styles.pillDateLabel}>
              {formatTaskDateRangeShort({
                startDate: task.startDate ?? null,
                deadLine: task.deadLine ?? null,
              }) || 'Без срока'}
            </span>
          </span>
        )}
        {canEditContent ? (
          <Dropdown
            items={availableTags.map((tag): DropdownItem => ({ id: tag.id, label: tag.name }))}
            multiple
            value={editTagIds}
            placeholder="+ Добавить метку"
            onChange={onTagsChange}
            renderTrigger={({ toggle }) => (
              <button
                type="button"
                className={`${styles.pill} ${styles.pillAdd}`}
                onClick={toggle}
              >
                + Добавить метку
              </button>
            )}
          />
        ) : null}
        {orgIsPersonal ? personalAssigneePill : null}
      </div>
      {!isBroadcast && (
        <TaskAssigneesBlock
          members={members}
          responsibleMembers={responsibleMembers}
          editResponsibleIds={editResponsibleIds}
          unassignedMembers={unassignedMembers}
          canEditContent={canEditContent}
          orgIsPersonal={orgIsPersonal}
          onResponsiblesChange={onResponsiblesChange}
          onRemoveResponsible={onRemoveResponsible}
          onAssignWholeDepartment={onAssignWholeDepartment}
        />
      )}
    </div>
  )
}
