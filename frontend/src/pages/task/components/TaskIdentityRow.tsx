import { Button, Dropdown, type DropdownItem } from 'shared/ui'
import type { Column } from 'shared/types/columns'
import type { Task } from 'shared/types/tasks'
import styles from '../TaskPage.module.css'
import { SendBackRevisionIcon } from './SendBackRevisionIcon'

type Props = {
  task: Task
  currentColumn: Column | null
  statusColumns: Column[]
  moveColumnsForDropdown: Column[]
  canMoveTask: boolean
  creatorLabel: string
  creatorEmail?: string | null
  onChangeColumn: (columnId: number) => void
  /** Только для задачи в завершённой колонке: автор может вернуть в работу. */
  canSendBack?: boolean
  onSendBack?: () => void
}

/** Шапка задачи: идентификатор, селектор статуса, автор. */
export function TaskIdentityRow({
  task,
  currentColumn,
  statusColumns,
  moveColumnsForDropdown,
  canMoveTask,
  creatorLabel,
  creatorEmail,
  onChangeColumn,
  canSendBack = false,
  onSendBack,
}: Props) {
  return (
    <div className={styles.identityRow}>
      <span className={styles.taskIdBadge}>#{task.id}</span>
      {canMoveTask && statusColumns.length > 0 ? (
        <Dropdown
          className={styles.statusDropdownWrap}
          items={moveColumnsForDropdown.map(
            (col): DropdownItem => ({ id: col.id, label: col.name }),
          )}
          value={task.columnId}
          placeholder="Статус"
          onChange={(val) => {
            const nextId = val != null && !Array.isArray(val) ? Number(val) : null
            if (nextId && nextId !== task.columnId) {
              onChangeColumn(nextId)
            }
          }}
          renderTrigger={({ toggle, selectedLabel }) => {
            const label = selectedLabel || currentColumn?.name || 'Статус'
            return (
              <button
                type="button"
                className={`${styles.columnStatusChip} ${styles.columnStatusInteractive}`}
                onClick={toggle}
                aria-label="Сменить статус"
                title={label}
              >
                <span className={styles.columnDot} />
                <span className={styles.columnStatusLabel}>{label}</span>
                <svg
                  className={styles.columnStatusChevron}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )
          }}
        />
      ) : currentColumn ? (
        <span className={styles.columnStatusChip} title={currentColumn.name}>
          <span className={styles.columnDot} />
          <span className={styles.columnStatusLabel}>{currentColumn.name}</span>
        </span>
      ) : null}
      <div className={styles.identityRowTail}>
        {canSendBack && onSendBack ? (
          <Button
            type="button"
            variant="ghost"
            className={styles.sendBackInlineBtn}
            onClick={onSendBack}
            title="Задача вернётся исполнителю в первую колонку воронки"
          >
            <span className={styles.sendBackInlineBtnIcon} aria-hidden>
              <SendBackRevisionIcon size={15} />
            </span>
            Вернуть на доработку
          </Button>
        ) : null}
        <p className={styles.creatorMeta} title={creatorEmail ?? undefined}>
          <span className={styles.creatorMetaPrefix}>Автор:</span>
          <span className={styles.creatorMetaValue}>{creatorLabel}</span>
        </p>
      </div>
    </div>
  )
}
