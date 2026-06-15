import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useUnit } from 'effector-react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AppLayout, Button, InlineEdit } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { departmentModel } from 'entities/department'
import { userModel } from 'entities/user'
import { departmentsAPI } from 'shared/api/requests/departments'
import {
  addDepartment,
  delDepartment,
  editDepartment,
  reorderDepartments as reorderDepartmentsEvent,
} from 'shared/api/events/department'
import { useCanManage, useCanManageDepartment, useDeleteWithConfirm } from 'shared/lib'
import type { Department, DepartmentMember } from 'shared/types/departments'
import type { OrganizationMember } from 'shared/types/organization'
import {
  organizationPageMounted,
  organizationPageUnmounted,
  $organizationPageError,
  $departmentMembersMap,
} from './model'
import styles from './OrganizationPage.module.css'

const MAX_VISIBLE_MEMBER_AVATARS = 5
const EMPTY_MEMBERS: DepartmentMember[] = []

const makeDeptDragId = (id: number) => `dept-${id}` as const
const parseDeptDragId = (id: string | number): number =>
  typeof id === 'string' && id.startsWith('dept-') ? Number(id.slice(5)) : Number(id)

function FolderIcon() {
  return (
    <svg className={styles.deptSvgIcon} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 19c.62-2.35 2.95-4 5.5-4h5c2.55 0 4.88 1.65 5.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="3" r="1.4" />
      <circle cx="10" cy="3" r="1.4" />
      <circle cx="6" cy="8" r="1.4" />
      <circle cx="10" cy="8" r="1.4" />
      <circle cx="6" cy="13" r="1.4" />
      <circle cx="10" cy="13" r="1.4" />
    </svg>
  )
}

function initialsOf(firstname: string | undefined, lastname: string | undefined, fallback?: string): string {
  const f = (firstname ?? '').trim()[0]
  const l = (lastname ?? '').trim()[0]
  if (f && l) return `${f}${l}`.toUpperCase()
  if (f) return f.toUpperCase()
  if (l) return l.toUpperCase()
  const fb = (fallback ?? '').trim()
  return fb ? fb[0]!.toUpperCase() : '?'
}

function fullName(member: { firstname?: string; lastname?: string; email?: string }): string {
  const fn = (member.firstname ?? '').trim()
  const ln = (member.lastname ?? '').trim()
  const joined = [fn, ln].filter(Boolean).join(' ')
  return joined || (member.email ?? '').trim() || 'Без имени'
}

function memberWord(n: number): string {
  const abs = n % 100
  if (abs >= 11 && abs <= 14) return 'участников'
  const last = n % 10
  if (last === 1) return 'участник'
  if (last >= 2 && last <= 4) return 'участника'
  return 'участников'
}

function deptWord(n: number): string {
  const abs = n % 100
  if (abs >= 11 && abs <= 14) return 'разделов'
  const last = n % 10
  if (last === 1) return 'раздел'
  if (last >= 2 && last <= 4) return 'раздела'
  return 'разделов'
}

type DepartmentCardKebabProps = {
  departmentId: number
  canRename: boolean
  canDelete: boolean
  canOpenSettings: boolean
  canOpenTags: boolean
  canOpenMembers: boolean
  onRename: () => void
  onDelete: () => void
}

