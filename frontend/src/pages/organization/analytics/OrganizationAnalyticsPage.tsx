import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  ListChecks,
  PieChart as PieIcon,
  Plus,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import {
  AppLayout,
  Dropdown,
  FilterSelectTrigger,
  filterSelectDropdownClassName,
  type DropdownItem,
} from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { departmentModel } from 'entities/department'
import { userModel } from 'entities/user'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { useCanManage, canViewOrganizationFullAnalytics, cn, useChartTheme } from 'shared/lib'
import type { AnalyticsPeriod, OrganizationAnalytics } from 'shared/types/organization'
import {
  organizationPageMounted,
  organizationPageUnmounted,
} from '../model'
import styles from './OrganizationAnalyticsPage.module.css'

const PERIOD_OPTIONS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '7d', label: '7 дн.' },
  { id: '30d', label: '30 дн.' },
  { id: '90d', label: '90 дн.' },
  { id: 'all', label: 'Всё время' },
]


function formatDateShort(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function truncateDeptName(name: string, max = 14): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}

type TrendTooltipPayloadItem = {
  dataKey?: string | number
  name?: string | number
  value?: number | string
  color?: string
  stroke?: string
  fill?: string
}

type TrendTooltipProps = {
  active?: boolean
  payload?: TrendTooltipPayloadItem[]
  label?: string
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0 || !label) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{formatDateFull(label)}</div>
      {payload.map((entry) => {
        const color = entry.color || entry.stroke || entry.fill
        const name =
          entry.dataKey === 'created'
            ? 'Новые лиды'
            : entry.dataKey === 'completed'
              ? 'Закрыто сделок'
              : String(entry.name ?? '')
        return (
          <div key={String(entry.dataKey)} className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>
              <span className={styles.tooltipSwatch} style={{ background: color }} />
              {name}
            </span>
            <span className={styles.tooltipValue}>
              {formatNumber(Number(entry.value) || 0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type DeptTooltipPayloadItem = TrendTooltipPayloadItem & {
  payload?: { name?: string }
}

type DeptTooltipProps = {
  active?: boolean
  payload?: DeptTooltipPayloadItem[]
}

function DeptTooltip({ active, payload }: DeptTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const title = payload[0]?.payload?.name ?? ''
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{title}</div>
      {payload.map((entry) => {
        const color = entry.color || entry.fill
        const name =
          entry.dataKey === 'active'
            ? 'В срок'
            : entry.dataKey === 'completed'
              ? 'Завершённые'
              : entry.dataKey === 'overdue'
                ? 'Просроченные'
                : String(entry.name ?? '')
        return (
          <div key={String(entry.dataKey)} className={styles.tooltipRow}>
            <span className={styles.tooltipLabel}>
              <span className={styles.tooltipSwatch} style={{ background: color }} />
              {name}
            </span>
            <span className={styles.tooltipValue}>
              {formatNumber(Number(entry.value) || 0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

type KpiCardProps = {
  icon: React.ReactNode
  label: string
  value: string
  hint?: React.ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
}

const TONE_VARS: Record<Required<KpiCardProps>['tone'], CSSProperties> = {
  accent: {
    '--kpi-accent': 'var(--color-accent)',
    '--kpi-accent-bg': 'var(--color-accent-light)',
  } as CSSProperties,
  success: {
    '--kpi-accent': 'var(--color-success)',
    '--kpi-accent-bg': 'var(--color-success-bg)',
  } as CSSProperties,
  warning: {
    '--kpi-accent': 'var(--color-warning)',
    '--kpi-accent-bg': 'var(--color-warning-bg)',
  } as CSSProperties,
  danger: {
    '--kpi-accent': 'var(--color-required)',
    '--kpi-accent-bg': 'var(--color-required-bg)',
  } as CSSProperties,
  neutral: {
    '--kpi-accent': 'var(--color-text-secondary)',
    '--kpi-accent-bg': 'var(--color-bg-secondary)',
  } as CSSProperties,
}

function KpiCard({ icon, label, value, hint, tone = 'accent' }: KpiCardProps) {
  return (
    <div className={styles.kpiCard} style={TONE_VARS[tone]}>
      <div className={styles.kpiHeader}>
        <span className={styles.kpiIcon}>{icon}</span>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {hint && <div className={styles.kpiHint}>{hint}</div>}
    </div>
  )
}

export function OrganizationAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const organizationId = Number(id)

  const organization = organizationModel.selectors.useCurrentOrganization()
  const members = organizationModel.selectors.useOrganizationMembers()
  const departments = departmentModel.selectors.useDepartments()
  const currentUser = userModel.selectors.useUser()
  const { canManage } = useCanManage(members, currentUser?.id)

  const canViewAnalytics = useMemo(
    () =>
      organization != null &&
      canViewOrganizationFullAnalytics(
        organization.isPersonal,
        canManage,
        currentUser?.systemRole,
      ),
    [organization, canManage, currentUser?.systemRole],
  )

  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [departmentId, setDepartmentId] = useState<number | null>(null)
  const chartTheme = useChartTheme()
  const [data, setData] = useState<OrganizationAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const sortedDepartments = useMemo(
    () =>
      [...departments].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
      ),
    [departments],
  )

  const departmentDropdownItems = useMemo<DropdownItem[]>(
    () => [
      { id: 'all', label: 'Все отделы' },
      ...sortedDepartments.map((d) => ({ id: d.id, label: d.name })),
    ],
    [sortedDepartments],
  )

  useEffect(() => {
    if (!organizationId) return
    organizationPageMounted({ organizationId })
    return () => organizationPageUnmounted()
  }, [organizationId])

  useEffect(() => {
    if (!organization) return
    if (organization.id !== organizationId) return
    if (!currentUser) return
    const isRoot = currentUser.systemRole === 'root'
    if (!isRoot && !members.some((m) => m.id === currentUser.id)) return
    if (!canViewAnalytics) {
      navigate(`/organizations/${organizationId}`, { replace: true })
    }
  }, [organization, organizationId, currentUser, members, canViewAnalytics, navigate])

  useEffect(() => {
    if (departmentId == null) return
    if (!departments.some((d) => d.id === departmentId)) {
      setDepartmentId(null)
    }
  }, [departments, departmentId])

  useEffect(() => {
    if (!organizationId) return
    if (!canViewAnalytics) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await organizationsAPI.getAnalytics(organizationId, period, departmentId)
        if (cancelled) return
        setData(res)
      } catch (err: unknown) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Не удалось загрузить аналитику'
        setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => { cancelled = true }
  }, [organizationId, period, departmentId, canViewAnalytics, reloadKey])

  const trendData = useMemo(
    () =>
      (data?.trend ?? []).map((p) => ({
        ...p,
        shortDate: formatDateShort(p.date),
      })),
    [data?.trend],
  )

  const deptData = useMemo(
    () =>
      (data?.byDepartment ?? []).map((d) => ({
        ...d,
        shortName: truncateDeptName(d.name),
      })),
    [data?.byDepartment],
  )

  const topMax = useMemo(() => {
    const performers = data?.topPerformers
    if (!performers?.length) return 0
    return Math.max(...performers.map((p) => p.completed))
  }, [data])

  if (!organization || organization.id !== organizationId) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <div className={styles.loading}>Загрузка…</div>
        </div>
      </AppLayout>
    )
  }

  if (!canViewAnalytics) {
    return null
  }

  const overview = data?.overview
  const completionRatePct = overview ? Math.round(overview.completionRate * 100) : 0
  const overdueRatePct =
    overview && overview.activeTasks > 0
      ? Math.round((overview.overdueTasks / overview.activeTasks) * 100)
      : 0

  const activeColor = chartTheme.active
  const completedColor = chartTheme.completed
  const overdueColor = chartTheme.overdue
  const createdColor = chartTheme.created

  const selectedDeptLabel =
    departmentId != null
      ? sortedDepartments.find((d) => d.id === departmentId)?.name ?? 'Отдел'
      : null

  return (
    <AppLayout>
      <div className={styles.page}>
        <header className={styles.topBar}>
          <nav className={styles.breadcrumb} aria-label="Навигация">
            <Link to="/" className={styles.breadcrumbLink}>Главная</Link>
            <span className={styles.breadcrumbSep}>/</span>
            <Link to={`/organizations/${organizationId}`} className={styles.breadcrumbLink}>
              {organization.name}
            </Link>
            <span className={styles.breadcrumbSep}>/</span>
            <span className={styles.breadcrumbCurrent}>Аналитика</span>
          </nav>
        </header>

        <div className={styles.body}>
          <section className={styles.hero} aria-labelledby="analytics-title">
            <div className={styles.heroIcon} aria-hidden>
              <BarChart3 size={26} strokeWidth={1.75} />
            </div>
            <div className={styles.heroText}>
              <h1 id="analytics-title" className={styles.heroTitle}>
                Аналитика продаж
              </h1>
              <p className={styles.heroSubtitle}>
                Ключевые показатели и динамика воронки продаж
              </p>
            </div>
          </section>

          <div className={styles.filterBar}>
            <div
              className={styles.periodTabs}
              role="group"
              aria-label="Период"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    styles.periodTab,
                    period === opt.id && styles.periodTabActive,
                  )}
                  onClick={() => setPeriod(opt.id)}
                  aria-pressed={period === opt.id}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {sortedDepartments.length > 0 && (
              <div className={styles.deptFilterWrap}>
                <Dropdown
                  items={departmentDropdownItems}
                  value={departmentId ?? 'all'}
                  placeholder="Все отделы"
                  searchPlaceholder="Поиск отдела…"
                  className={filterSelectDropdownClassName}
                  renderTrigger={({ open, selectedLabel, toggle }) => (
                    <FilterSelectTrigger
                      compact
                      open={open}
                      selectedLabel={selectedLabel || 'Все отделы'}
                      toggle={toggle}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M2.5 12.5h11M3.5 12.5V4.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v8M6 12.5V9.25M8 12.5V9.25M10 12.5V9.25"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                    />
                  )}
                  onChange={(value) => {
                    const raw = value == null ? 'all' : String(value)
                    if (raw === 'all') setDepartmentId(null)
                    else setDepartmentId(Number(raw))
                  }}
                />
              </div>
            )}

            {(departmentId != null) && (
              <button
                type="button"
                className={styles.filterResetBtn}
                onClick={() => setDepartmentId(null)}
                aria-label="Сбросить фильтр отдела"
              >
                <X size={13} />
                {selectedDeptLabel}
              </button>
            )}
          </div>

          <div className={styles.content}>
            {error && (
              <div className={styles.errorBanner}>
                <span>{error}</span>
                <button
                  type="button"
                  className={styles.retryBtn}
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Повторить
                </button>
              </div>
            )}

            {loading && !data ? (
              <>
                <div className={styles.kpiGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={styles.skeletonCard} />
                  ))}
                </div>
                <div className={styles.chartsGrid}>
                  <div className={cn(styles.skeletonChart, styles.chartCardWide)} />
                  <div className={styles.skeletonChart} />
                  <div className={styles.skeletonChart} />
                </div>
              </>
            ) : !overview ? (
              <div className={styles.empty}>Нет данных для отображения</div>
            ) : (
              <>
                {overview.overdueTasks > 0 && (
                  <div className={styles.insightBanner} role="alert">
                    <AlertTriangle size={15} className={styles.insightIcon} />
                    <span>
                      <strong>{formatNumber(overview.overdueTasks)}</strong>
                      {' '}
                      {overview.overdueTasks === 1 ? 'сделка просрочена' : 'сделок просрочено'}
                      {' — '}требует внимания
                    </span>
                    {overview.activeTasks > 0 && (
                      <span className={styles.insightMeta}>
                        {overdueRatePct}% от активных
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.kpiGrid}>
                  <KpiCard
                    tone="accent"
                    icon={<Plus size={16} />}
                    label="Новых лидов"
                    value={formatNumber(overview.createdInPeriod)}
                    hint={
                      period === 'all'
                        ? 'за всё время'
                        : `за последние ${PERIOD_OPTIONS.find((p) => p.id === period)?.label.toLowerCase()}`
                    }
                  />
                  <KpiCard
                    tone="success"
                    icon={<CheckCircle2 size={16} />}
                    label="Закрыто сделок"
                    value={formatNumber(overview.completedInPeriod)}
                    hint={
                      overview.createdInPeriod > 0 ? (
                        <>
                          из{' '}
                          <span className={styles.kpiHintAccent}>
                            {formatNumber(overview.createdInPeriod)}
                          </span>{' '}
                          лидов
                        </>
                      ) : (
                        'за выбранный период'
                      )
                    }
                  />
                  <KpiCard
                    tone="danger"
                    icon={<AlertTriangle size={16} />}
                    label="Просрочено"
                    value={formatNumber(overview.overdueTasks)}
                    hint={
                      overview.overdueTasks === 0
                        ? 'Отличный результат!'
                        : overview.activeTasks > 0
                          ? `${overdueRatePct}% от активных сделок`
                          : 'требуется внимание'
                    }
                  />
                  <KpiCard
                    tone="warning"
                    icon={<TrendingUp size={16} />}
                    label="Конверсия"
                    value={`${completionRatePct}%`}
                    hint={
                      overview.createdInPeriod > 0
                        ? `${formatNumber(overview.completedInPeriod)} из ${formatNumber(overview.createdInPeriod)} сделок`
                        : 'закрыто / создано'
                    }
                  />
                  <KpiCard
                    tone="neutral"
                    icon={<Timer size={16} />}
                    label="Цикл сделки"
                    value={
                      overview.avgCycleDays == null
                        ? '—'
                        : `${overview.avgCycleDays.toFixed(1)} дн.`
                    }
                    hint="от создания до закрытия"
                  />
                  <KpiCard
                    tone="accent"
                    icon={<ListChecks size={16} />}
                    label="Активные сделки"
                    value={formatNumber(overview.activeTasks)}
                    hint={
                      overview.overdueTasks > 0 ? (
                        <>
                          из них{' '}
                          <span className={styles.kpiHintDanger}>
                            {formatNumber(overview.overdueTasks)}
                          </span>{' '}
                          просрочено
                        </>
                      ) : (
                        <>
                          <span className={styles.kpiHintGood}>✓</span>
                          {' '}все в сроке
                        </>
                      )
                    }
                  />
                </div>

                <div className={styles.chartsGrid}>
                  <div className={cn(styles.chartCard, styles.chartCardWide)}>
                    <div className={styles.chartHeader}>
                      <div className={styles.chartTitleGroup}>
                        <span className={styles.chartTitleIcon} aria-hidden>
                          <TrendingUp size={16} />
                        </span>
                        <div>
                          <h2 className={styles.chartTitle}>Динамика продаж</h2>
                          <p className={styles.chartSubtitle}>Новые лиды и закрытые сделки</p>
                        </div>
                      </div>
                      <div className={styles.chartLegend}>
                        <span className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ background: createdColor }} />
                          Новые лиды
                        </span>
                        <span className={styles.legendItem}>
                          <span className={styles.legendSwatch} style={{ background: completedColor }} />
                          Закрытые сделки
                        </span>
                      </div>
                    </div>
                    <div className={styles.chartBody}>
                      {trendData.length === 0 ? (
                        <div className={styles.chartEmpty}>
                          Пока нет данных за выбранный период
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={trendData}
                            margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                          >
                            <defs>
                              <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={chartTheme.created} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={chartTheme.created} stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={completedColor} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={completedColor} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--color-border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="shortDate"
                              stroke="var(--color-text-secondary)"
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              interval="preserveStartEnd"
                              minTickGap={24}
                            />
                            <YAxis
                              stroke="var(--color-text-secondary)"
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                              width={32}
                            />
                            <Tooltip
                              content={<TrendTooltip />}
                              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="created"
                              stroke={chartTheme.created}
                              strokeWidth={2}
                              fill="url(#createdGradient)"
                              activeDot={{ r: 4 }}
                              name="Создано"
                            />
                            <Area
                              type="monotone"
                              dataKey="completed"
                              stroke={completedColor}
                              strokeWidth={2}
                              fill="url(#completedGradient)"
                              activeDot={{ r: 4 }}
                              name="Завершено"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <div className={styles.chartTitleGroup}>
                        <span className={styles.chartTitleIcon} aria-hidden>
                          <PieIcon size={16} />
                        </span>
                        <div>
                          <h2 className={styles.chartTitle}>По отделам</h2>
                          <p className={styles.chartSubtitle}>
                            По командам: активные, просроченные, закрытые
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.chartBody}>
                      {deptData.length === 0 ? (
                        <div className={styles.chartEmpty}>
                          Добавьте отделы, чтобы увидеть распределение
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={deptData}
                            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
                            barCategoryGap="25%"
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--color-border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="shortName"
                              stroke="var(--color-text-secondary)"
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              interval={0}
                            />
                            <YAxis
                              stroke="var(--color-text-secondary)"
                              tick={{ fontSize: 11 }}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                              width={32}
                            />
                            <Tooltip
                              content={<DeptTooltip />}
                              cursor={{ fill: 'var(--color-accent-light)' }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={28}
                              iconType="circle"
                              iconSize={8}
                              wrapperStyle={{
                                fontSize: '11px',
                                color: 'var(--color-text-secondary)',
                              }}
                              formatter={(value: string) => {
                                if (value === 'active') return 'В срок'
                                if (value === 'completed') return 'Завершённые'
                                if (value === 'overdue') return 'Просроченные'
                                return value
                              }}
                            />
                            <Bar dataKey="active" stackId="a" fill={activeColor} name="active" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="overdue" stackId="a" fill={overdueColor} name="overdue" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="completed" stackId="a" fill={completedColor} name="completed" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  <div className={styles.chartCard}>
                    <div className={styles.chartHeader}>
                      <div className={styles.chartTitleGroup}>
                        <span className={styles.chartTitleIcon} aria-hidden>
                          <Trophy size={16} />
                        </span>
                        <div>
                          <h2 className={styles.chartTitle}>Топ менеджеров</h2>
                          <p className={styles.chartSubtitle}>
                            Лидеры по закрытым сделкам за период
                          </p>
                        </div>
                      </div>
                      <div className={styles.chartHeaderMeta}>
                        <Users size={13} />
                        {data?.topPerformers?.length ?? 0}
                      </div>
                    </div>
                    {data?.topPerformers?.length ? (
                      <div className={styles.topList}>
                        {data.topPerformers.map((p, i) => {
                          const ratio = topMax > 0 ? (p.completed / topMax) * 100 : 0
                          const rankClass =
                            i === 0
                              ? styles.topRankGold
                              : i === 1
                                ? styles.topRankSilver
                                : i === 2
                                  ? styles.topRankBronze
                                  : undefined
                          return (
                            <div key={p.userId} className={styles.topItem}>
                              <div className={styles.topAvatarWrap}>
                                <div className={styles.topAvatar}>
                                  {[p.firstname?.[0], p.lastname?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                                </div>
                                <span className={cn(styles.topRankBadge, rankClass)} aria-label={`Место ${i + 1}`}>
                                  {i + 1}
                                </span>
                              </div>
                              <div className={styles.topNameWrap}>
                                <span className={styles.topName}>
                                  {p.firstname} {p.lastname}
                                </span>
                                <div className={styles.topMetaRow}>
                                  <span className={styles.topMeta}>
                                    <Clock size={11} aria-hidden />
                                    {formatNumber(p.active)} активных сделок
                                  </span>
                                  {p.overdue > 0 && (
                                    <span className={styles.topMetaOverdue}>
                                      <AlertTriangle size={11} aria-hidden />
                                      {formatNumber(p.overdue)} просроч.
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className={styles.topCountWrap}>
                                <span className={styles.topCount}>
                                  {formatNumber(p.completed)}
                                </span>
                                <span className={styles.topCountLabel}>сделок</span>
                              </div>
                              <div className={styles.topBarTrack}>
                                <div
                                  className={styles.topBarFill}
                                  style={{ width: `${ratio}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={styles.chartEmpty}>
                        Пока нет закрытых сделок за этот период
                      </div>
                    )}
                    <div className={styles.chartFooter}>
                      <Users size={12} />
                      {formatNumber(overview.membersCount)} участников
                      {' · '}
                      {formatNumber(overview.departmentsCount)}{' '}
                      {overview.departmentsCount === 1 ? 'отдел' : 'отделов'}
                      {' · '}
                      {formatNumber(overview.pipelinesCount)} воронок продаж
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
