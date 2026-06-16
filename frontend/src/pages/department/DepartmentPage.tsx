import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useUnit } from 'effector-react'
import { AppLayout, InlineEdit, PageHeader, Button } from 'shared/ui'
import { Tag, Users, Settings } from 'lucide-react'
import { departmentsAPI } from 'shared/api/requests/departments'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { pipelineModel } from 'entities/pipeline'
import { DepartmentPipelines } from 'entities/pipeline/ui/DepartmentPipelines'
import { userModel } from 'entities/user'
import { useCanManage, useCanManageDepartment, useDeleteWithConfirm } from 'shared/lib'
import { editDepartment, setCurrentDepartment } from 'shared/api/events/department'
import { departmentOverviewMounted, departmentOverviewUnmounted, $departmentOverviewError } from './model'
import styles from './DepartmentPage.module.css'

export function DepartmentPage() {
  const { id } = useParams<{ id: string }>()
  const departmentId = Number(id)
  const navigate = useNavigate()
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

  const pipelines = pipelineModel.selectors.usePipelinesForDepartment(departmentId)

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

  const pipelineCount = pipelines.length
  const memberCount = members.length
  const orgName = departmentOrg?.name ?? 'Организация'

  const descParts: string[] = []
  if (memberCount > 0) descParts.push(`${memberCount} участник${memberCount === 1 ? '' : memberCount < 5 ? 'а' : 'ов'}`)
  if (pipelineCount > 0) descParts.push(`${pipelineCount} воронк${pipelineCount === 1 ? 'а' : pipelineCount < 5 ? 'и' : ''}`)

  return (
    <AppLayout>
      <div className={`${styles.page} ${styles.departmentFunnelsOverview}`}>
        <PageHeader
          title={department.name}
          titleNode={
            <InlineEdit
              value={department.name}
              onSave={handleDepartmentNameSave}
              className={styles.pageTitle}
              editable={canRenameDepartment}
            />
          }
          breadcrumb={[{ label: orgName }, { label: 'Разделы' }]}
          description={descParts.join(' · ') || undefined}
          actions={
            <div className={styles.headerActions}>
              {canManageTags && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Tag size={14} />}
                  onClick={() => navigate(`/departments/${departmentId}/tags`)}
                >
                  Теги
                </Button>
              )}
              {showDepartmentMembersNav && canManageMembers && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Users size={14} />}
                  onClick={() => navigate(`/departments/${departmentId}/members`)}
                >
                  Участники
                </Button>
              )}
              {showSettingsNav && (
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Settings size={14} />}
                  onClick={() => navigate(`/departments/${departmentId}/settings`)}
                >
                  Настройки
                </Button>
              )}
            </div>
          }
        />
        {(deleteError || error) && (
          <p className={styles.error} style={{ padding: '0 1.5rem' }}>{deleteError || error}</p>
        )}

        <DepartmentPipelines
          departmentId={departmentId}
          organizationId={department.organizationId}
          canManage={canManagePipelines}
        />
      </div>
    </AppLayout>
  )
}