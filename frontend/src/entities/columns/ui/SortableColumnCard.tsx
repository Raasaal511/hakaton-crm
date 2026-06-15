import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Column } from 'shared/types/columns'
import { makeColId } from 'shared/lib/dndIds'
import { ColumnCard } from './ColumnCard'
import styles from './SortableColumnCard.module.css'

type SortableColumnCardProps = {
  column: Column
  canManage?: boolean
  headerActions?: React.ReactNode
  children?: React.ReactNode
}

export function SortableColumnCard({
  column,
  canManage = false,
  headerActions,
  children,
}: SortableColumnCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: makeColId(column.id),
    disabled: !canManage,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? styles.dragging : undefined}
    >
      <ColumnCard
        column={column}
        headerActions={
          canManage ? (
            <>
              <span
                {...attributes}
                {...listeners}
                className={styles.dragHandle}
                title="Перетащите для изменения порядка"
              >
                ⋮⋮
              </span>
              {headerActions}
            </>
          ) : (
            headerActions
          )
        }
      >
        {children}
      </ColumnCard>
    </div>
  )
}
