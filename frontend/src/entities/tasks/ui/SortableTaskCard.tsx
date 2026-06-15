import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from 'shared/types/tasks'
import type { Tag } from 'shared/types/tags'
import type { DepartmentMember } from 'shared/types/departments'
import { makeTaskId } from 'shared/lib/dndIds'
import { TaskCard } from './TaskCard'
import styles from './SortableTaskCard.module.css'

type SortableTaskCardProps = {
  task: Task
  tags?: Tag[]
  responsible?: DepartmentMember | null
  responsibles?: DepartmentMember[]
  creator?: DepartmentMember | null
  canDrag?: boolean
  onEdit?: () => void
  onDelete?: () => void
  isFirstInColumn?: boolean
  deadlineNeutral?: boolean
}

export function SortableTaskCard({
  task,
  tags,
  responsible,
  responsibles,
  creator,
  canDrag = false,
  onEdit,
  onDelete,
  isFirstInColumn = false,
  deadlineNeutral = false,
}: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: makeTaskId(task.id),
    disabled: !canDrag,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? styles.placeholder : undefined}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
    >
      {isDragging ? (
        <div className={styles.placeholderCard} />
      ) : (
      <TaskCard
        task={task}
        tags={tags}
        responsible={responsible}
        responsibles={responsibles}
        creator={creator}
        canDrag={canDrag}
        onEdit={onEdit}
        onDelete={onDelete}
        isFirstInColumn={isFirstInColumn}
        deadlineNeutral={deadlineNeutral}
      />
      )}
    </div>
  )
}

