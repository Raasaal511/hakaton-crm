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
  Bot,
  Briefcase,
  Building2,
  ChevronDown,
  CircleDollarSign,
  FolderKanban,
  LayoutDashboard,
  LogOut, Package,
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

const SZ = 15
const SW = 1.6

export type SidebarProps = {
  id?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  isMobileLayout?: boolean
  mobileDrawerOpen?: boolean
  onCloseMobileDrawer?: () => void
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
  const [orgOpen, setOrgOpen] = useState(false)
  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const orgRef = useRef<HTMLDivElement>(null)

  const currentUser = userModel.selectors.useUser()
  const organizations = organizationModel.selectors.useOrganizations()
  const currentOrg = organizationModel.selectors.useCurrentOrganization()
  const orgMembers = organizationModel.selectors.useOrganizationMembers()
  const { canManage } = useCanManage(orgMembers, currentUser?.id)
  const canViewOrgAnalytics =
    currentOrg != null &&
    canViewOrganizationFullAnalytics(currentOrg.isPersonal, canManage, currentUser?.systemRole)

  const navCollapsed = collapsed && !isMobileLayout
  const drawerOpen = isMobileLayout && mobileDrawerOpen

  const handleLogout = () => {
    localStorage.removeItem('token')
    clearFavoritePipelines()
    queryClient.clear()
    clearUser()
    navigate('/auth')
  }

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setOrgOpen(false)
    }
    if (orgOpen) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [orgOpen])

  const active = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const settle = () => { setOrgOpen(false); onCloseMobileDrawer?.() }

  return (
    <aside
      id={id}
      className={cn(
        styles.sidebar,
        navCollapsed && styles.collapsed,
        isMobileLayout && styles.mobile,
        drawerOpen && styles.mobileOpen,
      )}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div className={styles.logo}>
        <Link to="/dashboard" className={styles.logoLink} onClick={settle} title="Meridian">
          <div className={styles.logoMark}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="url(#sg)" strokeWidth="1.5"/>
              <path d="M5 9h2.5L9 6l1.5 6L12 9h1" stroke="url(#sg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="18" y2="18" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8"/>
                  <stop offset="1" stopColor="#a78bfa"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.logoText}>Meridian</span>
        </Link>

        {isMobileLayout ? (
          <button type="button" className={styles.closeBtn} onClick={onCloseMobileDrawer} aria-label="Закрыть">
            <X size={16} strokeWidth={2} />
          </button>
        ) : (
          <button type="button" className={styles.collapseBtn} onClick={onToggleCollapsed} aria-label={collapsed ? 'Развернуть' : 'Свернуть'}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {collapsed
                ? <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              }
            </svg>
          </button>
        )}
      </div>

      {/* ── Org switcher ─────────────────────────────────── */}
      <div className={styles.orgWrap} ref={orgRef}>
        <button
          type="button"
          className={cn(styles.orgBtn, orgOpen && styles.orgBtnOpen)}
          onClick={() => setOrgOpen(v => !v)}
          title={navCollapsed ? currentOrg?.name : undefined}
        >
          <span className={styles.orgDot}>{currentOrg?.name?.[0]?.toUpperCase() ?? '?'}</span>
          <span className={styles.orgName}>{currentOrg?.name ?? 'Выберите...'}</span>
          <ChevronDown size={12} strokeWidth={2} className={cn(styles.orgArrow, orgOpen && styles.orgArrowOpen)} />
        </button>

        {orgOpen && (
          <div className={cn(styles.orgMenu, navCollapsed && styles.orgMenuFlyout)}>
            <p className={styles.orgMenuLabel}>Пространства</p>
            {organizations.map(org => (
              <Link
                key={org.id}
                to={`/organizations/${org.id}`}
                className={cn(styles.orgItem, currentOrg?.id === org.id && styles.orgItemActive)}
                onClick={() => { setOrgOpen(false); settle() }}
              >
                <span className={styles.orgDot}>{org.name[0]?.toUpperCase()}</span>
                <span>{org.name}</span>
              </Link>
            ))}
            <div className={styles.orgDivider} />
            <button
              type="button"
              className={styles.orgCreate}
              onClick={() => { setOrgOpen(false); setCreateOrgOpen(true) }}
            >
              <Plus size={13} strokeWidth={2} />
              Создать
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={createOrgOpen} onClose={() => setCreateOrgOpen(false)} title="Создать организацию">
        <CreateOrganizationForm onSuccess={() => setCreateOrgOpen(false)} />
      </Modal>

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.scroll}>

          <N to="/dashboard"   icon={LayoutDashboard} label="Дашборд"   active={active('/dashboard')}   c={navCollapsed} onClick={settle} />

          <div className={styles.section}>
            <span className={styles.sectionLabel}>CRM</span>
          </div>
          <N to="/crm/contacts" icon={Users}     label="Контакты" active={active('/crm/contacts')} c={navCollapsed} onClick={settle} />
          <N to="/crm/companies" icon={Building2} label="Компании" active={active('/crm/companies')} c={navCollapsed} onClick={settle} />
          <N to="/crm/leads"    icon={Target}    label="Лиды"     active={active('/crm/leads')}    c={navCollapsed} onClick={settle} />

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Задачи</span>
          </div>
          {currentOrg && (
            <N to={`/organizations/${currentOrg.id}`} icon={Zap} label="Воронки" active={location.pathname === `/organizations/${currentOrg.id}`} c={navCollapsed} onClick={settle} />
          )}
          <N to="/favorite-pipelines" icon={TrendingUp} label="Избранные" active={active('/favorite-pipelines')} c={navCollapsed} onClick={settle} />

          <div className={styles.section}>
            <span className={styles.sectionLabel}>Каталог</span>
          </div>
          <N to="/catalog/products" icon={Package}   label="Товары"  active={active('/catalog/products')} c={navCollapsed} onClick={settle} />
          <N to="/catalog/services" icon={Briefcase} label="Услуги"  active={active('/catalog/services')} c={navCollapsed} onClick={settle} />

          <div className={styles.divider} />

          <N to="/finance"  icon={CircleDollarSign} label="Финансы"  active={active('/finance')}  c={navCollapsed} onClick={settle} />
          <N to="/ai"       icon={Bot}              label="AI"       active={active('/ai')}       c={navCollapsed} onClick={settle} badge="AI" />
          <N to="/reports"  icon={BarChart3}        label="Отчёты"   active={active('/reports')}  c={navCollapsed} onClick={settle} />

          {canManage && currentOrg && (
            <>
              <div className={styles.divider} />
              {!currentOrg.isPersonal && (
                <N to={`/organizations/${currentOrg.id}/users`}    icon={Users}    label="Участники" active={active(`/organizations/${currentOrg.id}/users`)}    c={navCollapsed} onClick={settle} />
              )}
              {canManage && (
                <N to={`/organizations/${currentOrg.id}/settings`}  icon={Settings}  label="Настройки" active={active(`/organizations/${currentOrg.id}/settings`)}  c={navCollapsed} onClick={settle} />
              )}
            </>
          )}

          {currentUser?.systemRole === 'root' && (
            <N to="/admin" icon={Shield} label="Админ" active={active('/admin')} c={navCollapsed} onClick={settle} variant="admin" />
          )}
        </div>

        {/* ── Footer: logout only ───────────────────────── */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut size={14} strokeWidth={1.75} />
            <span className={styles.logoutLabel}>Выйти</span>
          </button>
        </div>
      </nav>
    </aside>
  )
}

/* ── NavItem ─────────────────────────────────────────────── */
type NProps = {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  active: boolean
  c: boolean
  onClick?: () => void
  badge?: string
  variant?: 'admin'
}

function N({ to, icon: Icon, label, active, c, onClick, badge, variant }: NProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      title={c ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        styles.item,
        active && styles.itemActive,
        variant === 'admin' && styles.itemAdmin,
      )}
    >
      <Icon size={SZ} strokeWidth={SW} />
      <span className={styles.itemLabel}>{label}</span>
      {badge && !c && <span className={styles.badge}>{badge}</span>}
    </Link>
  )
}
