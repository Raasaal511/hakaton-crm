import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from 'shared/ui'
import { userModel } from 'entities/user'
import { adminAPI, type AdminStats } from 'shared/api/requests/admin'
import styles from './AdminPage.module.css'

export function AdminPage() {
  const navigate = useNavigate()
  const currentUser = userModel.selectors.useUser()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [organizations, setOrganizations] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (currentUser?.systemRole !== 'root') {
      navigate('/')
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const [statsData, orgsData] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getAllOrganizations(),
        ])
        setStats(statsData)
        setOrganizations(orgsData)
      } catch (e) {
        setError('Не удалось загрузить данные')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentUser?.systemRole, currentUser?.id, navigate])

  if (currentUser?.systemRole !== 'root') {
    return null
  }

  if (loading) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.loading}>Загрузка...</div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.error}>{error}</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Админ-панель</h1>
          <p className={styles.subtitle}>Статистика приложения</p>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Статистика</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats?.organizations ?? 0}</div>
                <div className={styles.statLabel}>Организаций</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats?.users ?? 0}</div>
                <div className={styles.statLabel}>Пользователей</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats?.tasks ?? 0}</div>
                <div className={styles.statLabel}>Задач</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{stats?.departments ?? 0}</div>
                <div className={styles.statLabel}>Разделов</div>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Все организации</h2>
            <div className={styles.orgList}>
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className={styles.orgCard}
                  onClick={() => navigate(`/organizations/${org.id}`)}
                >
                  <div className={styles.orgIcon}>{org.name[0]?.toUpperCase()}</div>
                  <span className={styles.orgName}>{org.name}</span>
                </div>
              ))}
              {organizations.length === 0 && (
                <div className={styles.empty}>Нет организаций</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
