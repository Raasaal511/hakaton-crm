import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useUnit } from 'effector-react'
import { AppLayout, Button, InlineEdit } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { delOrganization, setCurrentOrganization, editOrganization } from 'shared/api/events/organization'
import { useCanManage, useDeleteWithConfirm } from 'shared/lib'
import { organizationPageMounted, organizationPageUnmounted, $organizationPageError } from '../model'
import styles from './OrganizationSettingsPage.module.css'

export function OrganizationSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const organizationId = Number(id)

  const organization = organizationModel.selectors.useCurrentOrganization()
  const members = organizationModel.selectors.useOrganizationMembers()
  const currentUser = userModel.selectors.useUser()
  const { isOwner } = useCanManage(members, currentUser?.id)
  const { deleteError, handleDelete } = useDeleteWithConfirm()
  const pageError = useUnit($organizationPageError)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setError(null)
    organizationPageMounted({ organizationId })
    return () => organizationPageUnmounted()
  }, [organizationId])

  const onDeleteOrg = () => {
    if (!organization) return
    handleDelete(
      organization.isPersonal
        ? `Удалить личное пространство «${organization.name}»?`
        : `Удалить организацию «${organization.name}»?`,
      async () => {
        await organizationsAPI.delete(organizationId)
        delOrganization(organizationId)
      },
      () => navigate('/')
    )
  }

  const handleNameSave = async (newName: string) => {
    if (!organization) return
    const isPersonalOrg = organization.isPersonal
    try {
      const updated = await organizationsAPI.update(organizationId, newName)
      editOrganization(updated)
      setCurrentOrganization(updated)
    } catch (err) {
      console.error('Failed to update organization name:', err)
      setError(
        isPersonalOrg
          ? 'Не удалось сохранить название'
          : 'Не удалось сохранить название организации',
      )
    }
  }

  if (!organization) {
    return (
      <AppLayout>
        <div className={styles.loading}>{pageError ?? error ?? 'Загрузка...'}</div>
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
              to={`/organizations/${organizationId}`}
              className={styles.breadcrumbLink}
            >
              {organization.name}
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Настройки</span>
          </div>

          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => navigate(`/organizations/${organizationId}`)}>
              {organization.isPersonal ? '← К главной' : '← К организации'}
            </Button>
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.hero}>
            <div className={styles.heroIcon}>{organization.name[0]?.toUpperCase()}</div>
            <div className={styles.heroText}>
              <h1 className={styles.title}>
                {organization.isPersonal ? 'Настройки личного пространства' : 'Настройки организации'}
              </h1>
              <p className={styles.subtitle}>
                {organization.isPersonal
                  ? 'Название и удаление личного пространства'
                  : 'Управление названием и жизненным циклом организации'}
              </p>
            </div>
          </div>

          <div className={styles.sections}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Общие настройки</h2>
              </div>
              <p className={styles.sectionDesc}>
                {organization.isPersonal
                  ? 'Здесь можно изменить название личного пространства.'
                  : isOwner
                    ? 'Здесь можно управлять основными параметрами организации. Для работы с участниками используйте страницу «Пользователи» в левом меню.'
                    : 'Название организации может изменить только владелец. Для работы с участниками используйте страницу «Пользователи» в левом меню.'}
              </p>

              <div className={styles.fieldRow}>
                <div className={styles.fieldLabel}>
                  {organization.isPersonal ? 'Название пространства' : 'Название организации'}
                </div>
                <div className={styles.fieldControl}>
                  <div className={styles.deptNameRow}>
                    <InlineEdit
                      value={organization.name}
                      onSave={handleNameSave}
                      className={styles.deptName}
                      editable={isOwner || organization.isPersonal}
                    />
                    {isOwner && (
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
                        title={
                          organization.isPersonal
                            ? 'Переименовать пространство'
                            : 'Переименовать организацию'
                        }
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

              {isOwner && (
                <div className={styles.dangerZone}>
                  <Button variant="danger" onClick={onDeleteOrg}>
                    {organization.isPersonal ? 'Удалить личное пространство' : 'Удалить организацию'}
                  </Button>
                </div>
              )}
            </section>
          </div>
          {(deleteError || error) && <p className={styles.error}>{deleteError || error}</p>}
        </div>
      </div>
    </AppLayout>
  )
}
