import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  BarChart3,
  Building2,
  Download,
  DollarSign,
  MessageSquare,
  Percent,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import { AppLayout, Button, KPICard } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { crmAPI, type CrmReportPeriod, type CrmReportsResponse } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { formatRubles } from 'shared/lib/crmDemoData'
import { CONTACT_STATUS_CONFIG, normalizeContactStatus } from 'shared/lib/contactStatus'
import { COMPANY_STATUS_CONFIG, normalizeCompanyStatus } from 'shared/lib/companyStatus'
import { useChartTheme } from 'shared/lib'
import { downloadCsv } from 'features/reports/exportCsv'
import styles from './ReportsPage.module.css'

const PERIOD_OPTIONS: { id: CrmReportPeriod; label: string }[] = [
  { id: '7d', label: '7 дн.' },
  { id: '30d', label: '30 дн.' },
  { id: '90d', label: '90 дн.' },
  { id: 'all', label: 'Всё время' },
]

const CHANNEL_LABELS: Record<string, string> = {
  phone: 'Звонки',
  email: 'Email',
  telegram: 'Telegram',
  note: 'Заметки',
  meeting: 'Встречи',
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function managerName(m: CrmReportsResponse['byManager'][0]) {
  if (m.userId == null) return 'Без ответственного'
  return [m.firstname, m.lastname].filter(Boolean).join(' ')
}

function exportReportsCsv(data: CrmReportsResponse, period: CrmReportPeriod) {
  const rows = [
    ...data.funnel.map((f) => ({
      section: 'Воронка',
      name: f.stageName,
      count: f.count,
      amount: f.amount,
      conversion: f.conversionFromPrev != null ? formatPct(f.conversionFromPrev) : '',
    })),
    ...data.byManager.map((m) => ({
      section: 'Менеджеры',
      name: managerName(m),
      count: m.leadsCount,
      amount: m.wonAmount,
      conversion: formatPct(m.conversionRate),
    })),
    ...data.bySource.map((s) => ({
      section: 'Источники',
      name: s.source,
      count: s.count,
      amount: s.amount,
      conversion: '',
    })),
  ]
  downloadCsv(`crm-reports-${period}.csv`, rows, [
    { key: 'section', header: 'Раздел' },
    { key: 'name', header: 'Название' },
    { key: 'count', header: 'Количество' },
    { key: 'amount', header: 'Сумма' },
    { key: 'conversion', header: 'Конверсия' },
  ])
}

export function ReportsPage() {
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const [period, setPeriod] = useState<CrmReportPeriod>('30d')
  const chartTheme = useChartTheme()
  const tooltipStyle = useMemo(() => ({
    background: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: 8,
    color: chartTheme.tooltipText,
    fontSize: 12,
  }), [chartTheme])

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.crmReports(orgId, period),
    queryFn: () => crmAPI.getReports(orgId, period),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const maxFunnelCount = useMemo(
    () => Math.max(1, ...(data?.funnel ?? []).map((f) => f.count)),
    [data?.funnel],
  )

  const leadsTrend = useMemo(
    () => (data?.trends.leadsCreated ?? []).map((p) => ({ ...p, shortDate: formatDateShort(p.date) })),
    [data?.trends.leadsCreated],
  )

  const revenueTrend = useMemo(
    () => (data?.trends.revenueWon ?? []).map((p) => ({ ...p, shortDate: formatDateShort(p.date) })),
    [data?.trends.revenueWon],
  )

  const contactsChart = useMemo(
    () => (data?.contactsByStatus ?? []).map((c) => ({
      status: CONTACT_STATUS_CONFIG[normalizeContactStatus(c.status)]?.label ?? c.status,
      count: c.count,
    })),
    [data?.contactsByStatus],
  )

  const companiesChart = useMemo(
    () => (data?.companiesByStatus ?? []).map((c) => ({
      status: COMPANY_STATUS_CONFIG[normalizeCompanyStatus(c.status)]?.label ?? c.status,
      count: c.count,
    })),
    [data?.companiesByStatus],
  )

  const commChart = useMemo(
    () => (data?.communicationsByChannel ?? []).map((c) => ({
      channel: CHANNEL_LABELS[c.channel] ?? c.channel,
      count: c.count,
    })),
    [data?.communicationsByChannel],
  )

  const managersChart = useMemo(
    () => (data?.byManager ?? []).slice(0, 8).map((m) => ({
      name: managerName(m).slice(0, 16),
      wonAmount: m.wonAmount,
    })),
    [data?.byManager],
  )

  if (!orgId) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.noOrgHint}>Выберите организацию, чтобы просмотреть отчёты.</div>
        </div>
      </AppLayout>
    )
  }

  const overview = data?.overview

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden />
          <div className={styles.heroContent}>
            <div className={styles.heroTop}>
              <div>
                <div className={styles.heroBreadcrumb}>CRM · Отчёты</div>
                <h1 className={styles.heroTitle}>Отчёты и аналитика</h1>
                <p className={styles.heroSubtitle}>
                  {isLoading ? 'Загрузка…' : `Период: ${PERIOD_OPTIONS.find((p) => p.id === period)?.label ?? period}`}
                </p>
              </div>
              <div className={styles.heroActions}>
                <div className={styles.periodToggle}>
                  {PERIOD_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className={`${styles.periodBtn} ${period === opt.id ? styles.periodBtnActive : ''}`}
                      onClick={() => setPeriod(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  iconLeft={<Download size={14} />}
                  disabled={!data}
                  onClick={() => data && exportReportsCsv(data, period)}
                >
                  Экспорт CSV
                </Button>
              </div>
            </div>
          </div>
        </div>

        {isError && (
          <div className={styles.errorBanner}>
            Не удалось загрузить отчёты.{' '}
            <button type="button" className={styles.errorRetry} onClick={() => refetch()}>Повторить</button>
          </div>
        )}

        <div className={styles.body}>
          {/* KPI */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><BarChart3 size={18} /> Ключевые показатели</h2>
            <div className={styles.kpiGrid}>
              <KPICard label="Лиды" value={String(overview?.totalLeads ?? 0)} deltaLabel={`+${overview?.newLeads ?? 0} за период`} trend="up" icon={<Target size={16} />} loading={isLoading} />
              <KPICard label="Сумма воронки" value={formatRubles(overview?.totalAmount ?? 0)} icon={<DollarSign size={16} />} loading={isLoading} />
              <KPICard label="Выиграно" value={formatRubles(overview?.wonAmount ?? 0)} deltaLabel={`${overview?.wonCount ?? 0} сделок`} trend="up" icon={<Trophy size={16} />} accentColor="var(--color-success)" loading={isLoading} />
              <KPICard label="Конверсия" value={formatPct(overview?.conversionRate ?? 0)} deltaLabel={`${overview?.lostCount ?? 0} проиграно`} icon={<Percent size={16} />} loading={isLoading} />
              <KPICard label="Прогноз" value={formatRubles(overview?.weightedPipeline ?? 0)} deltaLabel="взвешенный" icon={<TrendingUp size={16} />} loading={isLoading} />
              <KPICard label="Контакты" value={String(overview?.contactCount ?? 0)} deltaLabel={`+${overview?.newContacts ?? 0} новых`} icon={<Users size={16} />} loading={isLoading} />
              <KPICard label="Компании" value={String(overview?.companyCount ?? 0)} deltaLabel={`+${overview?.newCompanies ?? 0} новых`} icon={<Building2 size={16} />} loading={isLoading} />
            </div>
          </section>

          {/* Trends */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><TrendingUp size={18} /> Динамика</h2>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Новые лиды</h3>
                {isLoading ? (
                  <div className={styles.chartSkeleton} />
                ) : leadsTrend.length === 0 ? (
                  <div className={styles.chartEmpty}>Нет данных за период</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={leadsTrend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="shortDate" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="count" name="Лиды" stroke="#6366f1" fill="url(#leadsGrad)" strokeWidth={2} />
                      <defs>
                        <linearGradient id="leadsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Выигранная выручка</h3>
                {isLoading ? (
                  <div className={styles.chartSkeleton} />
                ) : revenueTrend.length === 0 ? (
                  <div className={styles.chartEmpty}>Нет данных за период</div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={revenueTrend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="shortDate" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatRubles(Number(v) || 0), 'Выручка']} />
                      <Area type="monotone" dataKey="amount" name="Выручка" stroke="#10b981" fill="url(#revGrad)" strokeWidth={2} />
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* Funnel */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><Target size={18} /> Воронка и конверсия</h2>
            <div className={styles.funnelCard}>
              {isLoading ? (
                <div className={styles.chartSkeleton} />
              ) : (data?.funnel ?? []).length === 0 ? (
                <div className={styles.chartEmpty}>Нет этапов воронки</div>
              ) : (
                <div className={styles.funnelList}>
                  {(data?.funnel ?? []).map((stage) => {
                    const color = stage.color ?? '#6366f1'
                    const width = Math.max(4, Math.round((stage.count / maxFunnelCount) * 100))
                    return (
                      <div key={stage.stage} className={styles.funnelRow}>
                        <span className={styles.funnelName}>
                          <span className={styles.funnelDot} style={{ background: color }} />
                          {stage.stageName}
                        </span>
                        <span className={styles.funnelBarWrap}>
                          <span className={styles.funnelBar} style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 50%, transparent))` }} />
                        </span>
                        <span className={styles.funnelCount}>{stage.count}</span>
                        <span className={styles.funnelAmount}>{formatRubles(stage.amount)}</span>
                        <span className={styles.funnelConv}>
                          {stage.conversionFromPrev != null ? formatPct(stage.conversionFromPrev) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Managers */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><Users size={18} /> Менеджеры</h2>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Выручка по менеджерам</h3>
                {isLoading ? (
                  <div className={styles.chartSkeleton} />
                ) : managersChart.length === 0 ? (
                  <div className={styles.chartEmpty}>Нет данных</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={managersChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: chartTheme.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatRubles(Number(v) || 0), 'Выручка']} />
                      <Bar dataKey="wonAmount" name="Выручка" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className={styles.tableCard}>
                <h3 className={styles.chartTitle}>Детализация</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Менеджер</th>
                        <th>Лидов</th>
                        <th>Выиграно</th>
                        <th>Сумма</th>
                        <th>Конверсия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr><td colSpan={5} className={styles.tableEmpty}>Загрузка…</td></tr>
                      ) : (data?.byManager ?? []).length === 0 ? (
                        <tr><td colSpan={5} className={styles.tableEmpty}>Нет данных</td></tr>
                      ) : (
                        (data?.byManager ?? []).map((m) => (
                          <tr key={m.userId ?? 'none'}>
                            <td>{managerName(m)}</td>
                            <td>{m.leadsCount}</td>
                            <td>{m.wonCount}</td>
                            <td>{formatRubles(m.wonAmount)}</td>
                            <td>{formatPct(m.conversionRate)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Contacts & Companies */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><Building2 size={18} /> База клиентов</h2>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Контакты по статусу</h3>
                {isLoading ? (
                  <div className={styles.chartSkeleton} />
                ) : contactsChart.length === 0 ? (
                  <div className={styles.chartEmpty}>Нет контактов</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={contactsChart} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="status" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Контакты" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className={styles.chartCard}>
                <h3 className={styles.chartTitle}>Компании по статусу</h3>
                {isLoading ? (
                  <div className={styles.chartSkeleton} />
                ) : companiesChart.length === 0 ? (
                  <div className={styles.chartEmpty}>Нет компаний</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={companiesChart} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                      <XAxis type="number" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="status" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" name="Компании" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          {/* Sales & Communications */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}><MessageSquare size={18} /> Продажи и коммуникации</h2>
            <div className={styles.salesKpi}>
              <div className={styles.salesKpiItem}>
                <span className={styles.salesKpiLabel}>КП за период</span>
                <span className={styles.salesKpiValue}>{data?.sales.quotesCount ?? 0}</span>
                <span className={styles.salesKpiHint}>{formatRubles(data?.sales.quotesAmount ?? 0)}</span>
              </div>
              <div className={styles.salesKpiItem}>
                <span className={styles.salesKpiLabel}>Счетов за период</span>
                <span className={styles.salesKpiValue}>{data?.sales.invoicesCount ?? 0}</span>
              </div>
              <div className={styles.salesKpiItem}>
                <span className={styles.salesKpiLabel}>Оплачено</span>
                <span className={styles.salesKpiValue}>{formatRubles(data?.sales.invoicesPaid ?? 0)}</span>
              </div>
              <div className={styles.salesKpiItem}>
                <span className={styles.salesKpiLabel}>К оплате</span>
                <span className={styles.salesKpiValue}>{formatRubles(data?.sales.invoicesOutstanding ?? 0)}</span>
              </div>
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Коммуникации по каналам</h3>
              {isLoading ? (
                <div className={styles.chartSkeleton} />
              ) : commChart.length === 0 ? (
                <div className={styles.chartEmpty}>Нет коммуникаций за период</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={commChart} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis dataKey="channel" tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: chartTheme.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Коммуникации" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
