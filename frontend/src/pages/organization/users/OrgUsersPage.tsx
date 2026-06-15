import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { AppLayout, Button, Modal, Dropdown, type DropdownItem } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { AddMemberForm } from 'features/organization/add-member'
import { RemoveMemberButton as RemoveOrganizationMemberButton } from 'features/organization/remove-member'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { setCurrentOrganization, removeMember, setMembers } from 'shared/api/events/organization'
import type { OrganizationMemberWithDepartments } from 'shared/types/organization'
import { ORG_ROLE_LABELS, useCanManage, useDeleteWithConfirm, useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import styles from './OrgUsersPage.module.css'

const ROLE_OPTIONS: DropdownItem[] = [
  {
    id: 'owner',
    label: ORG_ROLE_LABELS.owner,
    description:
      'Может удалить организацию, менять её название и роли участников (нельзя оставить организацию без владельца). В остальном — как админ: участники, разделы, теги, все задачи.',
  },
  {
    id: 'admin',
    label: ORG_ROLE_LABELS.admin,
    description:
      'Приглашает и исключает участников, создаёт и удаляет разделы, настраивает теги организации, видит все задачи. Не меняет название организации, не удаляет организацию и не меняет роли в организации — это только владелец.',
  },
  {
    id: 'member',
    label: ORG_ROLE_LABELS.member,
    description:
      'Не управляет организацией и не видит все разделы подряд — только те, куда добавлен. В списках задач в основном свои: где он автор или исполнитель.',
  },
]

const DEPT_ROLE_LABELS: Record<string, string> = {
  member: 'Участник',
  admin: 'Админ',
}

function formatUser(m: OrganizationMemberWithDepartments) {
  const name = [m.firstname, m.lastname].filter(Boolean).join(' ') || '—'
  const initials = [m.firstname?.[0], m.lastname?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return { name, email: m.email, initials }
}

function isForbiddenError(e: unknown): boolean {
  const status = (e as { response?: { status?: number } })?.response?.status
  return status === 403
}

export function OrgUsersPage() {
  const { id } = useParams<{ id: string }>()
  const organizationId = Number(id)
  const [members, setMembersState] = useState<OrganizationMemberWithDepartments[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const { deleteError, handleDelete } = useDeleteWithConfirm()

  const organization = organizationModel.selectors.useCurrentOrganization()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const currentUser = userModel.selectors.useUser()
  const { canManage, isOwner } = useCanManage(orgMembers, currentUser?.id)
  const isMobileUsers = useMediaQuery(mediaMaxMobileQuery)

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    setForbidden(false)
    Promise.all([
      organizationsAPI.getById(organizationId),
      organizationsAPI
        .getMembersWithDepartments(organizationId)
        .then((data): { success: true; data: OrganizationMemberWithDepartments[] } => ({ success: true, data }))
        .catch((e: unknown) => ({ success: false as const, error: e })),
    ])
      .then(([org, membersResult]) => {
        setCurrentOrganization(org)
        if (membersResult.success) {
          setMembers(membersResult.data.map((m) => ({ id: m.id, email: m.email, firstname: m.firstname, lastname: m.lastname, role: m.role })))
          setMembersState(membersResult.data)
          setForbidden(false)
        } else {
          setMembers([])
          setMembersState([])
          setForbidden(isForbiddenError(membersResult.error))
          if (!isForbiddenError(membersResult.error)) {
            const msg =
              (membersResult.error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              (membersResult.error instanceof Error ? membersResult.error.message : 'Не удалось загрузить список')
            setError(msg)
          }
        }
      })
      .catch((e: unknown) => {
        setCurrentOrganization(null)
        setMembers([])
        setError(e instanceof Error ? e.message : 'Не удалось загрузить данные')
        setMembersState([])
      })
      .finally(() => setLoading(false))
  }, [organizationId, reloadKey])

  useEffect(() => {
    setSelectedUserIds([])
  }, [reloadKey])

  useEffect(() => {
    if (selectMode) return
    setSelectedUserIds([])
  }, [selectMode])

  const handleMemberAdded = () => {
    setShowAddMember(false)
    setReloadKey((k) => k + 1)
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const ownersCount = members?.filter((m) => m.role === 'owner').length ?? 0
  const isSingleOwner = ownersCount === 1
  const deletableUserIds = members
    ? members.filter((m) => !(isSingleOwner && m.role === 'owner')).map((m) => m.id)
    : []
  const deletableUserIdsSet = new Set(deletableUserIds)
  const selectedDeletableUserIds = selectedUserIds.filter((id) => deletableUserIdsSet.has(id))
  const isAllDeletableSelected =
    deletableUserIds.length > 0 && deletableUserIds.every((id) => selectedUserIds.includes(id))
  const selectedOwnersCount =
    members?.filter((m) => selectedUserIds.includes(m.id) && m.role === 'owner').length ?? 0
  const canBulkDelete =
    canManage && selectedDeletableUserIds.length > 0 && ownersCount - selectedOwnersCount > 0

  const handleRoleChange = async (memberId: number, newRole: string) => {
    setActionError(null)
    try {
      const updated = await organizationsAPI.updateMemberRole(organizationId, memberId, newRole)

      // Обновляем локальный список с отделами без полной перезагрузки страницы,
      // чтобы не было «прыжка» (scroll reset).
      setMembersState((prev) =>
        prev
          ? prev.map((m) =>
            m.id === updated.id
              ? { ...m, role: updated.role }
              : m,
          )
          : prev,
      )

      const nextOrgMembers = orgMembers.map((m) =>
        m.id === updated.id ? { ...m, role: updated.role } : m,
      )
      setMembers(nextOrgMembers)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Ошибка смены роли')
      setActionError(msg)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className={styles.wrapper}>
          <div className={styles.loading}>Загрузка…</div>
        </div>
      </AppLayout>
    )
  }

  if (forbidden) {
    return (
      <AppLayout>
        <div className={styles.wrapper}>
          <div className={styles.forbidden}>
            <h1 className={styles.title}>Нет доступа</h1>
            <p className={styles.text}>
              Управление участниками доступно только владельцу и администратору организации.
            </p>
            {organization && (
              <Link to={`/organizations/${organization.id}`} className={styles.backLink}>
                ← К организации
              </Link>
            )}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!loading && organization?.isPersonal) {
    return (
      <AppLayout>
        <div className={styles.wrapper}>
          <div className={styles.forbidden}>
            <h1 className={styles.title}>Пользователи</h1>
            <p className={styles.text}>
              Личная организация только для ваших задач: сюда нельзя приглашать других пользователей. Чтобы работать в
              команде, создайте отдельную организацию на главной странице.
            </p>
            <Link to={`/organizations/${organization.id}`} className={styles.backLink}>
              ← К организации
            </Link>
            <Link to="/" className={styles.backLink}>
              На главную
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Пользователи</h1>
            {organization && (
              <p className={styles.subtitle}>
                Участники организации «{organization.name}» и их отделы
              </p>
            )}
          </div>
          {organization && canManage && (
            <div className={styles.headerActions}>
              {!selectMode ? (
                <Button type="button" variant="secondary" onClick={() => setSelectMode(true)}>
                  Выбрать
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelectMode(false)
                    setSelectedUserIds([])
                  }}
                >
                  Отменить выбор
                </Button>
              )}

              {selectMode && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    void handleDelete(
                      `Удалить выбранных участников (${selectedDeletableUserIds.length})?`,
                      async () => {
                        setBulkDeleting(true)
                        try {
                          await organizationsAPI.removeMembers(organizationId, selectedDeletableUserIds)
                          selectedDeletableUserIds.forEach((userId) => removeMember(userId))
                          setReloadKey((k) => k + 1)
                        } finally {
                          setBulkDeleting(false)
                        }
                      },
                      () => {
                        setSelectedUserIds([])
                        setSelectMode(false)
                      },
                    )
                  }}
                  disabled={!canBulkDelete || bulkDeleting}
                >
                  {bulkDeleting ? 'Удаление...' : `Удалить выбранных (${selectedDeletableUserIds.length})`}
                </Button>
              )}
              <Button type="button" variant="primary" onClick={() => setShowAddMember(true)}>
                + Добавить участника
              </Button>
            </div>
          )}
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {deleteError && <div className={styles.error}>{deleteError}</div>}
        {actionError && <div className={styles.error}>{actionError}</div>}

        {!error && members && (
          <div className={styles.tableWrap}>
            {members.length === 0 ? (
              <div className={styles.empty}>Нет участников</div>
            ) : isMobileUsers ? (
              <ul className={styles.mobileUserList} aria-label="Участники организации">
                {members.map((m) => {
                  const { name, email, initials } = formatUser(m)
                  const isOwnerOrAdmin = m.role === 'owner' || m.role === 'admin'
                  return (
                    <li key={m.id} className={styles.mobileUserCard}>
                      <div className={styles.mobileUserTop}>
                        <span className={styles.avatar} aria-hidden>{initials}</span>
                        <div className={styles.mobileUserMain}>
                          <span className={styles.userName}>{name}</span>
                          <span className={styles.mobileUserEmail}>{email}</span>
                        </div>
                        {canManage && selectMode ? (
                          <input
                            type="checkbox"
                            className={styles.userSelectCheckbox}
                            checked={selectedUserIds.includes(m.id)}
                            disabled={isSingleOwner && m.role === 'owner'}
                            onChange={() => toggleUserSelection(m.id)}
                            aria-label={`Выбрать ${email}`}
                          />
                        ) : null}
                      </div>

                      <div className={styles.mobileUserSection}>
                        <span className={styles.mobileUserSectionLabel}>Роль</span>
                        <div className={styles.mobileUserSectionBody}>
                          {(isOwner || m.role !== 'owner') ? (
                            <Dropdown
                              items={ROLE_OPTIONS}
                              value={m.role}
                              placeholder="Роль"
                              searchPlaceholder="Поиск роли..."
                              onChange={(val) => {
                                if (val != null) handleRoleChange(m.id, String(val))
                              }}
                              renderTrigger={({ toggle, selectedLabel }) => {
                                const label = selectedLabel || ORG_ROLE_LABELS[m.role] || m.role
                                return (
                                  <button
                                    type="button"
                                    className={styles.roleTrigger}
                                    onClick={toggle}
                                    title="Изменить роль"
                                  >
                                    <span className={styles.roleTriggerText}>{label}</span>
                                    <span className={styles.roleTriggerIcon}>▾</span>
                                  </button>
                                )
                              }}
                            />
                          ) : (
                            <span
                              className={
                                isOwnerOrAdmin ? styles.orgRoleBadgeHighlight : styles.orgRoleBadge
                              }
                            >
                              {ORG_ROLE_LABELS[m.role] ?? m.role}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={styles.mobileUserSection}>
                        <span className={styles.mobileUserSectionLabel}>Отделы</span>
                        <div className={styles.mobileUserSectionBody}>
                          {m.departments.length === 0 ? (
                            <span className={styles.noDepts}>Не в отделах</span>
                          ) : (
                            <ul className={styles.mobileDeptList}>
                              {m.departments.map((d) => (
                                <li key={d.departmentId} className={styles.mobileDeptChip}>
                                  <Link
                                    to={`/departments/${d.departmentId}`}
                                    className={styles.deptLink}
                                  >
                                    {d.departmentName}
                                  </Link>
                                  <span
                                    className={
                                      d.role === 'admin'
                                        ? styles.deptRoleBadgeAdmin
                                        : styles.deptRoleBadge
                                    }
                                  >
                                    {DEPT_ROLE_LABELS[d.role] ?? d.role}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      {canManage && !selectMode ? (
                        <div className={styles.mobileUserActions}>
                          {m.role === 'owner' && isSingleOwner ? (
                            <Button type="button" variant="danger" disabled>
                              Удалить
                            </Button>
                          ) : (
                            <RemoveOrganizationMemberButton
                              organizationId={organizationId}
                              member={m}
                              canManage={canManage}
                              onSuccess={() => setReloadKey((k) => k + 1)}
                            />
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className={styles.tableWrapInner}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thUser}>Пользователь</th>
                      <th className={styles.thEmail}>Email</th>
                      <th className={styles.thRole}>Роль</th>
                      <th className={styles.thDepts}>Отделы</th>
                      {canManage && (
                        <th className={styles.thActions}>
                          {selectMode ? (
                            <input
                              type="checkbox"
                              className={styles.selectAllCheckbox}
                              checked={isAllDeletableSelected}
                              disabled={deletableUserIds.length === 0}
                              onChange={(e) => {
                                setSelectedUserIds(e.target.checked ? deletableUserIds : [])
                              }}
                              aria-label="Выбрать всех"
                            />
                          ) : (
                            'Действия'
                          )}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const { name, email, initials } = formatUser(m)
                      const isOwnerOrAdmin = m.role === 'owner' || m.role === 'admin'
                      return (
                        <tr key={m.id} className={styles.row}>
                          <td className={styles.tdUser}>
                            <div className={styles.userCell}>
                              <span className={styles.avatar} aria-hidden>{initials}</span>
                              <span className={styles.userName}>{name}</span>
                            </div>
                          </td>
                          <td className={styles.tdEmail}>{email}</td>
                          <td className={styles.tdRole}>
                            {(isOwner || m.role !== 'owner') ? (
                              <Dropdown
                                items={ROLE_OPTIONS}
                                value={m.role}
                                placeholder="Роль"
                                searchPlaceholder="Поиск роли..."
                                onChange={(val) => {
                                  if (val != null) handleRoleChange(m.id, String(val))
                                }}
                                renderTrigger={({ toggle, selectedLabel }) => {
                                  const label = selectedLabel || ORG_ROLE_LABELS[m.role] || m.role
                                  return (
                                    <button
                                      type="button"
                                      className={styles.roleTrigger}
                                      onClick={toggle}
                                      title="Изменить роль"
                                    >
                                      <span className={styles.roleTriggerText}>{label}</span>
                                      <span className={styles.roleTriggerIcon}>▾</span>
                                    </button>
                                  )
                                }}
                              />
                            ) : (
                              <span
                                className={
                                  isOwnerOrAdmin ? styles.orgRoleBadgeHighlight : styles.orgRoleBadge
                                }
                              >
                                {ORG_ROLE_LABELS[m.role] ?? m.role}
                              </span>
                            )}
                          </td>
                          <td className={styles.tdDepts}>
                            {m.departments.length === 0 ? (
                              <span className={styles.noDepts}>Не в отделах</span>
                            ) : (
                              <ul className={styles.deptList}>
                                {m.departments.map((d) => (
                                  <li key={d.departmentId} className={styles.deptItem}>
                                    <Link
                                      to={`/departments/${d.departmentId}`}
                                      className={styles.deptLink}
                                    >
                                      {d.departmentName}
                                    </Link>
                                    <span
                                      className={
                                        d.role === 'admin'
                                          ? styles.deptRoleBadgeAdmin
                                          : styles.deptRoleBadge
                                      }
                                    >
                                      {DEPT_ROLE_LABELS[d.role] ?? d.role}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          {canManage && (
                            <td className={styles.tdActions}>
                              <div className={styles.actionsCell}>
                                {selectMode && (
                                  <input
                                    type="checkbox"
                                    className={styles.userSelectCheckbox}
                                    checked={selectedUserIds.includes(m.id)}
                                    disabled={isSingleOwner && m.role === 'owner'}
                                    onChange={() => toggleUserSelection(m.id)}
                                    aria-label={`Выбрать ${email}`}
                                  />
                                )}
                                {m.role === 'owner' && isSingleOwner && !selectMode ? (
                                  <Button type="button" variant="danger" disabled>
                                    Удалить
                                  </Button>
                                ) : !selectMode ? (
                                  <RemoveOrganizationMemberButton
                                    organizationId={organizationId}
                                    member={m}
                                    canManage={canManage}
                                    onSuccess={() => setReloadKey((k) => k + 1)}
                                  />
                                ) : null}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {organization && (
          <Modal
            isOpen={showAddMember}
            onClose={() => setShowAddMember(false)}
            title="Добавить участника"
          >
            <AddMemberForm
              organizationId={organizationId}
              onClose={handleMemberAdded}
            />
          </Modal>
        )}
      </div>
    </AppLayout>
  )
}