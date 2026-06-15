import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AppLayout } from 'shared/ui'
import { userModel } from 'entities/user'
import { Bell, ChevronLeft, Palette, User } from 'lucide-react'
import styles from './ProfileSettingsLayout.module.css'

const NAV = [
  { to: '/profile', label: 'Аккаунт', shortLabel: 'Аккаунт', icon: User, end: true },
  { to: '/profile/appearance', label: 'Оформление', shortLabel: 'Стиль', icon: Palette },
  { to: '/profile/notifications', label: 'Уведомления', shortLabel: 'Push', icon: Bell },
] as const

type Props = {
  children: ReactNode
}

export function ProfileSettingsLayout({ children }: Props) {
  const location = useLocation()
  const currentUser = userModel.selectors.useUser()

  const fullName = currentUser
    ? `${currentUser.firstname} ${currentUser.lastname}`.trim()
    : ''
  const initials =
    `${currentUser?.firstname?.[0] ?? ''}${currentUser?.lastname?.[0] ?? ''}`.toUpperCase() || '?'

  const isSubPage = location.pathname !== '/profile'
  const activeNav = NAV.find((item) =>
    'end' in item && item.end
      ? location.pathname === '/profile'
      : location.pathname.startsWith(item.to),
  )

  return (
    <AppLayout>
      <div className={styles.page}>
        <header className={styles.header}>
          <nav className={styles.topBar} aria-label="Навигация">
            {isSubPage ? (
              <Link to="/profile" className={styles.backLink}>
                <ChevronLeft size={18} strokeWidth={2} aria-hidden />
                <span>Профиль</span>
              </Link>
            ) : (
              <Link to="/" className={styles.backLink}>
                <ChevronLeft size={18} strokeWidth={2} aria-hidden />
                <span>Главная</span>
              </Link>
            )}
          </nav>

          <div className={styles.hero}>
            <div className={styles.avatar} aria-hidden>
              {initials}
            </div>
            <div className={styles.heroText}>
              <h1 className={styles.title}>{fullName || 'Профиль'}</h1>
              {currentUser?.email ? (
                <p className={styles.email}>{currentUser.email}</p>
              ) : null}
            </div>
          </div>

          <nav className={styles.tabs} aria-label="Разделы профиля">
            {NAV.map(({ to, label, shortLabel, icon: Icon, ...rest }) => {
              const end = 'end' in rest && rest.end
              const active = end
                ? location.pathname === '/profile'
                : location.pathname.startsWith(to)
              return (
                <Link
                  key={to}
                  to={to}
                  className={`${styles.tab} ${active ? styles.tabActive : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={17} strokeWidth={1.75} aria-hidden />
                  <span className={styles.tabLabelDesktop}>{label}</span>
                  <span className={styles.tabLabelMobile}>{shortLabel}</span>
                </Link>
              )
            })}
          </nav>

          {isSubPage && activeNav ? (
            <p className={styles.sectionHint}>{activeNav.label}</p>
          ) : null}
        </header>

        <div className={styles.body}>{children}</div>
      </div>
    </AppLayout>
  )
}
