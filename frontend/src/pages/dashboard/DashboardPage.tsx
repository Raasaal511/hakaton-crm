import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useState, useEffect, useRef } from 'react'
import {
  TrendingUp,
  Users,
  Target,
  DollarSign,
  Activity,
  Plus,
  PhoneCall,
  Mail,
  ArrowRight,
  Zap,
  Sparkles,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { KPICard } from 'shared/ui/KPICard/KPICard'
import { Card, CardHeader } from 'shared/ui/Card/Card'
import { organizationModel } from 'entities/organization'
import { userModel } from 'entities/user'
import {
  REVENUE_TREND,
  LEAD_STAGE_LABELS,
  LEAD_STAGE_COLORS,
  formatRubles,
} from 'shared/lib/crmDemoData'
import { useChartTheme } from 'shared/lib'
import { streamInto } from 'shared/lib/ai'
import { crmAPI } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { LeadForm } from 'features/crm/LeadForm'
import { ContactForm } from 'features/crm/ContactForm'
import { LogCommunicationModal, type CommChannel } from 'features/crm/LogCommunicationModal'
import styles from './DashboardPage.module.css'


// ── AI Insights (dynamic, seeded from real stats) ─────────────────────────────
function AiInsightsCard({
  leadCount,
  pipelineValue,
  conversionRate,
}: {
  leadCount: number
  pipelineValue: number
  conversionRate: number
}) {
  const insights = [
    {
      text: leadCount > 0
        ? `${leadCount} лидов в работе · ${Math.round(leadCount * 0.12)} могут потребовать внимания`
        : 'Добавьте первые лиды для AI-анализа',
      color: '#ef4444',
    },
    {
      text: pipelineValue > 0
        ? `Ожидаемая выручка: ${formatRubles(pipelineValue)} — анализирую прогноз`
        : 'Воронка продаж пока пуста',
      color: '#10b981',
    },
    {
      text: conversionRate > 0
        ? `Конверсия лидов: ${Math.round(conversionRate * 100)}% — ${conversionRate > 0.25 ? 'выше' : 'ниже'} среднего`
        : 'Накопите данные для расчёта конверсии',
      color: '#6366f1',
    },
  ]

  const [texts, setTexts] = useState<string[]>(['', '', ''])
  const [doneFlags, setDoneFlags] = useState<boolean[]>([false, false, false])
  const cancelRefs = useRef<Array<() => void>>([])

  useEffect(() => {
    // Reset on data change
    setTexts(['', '', ''])
    setDoneFlags([false, false, false])
    cancelRefs.current.forEach((c) => c?.())

    let active = true
    async function go() {
      for (let i = 0; i < insights.length; i++) {
        if (!active) break
        await new Promise<void>((r) => setTimeout(r, i * 800 + 400))
        if (!active) break
        const idx = i
        cancelRefs.current[idx] = streamInto(
          insights[idx].text,
          (partial) => setTexts((prev) => { const next = [...prev]; next[idx] = partial; return next }),
          () => setDoneFlags((prev) => { const next = [...prev]; next[idx] = true; return next }),
        )
      }
    }
    go()
    return () => {
      active = false
      cancelRefs.current.forEach((c) => c?.())
    }
  }, [leadCount, pipelineValue, conversionRate]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card padding="none">
      <div className={styles.aiHeader}>
        <div className={styles.aiHeaderIcon}>✦</div>
        <span className={styles.aiHeaderTitle}>Meridian AI</span>
        <span className={styles.aiPulseDot} />
      </div>
      <div className={styles.aiInsights}>
        {insights.map((insight, i) => (
          <div key={i} className={styles.aiInsightItem}>
            <span className={styles.aiInsightDot} style={{ background: insight.color }} />
            <span className={styles.aiInsightText}>
              {texts[i]}
              {!doneFlags[i] && texts[i].length > 0 && (
                <span className={styles.aiInsightCursor} />
              )}
              {texts[i].length === 0 && (
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>Анализирую...</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <Link to="/ai" className={styles.aiViewAll}>
        <Sparkles size={12} />
        Открыть Meridian AI
        <ArrowRight size={11} />
      </Link>
    </Card>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

function formatDate() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function ActivityDot({ type, color }: { type: string; color: string }) {
  const icons: Record<string, React.ReactNode> = {
    call:    <PhoneCall size={10} />,
    deal:    <DollarSign size={10} />,
    win:     <Target size={10} />,
    contact: <Users size={10} />,
    email:   <Mail size={10} />,
    meeting: <Activity size={10} />,
    created: <Plus size={10} />,
    updated: <Activity size={10} />,
  }
  return (
    <span className={styles.actDot} style={{ background: color }}>
      {icons[type] ?? <Activity size={10} />}
    </span>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ч назад`
  return `${Math.floor(hrs / 24)} д назад`
}

export function DashboardPage() {
  const organization = organizationModel.selectors.useCurrentOrganization()
  const currentUser = userModel.selectors.useUser()
  const chartTheme = useChartTheme()
  const orgId = organization?.id ?? 0
  const [leadFormOpen, setLeadFormOpen] = useState(false)
  const [contactFormOpen, setContactFormOpen] = useState(false)
  const [communicationChannel, setCommunicationChannel] = useState<CommChannel | null>(null)

  // ── Real data queries ──────────────────────────────────────────────────────
  const { data: leadStats } = useQuery({
    queryKey: qk.crmLeadStats(orgId),
    queryFn: () => crmAPI.getLeadStats(orgId),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: dealStats } = useQuery({
    queryKey: qk.crmDealStats(orgId),
    queryFn: () => crmAPI.getDealStats(orgId),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: leadsData } = useQuery({
    queryKey: qk.crmLeads(orgId, { limit: 10, sort: 'updated' }),
    queryFn: () => crmAPI.getLeads(orgId, { limit: 10 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: contactsData } = useQuery({
    queryKey: qk.crmContacts(orgId, { limit: 1 }),
    queryFn: () => crmAPI.getContacts(orgId, { limit: 1 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: recentActivityData } = useQuery({
    queryKey: qk.crmRecentActivity(orgId),
    queryFn: () => crmAPI.getRecentActivity(orgId, 20),
    enabled: Boolean(orgId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalLeads = leadStats?.totalLeads ?? 0
  const totalAmount = leadStats?.totalAmount ?? 0
  const conversionRate = leadStats?.conversionRate ?? 0
  const wonAmount = leadStats?.byStage.find((s) => s.stage === 'won')?.amount ?? 0
  const contactCount = contactsData?.total ?? 0

  // Active leads (not won/lost)
  const activeLeadCount = (leadStats?.byStage ?? [])
    .filter((s) => s.stage !== 'won' && s.stage !== 'lost')
    .reduce((sum, s) => sum + s.count, 0)

  // Funnel from real stage breakdown
  const maxStageCount = Math.max(1, ...(leadStats?.byStage ?? []).map((s) => s.count))
  const funnelData = (leadStats?.byStage ?? [])
    .filter((s) => s.stage !== 'won' && s.stage !== 'lost')
    .map((s) => ({
      stage: LEAD_STAGE_LABELS[s.stage as keyof typeof LEAD_STAGE_LABELS] ?? s.stage,
      count: s.count,
      pct: Math.round((s.count / maxStageCount) * 100),
      color: LEAD_STAGE_COLORS[s.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280',
    }))

  // Top leads as "top deals"
  const topLeads = (leadsData?.items ?? [])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  // Real activity feed (communications + crm_activity events)
  const recentActivityItems = recentActivityData?.items ?? []

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title={`${getGreeting()}, ${currentUser?.firstname ?? 'пользователь'}`}
          description={`${organization?.name ?? 'Meridian'} · ${formatDate()}`}
          actions={
            <>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<PhoneCall size={13} />}
                onClick={() => setCommunicationChannel('phone')}
                disabled={!orgId}
              >
                Звонок
              </Button>
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Mail size={13} />}
                onClick={() => setCommunicationChannel('email')}
                disabled={!orgId}
              >
                Письмо
              </Button>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus size={13} />}
                onClick={() => setLeadFormOpen(true)}
                disabled={!orgId}
              >
                Новый лид
              </Button>
            </>
          }
        />

        <div className={styles.body}>
          {/* KPI Row */}
          <div className={styles.kpiGrid}>
            <KPICard
              label="Выручка (Won)"
              value={formatRubles(wonAmount)}
              deltaLabel="закрытых сделок"
              trend="up"
              icon={<DollarSign size={16} strokeWidth={1.75} />}
              loading={!leadStats}
            />
            <KPICard
              label="Лиды"
              value={String(totalLeads)}
              deltaLabel={`${activeLeadCount} активных`}
              trend="up"
              icon={<Users size={16} strokeWidth={1.75} />}
              accentColor="var(--color-success)"
              loading={!leadStats}
            />
            <KPICard
              label="Конверсия"
              value={`${Math.round(conversionRate * 100)}%`}
              deltaLabel="выиграно/закрыто"
              trend={conversionRate > 0.25 ? 'up' : 'neutral'}
              icon={<TrendingUp size={16} strokeWidth={1.75} />}
              loading={!leadStats}
            />
            <KPICard
              label="Контакты"
              value={String(contactCount)}
              deltaLabel="в базе"
              trend="neutral"
              icon={<Target size={16} strokeWidth={1.75} />}
              accentColor="var(--color-warning)"
              loading={!contactsData}
            />
          </div>

          {/* Main grid: 2/3 + 1/3 */}
          <div className={styles.mainGrid}>
            <div className={styles.mainCol}>
              {/* Revenue chart — historical placeholder */}
              <Card padding="none">
                <CardHeader
                  title="Динамика воронки"
                  description="Плановый тренд · подключите BI для реального графика"
                />
                <div className={styles.revenueChart}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_TREND} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={chartTheme.created} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={chartTheme.created} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) => [typeof v === 'number' ? formatRubles(v) : '', 'Выручка']}
                        contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-lg)' }}
                        labelStyle={{ color: 'var(--color-text-secondary)', fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={chartTheme.created} strokeWidth={2} fill="url(#revGrad)" activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Top leads */}
              <Card padding="none">
                <div className={styles.cardTop}>
                  <CardHeader title="Топ лиды" description="По сумме сделки" />
                  <Link to="/crm/leads" className={styles.viewAllLink}>
                    Все лиды <ArrowRight size={12} />
                  </Link>
                </div>
                <div className={styles.dealsTableWrap}>
                  {topLeads.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                      Лиды не добавлены — <Link to="/crm/leads" style={{ color: 'var(--color-accent)' }}>создать первый</Link>
                    </div>
                  ) : (
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
                        {topLeads.map((lead) => {
                          const stageColor = LEAD_STAGE_COLORS[lead.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
                          const stageLabel = LEAD_STAGE_LABELS[lead.stage as keyof typeof LEAD_STAGE_LABELS] ?? lead.stage
                          return (
                            <tr key={lead.id}>
                              <td>
                                <div className={styles.dealName}>{lead.title}</div>
                                {lead.source && <div className={styles.dealCo}>{lead.source}</div>}
                              </td>
                              <td className={styles.dealAmt}>{formatRubles(lead.amount)}</td>
                              <td>
                                <span
                                  className={styles.stagePill}
                                  style={{ color: stageColor, background: `color-mix(in srgb, ${stageColor} 12%, var(--color-bg))` }}
                                >
                                  {stageLabel}
                                </span>
                              </td>
                              <td>
                                <div className={styles.probRow}>
                                  <div className={styles.probTrack}>
                                    <div className={styles.probFill} style={{ width: `${lead.probability}%`, background: stageColor }} />
                                  </div>
                                  <span className={styles.probPct}>{lead.probability}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </div>

            <div className={styles.sideCol}>
              {/* AI Insights */}
              <AiInsightsCard
                leadCount={totalLeads}
                pipelineValue={totalAmount}
                conversionRate={conversionRate}
              />

              {/* Funnel — real data */}
              <Card padding="none">
                <div className={styles.cardTop}>
                  <CardHeader title="Воронка" description="Лиды по этапам" />
                  <Link to="/crm/leads" className={styles.viewAllLink}>
                    Все <ArrowRight size={12} />
                  </Link>
                </div>
                <div className={styles.funnelBody}>
                  {funnelData.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                      Нет данных о лидах
                    </div>
                  ) : funnelData.map((row) => (
                    <div key={row.stage} className={styles.funnelRow}>
                      <span className={styles.funnelLabel}>{row.stage}</span>
                      <div className={styles.funnelTrack}>
                        <div className={styles.funnelFill} style={{ width: `${row.pct}%`, background: row.color }} />
                      </div>
                      <span className={styles.funnelCount}>{row.count}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick actions */}
              <Card padding="md">
                <CardHeader title="Быстрые действия" />
                <div className={styles.quickActions}>
                  <button type="button" className={styles.qaItem} onClick={() => setContactFormOpen(true)}>
                    <span className={styles.qaIcon}><Users size={16} strokeWidth={1.75} /></span>
                    <span>Добавить контакт</span>
                  </button>
                  <button type="button" className={styles.qaItem} onClick={() => setLeadFormOpen(true)}>
                    <span className={styles.qaIcon}><Target size={16} strokeWidth={1.75} /></span>
                    <span>Создать лид</span>
                  </button>
                  <Link to="/catalog/products" className={styles.qaItem}>
                    <span className={styles.qaIcon}><Zap size={16} strokeWidth={1.75} /></span>
                    <span>Каталог товаров</span>
                  </Link>
                  <Link to="/crm/companies" className={styles.qaItem}>
                    <span className={styles.qaIcon}><TrendingUp size={16} strokeWidth={1.75} /></span>
                    <span>Компании</span>
                  </Link>
                </div>
              </Card>

              {/* Real activity feed */}
              <Card padding="none">
                <CardHeader title="Лента активности" description="Последние события в CRM" />
                <div className={styles.actList}>
                  {recentActivityItems.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                      Нет активностей — позвоните клиенту или создайте лид
                    </div>
                  ) : recentActivityItems.map((item) => {
                    const isCall  = item.kind.includes('phone') || item.kind.includes('call')
                    const isEmail = item.kind.includes('email')
                    const isComm  = item.type === 'communication'
                    const isWon   = item.kind.includes('won')
                    const isNew   = item.kind.includes('created')

                    const dotType = isCall ? 'call' : isEmail ? 'email' : isWon ? 'win' : isNew ? 'created' : 'deal'
                    const dotColor = isCall ? '#7c3aed' : isEmail ? '#0369a1' : isWon ? '#10b981' : isNew ? '#6366f1' : '#6b7280'

                    const subject = (item.payload.subject as string) ?? ''
                    const channel = (item.payload.channel as string) ?? ''
                    const label = isComm
                      ? (subject || (isCall ? 'Звонок' : isEmail ? 'Письмо' : `${channel}`))
                      : item.kind.replace(/_/g, ' ')

                    const entityLabel = item.entityType === 'contact' ? 'контакт' : item.entityType === 'lead' ? 'лид' : 'компания'

                    return (
                      <div key={item.id} className={styles.actItem}>
                        <ActivityDot type={dotType} color={dotColor} />
                        <div className={styles.actBody}>
                          <p className={styles.actText}>{label}</p>
                          <div className={styles.actMeta}>
                            <span className={styles.actUser}>
                              <span className={styles.actAvatar}>{entityLabel[0].toUpperCase()}</span>
                              {entityLabel} #{item.entityId}
                            </span>
                            <span className={styles.actTime}>{timeAgo(item.createdAt ?? '')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <LeadForm
        open={leadFormOpen}
        onClose={() => setLeadFormOpen(false)}
      />
      <ContactForm
        open={contactFormOpen}
        onClose={() => setContactFormOpen(false)}
      />
      <LogCommunicationModal
        open={communicationChannel !== null}
        channel={communicationChannel ?? 'phone'}
        onClose={() => setCommunicationChannel(null)}
      />
    </AppLayout>
  )
}
