import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import styles from './PageHeader.module.css'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export type PageTab = {
  id: string
  label: string
  count?: number
}

export type PageHeaderProps = {
  title: string
  titleNode?: ReactNode
  breadcrumb?: BreadcrumbItem[]
  description?: string
  actions?: ReactNode
  tabs?: PageTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  borderless?: boolean
}

export function PageHeader({
  title,
  titleNode,
  breadcrumb,
  description,
  actions,
  tabs,
  activeTab,
  onTabChange,
  borderless = false,
}: PageHeaderProps) {
  return (
    <div className={`${styles.pageHeader} ${borderless ? styles.borderless : ''}`}>
      <div className={styles.topRow}>
        <div className={styles.titleBlock}>
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className={styles.breadcrumb} aria-label="Навигация">
              {breadcrumb.map((item, i) => (
                <span key={i} className={styles.breadcrumbItem}>
                  {item.href ? (
                    <a href={item.href} className={styles.breadcrumbLink}>{item.label}</a>
                  ) : (
                    <span className={styles.breadcrumbLabel}>{item.label}</span>
                  )}
                  {i < breadcrumb.length - 1 && (
                    <ChevronRight size={12} strokeWidth={2} className={styles.breadcrumbSep} aria-hidden />
                  )}
                </span>
              ))}
            </nav>
          )}
          {titleNode ?? <h1 className={styles.title}>{title}</h1>}
          {description && (
            <p className={styles.description}>{description}</p>
          )}
        </div>

        {actions && (
          <div className={styles.actions}>{actions}</div>
        )}
      </div>

      {tabs && tabs.length > 0 && (
        <div className={styles.tabs} role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`${styles.tabCount} ${activeTab === tab.id ? styles.tabCountActive : ''}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
