import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  clearFavoritePipelines,
} from 'entities/pipeline/model/favorites'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { clearUser } from 'shared/api/events/auth'
import { cn, useCanManage, canViewOrganizationFullAnalytics } from 'shared/lib'
import { queryClient } from 'shared/api/queryClient'
import { Modal, ThemeToggle } from 'shared/ui'
import { CreateOrganizationForm } from 'features/organization/create'
import {
  BarChart3,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Package,
  Plus,
  Settings,
  Shield,
  Star,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react'
import styles from './Sidebar.module.css'

const iconProps = { size: 16, strokeWidth: 2 } as const

export type SidebarProps = {
  id?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  isMobileLayout?: boolean
  mobileDrawerOpen?: boolean
  onCloseMobileDrawer?: () => void
}

function NavSection({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <>{children}</>
  return (
    <div className={styles.navSection}>
      <div className={styles.navSectionLabel}>{label}</div>
      {children}
    </div>
  )
}

export function Sidebar({
  id,
  collapsed,
  onToggleCollapsed,
  isMobileLayout = false,
  mobileDrawerOpen = false,
  onCloseMobileDrawer,
}: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false)
  const orgDropdownRef = useRef<HTMLDivElement>(null)

  const currentUser = userModel.selectors.useUser()
  const organizations = organizationModel.selectors.useOrganizations()
  const currentOrganization = organizationModel.selectors.useCurrentOrganization()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const { canManage } = useCanManage(orgMembers, currentUser?.id)
  const canViewOrgAnalytics =
    currentOrganization != null &&
    canViewOrganizationFullAnalytics(
      currentOrganization.isPersonal,
      canManage,
      currentUser?.systemRole,
    )

  const handleLogout = () => {
    localStorage.removeItem('token')
    clearFavoritePipelines()
    queryClient.clear()
    clearUser()
    navigate('/auth')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false)
      }
    }
    if (orgDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [orgDropdownOpen])

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')
  const isProfileRoute = location.pathname === '/profile' || location.pathname.startsWith('/profile/')

  const orgTitle = currentOrganization?.name || 'Выберите в списке…'
  const profileTitle =
    currentUser ? `${currentUser.firstname} ${currentUser.lastname} — профиль` : undefined

  const drawerOpen = isMobileLayout && mobileDrawerOpen
  const navCollapsed = collapsed && !isMobileLayout

  const settleMobileNav = () => {
    setOrgDropdownOpen(false)
    onCloseMobileDrawer?.()
  }

  return (
    <aside
      id={id}
      className={cn(
        styles.sidebar,
        navCollapsed && styles.sidebarCollapsed,
        isMobileLayout && styles.sidebarMobile,
        drawerOpen && styles.sidebarMobileOpen,
      )}
    >
      <div className={styles.header}>
        <div className={styles.headerTopRow}>
          <Link
            to="/dashboard"
            className={styles.logo}
            title={navCollapsed ? 'PulsarCRM — на главную' : undefined}
            onClick={() => settleMobileNav()}
          >
            <img src="/logo.png" alt="PulsarCRM" className={styles.logoImage} />
            <span className={styles.logoText}>PulsarCRM</span>
          </Link>
          {isMobileLayout ? (
            <button
              type="button"
              className={styles.mobileDrawerClose}
              onClick={onCloseMobileDrawer}
              aria-label="Закрыть меню"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>

        <div className={styles.orgBlock}>
          <div className={styles.orgSelector} ref={orgDropdownRef}>
            <button
              type="button"
              className={cn(styles.orgTrigger, orgDropdownOpen && styles.orgTriggerOpen)}
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              aria-haspopup="listbox"
              aria-expanded={orgDropdownOpen}
              title={navCollapsed ? `Организация: ${orgTitle}` : undefined}
              aria-label={navCollapsed ? `Выбор организации. Сейчас: ${orgTitle}` : undefined}
            >
              <div className={styles.orgAvatar}>
                {currentOrganization?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <span className={styles.orgLabel} aria-hidden={navCollapsed || undefined}>
                {currentOrganization?.name || 'Выберите в списке…'}
              </span>
              <ChevronDown
                className={`${styles.orgChevron} ${orgDropdownOpen ? styles.orgChevronOpen : ''}`}
                size={14}
                strokeWidth={2}
                aria-hidden
              />
            </button>

            {orgDropdownOpen && (
              <div
                className={cn(styles.orgDropdown, navCollapsed && styles.orgDropdownFlyout)}
                aria-label="Пространства и организации"
              >
                <div className={styles.orgDropdownHeader}>Пространства</div>
                {organizations.map((org) => (
                  <Link
                    key={org.id}
                    to={`/organizations/${org.id}`}
                    className={`${styles.orgOption} ${
                      currentOrganization?.id === org.id ? styles.orgOptionActive : ''
                    }`}
                    onClick={() => settleMobileNav()}
                  >
                    <div className={styles.orgOptionIcon}>{org.name[0]?.toUpperCase()}</div>
                    <span>{org.name}</span>
                  </Link>
                ))}
                <div className={styles.orgDropdownDivider} />
                <button
                  type="button"
                  className={styles.orgOptionCreate}
                  onClick={() => {
                    setOrgDropdownOpen(false)
                    setCreateOrgModalOpen(true)
                  }}
                >
                  <Plus className={styles.orgOptionCreateIcon} size={16} strokeWidth={2} aria-hidden />
                  Создать организацию
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={createOrgModalOpen}
        onClose={() => setCreateOrgModalOpen(false)}
        title="Создать организацию"
      >
        <CreateOrganizationForm
          onSuccess={() => setCreateOrgModalOpen(false)}
        />
      </Modal>

      <nav className={styles.nav}>
        {currentUser && (
          <div className={styles.accountSection}>
            <Link
              to="/profile"
              className={`${styles.profileCard} ${isActive('/profile') ? styles.profileCardActive : ''}`}
              title={navCollapsed ? profileTitle : undefined}
              onClick={() => settleMobileNav()}
            >
              <div className={styles.profileAvatar}>
                {currentUser.firstname?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={styles.profileCardBody}>
                <span className={styles.profileCardName}>
                  {currentUser.firstname} {currentUser.lastname}
                </span>
                <span className={styles.profileCardEmail}>{currentUser.email}</span>
              </div>
              <ChevronRight className={styles.profileCardChevron} size={16} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        )}

        <div className={styles.navScroll}>
          <div className={styles.pagesSection}>

            {/* Dashboard */}
            <Link
              to="/dashboard"
              className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`}
              title={navCollapsed ? 'Дашборд' : undefined}
              onClick={() => settleMobileNav()}
            >
              <LayoutDashboard className={styles.navIcon} {...iconProps} aria-hidden />
              <span className={styles.navText}>Дашборд</span>
            </Link>

            {/* CRM Section */}
            <NavSection label="CRM" collapsed={navCollapsed}>
              <Link
                to="/crm/contacts"
                className={`${styles.navItem} ${isActive('/crm/contacts') ? styles.active : ''}`}
                title={navCollapsed ? 'Контакты' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Users className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Контакты</span>
              </Link>
              <Link
                to="/crm/companies"
                className={`${styles.navItem} ${isActive('/crm/companies') ? styles.active : ''}`}
                title={navCollapsed ? 'Компании' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Building2 className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Компании</span>
              </Link>
              <Link
                to="/crm/leads"
                className={`${styles.navItem} ${isActive('/crm/leads') ? styles.active : ''}`}
                title={navCollapsed ? 'Лиды' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Target className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Лиды</span>
              </Link>
            </NavSection>

            {/* Sales / Dept pipelines */}
            <NavSection label="Продажи" collapsed={navCollapsed}>
              {currentOrganization && (
                <Link
                  to={`/organizations/${currentOrganization.id}`}
                  className={`${styles.navItem} ${location.pathname === `/organizations/${currentOrganization.id}` ? styles.active : ''}`}
                  title={navCollapsed ? 'Воронки продаж' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <Zap className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Воронки продаж</span>
                </Link>
              )}
              {currentUser && (
                <Link
                  to="/favorite-pipelines"
                  className={`${styles.navItem} ${location.pathname === '/favorite-pipelines' ? styles.active : ''}`}
                  title={navCollapsed ? 'Избранные воронки' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <Star className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Избранные</span>
                </Link>
              )}
            </NavSection>

            {/* Catalog */}
            <NavSection label="Каталог" collapsed={navCollapsed}>
              <Link
                to="/catalog/products"
                className={`${styles.navItem} ${isActive('/catalog/products') ? styles.active : ''}`}
                title={navCollapsed ? 'Товары' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Package className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Товары</span>
              </Link>
              <Link
                to="/catalog/services"
                className={`${styles.navItem} ${isActive('/catalog/services') ? styles.active : ''}`}
                title={navCollapsed ? 'Услуги' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Briefcase className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Услуги</span>
              </Link>
            </NavSection>

            {/* Tasks (secondary) */}
            <NavSection label="Задачи" collapsed={navCollapsed}>
              {currentOrganization && (
                <Link
                  to={`/organizations/${currentOrganization.id}/my-tasks`}
                  className={`${styles.navItem} ${isActive(`/organizations/${currentOrganization.id}/my-tasks`) ? styles.active : ''}`}
                  title={navCollapsed ? 'Мои задачи' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <ListChecks className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>
                    {currentOrganization.isPersonal ? 'Мои задачи' : 'Задачи в орг.'}
                  </span>
                </Link>
              )}
              {currentUser && (
                <Link
                  to="/my-tasks"
                  className={`${styles.navItem} ${location.pathname === '/my-tasks' ? styles.active : ''}`}
                  title={navCollapsed ? 'Все задачи' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <ClipboardList className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Все задачи</span>
                </Link>
              )}
            </NavSection>

            {/* Organization */}
            <NavSection label="Организация" collapsed={navCollapsed}>
              {currentOrganization && canManage && !currentOrganization.isPersonal && (
                <Link
                  to={`/organizations/${currentOrganization.id}/users`}
                  className={`${styles.navItem} ${isActive(`/organizations/${currentOrganization.id}/users`) ? styles.active : ''}`}
                  title={navCollapsed ? 'Участники' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <Users className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Участники</span>
                </Link>
              )}
              {currentOrganization && canViewOrgAnalytics && (
                <Link
                  to={`/organizations/${currentOrganization.id}/analytics`}
                  className={`${styles.navItem} ${isActive(`/organizations/${currentOrganization.id}/analytics`) ? styles.active : ''}`}
                  title={navCollapsed ? 'Аналитика' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <BarChart3 className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Аналитика</span>
                </Link>
              )}
              {currentOrganization && canManage && (
                <Link
                  to={`/organizations/${currentOrganization.id}/settings`}
                  className={`${styles.navItem} ${isActive(`/organizations/${currentOrganization.id}/settings`) ? styles.active : ''}`}
                  title={navCollapsed ? 'Настройки' : undefined}
                  onClick={() => settleMobileNav()}
                >
                  <Settings className={styles.navIcon} {...iconProps} aria-hidden />
                  <span className={styles.navText}>Настройки</span>
                </Link>
              )}
            </NavSection>

            {currentUser?.systemRole === 'root' && (
              <Link
                to="/admin"
                className={`${styles.navItem} ${styles.navItemAdmin} ${isActive('/admin') ? styles.active : ''}`}
                title={navCollapsed ? 'Админ-панель' : undefined}
                onClick={() => settleMobileNav()}
              >
                <Shield className={styles.navIcon} {...iconProps} aria-hidden />
                <span className={styles.navText}>Админ-панель</span>
              </Link>
            )}
          </div>
        </div>

        <div className={styles.bottomSection}>
          {!isProfileRoute ? (
            <ThemeToggle compact className={styles.themeToggle} />
          ) : null}
          {!isMobileLayout && (
            <button
              type="button"
              className={styles.collapseToggle}
              onClick={onToggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
              title={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
            >
              {collapsed ? (
                <ChevronsRight size={18} strokeWidth={2} aria-hidden />
              ) : (
                <ChevronsLeft size={18} strokeWidth={2} aria-hidden />
              )}
            </button>
          )}
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title={navCollapsed ? 'Выйти' : undefined}
          >
            <LogOut className={styles.navIcon} {...iconProps} aria-hidden />
            <span className={styles.navText}>Выйти</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}
