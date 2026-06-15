import type { ReactNode } from 'react'
import { AppLayout } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import styles from './StubPage.module.css'

type StubPageConfig = {
  title: string
  breadcrumb?: string
  description: string
  icon: ReactNode
  features?: string[]
  badge?: string
}

const PAGES: Record<string, StubPageConfig> = {
  finance: {
    title: 'Финансы',
    breadcrumb: 'Финансы',
    description: 'Управление финансами, счетами, бюджетами и платёжными транзакциями',
    icon: '💰',
    badge: 'Скоро',
    features: [
      'Выставление счетов и инвойсов',
      'Отслеживание платежей',
      'Бюджетирование и прогнозирование',
      'Финансовые отчёты',
      'Интеграция с банками',
    ],
  },
  projects: {
    title: 'Проекты',
    breadcrumb: 'Проекты',
    description: 'Управление проектами, задачами и командными рабочими процессами',
    icon: '📁',
    badge: 'Скоро',
    features: [
      'Канбан и таймлайн проектов',
      'Назначение задач команде',
      'Отслеживание прогресса',
      'Управление ресурсами',
      'Интеграция с CRM',
    ],
  },
  ai: {
    title: 'Meridian AI',
    breadcrumb: 'AI',
    description: 'Интеллектуальный помощник для анализа данных, автоматизации и инсайтов',
    icon: '🤖',
    badge: 'Beta',
    features: [
      'Умные рекомендации по сделкам',
      'Автоматическое заполнение данных',
      'Анализ паттернов продаж',
      'Генерация отчётов и резюме',
      'Прогнозирование конверсии',
    ],
  },
  reports: {
    title: 'Отчёты',
    breadcrumb: 'Отчёты',
    description: 'Глубокая аналитика, настраиваемые дашборды и экспорт данных',
    icon: '📊',
    badge: 'Скоро',
    features: [
      'Кастомные отчёты и дашборды',
      'Воронка и конверсия',
      'Отчёты по менеджерам',
      'Экспорт в Excel и PDF',
      'Плановые отчёты по email',
    ],
  },
}

export function FinancePage() { return <StubPage pageKey="finance" /> }
export function ProjectsPage() { return <StubPage pageKey="projects" /> }
export function ReportsPage()  { return <StubPage pageKey="reports" /> }

function StubPage({ pageKey }: { pageKey: keyof typeof PAGES }) {
  const config = PAGES[pageKey]

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title={config.title}
          breadcrumb={config.breadcrumb ? [{ label: config.breadcrumb }] : undefined}
          description={config.description}
        />

        <div className={styles.body}>
          <div className={styles.stub}>
            <div className={styles.stubIcon}>{config.icon}</div>

            {config.badge && (
              <span className={styles.badge}>{config.badge}</span>
            )}

            <h2 className={styles.stubTitle}>{config.title}</h2>
            <p className={styles.stubDesc}>{config.description}</p>

            {config.features && (
              <ul className={styles.featureList}>
                {config.features.map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <span className={styles.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.stubCta}>
              <button type="button" className={styles.ctaBtn}>
                Уведомить о запуске
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
