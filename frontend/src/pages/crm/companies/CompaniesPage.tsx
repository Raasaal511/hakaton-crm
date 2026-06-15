import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Download, Building2, Users, Loader2 } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { formatRubles } from 'shared/lib/crmDemoData'
import { crmAPI, type CrmCompany } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'
import { CompanyForm } from 'features/crm/CompanyForm'
import styles from './CompaniesPage.module.css'

const STATUS_LABELS: Record<string, string> = {
  active: 'Активная',
  inactive: 'Неактивная',
  prospect: 'Перспективная',
}

const AVATAR_COLORS = ['#4361ee', '#7c3aed', '#0f766e', '#dc2626', '#d97706', '#0369a1', '#1a7f37', '#9d174d']

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function CompanyRow({ company, onDelete }: { company: CrmCompany; onDelete: (id: number) => void }) {
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
            {getInitials(company.name)}
          </div>
          <div>
            <div className={styles.companyName}>{company.name}</div>
            <div className={styles.companyCity}>{company.city ?? '—'}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={styles.industry}>{company.industry ?? '—'}</span>
      </td>
      <td>
        <span className={styles.employees}>
          <Users size={12} style={{ opacity: 0.6 }} />
          {company.employeesCount != null ? company.employeesCount.toLocaleString('ru-RU') : '—'}
        </span>
      </td>
      <td>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>—</span>
      </td>
      <td>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          {company.email ?? '—'}
        </span>
      </td>
      <td>
        <span className={`${styles.statusBadge} ${statusCls}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
          {STATUS_LABELS[company.status] ?? company.status}
        </span>
      </td>
      <td>
        {company.annualRevenue != null && company.annualRevenue > 0
          ? <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{formatRubles(company.annualRevenue)}</span>
          : '—'}
      </td>
    </tr>
  )
}

export function CompaniesPage() {
  const [search, setSearch] = useState('')
  const [industryFilter, setIndustryFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editCompany, setEditCompany] = useState<CrmCompany | null>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: qk.crmCompanies(org?.id ?? 0, { q: search, limit: 200 }),
    queryFn: () => crmAPI.getCompanies(org!.id, { q: search || undefined, limit: 200 }),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => crmAPI.deleteCompany(org!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.crmCompanies(org?.id ?? 0) }),
  })

  const companies = useMemo(() => data?.items ?? [], [data])

  const industries = useMemo(
    () => ['all', ...Array.from(new Set(companies.map((c) => c.industry).filter(Boolean) as string[]))],
    [companies],
  )

  const filtered = useMemo(() =>
    companies.filter((c) => {
      const matchSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.industry ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.city ?? '').toLowerCase().includes(search.toLowerCase())
      const matchIndustry = industryFilter === 'all' || c.industry === industryFilter
      return matchSearch && matchIndustry
    }), [companies, search, industryFilter])

  const activeCount = filtered.filter((c) => c.status === 'active').length
  const totalRevenue = filtered.reduce((s, c) => s + (c.annualRevenue ?? 0), 0)

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Компании"
          breadcrumb={[{ label: 'CRM' }]}
          description={`${isLoading ? '...' : (data?.total ?? 0)} компаний в базе`}
          actions={
            <>
              <button type="button" className={styles.btn}>
                <Download size={14} />
                Экспорт
              </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { setEditCompany(null); setFormOpen(true) }}>
              <Plus size={14} />
              Новая компания
            </button>
            </>
          }
        />

        <div className={styles.body}>
          <div className={styles.statsRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>
                {isLoading ? <Loader2 size={14} className={styles.spin} /> : (data?.total ?? 0)}
              </span>
              <span className={styles.statLabel}>Всего компаний</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.stat}>
              <span className={styles.statValue}>{activeCount}</span>
              <span className={styles.statLabel}>Активных</span>
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

          {isError && (
            <div className={styles.empty}>
              <Building2 size={40} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>Ошибка загрузки</h3>
              <p className={styles.emptyDesc}>Не удалось получить данные. Проверьте подключение к серверу.</p>
            </div>
          )}

          {!isError && isLoading && (
            <div className={styles.loadingWrap}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow} />
              ))}
            </div>
          )}

          {!isError && !isLoading && filtered.length === 0 && (
            <div className={styles.empty}>
              <Building2 size={40} strokeWidth={1.5} />
              <h3 className={styles.emptyTitle}>
                {search || industryFilter !== 'all' ? 'Компании не найдены' : 'Нет компаний'}
              </h3>
              <p className={styles.emptyDesc}>
                {search || industryFilter !== 'all'
                  ? 'Попробуйте изменить критерии поиска'
                  : 'Добавьте первую компанию, нажав «Новая компания»'}
              </p>
            </div>
          )}

          {!isError && !isLoading && filtered.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Компания</th>
                    <th>Отрасль</th>
                    <th>Сотрудники</th>
                    <th>Сделки</th>
                    <th>Email</th>
                    <th>Статус</th>
                    <th>Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <CompanyRow key={c.id} company={c} onDelete={(id) => deleteMutation.mutate(id)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <CompanyForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditCompany(null) }}
        existing={editCompany}
      />
    </AppLayout>
  )
}
