import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AppLayout, Button, InlineEdit } from 'shared/ui'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { departmentsAPI } from 'shared/api/requests/departments'
import { delDepartment, editDepartment, setCurrentDepartment } from 'shared/api/events/department'
import { useCanManage, useCanManageDepartment, useDeleteWithConfirm } from 'shared/lib'
import { departmentPageMounted, departmentPageUnmounted } from '../model'
import { DepartmentSettingsPermissions, DepartmentSettingsPolicies } from 'features/department/settings'
import styles from './DepartmentSettingsPage.module.css'

export function DepartmentSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)
  const department = departmentModel.selectors.useCurrentDepartment()
  const members = departmentModel.selectors.useDepartmentMembers()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const currentUser = userModel.selectors.useUser()
  const { isOwner } = useCanManage(orgMembers, currentUser?.id)
  const { canRenameDepartment, canAssignDepartmentAdmin, canManageDepartmentPolicies } =
    useCanManageDepartment(orgMembers, members, currentUser?.id, department?.permissions ?? null)
  const { deleteError, handleDelete } = useDeleteWithConfirm()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!departmentId) return
    setError(null)
    departmentPageMounted({ departmentId })
    departmentsAPI
      .getById(departmentId)
      .catch((err) => {
        console.error('Failed to load department:', err)
        setError('Не удалось загрузить Раздел')
      })
    return () => departmentPageUnmounted()
  }, [departmentId])

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

  const onNameSave = async (newName: string) => {
    try {
      const updated = await departmentsAPI.update(departmentId, newName)
      editDepartment(updated)
      setCurrentDepartment(updated)
    } catch (error) {
      console.error('Failed to update department name:', error)
    }
  }

  if (!department) {
    return (
      <AppLayout>
        <div className={styles.loading}>{error ?? 'Загрузка...'}</div>
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
            <span className={styles.breadcrumbCurrent}>Настройки</span>
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
              <h1 className={styles.title}>Настройки Раздела</h1>
              <p className={styles.subtitle}>
                Название раздела, правила задач и настройки для администраторов отдела
              </p>
            </div>
          </div>

          <div className={styles.sections}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Основные настройки</h2>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabel}>Название Раздела</div>
                <div className={styles.fieldControl}>
                  <div className={styles.deptNameRow}>
                    <InlineEdit
                      value={department.name}
                      onSave={onNameSave}
                      className={styles.deptName}
                      editable={canRenameDepartment}
                    />
                    {canRenameDepartment && (
                      <button
                        type="button"
                        className={styles.editIconBtn}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const target = (e.currentTarget.previousElementSibling as HTMLElement | null)
                          if (target) {
                            target.click()
                          }
                        }}
                        title="Переименовать Раздел"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 20 20"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M4 13.5L4.5 11.5L11.5 4.5L13.5 6.5L6.5 13.5L4 13.5Z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M11 4L12.5 2.5C12.8978 2.10218 13.4374 1.87868 14 1.87868C14.2786 1.87868 14.5552 1.9335 14.8142 2.04054C15.0733 2.14758 15.309 2.30468 15.509 2.50471C15.709 2.70473 15.8661 2.94044 15.9732 3.19949C16.0802 3.45854 16.135 3.73513 16.135 4.01375C16.135 4.29236 16.0802 4.56895 15.9732 4.828C15.8661 5.08705 15.709 5.32276 15.509 5.52279L14 7"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4 17H16"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {isOwner ? (
              <section className={styles.section}>
                <DepartmentSettingsPermissions department={department} />
              </section>
            ) : null}

            {canManageDepartmentPolicies ? (
              <section className={styles.section}>
                <DepartmentSettingsPolicies department={department} />
              </section>
            ) : null}

          </div>
          {(deleteError || error) && <p className={styles.error}>{deleteError || error}</p>}
        </div>

      </div>
    </AppLayout>
  )
}
