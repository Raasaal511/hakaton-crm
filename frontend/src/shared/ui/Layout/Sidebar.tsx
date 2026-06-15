import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { clearFavoritePipelines } from 'entities/pipeline/model/favorites'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import { clearUser } from 'shared/api/events/auth'
import { cn, useCanManage, canViewOrganizationFullAnalytics } from 'shared/lib'
import { queryClient } from 'shared/api/queryClient'
import { Modal } from 'shared/ui'
import { CreateOrganizationForm } from 'features/organization/create'
import {
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FolderKanban,
  LayoutDashboard,
  Package,
  Plus,
  Settings,
  Shield,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import styles from './Sidebar.module.css'

const iconSize = 16
const iconStroke = 1.75

export type SidebarProps = {
  id?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  isMobileLayout?: boolean
  mobileDrawerOpen?: boolean
  onCloseMobileDrawer?: () => void
}

type NavItem = {
  label: string
  to?: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  matchPaths?: string[]
  children?: NavItem[]
  dynamic?: boolean
  hidden?: boolean
  adminOnly?: boolean
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    crm: true,
    sales: false,
    catalog: false,
    organization: false,
  })
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
    if (orgDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [orgDropdownOpen])

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const drawerOpen = isMobileLayout && mobileDrawerOpen
  const navCollapsed = collapsed && !isMobileLayout

  const settle = () => {
    setOrgDropdownOpen(false)
    onCloseMobileDrawer?.()
  }

  const toggleSection = (key: string) => {
    if (navCollapsed) return
    setExpandedSections((s) => ({ ...s, [key]: !s[key] }))
  }

  const orgTitle = currentOrganization?.name || 'Выберите…'

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
      {/* ── Brand header ─────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.headerTopRow}>
          <Link
            to="/dashboard"
            className={styles.brand}
            title={navCollapsed ? 'Meridian — на главную' : undefined}
            onClick={settle}
          >
            <div className={styles.brandIcon} aria-hidden>M</div>
            <span className={styles.brandName}>Meridian</span>
          </Link>
          {isMobileLayout && (
            <button
              type="button"
              className={styles.mobileDrawerClose}
              onClick={onCloseMobileDrawer}
              aria-label="Закрыть меню"
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          )}
          {!isMobileLayout && (
            <button
              type="button"
              className={styles.collapseBtn}
              onClick={onToggleCollapsed}
              title={collapsed ? 'Развернуть' : 'Свернуть'}
              aria-label={collapsed ? 'Развернуть панель' : 'Свернуть панель'}
            >
              {collapsed
                ? <ChevronRight size={14} strokeWidth={2} aria-hidden />
                : <ChevronLeft size={14} strokeWidth={2} aria-hidden />
              }
            </button>
          )}
        </div>

        {/* Org switcher */}
        <div className={styles.orgSelector} ref={orgDropdownRef}>
          <button
            type="button"
            className={cn(styles.orgTrigger, orgDropdownOpen && styles.orgTriggerOpen)}
            onClick={() => setOrgDropdownOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={orgDropdownOpen}
            title={navCollapsed ? `Организация: ${orgTitle}` : undefined}
          >
            <div className={styles.orgAvatar} aria-hidden>
              {currentOrganization?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <span className={styles.orgLabel}>
              {currentOrganization?.name || 'Выберите…'}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={2}
              className={cn(styles.orgChevron, orgDropdownOpen && styles.orgChevronOpen)}
              aria-hidden
            />
          </button>

          {orgDropdownOpen && (
            <div
              className={cn(styles.orgDropdown, navCollapsed && styles.orgDropdownFlyout)}
              role="listbox"
              aria-label="Организации"
            >
              <div className={styles.orgDropdownHeader}>Пространства</div>
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  to={`/organizations/${org.id}`}
                  role="option"
                  aria-selected={currentOrganization?.id === org.id}
                  className={cn(styles.orgOption, currentOrganization?.id === org.id && styles.orgOptionActive)}
                  onClick={() => { setOrgDropdownOpen(false); settle() }}
                >
                  <div className={styles.orgOptionIcon} aria-hidden>{org.name[0]?.toUpperCase()}</div>
                  <span>{org.name}</span>
                </Link>
              ))}
              <div className={styles.orgDropdownDivider} />
              <button
                type="button"
                className={styles.orgOptionCreate}
                onClick={() => { setOrgDropdownOpen(false); setCreateOrgModalOpen(true) }}
              >
                <Plus size={14} strokeWidth={2} aria-hidden />
                Создать организацию
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={createOrgModalOpen}
        onClose={() => setCreateOrgModalOpen(false)}
        title="Создать организацию"
      >
        <CreateOrganizationForm onSuccess={() => setCreateOrgModalOpen(false)} />
      </Modal>

      {/* ── Nav ──────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Главная навигация">
        <div className={styles.navScroll}>

          {/* Dashboard */}
          <NavLink
            to="/dashboard"
            icon={LayoutDashboard}
            label="Дашборд"
            active={isActive('/dashboard')}
            collapsed={navCollapsed}
            onClick={settle}
          />

          {/* CRM */}
          <NavGroup
            label="CRM"
            sectionKey="crm"
            expanded={expandedSections.crm}
            collapsed={navCollapsed}
            onToggle={() => toggleSection('crm')}
            active={isActive('/crm')}
          >
            <NavLink
              to="/crm/contacts"
              icon={Users}
              label="Контакты"
              active={isActive('/crm/contacts')}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
            <NavLink
              to="/crm/companies"
              icon={Building2}
              label="Компании"
              active={isActive('/crm/companies')}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
            <NavLink
              to="/crm/leads"
              icon={Target}
              label="Лиды"
              active={isActive('/crm/leads')}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
          </NavGroup>

          {/* Sales */}
          <NavGroup
            label="Продажи"
            sectionKey="sales"
            expanded={expandedSections.sales}
            collapsed={navCollapsed}
            onToggle={() => toggleSection('sales')}
            active={
              !!currentOrganization &&
              location.pathname === `/organizations/${currentOrganization.id}`
            }
          >
            {currentOrganization && (
              <NavLink
                to={`/organizations/${currentOrganization.id}`}
                icon={Zap}
                label="Воронки"
                active={location.pathname === `/organizations/${currentOrganization.id}`}
                collapsed={navCollapsed}
                onClick={settle}
                indent
              />
            )}
            <NavLink
              to="/favorite-pipelines"
              icon={TrendingUp}
              label="Избранные"
              active={location.pathname === '/favorite-pipelines'}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
          </NavGroup>

          {/* Catalog */}
          <NavGroup
            label="Каталог"
            sectionKey="catalog"
            expanded={expandedSections.catalog}
            collapsed={navCollapsed}
            onToggle={() => toggleSection('catalog')}
            active={isActive('/catalog')}
          >
            <NavLink
              to="/catalog/products"
              icon={Package}
              label="Товары"
              active={isActive('/catalog/products')}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
            <NavLink
              to="/catalog/services"
              icon={Briefcase}
              label="Услуги"
              active={isActive('/catalog/services')}
              collapsed={navCollapsed}
              onClick={settle}
              indent
            />
          </NavGroup>

          {/* Finance */}
          <NavLink
            to="/finance"
            icon={CircleDollarSign}
            label="Финансы"
            active={isActive('/finance')}
            collapsed={navCollapsed}
            onClick={settle}
          />

          {/* Projects */}
          <NavLink
            to="/projects"
            icon={FolderKanban}
            label="Проекты"
            active={isActive('/projects')}
            collapsed={navCollapsed}
            onClick={settle}
          />

          {/* AI */}
          <NavLink
            to="/ai"
            icon={Bot}
            label="Meridian AI"
            active={isActive('/ai')}
            collapsed={navCollapsed}
            onClick={settle}
            badge="Beta"
          />

          {/* Reports */}
          <NavLink
            to="/reports"
            icon={BookOpen}
            label="Отчеты"
            active={isActive('/reports')}
            collapsed={navCollapsed}
            onClick={settle}
          />

          <div className={styles.divider} />

          {/* Organization */}
          <NavGroup
            label="Организация"
            sectionKey="organization"
            expanded={expandedSections.organization}
            collapsed={navCollapsed}
            onToggle={() => toggleSection('organization')}
            active={isActive('/organizations') || isActive('/profile')}
          >
            {currentOrganization && canManage && !currentOrganization.isPersonal && (
              <NavLink
                to={`/organizations/${currentOrganization.id}/users`}
                icon={Users}
                label="Участники"
                active={isActive(`/organizations/${currentOrganization.id}/users`)}
                collapsed={navCollapsed}
                onClick={settle}
                indent
              />
            )}
            {currentOrganization && canViewOrgAnalytics && (
              <NavLink
                to={`/organizations/${currentOrganization.id}/analytics`}
                icon={BarChart3}
                label="Аналитика"
                active={isActive(`/organizations/${currentOrganization.id}/analytics`)}
                collapsed={navCollapsed}
                onClick={settle}
                indent
              />
            )}
            {currentOrganization && canManage && (
              <NavLink
                to={`/organizations/${currentOrganization.id}/settings`}
                icon={Settings}
                label="Настройки"
                active={isActive(`/organizations/${currentOrganization.id}/settings`)}
                collapsed={navCollapsed}
                onClick={settle}
                indent
              />
            )}
          </NavGroup>

          {currentUser?.systemRole === 'root' && (
            <NavLink
              to="/admin"
              icon={Shield}
              label="Администрирование"
              active={isActive('/admin')}
              collapsed={navCollapsed}
              onClick={settle}
              variant="admin"
            />
          )}
        </div>

        {/* ── User footer ──────────────────────────── */}
        <div className={styles.userFooter}>
          {currentUser && (
            <Link
              to="/profile"
              className={cn(styles.userCard, isActive('/profile') && styles.userCardActive)}
              onClick={settle}
              title={navCollapsed
                ? `${currentUser.firstname} ${currentUser.lastname ?? ''} — профиль`
                : undefined
              }
            >
              <div className={styles.userAvatar} aria-hidden>
                {currentUser.firstname?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {currentUser.firstname} {currentUser.lastname}
                </span>
                <span className={styles.userEmail}>{currentUser.email}</span>
              </div>
            </Link>
          )}
        </div>
      </nav>
    </aside>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

type NavLinkProps = {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  active: boolean
  collapsed: boolean
  onClick?: () => void
  indent?: boolean
  badge?: string
  variant?: 'default' | 'admin'
}

function NavLink({ to, icon: Icon, label, active, collapsed, onClick, indent, badge, variant }: NavLinkProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        styles.navItem,
        active && styles.navItemActive,
        indent && styles.navItemIndent,
        variant === 'admin' && styles.navItemAdmin,
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={iconSize} strokeWidth={iconStroke} />
      <span className={styles.navItemLabel}>{label}</span>
      {badge && !collapsed && <span className={styles.navBadge}>{badge}</span>}
    </Link>
  )
}

type NavGroupProps = {
  label: string
  sectionKey: string
  expanded: boolean
  collapsed: boolean
  onToggle: () => void
  active?: boolean
  children: React.ReactNode
}

function NavGroup({ label, sectionKey, expanded, collapsed, onToggle, active, children }: NavGroupProps) {
  if (collapsed) {
    return <>{children}</>
  }
  return (
    <div className={styles.navGroup}>
      <button
        type="button"
        className={cn(styles.navGroupTrigger, active && !expanded && styles.navGroupTriggerActive)}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className={styles.navGroupLabel}>{label}</span>
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={cn(styles.navGroupChevron, expanded && styles.navGroupChevronOpen)}
          aria-hidden
        />
      </button>
      {expanded && <div className={styles.navGroupChildren}>{children}</div>}
    </div>
  )
}
