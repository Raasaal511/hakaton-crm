import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { AppLayout, Button } from 'shared/ui'
import { departmentModel } from 'entities/department'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { DepartmentSettingsTags } from 'features/department/settings'
import { useCanManageDepartment } from 'shared/lib'
import { departmentPageMounted, departmentPageUnmounted } from '../model'
import styles from '../settings/DepartmentSettingsPage.module.css'

export function DepartmentTagsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const departmentId = Number(id)

  const department = departmentModel.selectors.useCurrentDepartment()
  const members = departmentModel.selectors.useDepartmentMembers()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const currentUser = userModel.selectors.useUser()
  const { canManageTags } = useCanManageDepartment(
    orgMembers,
    members,
    currentUser?.id,
    department?.permissions,
  )

  useEffect(() => {
    if (!departmentId) return
    departmentPageMounted({ departmentId })
    return () => departmentPageUnmounted()
  }, [departmentId])

  if (!department) {
    return (
      <AppLayout>
        <div className={styles.loading}>Загрузка...</div>
      </AppLayout>
    )
  }

  if (!canManageTags) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <p className={styles.loading}>Нет доступа к управлению тегами раздела.</p>
          <Button type="button" variant="secondary" onClick={() => navigate(`/departments/${departmentId}`)}>
            ← К разделу
          </Button>
        </div>
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
            <Link to={`/departments/${departmentId}`} className={styles.breadcrumbLink}>
              {department.name}
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Теги</span>
          </div>

          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => navigate(`/departments/${departmentId}`)}>
              ← К разделу
            </Button>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroIcon} aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M7 7h.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className={styles.heroText}>
              <h1 className={styles.title}>Теги раздела</h1>
              <p className={styles.subtitle}>
                Справочник меток для задач в «{department.name}»
              </p>
            </div>
          </div>

          <div className={styles.sections}>
            <section className={styles.section}>
              <DepartmentSettingsTags
                departmentId={departmentId}
                canManage={canManageTags}
                showHeading={false}
              />
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
