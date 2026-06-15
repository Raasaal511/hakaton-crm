import { type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  DollarSign,
  Activity,
  Plus,
  PhoneCall,
  Mail,
  ArrowRight,
} from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import {
  DASHBOARD_KPI,
  FUNNEL_DATA,
  RECENT_ACTIVITIES,
  TOP_DEALS,
  REVENUE_TREND,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  formatRubles,
} from 'shared/lib/crmDemoData'
import { useChartTheme } from 'shared/lib'
import styles from './DashboardPage.module.css'

function formatDate() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type KpiCardProps = {
  icon: React.ReactNode
  label: string
  value: string
  changeValue?: number
  changePeriod?: string
  hint?: string
  color: string
  bg: string
}

function KpiCard({ icon, label, value, changeValue, changePeriod, hint, color, bg }: KpiCardProps) {
  const style = {
    '--kpi-color': color,
    '--kpi-bg': bg,
  } as CSSProperties

  const isUp = changeValue != null && changeValue >= 0

  return (
    <div className={styles.kpiCard} style={style}>
      <div className={styles.kpiHeader}>
        <div className={styles.kpiIcon}>{icon}</div>
        <span className={styles.kpiLabel}>{label}</span>
      </div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiFooter}>
        {changeValue != null && (
          <span className={`${styles.kpiChange} ${isUp ? styles.kpiChangeUp : styles.kpiChangeDown}`}>
            {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isUp ? '+' : ''}{changeValue}%
          </span>
        )}
        {changePeriod && <span className={styles.kpiChangePeriod}>за {changePeriod}</span>}
        {hint && <span className={styles.kpiChangePeriod}>{hint}</span>}
      </div>
    </div>
  )
}