function DepartmentCardKebab({
  departmentId,
  canRename,
  canDelete,
  canOpenSettings,
  canOpenTags,
  canOpenMembers,
  onRename,
  onDelete,
}: DepartmentCardKebabProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)

  const updateMenuPos = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const menuWidth = menuRef.current?.getBoundingClientRect().width ?? 180
    const pad = 8
    let left = rect.right - menuWidth
    if (left < pad) left = pad
    if (left + menuWidth > window.innerWidth - pad) {
      left = window.innerWidth - pad - menuWidth
    }
    setMenuPos({ top: rect.bottom + 4, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    updateMenuPos()
    const onMove = () => updateMenuPos()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, updateMenuPos])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!canRename && !canDelete && !canOpenSettings && !canOpenTags && !canOpenMembers) {
    return null
  }

  return (
    <div className={`dropdown ${styles.cardKebabWrap}`} ref={wrapRef}>
      <button
        type="button"
        ref={btnRef}
        className={`dropdownBtn ${styles.cardKebabBtn}`}
        title="Действия с разделом"
        aria-label="Действия с разделом"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden>
          <path
            stroke="currentColor"
            strokeWidth="1.5"
            d="M8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          />
        </svg>
      </button>
      {open && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className={styles.cardKebabMenu}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                zIndex: 10_000,
                width: 'max-content',
                minWidth: 180,
              }}
              role="menu"
            >
              {canOpenSettings && (
                <button
                  type="button"
                  className={styles.cardKebabItem}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/departments/${departmentId}/settings`)
                    setOpen(false)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Настройки раздела
                </button>
              )}
              {canOpenTags && (
                <button
                  type="button"
                  className={styles.cardKebabItem}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/departments/${departmentId}/tags`)
                    setOpen(false)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 7h.01"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Теги
                </button>
              )}
              {canOpenMembers && (
                <button
                  type="button"
                  className={styles.cardKebabItem}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/departments/${departmentId}/members`)
                    setOpen(false)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 19C4.62098 16.6501 6.95229 15 9.5 15H14.5C17.0477 15 19.379 16.6501 20 19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Участники
                </button>
              )}
              {canRename && (
                <button
                  type="button"
                  className={styles.cardKebabItem}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRename()
                    setOpen(false)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M10.5 1.75a1.767 1.767 0 1 1 2.5 2.5L4.375 12.875 1.75 13.125l.25-2.625L10.5 1.75Z"
                    />
                  </svg>
                  Переименовать
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className={`${styles.cardKebabItem} ${styles.cardKebabItemDanger}`}
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                    setOpen(false)
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M1.75 3.5h10.5M5.25 3.5V2.625a.875.875 0 0 1 .875-.875h1.75a.875.875 0 0 1 .875.875V3.5M5.25 6.125v3.5M8.75 6.125v3.5M2.625 3.5h8.75l-.438 7.875a.875.875 0 0 1-.875.875H3.938a.875.875 0 0 1-.875-.875L2.625 3.5Z"
                    />
                  </svg>
                  Удалить
                </button>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

type DepartmentCardProps = {
  department: Department
  members: DepartmentMember[]
  orgMembers: OrganizationMember[]
  currentUserId: number | undefined
  isPersonalOrg: boolean
  isOrgOwner: boolean
  canManageOrg: boolean
  canReorder: boolean
  onOpen: (id: number) => void
}

const DepartmentRow = memo(function DepartmentRow({
  department,
  members,
  orgMembers,
  currentUserId,
  isPersonalOrg,
  isOrgOwner,
  canManageOrg,
  canReorder,
  onOpen,
}: DepartmentCardProps) {
  const { isOwner } = useCanManage(orgMembers, currentUserId)
  const { canRenameDepartment, canManageMembers, canManageDepartment, canManageTags } =
    useCanManageDepartment(orgMembers, members, currentUserId, department.permissions)
  const { handleDelete: confirmDelete, deleteError } = useDeleteWithConfirm()
  const [renameEditorSignal, setRenameEditorSignal] = useState(0)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: makeDeptDragId(department.id),
    disabled: !canReorder,
  })

  const { primaryAdmin, participants } = useMemo(() => {
    if (!isOrgOwner) {
      return { primaryAdmin: undefined as DepartmentMember | undefined, participants: members }
    }
    const admins = members.filter((m) => m.role === 'admin')
    const regular = members.filter((m) => m.role !== 'admin')
    return { primaryAdmin: admins[0], participants: regular }
  }, [isOrgOwner, members])

  const visibleParticipants = participants.slice(0, MAX_VISIBLE_MEMBER_AVATARS)
  const extraCount = participants.length - visibleParticipants.length

  const canRename = !isPersonalOrg && canRenameDepartment
  const canDelete = !isPersonalOrg && canManageOrg
  const canOpenSettings =
    !isPersonalOrg &&
    (isOwner || canRenameDepartment || canManageMembers || canManageDepartment)
  const canOpenTags = !isPersonalOrg && canManageTags
  const canOpenMembers = !isPersonalOrg && canManageMembers
  const showKebab =
    canRename || canDelete || canOpenSettings || canOpenTags || canOpenMembers

  const handleNameSave = useCallback(
    async (name: string) => {
      const updated = await departmentsAPI.update(department.id, name)
      editDepartment(updated)
    },
    [department.id],
  )

  const handleDeleteClick = useCallback(() => {
    void confirmDelete(
      `Удалить раздел «${department.name}»? Его воронки и задачи будут недоступны.`,
      async () => {
        await departmentsAPI.delete(department.id)
        delDepartment(department.id)
      },
    )
  }, [confirmDelete, department.id, department.name])

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const t = e.target as Element
    if (t.closest('.dropdown') || t.closest('.dropdownBtn')) return
    if (t.closest('[data-dept-card-stop]')) return
    onOpen(department.id)
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: isDragging ? 'transform' : undefined,
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen(department.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      className={`${styles.departmentCard} ${isDragging ? styles.departmentCardDragging : ''}`.trim()}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-label={`Открыть раздел ${department.name}`}
    >
      <div className={styles.cardHead}>
        <div className={styles.cardTitleBlock}>
          {canReorder && (
            <button
              type="button"
              className={styles.dragHandle}
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              title="Перетащите, чтобы изменить порядок"
              aria-label="Перетащите, чтобы изменить порядок"
            >
              <DragHandleIcon />
            </button>
          )}
          <div className={styles.departmentIcon}>
            <FolderIcon />
          </div>
          <div className={styles.cardTitleText}>
            <div
              {...(canRename
                ? {
                    'data-dept-card-stop': true,
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                  }
                : {})}
            >
              <InlineEdit
                value={department.name}
                onSave={handleNameSave}
                className={styles.departmentName}
                inputClassName={styles.departmentNameInput}
                editable={canRename}
                openEditorSignal={renameEditorSignal}
              />
            </div>
            {deleteError ? (
              <p className={styles.cardRowError} role="status">
                {deleteError}
              </p>
            ) : null}
            <div className={styles.departmentMeta}>
              {!isPersonalOrg && (
                <span className={styles.metaChip}>
                  <PeopleIcon />
                  <span>
                    {members.length} {memberWord(members.length)}
                  </span>
                </span>
              )}
              {isPersonalOrg && (
                <span className={styles.metaChip}>
                  <span>Личное пространство</span>
                </span>
              )}
            </div>
          </div>
        </div>
        {showKebab && (
          <DepartmentCardKebab
            departmentId={department.id}
            canRename={canRename}
            canDelete={canDelete}
            canOpenSettings={canOpenSettings}
            canOpenTags={canOpenTags}
            canOpenMembers={canOpenMembers}
            onRename={() => setRenameEditorSignal((n) => n + 1)}
            onDelete={handleDeleteClick}
          />
        )}
      </div>

      {!isPersonalOrg && (
        <div className={styles.cardBody}>
          <div className={styles.peopleSection}>
            {isOrgOwner && (
              <>
                <div className={styles.peopleColumn}>
                  <span className={styles.peopleLabel}>Администратор отдела</span>
                  {primaryAdmin ? (
                    <div className={styles.adminBadge} title={fullName(primaryAdmin)}>
                      <span className={`${styles.avatar} ${styles.avatarAdmin}`} aria-hidden>
                        {initialsOf(primaryAdmin.firstname, primaryAdmin.lastname, primaryAdmin.email)}
                      </span>
                      <span className={styles.adminName}>{fullName(primaryAdmin)}</span>
                    </div>
                  ) : (
                    <span className={styles.peopleEmpty}>Не назначен</span>
                  )}
                </div>

                <div className={styles.peopleDivider} aria-hidden />
              </>
            )}

            <div className={styles.peopleColumn}>
              <span className={styles.peopleLabel}>
                {participants.length > 0 ? 'Участники' : 'Участников нет'}
              </span>
              {participants.length > 0 ? (
                <div className={styles.avatarStack}>
                  {visibleParticipants.map((m) => (
                    <span
                      key={m.id}
                      className={styles.avatar}
                      title={fullName(m)}
                      aria-label={fullName(m)}
                    >
                      {initialsOf(m.firstname, m.lastname, m.email)}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className={`${styles.avatar} ${styles.avatarExtra}`} aria-hidden>
                      +{extraCount}
                    </span>
                  )}
                </div>
              ) : (
                <span className={styles.peopleEmpty}>Добавьте людей в раздел</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export function OrganizationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const organizationId = Number(id)

  const [showCreateDepartment, setShowCreateDepartment] = useState(false)
  const [newDepartmentName, setNewDepartmentName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const organization = organizationModel.selectors.useCurrentOrganization()
  const error = useUnit($organizationPageError)
  const departments = departmentModel.selectors.useDepartments()
  const departmentMembersMap = useUnit($departmentMembersMap)
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const currentUser = userModel.selectors.useUser()
  const { canManage, isOwner } = useCanManage(orgMembers, currentUser?.id)

  const departmentsSorted = useMemo(
    () =>
      [...departments].sort(
        (a, b) =>
          (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
          a.id - b.id,
      ),
    [departments],
  )

  const isPersonalOrg = Boolean(organization?.isPersonal)
  const canReorder = isOwner && !isPersonalOrg && departmentsSorted.length > 1

  const sortableIds = useMemo(
    () => departmentsSorted.map((d) => makeDeptDragId(d.id)),
    [departmentsSorted],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    if (!organizationId) return
    organizationPageMounted({ organizationId })
    return () => organizationPageUnmounted()
  }, [organizationId])

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDepartmentName.trim()) return

    try {
      setIsCreating(true)
      const dep = await departmentsAPI.create(organizationId, newDepartmentName.trim())
      addDepartment(dep)
      setNewDepartmentName('')
      setShowCreateDepartment(false)
    } catch (error) {
      console.error('Failed to create department:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const goToDepartment = useCallback(
    (departmentId: number) => {
      navigate(`/departments/${departmentId}`)
    },
    [navigate],
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids: string[] = sortableIds
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const nextIds = arrayMove(ids, oldIndex, newIndex).map(parseDeptDragId)
    const previousIds = ids.map(parseDeptDragId)

    reorderDepartmentsEvent(nextIds)
    try {
      await departmentsAPI.reorder(organizationId, nextIds)
    } catch (error) {
      console.error('Failed to reorder departments:', error)
      reorderDepartmentsEvent(previousIds)
    }
  }

  if (!organization) {
    return (
      <AppLayout>
        <div className={styles.loading}>{error ?? 'Загрузка...'}</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <header className={styles.topBar}>
          <nav className={styles.breadcrumb} aria-label="Навигация">
            <Link to="/" className={styles.breadcrumbLink}>
              Главная
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>{organization.name}</span>
          </nav>
        </header>

        <div className={styles.body}>
          <section className={styles.hero} aria-labelledby="org-title">
            <div className={styles.heroIcon}>{organization.name[0]?.toUpperCase()}</div>
            <div className={styles.heroText}>
              <h1 id="org-title" className={styles.heroTitle}>
                {organization.name}
              </h1>
              <div className={styles.heroMeta} role="list">
                <span className={styles.heroMetaItem} role="listitem">
                  <span className={styles.heroMetaValue}>{departments.length}</span>
                  <span className={styles.heroMetaLabel}>{deptWord(departments.length)}</span>
                </span>
                {canManage && !isPersonalOrg && (
                  <>
                    <span className={styles.heroMetaDot} aria-hidden>
                      ·
                    </span>
                    <span className={styles.heroMetaItem} role="listitem">
                      <span className={styles.heroMetaValue}>{orgMembers.length}</span>
                      <span className={styles.heroMetaLabel}>{memberWord(orgMembers.length)}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className={styles.departmentsPanel} aria-labelledby="dept-heading">
            <div className={styles.panelHeader}>
              <div className={styles.panelHeaderText}>
                <h2 id="dept-heading" className={styles.panelTitle}>
                  Разделы
                </h2>
                <p className={styles.panelDesc}>
                  {canReorder
                    ? 'Перетащите карточки за иконку слева, чтобы изменить их порядок.'
                    : 'Каждый раздел — отдельное пространство с воронками и задачами.'}
                </p>
              </div>
              {canManage && (
                <Button variant="primary" onClick={() => setShowCreateDepartment(true)}>
                  + Создать раздел
                </Button>
              )}
            </div>

            <div className={styles.departmentsGrid}>
              {departmentsSorted.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    {departmentsSorted.map((department) => (
                      <DepartmentRow
                        key={department.id}
                        department={department}
                        members={departmentMembersMap[department.id] ?? EMPTY_MEMBERS}
                        orgMembers={orgMembers}
                        currentUserId={currentUser?.id}
                        isPersonalOrg={isPersonalOrg}
                        isOrgOwner={isOwner}
                        canManageOrg={canManage}
                        canReorder={canReorder}
                        onOpen={goToDepartment}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}

              {departments.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIllustration} aria-hidden>
                    <FolderIcon />
                  </div>
                  <h3 className={styles.emptyTitle}>Пока нет разделов</h3>
                  <p className={styles.emptyDescription}>
                    Создайте первый раздел — в нём появятся воронки и задачи вашей команды.
                  </p>
                  {canManage && (
                    <Button onClick={() => setShowCreateDepartment(true)}>Создать раздел</Button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {showCreateDepartment && (
          <div className={styles.modal}>
            <div
              className={styles.modalOverlay}
              onClick={() => setShowCreateDepartment(false)}
              aria-hidden
            />
            <div className={styles.modalContent} role="dialog" aria-modal="true" aria-labelledby="modal-title">
              <h3 id="modal-title" className={styles.modalTitle}>
                Новый раздел
              </h3>
              <form onSubmit={handleCreateDepartment} className={styles.form}>
                <label className={styles.inputLabel} htmlFor="new-dept-name">
                  Название
                </label>
                <input
                  id="new-dept-name"
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  placeholder="Например, Маркетинг"
                  className={styles.input}
                  autoFocus
                  required
                />
                <div className={styles.formActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateDepartment(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreating || !newDepartmentName.trim()}
                  >
                    {isCreating ? 'Создание...' : 'Создать'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
