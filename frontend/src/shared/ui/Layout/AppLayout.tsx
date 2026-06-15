import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useUnit } from 'effector-react'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { setFavoritePipelinesForOrg } from 'entities/pipeline/model/favorites'
import { userModel } from 'entities/user'
import { organizationModel } from 'entities/organization'
import { departmentModel } from 'entities/department'
import { setMembers, setOrganizations } from 'shared/api/events/organization'
import { setDepartments } from 'shared/api/events/department'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { departmentsAPI } from 'shared/api/requests/departments'
import { pipelinesAPI } from 'shared/api/requests/pipelines'
import { qk } from 'shared/api/queryKeys'
import { mediaMaxMobileQuery, useMediaQuery } from 'shared/lib'
import { Menu } from 'lucide-react'
import styles from './AppLayout.module.css'

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed'

function readSidebarCollapsed(): boolean {
  try {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

type AppLayoutProps = {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const isMobileLayout = useMediaQuery(mediaMaxMobileQuery)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const currentUser = userModel.selectors.useUser()
  const organizations = useUnit(organizationModel.$organizationsStore)
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const departments = departmentModel.selectors.useDepartments()

  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isMobileLayout) setMobileDrawerOpen(false)
  }, [isMobileLayout])

  useEffect(() => {
    if (!isMobileLayout || !mobileDrawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isMobileLayout, mobileDrawerOpen])

  useEffect(() => {
    if (!isMobileLayout || !mobileDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMobileLayout, mobileDrawerOpen])

  useEffect(() => {
    if (!currentUser) return
    if (organizations.length > 0) return
    organizationsAPI.getAll().then(setOrganizations).catch(() => setOrganizations([]))
  }, [currentUser?.id, organizations.length])

  useEffect(() => {
    if (!currentUser) return
    const orgId = currentOrganization?.id
    if (!orgId) return

    if (orgMembers.length === 0) {
      organizationsAPI.getMembers(orgId).then(setMembers).catch(() => setMembers([]))
    }
    if (departments.length === 0) {
      departmentsAPI.getAll(orgId).then(setDepartments).catch(() => setDepartments([]))
    }
  }, [currentUser?.id, currentOrganization?.id, orgMembers.length, departments.length])

  const favoritesQuery = useQuery({
    queryKey: currentOrganization?.id != null ? qk.favoritePipelines(currentOrganization.id) : ['favorite-pipelines', null],
    queryFn: ({ signal }) => pipelinesAPI.listFavoritePipelines(currentOrganization!.id, { signal }),
    enabled: Boolean(currentOrganization?.id && currentUser?.id),
    staleTime: 5 * 60_000,
  })

  /**
   * Зеркалим избранное в effector-стор: его читают сайдбар/страницы без useQuery.
   * Когда мигрируем эти места на TanStack Query — стор и этот эффект уберём.
   */
  useEffect(() => {
    if (!currentOrganization?.id) return
    const items = favoritesQuery.data
    if (!items) return
    setFavoritePipelinesForOrg({ organizationId: currentOrganization.id, items })
  }, [currentOrganization?.id, favoritesQuery.data])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  const layoutStyle = {
    '--sidebar-width': isMobileLayout ? '0px' : sidebarCollapsed ? '72px' : '280px',
  } as CSSProperties

  return (
    <div className={styles.layout} style={layoutStyle}>
      <div className={styles.mobileTopBar}>
        {currentUser ? (
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setMobileDrawerOpen(true)}
            aria-expanded={mobileDrawerOpen}
            aria-controls="app-sidebar-nav"
            aria-label="Открыть меню"
          >
            <Menu size={22} strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <span className={styles.mobileTopBarPlaceholder} />
        )}
        <span className={styles.mobileTopTitle}>PulsarCRM</span>
        <span className={styles.mobileTopBarPlaceholder} aria-hidden />
      </div>

      {isMobileLayout && mobileDrawerOpen && (
        <button
          type="button"
          className={styles.mobileBackdrop}
          aria-label="Закрыть меню"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      <Sidebar
        id="app-sidebar-nav"
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        isMobileLayout={isMobileLayout}
        mobileDrawerOpen={mobileDrawerOpen}
        onCloseMobileDrawer={() => setMobileDrawerOpen(false)}
      />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
