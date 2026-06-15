import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUnit } from 'effector-react'
import { AppLayout, InlineEdit } from 'shared/ui'
import { departmentsAPI } from 'shared/api/requests/departments'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { DepartmentPipelines } from 'entities/pipeline/ui/DepartmentPipelines'
import { userModel } from 'entities/user'
import { useCanManage, useCanManageDepartment, useDeleteWithConfirm, cn } from 'shared/lib'
import { editDepartment, setCurrentDepartment } from 'shared/api/events/department'
import { departmentOverviewMounted, departmentOverviewUnmounted, $departmentOverviewError } from './model'
import styles from './DepartmentPage.module.css'

export function DepartmentPage() {
  const { id } = useParams<{ id: string }>()
  const departmentId = Number(id)
  const [error, setError] = useState<string | null>(null)
  const { deleteError } = useDeleteWithConfirm()

  const department = departmentModel.selectors.useCurrentDepartment()
  const members = departmentModel.selectors.useDepartmentMembers()
  const loadError = useUnit($departmentOverviewError)
  const currentUser = userModel.selectors.useUser()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const organizations = organizationModel.selectors.useOrganizations()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const { isOwner } = useCanManage(orgMembers, currentUser?.id)
  const {
    canManageDepartment,
    canManageMembers,
    canManagePipelines,
    canManageTags,
    canRenameDepartment,
  } = useCanManageDepartment(orgMembers, members, currentUser?.id, department?.permissions)
  const showSettingsNav =
    isOwner || canRenameDepartment || canManageMembers || canManageDepartment

  const departmentOrg = department
    ? organizations.find((o) => o.id === department.organizationId) ??
      (currentOrganization?.id === department.organizationId ? currentOrganization : null)
    : null
  const showDepartmentMembersNav = Boolean(departmentOrg && !departmentOrg.isPersonal)

  useEffect(() => {
    if (!departmentId) return
    departmentOverviewMounted({ departmentId })
    return () => departmentOverviewUnmounted()
  }, [departmentId])

  const handleDepartmentNameSave = async (newName: string) => {
    try {
      setError(null)
      const updated = await departmentsAPI.update(departmentId, newName)
      editDepartment(updated)
      setCurrentDepartment(updated)
    } catch (err) {
      console.error('Failed to update department name:', err)
      setError('Не удалось сохранить название Раздела')
    }
  }

  if (!department) {
    return (
      <AppLayout>
        <div className={styles.loading}>
          {loadError ?? error ?? 'Загрузка...'}
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={cn(styles.page, styles.departmentFunnelsOverview)}>
        <div className={styles.pageHeader}>
          <div className={styles.breadcrumb}>
            <Link
              to={`/organizations/${department.organizationId}`}
              className={styles.breadcrumbItem}
            >
              ← Все разделы
            </Link>
          </div>
          <div className={styles.titleSection}>
            <div className={styles.titleBlock}>
              <InlineEdit
                value={department.name}
                onSave={handleDepartmentNameSave}
                className={styles.title}
                editable={canRenameDepartment}
              />
            </div>
            <div className={styles.headerActions}>
              {canManageTags && (
                <Link
                  to={`/departments/${departmentId}/tags`}
                  className={styles.tagsBtn}
                  title="Теги раздела"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
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
                </Link>
              )}
              {showDepartmentMembersNav && canManageMembers && (
                <Link
                  to={`/departments/${departmentId}/members`}
                  className={styles.membersBtn}
                  title="Участники Раздела"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
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
                    <path
                      d="M19 7V11"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M21 9H17"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              )}
              {showSettingsNav && (
                <Link
                  to={`/departments/${departmentId}/settings`}
                  className={styles.settingsBtn}
                  title="Настройки"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
          {(deleteError || error) && (
            <p className={styles.error}>{deleteError || error}</p>
          )}
        </div>

        <DepartmentPipelines
          departmentId={departmentId}
          organizationId={department.organizationId}
          canManage={canManagePipelines}
        />
      </div>
    </AppLayout>
  )
}