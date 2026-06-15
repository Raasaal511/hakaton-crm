import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AppLayout, Button, Modal, Dropdown, type DropdownItem } from 'shared/ui'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { AddDepartmentMemberForm } from 'features/department/add-member'
import { RemoveDepartmentMemberButton } from 'features/department/remove-member'
import { departmentsAPI } from 'shared/api/requests/departments'
import { delDepartment, updateDepartmentMemberRole } from 'shared/api/events/department'
import { useCanManageDepartment, useDeleteWithConfirm, useMediaQuery, mediaMaxMobileQuery } from 'shared/lib'
import { departmentPageMounted, departmentPageUnmounted } from '../model'
import type { DepartmentMember, DepartmentRole } from 'shared/types/departments'
import styles from '../settings/DepartmentSettingsPage.module.css'

const DEPT_ROLE_LABELS: Record<DepartmentRole, string> = {
  member: 'Участник',
  admin: 'Админ',
}

const DEPT_ROLE_OPTIONS: DropdownItem[] = [
  {
    id: 'member',
    label: DEPT_ROLE_LABELS.member,
    description:
      'Работает в разделе: создаёт задачи, видит доску. В выдаче — в основном задачи, где он автор или исполнитель. Не меняет воронку, колонки, участников и теги.',
  },
  {
    id: 'admin',
    label: 'Админ отдела',
    description:
      'Настраивает раздел: название, воронки, колонки, участников и роли в разделе. Видит все задачи раздела. Назначить ещё одного админа раздела могут только владелец или админ организации.',
  },
]

