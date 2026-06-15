import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Bell, Plus, Search, ChevronDown, LogOut, User, Settings, Moon, Sun, Monitor } from 'lucide-react'
import { userModel } from 'entities/user'
import { organizationModel } from 'entities/organization'
import { clearUser } from 'shared/api/events/auth'
import { clearFavoritePipelines } from 'entities/pipeline/model/favorites'
import { queryClient } from 'shared/api/queryClient'
import { useTheme } from 'shared/lib/useTheme'
import styles from './TopBar.module.css'

const SECTION_LABELS: Record<string, string> = {
  '/dashboard':    'Дашборд',
  '/crm':         'CRM',
  '/sales':       'Продажи',
  '/catalog':     'Каталог',
  '/finance':     'Финансы',
  '/projects':    'Проекты',
  '/ai':          'Meridian AI',
  '/reports':     'Отчеты',
  '/organizations': 'Организация',
  '/admin':       'Администрирование',
  '/profile':     'Профиль',
}

function getBreadcrumb(pathname: string): string {
  const match = Object.keys(SECTION_LABELS)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname === k || pathname.startsWith(k + '/'))
  return match ? SECTION_LABELS[match] : ''
}

type TopBarProps = {
  onSearchOpen?: () => void
}

export function TopBar({ onSearchOpen }: TopBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const currentUser = userModel.selectors.useUser()
  const currentOrg = organizationModel.selectors.useCurrentOrganization()
  const { preference, setPreference } = useTheme()

  const section = getBreadcrumb(location.pathname)
  const initials = currentUser
    ? `${currentUser.firstname?.[0] ?? ''}${currentUser.lastname?.[0] ?? ''}`.toUpperCase()
    : '?'
  const fullName = currentUser
    ? `${currentUser.firstname} ${currentUser.lastname ?? ''}`.trim()
    : ''

  const handleLogout = () => {
    setUserMenuOpen(false)
    localStorage.removeItem('token')
    clearFavoritePipelines()
    queryClient.clear()
    clearUser()
    navigate('/auth')
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  const themeOptions = [
    { id: 'light' as const, label: 'Светлая', icon: Sun },
    { id: 'dark' as const, label: 'Тёмная', icon: Moon },
    { id: 'system' as const, label: 'Системная', icon: Monitor },
  ]

  return (
    <header className={styles.topBar}>
      <div className={styles.left}>
        {section && <span className={styles.sectionLabel}>{section}</span>}
      </div>

      <div className={styles.center}>
        <button
          type="button"
          className={styles.searchTrigger}
          onClick={onSearchOpen}
          aria-label="Поиск (Cmd+K)"
        >
          <Search size={14} strokeWidth={2} className={styles.searchIcon} />
          <span className={styles.searchPlaceholder}>Поиск...</span>
          <kbd className={styles.searchKbd}>⌘K</kbd>
        </button>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.notifBtn}
          aria-label="Уведомления"
          title="Уведомления"
        >
          <Bell size={16} strokeWidth={1.75} />
          <span className={styles.notifDot} aria-hidden />
        </button>

        <div className={styles.userMenu} ref={userMenuRef}>
          <button
            type="button"
            className={styles.userTrigger}
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <span className={styles.userAvatar} aria-hidden>{initials}</span>
            <span className={styles.userName}>{fullName}</span>
            <ChevronDown size={14} strokeWidth={2} className={`${styles.userChevron} ${userMenuOpen ? styles.userChevronOpen : ''}`} aria-hidden />
          </button>

          {userMenuOpen && (
            <div className={styles.userDropdown} role="menu">
              <div className={styles.userDropdownHeader}>
                <span className={styles.userDropdownName}>{fullName}</span>
                {currentOrg && (
                  <span className={styles.userDropdownOrg}>{currentOrg.name}</span>
                )}
              </div>

              <div className={styles.userDropdownDivider} />

              <Link
                to="/profile"
                className={styles.userDropdownItem}
                onClick={() => setUserMenuOpen(false)}
                role="menuitem"
              >
                <User size={15} strokeWidth={1.75} />
                Профиль
              </Link>
              <Link
                to={currentOrg ? `/organizations/${currentOrg.id}/settings` : '/profile'}
                className={styles.userDropdownItem}
                onClick={() => setUserMenuOpen(false)}
                role="menuitem"
              >
                <Settings size={15} strokeWidth={1.75} />
                Настройки
              </Link>

              <div className={styles.userDropdownDivider} />

              <div className={styles.themeSection}>
                <span className={styles.themeSectionLabel}>Тема</span>
                <div className={styles.themeOptions}>
                  {themeOptions.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.themeOption} ${preference === id ? styles.themeOptionActive : ''}`}
                      onClick={() => setPreference(id)}
                      title={label}
                    >
                      <Icon size={14} strokeWidth={2} />
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.userDropdownDivider} />

              <button
                type="button"
                className={`${styles.userDropdownItem} ${styles.userDropdownItemDanger}`}
                onClick={handleLogout}
                role="menuitem"
              >
                <LogOut size={15} strokeWidth={1.75} />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
