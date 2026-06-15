import { useState, useMemo } from 'react'
import { Plus, Search, Download, Building2, TrendingUp, Users } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { DEMO_COMPANIES, type CrmCompany, formatRubles } from 'shared/lib/crmDemoData'
import styles from './CompaniesPage.module.css'

const STATUS_LABELS = { active: 'Активная', inactive: 'Неактивная', prospect: 'Перспективная' }
const AVATAR_COLORS = ['#4361ee', '#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d']

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function CompanyRow({ company }: { company: CrmCompany }) {
  const color = getAvatarColor(company.name)
  const statusCls =
    company.status === 'active' ? styles.statusActive
    : company.status === 'inactive' ? styles.statusInactive
    : styles.statusProspect

  return (
    <tr>
      <td>
        <div className={styles.companyCell}>
          <div className={styles.companyAvatar} style={{ background: color }}>
            {company.avatar}
          </div>
          <div>
            <div className={styles.companyName}>{company.name}</div>
            <div className={styles.companyCity}>{company.city}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={styles.industry}>{company.industry}</span>
      </td>
      <td>
        <span className={styles.employees}>
          <Users size={12} style={{ opacity: 0.6 }} />
          {company.employees.toLocaleString('ru-RU')}
        </span>
      </td>
      <td>
        <div className={styles.dealsCell}>
          <span className={styles.dealsCount}>{company.dealsCount}</span>
          {company.totalDeals > 0 && (
            <span className={styles.dealsSum}>{formatRubles(company.totalDeals)}</span>
          )}
        </div>
      </td>
      <td>
        <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          {company.manager}
        </span>
      </td>
      <td>
        <span className={`${styles.statusBadge} ${statusCls}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {STATUS_LABELS[company.status]}
        </span>
      </td>
      <td>
        {company.revenue > 0 ? (
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)' }}>
            {formatRubles(company.revenue)}
          </span>
        ) : '—'}
      </td>
    </tr>
  )
}

export function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')

  const industries = useMemo(
    () => ['all', ...Array.from(new Set(DEMO_COMPANIES.map((c) => c.industry)))],
    [],
  )

  const filtered = useMemo(() =>
    DEMO_COMPANIES.filter((c) => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.industry.toLowerCase().includes(search.toLowerCase()) ||
        c.city.toLowerCase().includes(search.toLowerCase())
      const matchIndustry = industryFilter === 'all' || c.industry === industryFilter
      return matchSearch && matchIndustry
    }), [search, industryFilter])

  const totalRevenue = DEMO_COMPANIES.reduce((s, c) => s + c.revenue, 0)
  const totalDeals = DEMO_COMPANIES.reduce((s, c) => s + c.totalDeals, 0)
  const activeCount = DEMO_COMPANIES.filter((c) => c.status === 'active').length

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Компании</h1>
            <p className={styles.pageSubtitle}>
              Клиентская база · {DEMO_COMPANIES.length} компаний
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.btn}>
              <Download size={14} />
              Экспорт
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} />
              Новая компания
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{DEMO_COMPANIES.length}</span>
              <span className={styles.statLabel}>Всего компаний</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{activeCount}</span>
              <span className={styles.statLabel}>Активных</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatRubles(totalDeals)}</span>
              <span className={styles.statLabel}>Сумма сделок</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{formatRubles(totalRevenue)}</span>
              <span className={styles.statLabel}>Совокупная выручка</span>
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Поиск по названию, отрасли, городу..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.filterTabs}>
              {industries.map((ind) => (
                <button
                  key={ind}
                  type="button"
                  className={`${styles.filterTab} ${industryFilter === ind ? styles.filterTabActive : ''}`}
                  onClick={() => setIndustryFilter(ind)}
                >
                  {ind === 'all' ? 'Все отрасли' : ind}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <Building2 size={40} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>Компании не найдены</h3>
              <p className={styles.emptyDesc}>Попробуйте изменить критерии поиска</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>Отрасль</th>
                    <th>Сотрудники</th>
                    <th>Сделки</th>
                    <th>Менеджер</th>
                    <th>Статус</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CompanyRow key={c.id} company={c} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