export function DepartmentMembersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)
  const [showAddMember, setShowAddMember] = useState(false)

  const department = departmentModel.selectors.useCurrentDepartment()
  const members = departmentModel.selectors.useDepartmentMembers()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const organizations = organizationModel.selectors.useOrganizations()
  const currentUser = userModel.selectors.useUser()
  const { canManageMembers, canAssignDepartmentAdmin } = useCanManageDepartment(
    orgMembers,
    members,
    currentUser?.id,
    department?.permissions,
  )
  const { deleteError, handleDelete } = useDeleteWithConfirm()
  const [roleError, setRoleError] = useState<string | null>(null)
  const isMobileMembers = useMediaQuery(mediaMaxMobileQuery)

  const orgOwnerUserId = useMemo(() => {
    if (!department) return null
    const org = organizations.find((o) => o.id === department.organizationId)
    if (org?.ownerUserId != null) return org.ownerUserId
    const ownerMember = orgMembers.find((m) => m.role === 'owner')
    return ownerMember?.id ?? null
  }, [department, organizations, orgMembers])

  const canRemoveMemberFromDepartment = (member: DepartmentMember) => {
    if (currentUser != null && member.id === currentUser.id) return false
    if (orgOwnerUserId != null && member.id === orgOwnerUserId) return false
    return true
  }

  useEffect(() => {
    if (!departmentId) return
    departmentPageMounted({ departmentId })
    return () => departmentPageUnmounted()
  }, [departmentId])

  const onRoleChange = async (memberId: number, newRole: DepartmentRole) => {
    setRoleError(null)
    try {
      await departmentsAPI.updateMemberRole(departmentId, memberId, newRole)
      updateDepartmentMemberRole({ id: memberId, role: newRole })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Ошибка смены роли')
      setRoleError(msg)
    }
  }

  const onDeleteDept = () =>
    department &&
    handleDelete(
      `Удалить Раздел «${department.name}»?`,
      async () => {
        await departmentsAPI.delete(departmentId)
        delDepartment(departmentId)
      },
      () => navigate(`/organizations/${department.organizationId}`)
    )

  if (!department) {
    return (
      <AppLayout>
        <div className={styles.loading}>Загрузка...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <div className={styles.breadcrumb}>
            <Link to="/" className={styles.breadcrumbLink}>
              Главная
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link
              to={`/organizations/${department.organizationId}`}
              className={styles.breadcrumbLink}
            >
              Организация
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link
              to={`/departments/${departmentId}`}
              className={styles.breadcrumbLink}
            >
              {department.name}
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Участники</span>
          </div>

          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => navigate(`/departments/${departmentId}`)}>
              ← К Разделу
            </Button>
            {canAssignDepartmentAdmin && (
              <Button variant="danger" onClick={onDeleteDept}>
                Удалить отдел
              </Button>
            )}
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroIcon}>#</div>
            <div className={styles.heroText}>
              <h1 className={styles.title}>Участники</h1>
              <p className={styles.subtitle}>
                {department.name} · {members.length}{' '}
                {members.length === 1 ? 'участник' : members.length >= 2 && members.length <= 4 ? 'участника' : 'участников'}
              </p>
            </div>
            {canManageMembers && (
              <Button
                variant="primary"
                onClick={() => setShowAddMember(true)}
                className={styles.heroAddBtn}
              >
                + Добавить
              </Button>
            )}
          </div>

          <div className={styles.membersTableWrap}>
            {members.length === 0 ? (
              <div className={styles.empty}>
                Нет участников. Добавьте участников из организации.
              </div>
            ) : isMobileMembers ? (
              <ul className={styles.membersMobileList} aria-label="Участники раздела">
                {members.map((member) => (
                  <li key={member.id} className={styles.membersMobileCard}>
                    <div className={styles.membersMobileCardTop}>
                      <div className={styles.memberAvatar}>
                        {member.firstname?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className={styles.membersMobileCardMain}>
                        <span className={styles.memberName}>
                          {member.firstname} {member.lastname}
                        </span>
                        <span className={styles.memberEmail}>{member.email}</span>
                      </div>
                    </div>
                    <div className={styles.membersMobileCardFooter}>
                      <div className={styles.membersMobileRole}>
                        {canAssignDepartmentAdmin ? (
                          <Dropdown
                            items={DEPT_ROLE_OPTIONS}
                            value={member.role}
                            placeholder="Роль"
                            searchPlaceholder="Роль..."
                            onChange={(val) => {
                              if (val === 'member' || val === 'admin') onRoleChange(member.id, val)
                            }}
                            renderTrigger={({ toggle, selectedLabel }) => {
                              const label =
                                selectedLabel ??
                                DEPT_ROLE_LABELS[member.role ?? 'member'] ??
                                member.role
                              const isAdmin = (member.role ?? 'member') === 'admin'
                              return (
                                <button
                                  type="button"
                                  className={isAdmin ? styles.roleBadgeAdmin : styles.roleBadge}
                                  onClick={toggle}
                                  title="Изменить роль"
                                >
                                  <span className={styles.roleBadgeText}>{label}</span>
                                  <span className={styles.roleBadgeIcon}>▾</span>
                                </button>
                              )
                            }}
                            className={styles.roleDropdown}
                          />
                        ) : (
                          <span
                            className={
                              (member.role ?? 'member') === 'admin'
                                ? styles.roleBadgeAdmin
                                : styles.roleBadge
                            }
                            title="Роль"
                          >
                            {DEPT_ROLE_LABELS[member.role ?? 'member'] ?? member.role}
                          </span>
                        )}
                      </div>
                      {canManageMembers ? (
                        <div className={styles.membersMobileActions}>
                          <RemoveDepartmentMemberButton
                            departmentId={departmentId}
                            member={member}
                            canManage={canManageMembers && canRemoveMemberFromDepartment(member)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.membersTableInner}>
                <table className={styles.membersTable}>
                  <thead>
                    <tr>
                      <th className={styles.thUser}>Участник</th>
                      <th className={styles.thEmail}>Email</th>
                      <th className={styles.thRole}>Роль в отделе</th>
                      {canManageMembers && <th className={styles.thActions}>Действия</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id} className={styles.row}>
                        <td className={styles.tdUser}>
                          <div className={styles.userCell}>
                            <div className={styles.memberAvatar}>
                              {member.firstname?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span className={styles.memberName}>
                              {member.firstname} {member.lastname}
                            </span>
                          </div>
                        </td>
                        <td className={styles.tdEmail}>{member.email}</td>
                        <td className={styles.tdRole}>
                          {canAssignDepartmentAdmin ? (
                            <Dropdown
                              items={DEPT_ROLE_OPTIONS}
                              value={member.role}
                              placeholder="Роль"
                              searchPlaceholder="Роль..."
                              onChange={(val) => {
                                if (val === 'member' || val === 'admin') onRoleChange(member.id, val)
                              }}
                              renderTrigger={({ toggle, selectedLabel }) => {
                                const label =
                                  selectedLabel ??
                                  DEPT_ROLE_LABELS[member.role ?? 'member'] ??
                                  member.role
                                const isAdmin = (member.role ?? 'member') === 'admin'
                                return (
                                  <button
                                    type="button"
                                    className={isAdmin ? styles.roleBadgeAdmin : styles.roleBadge}
                                    onClick={toggle}
                                    title="Изменить роль"
                                  >
                                    <span className={styles.roleBadgeText}>{label}</span>
                                    <span className={styles.roleBadgeIcon}>▾</span>
                                  </button>
                                )
                              }}
                              className={styles.roleDropdown}
                            />
                          ) : (
                            <span
                              className={
                                (member.role ?? 'member') === 'admin'
                                  ? styles.roleBadgeAdmin
                                  : styles.roleBadge
                              }
                              title="Роль"
                            >
                              {DEPT_ROLE_LABELS[member.role ?? 'member'] ?? member.role}
                            </span>
                          )}
                        </td>
                        {canManageMembers && (
                          <td className={styles.tdActions}>
                            <RemoveDepartmentMemberButton
                              departmentId={departmentId}
                              member={member}
                              canManage={canManageMembers && canRemoveMemberFromDepartment(member)}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {deleteError && <p className={styles.error}>{deleteError}</p>}
          {roleError && <p className={styles.error}>{roleError}</p>}
        </div>

        <Modal
          isOpen={showAddMember}
          onClose={() => setShowAddMember(false)}
          title="Добавить участника"
        >
          <AddDepartmentMemberForm
            departmentId={departmentId}
            organizationId={department.organizationId}
            currentMembers={members}
            orgMembers={orgMembers}
            canAssignDepartmentAdmin={canAssignDepartmentAdmin}
            onClose={() => setShowAddMember(false)}
          />
        </Modal>
      </div>
    </AppLayout>
  )
}

