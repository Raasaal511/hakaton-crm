import { useCallback, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task } from 'shared/types/tasks'
import type { Column } from 'shared/types/columns'
import type { DepartmentMember } from 'shared/types/departments'
import {
  formatTaskDateRangeShort,
  isTaskDeadlineOverdue,
} from 'shared/lib/formatTaskDateRange'
import { isTaskInCompletedPipelineColumn } from 'shared/lib/isTaskInCompletedPipelineColumn'
import { useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import { Dropdown, filterSelectDropdownClassName, type DropdownItem } from 'shared/ui'
import styles from './PipelineBoardTaskTable.module.css'

export type PipelineBoardTaskTableRow = { task: Task; column: Column }

type PipelineBoardTaskTableProps = {
  rows: PipelineBoardTaskTableRow[]
  members: DepartmentMember[]
  columns: Column[]
  currentUser: { id: number; firstname: string; lastname: string; email: string } | null
  isPersonalOrganization?: boolean
  /** Режим списка: колонки, доступные в селекторе стадии (права как на канбане). */
  getListStageMoveColumns?: (task: Task) => Column[]
  canChangeListTaskStage?: (task: Task) => boolean
  onListTaskMoveToColumn?: (taskId: number, columnId: number) => void
}

function memberShort(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  const name = [fn, ln].filter(Boolean).join(' ')
  return name || m.email || `Участник #${m.id}`
}

function resolveResponsibles(
  task: Task,
  members: DepartmentMember[],
  currentUser: PipelineBoardTaskTableProps['currentUser'],
  isPersonalOrganization: boolean,
): DepartmentMember[] {
  const ids =
    task.responsibleIds && task.responsibleIds.length
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
  if (
    list.length === 0 &&
    isPersonalOrganization &&
    currentUser != null &&
    (task.responsibleId == null || task.responsibleId === currentUser.id)
  ) {
    list.push({
      id: currentUser.id,
      email: currentUser.email,
      firstname: currentUser.firstname,
      lastname: currentUser.lastname,
      role: 'member',
    })
  }
  return list
}

function creatorDisplayShort(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  if (fn && ln) return `${fn} ${ln[0]}.`
  if (fn) return fn
  if (ln) return ln
  const email = (m.email ?? '').trim()
  if (email) return email
  return `Участник #${m.id}`
}

function creatorDisplayTitle(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  const namePart = [fn, ln].filter(Boolean).join(' ')
  const email = (m.email ?? '').trim()
  if (namePart) return email ? `Автор: ${namePart} (${email})` : `Автор: ${namePart}`
  if (email) return `Автор: ${email}`
  return `Автор: участник #${m.id}`
}

function creatorFallbackShort(creatorId: number): string {
  return `ID ${creatorId}`
}

function creatorFallbackTitle(creatorId: number): string {
  return `Автор: ID ${creatorId}`
}

function resolveCreator(
  task: Task,
  members: DepartmentMember[],
  currentUser: PipelineBoardTaskTableProps['currentUser'],
): DepartmentMember | null {
  const cid = task.creatorId
  if (cid == null) return null
  const fromDept = members.find((m) => m.id === cid)
  if (fromDept) return fromDept
  if (currentUser != null && currentUser.id === cid) {
    return {
      id: currentUser.id,
      email: currentUser.email,
      firstname: currentUser.firstname,
      lastname: currentUser.lastname,
      role: 'member',
    }
  }
  return null
}

function Avatar({
  letter,
  title,
  ghost,
  stacked,
}: {
  letter: string
  title?: string
  ghost?: boolean
  stacked?: boolean
}) {
  return (
    <span
      className={`${styles.avatar} ${ghost ? styles.avatarGhost : ''} ${stacked ? styles.avatarStacked : ''}`}
      title={title}
      aria-hidden
    >
      {letter}
    </span>
  )
}

function PersonChip({ member }: { member: DepartmentMember | null }) {
  if (!member) {
    return (
      <span className={styles.chipRow}>
        <Avatar letter="?" ghost title="Не назначен" />
        <span className={`${styles.cellMuted} ${styles.nameEllipsis}`}>—</span>
      </span>
    )
  }
  return (
    <span className={styles.chipRow}>
      <Avatar letter={member.firstname?.[0]?.toUpperCase() || 'U'} title={memberShort(member)} />
      <span className={styles.nameEllipsis} title={memberShort(member)}>
        {memberShort(member)}
      </span>
    </span>
  )
}

function AuthorCell({
  task,
  members,
  currentUser,
}: {
  task: Task
  members: DepartmentMember[]
  currentUser: PipelineBoardTaskTableProps['currentUser']
}) {
  if (task.creatorId == null) {
    return <span className={styles.cellMuted}>—</span>
  }
  const creator = resolveCreator(task, members, currentUser)
  if (creator) {
    return (
      <span className={styles.chipRow} title={creatorDisplayTitle(creator)}>
        <Avatar letter={creator.firstname?.[0]?.toUpperCase() || 'U'} title={creatorDisplayTitle(creator)} />
        <span className={`${styles.nameEllipsis} ${styles.authorNameInTable}`}>
          {creatorDisplayShort(creator)}
        </span>
      </span>
    )
  }
  return (
    <span className={styles.nameEllipsis} title={creatorFallbackTitle(task.creatorId)}>
      {creatorFallbackShort(task.creatorId)}
    </span>
  )
}

function listStageAccent(column: Column): string {
  const c = column.color?.trim() ?? ''
  if (/^#[0-9A-Fa-f]{6}$/.test(c) || /^#[0-9A-Fa-f]{3}$/.test(c)) return c
  return 'var(--color-accent)'
}

function ListStageCell({
  task,
  column,
  terminal,
  moveColumns,
  onMoveToColumn,
}: {
  task: Task
  column: Column
  terminal: boolean
  moveColumns: Column[] | null
  onMoveToColumn?: (taskId: number, columnId: number) => void
}) {
  const dotColor = listStageAccent(column)
  const interactive =
    Boolean(onMoveToColumn) && moveColumns != null && moveColumns.length > 0

  const staticStage = (
    <span
      className={`${styles.stage} ${terminal ? styles.stageDone : ''}`}
      title={column.name}
    >
      <span className={styles.stageDot} style={{ ['--dot-color' as string]: dotColor }} />
      <span className={styles.stageName}>{column.name}</span>
    </span>
  )

  if (!interactive) return staticStage

  const items: DropdownItem[] = moveColumns.map((col) => ({
    id: col.id,
    label: col.name,
  }))

  return (
    <span
      className={styles.listStageStop}
      data-stop-card-nav
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Dropdown
        className={`${filterSelectDropdownClassName} ${styles.listStageDropdown}`}
        items={items}
        value={task.columnId ?? column.id}
        placeholder="Стадия"
        onChange={(val) => {
          const nextId = val != null && !Array.isArray(val) ? Number(val) : null
          if (nextId && nextId !== (task.columnId ?? column.id)) {
            onMoveToColumn?.(task.id, nextId)
          }
        }}
        renderTrigger={({ toggle, selectedLabel }) => {
          const label = selectedLabel || column.name
          return (
            <button
              type="button"
              className={`${styles.listStageChip} ${styles.listStageChipInteractive} ${terminal ? styles.listStageChipTerminal : ''}`}
              style={{ ['--list-stage-accent' as string]: dotColor }}
              onClick={toggle}
              aria-label="Сменить стадию"
              title={label}
            >
              <span className={styles.listStageDot} />
              <span className={styles.listStageLabel}>{label}</span>
              <svg
                className={styles.listStageChevron}
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
    </span>
  )
}

function AssigneesCell({ list }: { list: DepartmentMember[] }) {
  if (list.length === 0) {
    return <span className={styles.cellMuted}>—</span>
  }
  if (list.length === 1) {
    return <PersonChip member={list[0]!} />
  }
  const visible = list.slice(0, 3)
  const extra = list.length - visible.length
  return (
    <span className={styles.chipRow}>
      <span className={styles.avatarStack} title={list.map(memberShort).join(', ')}>
        {visible.map((m, i) => (
          <Avatar
            key={m.id}
            letter={m.firstname?.[0]?.toUpperCase() || 'U'}
            title={memberShort(m)}
            stacked={i > 0}
          />
        ))}
        {extra > 0 ? (
          <span
            className={`${styles.avatar} ${styles.avatarExtra} ${styles.avatarStacked}`}
            title={list
              .slice(3)
              .map(memberShort)
              .join(', ')}
          >
            +{extra}
          </span>
        ) : null}
      </span>
      <span className={`${styles.cellMuted} ${styles.nameEllipsis}`}>{list.length} исп.</span>
    </span>
  )
}

export function PipelineBoardTaskTable({
  rows,
  members,
  columns,
  currentUser,
  isPersonalOrganization = false,
  getListStageMoveColumns,
  canChangeListTaskStage,
  onListTaskMoveToColumn,
}: PipelineBoardTaskTableProps) {
  const navigate = useNavigate()
  const isMobileList = useMediaQuery(mediaMaxMobileQuery)

  const onRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTableRowElement>, taskId: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        navigate(`/tasks/${taskId}`)
      }
    },
    [navigate],
  )

  const onMobileCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, taskId: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const t = e.target as HTMLElement | null
        if (t && t.closest('[data-stop-card-nav]')) return
        e.preventDefault()
        navigate(`/tasks/${taskId}`)
      }
    },
    [navigate],
  )

  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.cellMuted} style={{ padding: '1.25rem 1rem', margin: 0 }}>
          Нет задач по текущим фильтрам
        </p>
      </div>
    )
  }

  if (isMobileList) {
    return (
      <div className={styles.wrap}>
        <ul className={styles.mobileList} aria-label="Список задач">
          {rows.map(({ task, column }) => {
            const creatorMember = resolveCreator(task, members, currentUser)
            const responsibles = resolveResponsibles(
              task,
              members,
              currentUser,
              isPersonalOrganization,
            )
            const terminal = isTaskInCompletedPipelineColumn(column.id, columns)
            const rangeLabel = formatTaskDateRangeShort(task)
            const overdue =
              rangeLabel &&
              isTaskDeadlineOverdue({
                ...task,
                inPipelineTerminalColumn: terminal,
              })
            const dotColor = listStageAccent(column)

            return (
              <li key={task.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className={styles.mobileCard}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  onKeyDown={(e) => onMobileCardKeyDown(e, task.id)}
                >
                  <span className={styles.mobileCardTop}>
                    <span className={styles.mobileCardTitle}>{task.name}</span>
                    <span
                      className={styles.mobileCardAuthor}
                      title={
                        task.creatorId == null
                          ? 'Автор не указан'
                          : creatorMember != null
                            ? creatorDisplayTitle(creatorMember)
                            : creatorFallbackTitle(task.creatorId)
                      }
                    >
                      <span className={styles.mobileCardAuthorLabel}>Автор:</span>{' '}
                      <span className={styles.mobileCardAuthorName}>
                        {task.creatorId == null
                          ? '—'
                          : creatorMember != null
                            ? creatorDisplayShort(creatorMember)
                            : creatorFallbackShort(task.creatorId)}
                      </span>
                    </span>
                  </span>
                  <span className={styles.mobileCardAssignees}>
                    <AssigneesCell list={responsibles} />
                  </span>
                  <div className={styles.mobileCardMetaRow}>
                    <span
                      className={`${styles.stage} ${terminal ? styles.stageDone : ''} ${styles.mobileCardStageReadonly}`}
                      title={column.name}
                    >
                      <span
                        className={styles.stageDot}
                        style={{ ['--dot-color' as string]: dotColor }}
                      />
                      <span className={styles.stageName}>{column.name}</span>
                    </span>
                    <div className={styles.mobileCardMetaTail}>
                      {rangeLabel ? (
                        <span
                          className={`${styles.deadline} ${overdue ? styles.deadlineOverdue : ''} ${styles.mobileCardDeadlineCompact}`}
                        >
                          {rangeLabel}
                        </span>
                      ) : (
                        <span className={`${styles.cellMuted} ${styles.mobileCardNoDeadline}`}>
                          Без срока
                        </span>
                      )}
                      <span className={styles.mobileCardIdTiny}>#{task.id}</span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Название</th>
            <th className={styles.th}>Автор</th>
            <th className={styles.th}>Исполнители</th>
            <th className={styles.th}>Срок</th>
            <th className={styles.th}>Стадия</th>
            <th className={styles.th}>Метки</th>
            <th className={styles.th}>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, column }) => {
            const responsibles = resolveResponsibles(
              task,
              members,
              currentUser,
              isPersonalOrganization,
            )
            const terminal = isTaskInCompletedPipelineColumn(column.id, columns)
            const rangeLabel = formatTaskDateRangeShort(task)
            const overdue =
              rangeLabel &&
              isTaskDeadlineOverdue({
                ...task,
                inPipelineTerminalColumn: terminal,
              })
            const allowStage =
              Boolean(getListStageMoveColumns && onListTaskMoveToColumn) &&
              (canChangeListTaskStage?.(task) ?? false)
            const moveColumns =
              allowStage && getListStageMoveColumns ? getListStageMoveColumns(task) : null

            return (
              <tr
                key={task.id}
                className={styles.tr}
                tabIndex={0}
                role="button"
                onClick={() => navigate(`/tasks/${task.id}`)}
                onKeyDown={(e) => onRowKeyDown(e, task.id)}
              >
                <td className={styles.td}>
                  <span className={styles.taskName} title={task.name}>
                    {task.name}
                  </span>
                </td>
                <td className={styles.td}>
                  <AuthorCell task={task} members={members} currentUser={currentUser} />
                </td>
                <td className={styles.td}>
                  <AssigneesCell list={responsibles} />
                </td>
                <td className={styles.td}>
                  {rangeLabel ? (
                    <span
                      className={`${styles.deadline} ${overdue ? styles.deadlineOverdue : ''}`}
                    >
                      {rangeLabel}
                    </span>
                  ) : (
                    <span className={styles.cellMuted}>—</span>
                  )}
                </td>
                <td
                  className={styles.td}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <ListStageCell
                    task={task}
                    column={column}
                    terminal={terminal}
                    moveColumns={moveColumns}
                    onMoveToColumn={allowStage ? onListTaskMoveToColumn : undefined}
                  />
                </td>
                <td className={styles.td}>
                  {task.tags && task.tags.length > 0 ? (
                    <span className={styles.tags}>
                      {task.tags.map((tag) => (
                        <span key={tag.id} className={styles.tag} title={tag.name}>
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className={styles.cellMuted}>—</span>
                  )}
                </td>
                <td className={`${styles.td} ${styles.idCell}`}>#{task.id}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