function ActivityTypeIcon({ type, color }: { type: string; color: string }) {
  const icons: Record<string, React.ReactNode> = {
    call: <PhoneCall size={10} />,
    deal: <DollarSign size={10} />,
    win: <Target size={10} />,
    contact: <Users size={10} />,
    email: <Mail size={10} />,
    meeting: <Activity size={10} />,
  }
  return (
    <span
      className={styles.activityDot}
      style={{ background: color, width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}
    >
      {icons[type] ?? <Activity size={10} />}
    </span>
  )
}

export function DashboardPage() {
  const organization = organizationModel.selectors.useCurrentOrganization()
  const currentUser = userModel.selectors.useUser()
  const chartTheme = useChartTheme()

  const kpi = DASHBOARD_KPI

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Доброе утро'
    if (h < 18) return 'Добрый день'
    return 'Добрый вечер'
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.topBarLeft}>
            <h1 className={styles.pageTitle}>
              {greeting()}, {currentUser?.firstname ?? 'пользователь'} 👋
            </h1>
            <p className={styles.pageSubtitle}>
              {organization?.name ?? 'PulsarCRM'} · {formatDate()}
            </p>
          </div>
          <div className={styles.quickActions}>
            <button type="button" className={styles.quickBtn}>
              <PhoneCall size={14} />
              Звонок
            </button>
            <button type="button" className={styles.quickBtn}>
              <Mail size={14} />
              Письмо
            </button>
            <Link to="/crm/leads" className={`${styles.quickBtn} ${styles.quickBtnPrimary}`}>
              <Plus size={14} />
              Новый лид
            </Link>
          </div>
        </div>

        <div className={styles.body}>
          {/* KPI Row */}
          <div className={styles.kpiGrid}>
            <KpiCard
              icon={<DollarSign size={16} />}
              label="Выручка"
              value={formatRubles(kpi.revenue.value)}
              changeValue={kpi.revenue.change}
              changePeriod={kpi.revenue.period}
              color="var(--color-accent)"
              bg="var(--color-accent-light)"
            />
            <KpiCard
              icon={<Users size={16} />}
              label="Новые лиды"
              value={String(kpi.newLeads.value)}
              changeValue={kpi.newLeads.change}
              changePeriod={`${kpi.newLeads.period}`}
              color="var(--color-success)"
              bg="var(--color-success-bg)"
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Конверсия"
              value={`${kpi.conversion.value}%`}
              changeValue={kpi.conversion.change}
              changePeriod={kpi.conversion.period}
              color="#7c3aed"
              bg="color-mix(in srgb, #7c3aed 12%, var(--color-bg))"
            />
            <KpiCard
              icon={<Target size={16} />}
              label="Активные сделки"
              value={String(kpi.activeDeals.value)}
              hint={`${kpi.activeDeals.urgent} срочных`}
              color="var(--color-warning)"
              bg="var(--color-warning-bg)"
            />
          </div>

          {/* Charts row */}
          <div className={styles.chartsRow}>
            {/* Funnel */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleGroup}>
                  <span className={styles.cardTitleIcon}>
                    <Target size={14} />
                  </span>
                  <div>
                    <h2 className={styles.cardTitle}>Воронка продаж</h2>
                    <p className={styles.cardSubtitle}>Распределение лидов по этапам</p>
                  </div>
                </div>
                <Link
                  to="/crm/leads"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                >
                  Все лиды <ArrowRight size={12} />
                </Link>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.funnelList}>
                  {FUNNEL_DATA.map((row) => (
                    <div key={row.stage} className={styles.funnelRow}>
                      <span className={styles.funnelLabel}>{row.stage}</span>
                      <div className={styles.funnelBarTrack}>
                        <div
                          className={styles.funnelBarFill}
                          style={{ width: `${row.pct}%`, background: row.color }}
                        />
                      </div>
                      <span className={styles.funnelCount}>{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue chart */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleGroup}>
                  <span className={styles.cardTitleIcon}>
                    <TrendingUp size={14} />
                  </span>
                  <div>
                    <h2 className={styles.cardTitle}>Динамика выручки</h2>
                    <p className={styles.cardSubtitle}>За последние 6 месяцев</p>
                  </div>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.revenueChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_TREND} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartTheme.created} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={chartTheme.created} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value) => [typeof value === 'number' ? formatRubles(value) : '', 'Выручка']}
                        contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--color-text-secondary)', fontSize: 11 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={chartTheme.created}
                        strokeWidth={2}
                        fill="url(#revGradient)"
                        activeDot={{ r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className={styles.bottomRow}>
            {/* Top deals */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleGroup}>
                  <span className={styles.cardTitleIcon}>
                    <DollarSign size={14} />
                  </span>
                  <div>
                    <h2 className={styles.cardTitle}>Топ сделки</h2>
                    <p className={styles.cardSubtitle}>По сумме потенциальной выручки</p>
                  </div>
                </div>
                <Link
                  to="/crm/leads"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                >
                  Все сделки <ArrowRight size={12} />
                </Link>
              </div>
              <div className={styles.cardBody} style={{ padding: '0 1.25rem' }}>
                <table className={styles.dealsTable}>
                  <thead>
                    <tr>
                      <th>Сделка</th>
                      <th>Сумма</th>
                      <th>Этап</th>
                      <th>Вероятность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_DEALS.map((deal) => {
                      const stageColor = LEAD_STAGE_COLORS[deal.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
                      return (
                        <tr key={deal.id}>
                          <td>
                            <span className={styles.dealTitle}>{deal.title}</span>
                            <span className={styles.dealCompany}>{deal.company}</span>
                          </td>
                          <td>
                            <span className={styles.dealAmount}>{formatRubles(deal.amount)}</span>
                          </td>
                          <td>
                            <span
                              className={styles.stageBadge}
                              style={{ color: stageColor, background: `color-mix(in srgb, ${stageColor} 12%, var(--color-bg))` }}
                            >
                              {LEAD_STAGE_LABELS[deal.stage as keyof typeof LEAD_STAGE_LABELS]}
                            </span>
                          </td>
                          <td>
                            <div className={styles.probBar}>
                              <div className={styles.probTrack}>
                                <div className={styles.probFill} style={{ width: `${deal.probability}%`, background: stageColor }} />
                              </div>
                              <span className={styles.probText}>{deal.probability}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent activities */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleGroup}>
                  <span className={styles.cardTitleIcon}>
                    <Activity size={14} />
                  </span>
                  <div>
                    <h2 className={styles.cardTitle}>Последние активности</h2>
                    <p className={styles.cardSubtitle}>Действия команды за сегодня</p>
                  </div>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.activityList}>
                  {RECENT_ACTIVITIES.map((act) => (
                    <div key={act.id} className={styles.activityItem}>
                      <ActivityTypeIcon type={act.type} color={act.color} />
                      <div className={styles.activityContent}>
                        <p className={styles.activityText}>{act.text}</p>
                        <div className={styles.activityMeta}>
                          <span className={styles.activityUser}>
                            <span className={styles.activityAvatar}>{act.userAvatar}</span>
                            {act.user}
                          </span>
                          <span>·</span>
                          <span>{act.time}</span>
                          <span>·</span>
                          <span>{act.date}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
