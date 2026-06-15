import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { AppLayout, Button, HomeEntrySkeleton, Modal } from 'shared/ui'
import { userModel } from 'entities/user'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { setOrganizations } from 'shared/api/events/organization'
import { CreateOrganizationForm } from 'features/organization/create'
import { resolveHomePath } from 'shared/lib/resolveHomePath'
import { hasAuthToken } from 'shared/lib'
import { Building2 } from 'lucide-react'
import styles from './HomeEntryPage.module.css'

export function HomeEntryPage() {
  const navigate = useNavigate()
  const currentUser = userModel.selectors.useUser()
  const [phase, setPhase] = useState<'loading' | 'empty'>('loading')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!currentUser) return

    let cancelled = false
    ;(async () => {
      const orgs = await organizationsAPI.getAll().catch(() => [])
      if (cancelled) return
      setOrganizations(orgs)
      const path = resolveHomePath(orgs, currentUser.id)
      if (path) {
        navigate(path, { replace: true })
        return
      }
      setPhase('empty')
    })()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id, navigate])

  if (!currentUser) {
    if (!hasAuthToken()) {
      return <Navigate to="/auth" replace />
    }
    return (
      <AppLayout>
        <HomeEntrySkeleton />
      </AppLayout>
    )
  }

  if (phase === 'loading') {
    return (
      <AppLayout>
        <HomeEntrySkeleton />
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.iconWrap} aria-hidden>
            <Building2 size={26} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className={styles.title}>Добро пожаловать</h1>
            <p className={styles.text}>
              У вас пока нет доступных организаций. Создайте командное пространство для совместной работы.
            </p>
          </div>
          <Button variant="primary" type="button" onClick={() => setCreateOpen(true)}>
            Создать организацию
          </Button>
        </div>
      </div>
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Создать организацию">
        <CreateOrganizationForm onSuccess={() => setCreateOpen(false)} />
      </Modal>
    </AppLayout>
  )
}
