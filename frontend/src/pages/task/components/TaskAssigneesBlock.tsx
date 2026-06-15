import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Dropdown, type DropdownItem } from 'shared/ui'
import type { DepartmentMember } from 'shared/types/departments'
import styles from '../TaskPage.module.css'

/** Свернуть список исполнителей в одну строку при count > N. */
const ASSIGNEES_LIST_COLLAPSE_AFTER = 2

type Props = {
  members: DepartmentMember[]
  responsibleMembers: DepartmentMember[]
  editResponsibleIds: number[]
  unassignedMembers: DepartmentMember[]
  canEditContent: boolean
  orgIsPersonal: boolean
  onResponsiblesChange: (val: string | number | (string | number)[] | null) => void
  onRemoveResponsible: (userId: number) => void
  onAssignWholeDepartment: () => void
}

export function TaskAssigneesBlock({
  members,
  responsibleMembers,
  editResponsibleIds,
  unassignedMembers,
  canEditContent,
  orgIsPersonal,
  onResponsiblesChange,
  onRemoveResponsible,
  onAssignWholeDepartment,
}: Props) {
  const allDeptAlreadyAssigned =
    members.length > 0 && members.every((m) => editResponsibleIds.includes(m.id))

  const assigneesCount = responsibleMembers.length
  const assigneesNeedsCollapse =
    !orgIsPersonal && assigneesCount > ASSIGNEES_LIST_COLLAPSE_AFTER

  /**
   * `null` — пользователь ещё не делал ручной выбор; используется автологика:
   *   - до порога: всегда раскрыто;
   *   - выше порога: свёрнуто по умолчанию, можно раскрыть кликом по сводке.
   * При падении ниже порога override сбрасывается — следующий «всплеск» снова
   * стартует свёрнутым.
   */
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null)

  const assigneesListExpanded =
    orgIsPersonal || assigneesCount <= ASSIGNEES_LIST_COLLAPSE_AFTER
      ? true
      : (userExpanded ?? false)

  useEffect(() => {
    if (assigneesCount <= ASSIGNEES_LIST_COLLAPSE_AFTER && userExpanded != null) {
      setUserExpanded(null)
    }
  }, [assigneesCount, userExpanded])

  const setAssigneesListExpanded: Dispatch<SetStateAction<boolean>> = (next) => {
    setUserExpanded((prev) => {
      const current = prev ?? assigneesListExpanded
      return typeof next === 'function' ? next(current) : next
    })
  }

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
        /** Ручка истории в portal на body — не даём этому mousedown свернуть список и тем самым «съесть» click. */
        if (t.closest('[data-task-history-edge-handle]')) return
      }
      setAssigneesListExpanded(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
    // setAssigneesListExpanded — стабильный локальный сеттер, рендерится из stateful useState, перезапускать подписку не нужно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneesNeedsCollapse, assigneesListExpanded])

  if (orgIsPersonal) return null
  if (!canEditContent && responsibleMembers.length === 0) return null

  const renderAssigneeRow = (m: DepartmentMember) => (
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
      {canEditContent ? (
        <button
          type="button"
          className={styles.assigneeRowRemove}
          onClick={() => onRemoveResponsible(m.id)}
          aria-label={`Убрать исполнителя ${m.firstname} ${m.lastname}`}
          title="Убрать исполнителя"
        >
          ×
        </button>
      ) : null}
    </li>
  )

  return (
    <div
      ref={assigneesDismissRootRef}
      className={
        assigneesNeedsCollapse && assigneesListExpanded
          ? `${styles.assigneesBlock} ${styles.assigneesBlockRaised}`
          : styles.assigneesBlock
      }
    >
      {canEditContent ? (
        <div className={styles.assigneesToolbarRow}>
          <Dropdown
            items={unassignedMembers.map(
              (m): DropdownItem => ({
                id: m.id,
                label: `${m.firstname} ${m.lastname}`,
                avatarInitial: m.firstname?.[0]?.toUpperCase() || '?',
              }),
            )}
            multiple
            menuPlacement="above"
            value={editResponsibleIds}
            placeholder={
              responsibleMembers.length === 0 ? 'Исполнитель' : '+ Добавить исполнителя'
            }
            onChange={onResponsiblesChange}
            renderTrigger={({ toggle }) => (
              <button
                type="button"
                className={`${styles.pill} ${styles.pillAdd}`}
                onClick={toggle}
              >
                {responsibleMembers.length === 0
                  ? 'Исполнитель'
                  : '+ Добавить исполнителя'}
              </button>
            )}
          />
          {members.length > 1 && !allDeptAlreadyAssigned ? (
            <button
              type="button"
              className={`${styles.pill} ${styles.pillAdd}`}
              onClick={onAssignWholeDepartment}
              title="Назначить исполнителями всех сотрудников отдела"
            >
              Весь отдел
            </button>
          ) : null}
        </div>
      ) : null}
      {responsibleMembers.length > 0 ? (
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
                    {responsibleMembers.map(renderAssigneeRow)}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <ul className={styles.assigneesList}>
              {responsibleMembers.map(renderAssigneeRow)}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
