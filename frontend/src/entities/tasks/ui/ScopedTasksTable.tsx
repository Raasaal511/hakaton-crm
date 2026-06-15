import { useCallback, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Task } from 'shared/types/tasks'
import type { DepartmentMember } from 'shared/types/departments'
import {
  formatTaskDateRangeShort,
  isTaskDeadlineOverdue,
} from 'shared/lib/formatTaskDateRange'
import { useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import styles from './PipelineBoardTaskTable.module.css'

export type ScopedTasksTableRow = {
  task: Task
  stageLabel: string
  stageDone?: boolean
  stageDotColor?: string
  organizationName?: string
}

type ScopedTasksTableProps = {
  rows: ScopedTasksTableRow[]
  currentUser: { id: number; firstname: string; lastname: string; email: string } | null
  isPersonalOrganization?: boolean
  /** Id личных пространств (для сводки «Все задачи») */
  personalOrganizationIds?: Set<number>
  /** Список участников одной организации */
  members?: DepartmentMember[]
  /** Несколько организаций: отображаемые имена по `organizationId` и `userId` */
  memberNamesByOrg?: Record<number, Map<number, string>>
  /** Колонка «Пространство» (страница «Все задачи») */
  showOrganizationColumn?: boolean
}

function memberShort(m: DepartmentMember): string {
  const fn = (m.firstname ?? '').trim()
  const ln = (m.lastname ?? '').trim()
  const name = [fn, ln].filter(Boolean).join(' ')
  return name || m.email || `Участник #${m.id}`
}

function labelToMember(id: number, label: string): DepartmentMember {
  const parts = label.trim().split(/\s+/).filter(Boolean)
  return {
    id,
    email: '',
    firstname: parts[0] ?? `#${id}`,
    lastname: parts.slice(1).join(' '),
    role: 'member',
  }
}

function resolveResponsiblesSingleOrg(
  task: Task,
  members: DepartmentMember[],
  currentUser: ScopedTasksTableProps['currentUser'],
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

function resolveResponsiblesMultiOrg(
  task: Task,
  memberNamesByOrg: Record<number, Map<number, string>>,
  currentUser: ScopedTasksTableProps['currentUser'],
  personalOrgIds: Set<number> | undefined,
): DepartmentMember[] {
  const orgId = task.organizationId
  const ids =
    task.responsibleIds && task.responsibleIds.length
      ? task.responsibleIds
      : task.responsibleId != null
        ? [task.responsibleId]
        : []
  const map = memberNamesByOrg[orgId]
  const list: DepartmentMember[] = []
  for (const id of ids) {
    const label = map?.get(id)
    if (label) {
      list.push(labelToMember(id, label))
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
      continue
    }
    list.push(labelToMember(id, `#${id}`))
  }
  if (
    list.length === 0 &&
    personalOrgIds?.has(orgId) &&
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
  props: Pick<ScopedTasksTableProps, 'members' | 'memberNamesByOrg' | 'currentUser'>,
): DepartmentMember | null {
  const cid = task.creatorId
  if (cid == null) return null
  const { members, memberNamesByOrg, currentUser } = props
  if (members) {
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
  if (memberNamesByOrg) {
    const orgId = task.organizationId
    const map = memberNamesByOrg[orgId]
    const label = map?.get(cid)
    if (label) return labelToMember(cid, label)
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

function resolveResponsibles(
  task: Task,
  props: Pick<
    ScopedTasksTableProps,
    | 'members'
    | 'memberNamesByOrg'
    | 'currentUser'
    | 'isPersonalOrganization'
    | 'personalOrganizationIds'
  >,
): DepartmentMember[] {
  const {
    members,
    memberNamesByOrg,
    currentUser,
    isPersonalOrganization = false,
    personalOrganizationIds,
  } = props
  if (members) {
    return resolveResponsiblesSingleOrg(task, members, currentUser, isPersonalOrganization)
  }
  if (memberNamesByOrg) {
    return resolveResponsiblesMultiOrg(task, memberNamesByOrg, currentUser, personalOrganizationIds)
  }
  return resolveResponsiblesSingleOrg(task, [], currentUser, isPersonalOrganization)
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

export function ScopedTasksTable({
  rows,
  currentUser,
  isPersonalOrganization = false,
  personalOrganizationIds,
  members,
  memberNamesByOrg,
  showOrganizationColumn = false,
}: ScopedTasksTableProps) {
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

  if (rows.length === 0) {
    return (
      <div className={styles.wrap}>
        <p className={styles.cellMuted} style={{ padding: '1.25rem 1em', margin: 0 }}>
          Нет задач по текущим условиям
        </p>
      </div>
    )
  }

  const resolveOpts = {
    members,
    memberNamesByOrg,
    currentUser,
    isPersonalOrganization,
    personalOrganizationIds,
  }

  if (isMobileList) {
    return (
      <div className={styles.wrap}>
        <ul className={styles.mobileList} aria-label="Список задач">
          {rows.map(({ task, stageLabel, stageDone, stageDotColor, organizationName }) => {
            const creatorMember = resolveCreator(task, resolveOpts)
            const responsibles = resolveResponsibles(task, resolveOpts)
            const terminal = Boolean(task.inPipelineTerminalColumn)
            const rangeLabel = formatTaskDateRangeShort(task)
            const overdue =
              rangeLabel &&
              isTaskDeadlineOverdue({
                ...task,
                inPipelineTerminalColumn: terminal,
              })
            const dotColor =
              stageDotColor &&
              (stageDotColor.startsWith('var(') ||
                /^#[0-9A-Fa-f]{6}$/i.test(stageDotColor) ||
                /^#[0-9A-Fa-f]{3}$/i.test(stageDotColor))
                ? stageDotColor
                : (stageDotColor ?? 'var(--color-accent)')

            return (
              <li key={task.id}>
                <button
                  type="button"
                  className={styles.mobileCard}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <span className={styles.mobileCardTop}>
                    <span className={styles.mobileCardTitle}>{task.name}</span>
                    {task.creatorId != null ? (
                      <span
                        className={styles.mobileCardAuthor}
                        title={
                          creatorMember != null
                            ? creatorDisplayTitle(creatorMember)
                            : creatorFallbackTitle(task.creatorId)
                        }
                      >
                        <span className={styles.mobileCardAuthorLabel}>Автор:</span>{' '}
                        <span className={styles.mobileCardAuthorName}>
                          {creatorMember != null
                            ? creatorDisplayShort(creatorMember)
                            : creatorFallbackShort(task.creatorId)}
                        </span>
                      </span>
                    ) : null}
                  </span>
                  {showOrganizationColumn && organizationName ? (
                    <span className={styles.mobileCardOrg}>{organizationName}</span>
                  ) : null}
                  <span className={styles.mobileCardMeta}>
                    <span
                      className={`${styles.stage} ${stageDone ? styles.stageDone : ''}`}
                      title={stageLabel}
                    >
                      <span
                        className={styles.stageDot}
                        style={{ ['--dot-color' as string]: dotColor }}
                      />
                      <span className={styles.stageName}>{stageLabel}</span>
                    </span>
                    {rangeLabel ? (
                      <span
                        className={`${styles.deadline} ${overdue ? styles.deadlineOverdue : ''}`}
                      >
                        {rangeLabel}
                      </span>
                    ) : (
                      <span className={styles.cellMuted}>Без срока</span>
                    )}
                  </span>
                  <span className={styles.mobileCardAssignees}>
                    <AssigneesCell list={responsibles} />
                  </span>
                  <span className={styles.mobileCardFooter}>
                    <span className={styles.mobileCardTags}>
                      {task.tags && task.tags.length > 0 ? (
                        task.tags.map((tag) => (
                          <span key={tag.id} className={styles.tag} title={tag.name}>
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className={styles.cellMuted}>Нет меток</span>
                      )}
                    </span>
                    <span className={styles.mobileCardId}>#{task.id}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <table
        className={styles.table}
        style={showOrganizationColumn ? { minWidth: 820 } : undefined}
      >
        <thead>
          <tr>
            <th className={styles.th}>Название</th>
            {showOrganizationColumn ? (
              <th className={styles.th}>Пространство</th>
            ) : null}
            <th className={styles.th}>Исполнители</th>
            <th className={styles.th}>Срок</th>
            <th className={styles.th}>Тип</th>
            <th className={styles.th}>Метки</th>
            <th className={styles.th}>ID</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ task, stageLabel, stageDone, stageDotColor, organizationName }) => {
              const responsibles = resolveResponsibles(task, resolveOpts)
              const terminal = Boolean(task.inPipelineTerminalColumn)
              const rangeLabel = formatTaskDateRangeShort(task)
              const overdue =
                rangeLabel &&
                isTaskDeadlineOverdue({
                  ...task,
                  inPipelineTerminalColumn: terminal,
                })
              const dotColor =
                stageDotColor &&
                (stageDotColor.startsWith('var(') ||
                  /^#[0-9A-Fa-f]{6}$/i.test(stageDotColor) ||
                  /^#[0-9A-Fa-f]{3}$/i.test(stageDotColor))
                  ? stageDotColor
                  : (stageDotColor ?? 'var(--color-accent)')

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
                  {showOrganizationColumn ? (
                    <td className={styles.td}>
                      {organizationName ? (
                        <span className={styles.stageName} title={organizationName}>
                          {organizationName}
                        </span>
                      ) : (
                        <span className={styles.cellMuted}>—</span>
                      )}
                    </td>
                  ) : null}
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
                  <td className={styles.td}>
                    <span
                      className={`${styles.stage} ${stageDone ? styles.stageDone : ''}`}
                      title={stageLabel}
                    >
                      <span
                        className={styles.stageDot}
                        style={{ ['--dot-color' as string]: dotColor }}
                      />
                      <span className={styles.stageName}>{stageLabel}</span>
                    </span>
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
