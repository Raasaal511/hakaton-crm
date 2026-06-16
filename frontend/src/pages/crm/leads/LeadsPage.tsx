import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Columns,
  List,
  Target,
  CircleDollarSign,
  Trash2,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { FilterBar } from 'shared/ui/FilterBar/FilterBar'
import { DataTable, type ColumnDef } from 'shared/ui/DataTable/DataTable'
import { organizationModel } from 'entities/organization'
import { crmAPI, type CrmLead } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { LEAD_STAGE_LABELS, LEAD_STAGE_COLORS, PRIORITY_COLORS, formatRubles } from 'shared/lib/crmDemoData'
import { LeadForm } from 'features/crm/LeadForm'
import { useLeadScore } from 'features/realtime/useLeadScore'
import styles from './LeadsPage.module.css'

function scoreColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function AiScoreBadge({ lead }: { lead: CrmLead }) {
  const { data, isLoading } = useLeadScore(lead)
  const [displayed, setDisplayed] = useState(0)
  const score = data?.score ?? 0
  const color = scoreColor(score)
  const isDeepSeek = data?.source === 'deepseek'

  useEffect(() => {
    if (!score) return
    let start = 0
    const step = Math.ceil(score / 20)
    const timer = setInterval(() => {
      start += step
      if (start >= score) { setDisplayed(score); clearInterval(timer) }
      else setDisplayed(start)
    }, 30)
    return () => clearInterval(timer)
  }, [score])

  if (isLoading) {
    return (
      <span className={styles.aiScoreBadge} style={{ color: '#6b7280', background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
        <Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} />
        AI
      </span>
    )
  }

  return (
    <span
      className={styles.aiScoreBadge}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))`, borderColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
      title={`AI Score: ${score}${isDeepSeek ? ' (DeepSeek)' : ' (local)'}\n${data?.summary ?? ''}`}
    >
      <Sparkles size={9} />
      {displayed}
    </span>
  )
}

type LeadStage = 'new' | 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost'
const STAGES: LeadStage[] = ['new', 'qualification', 'proposal', 'negotiation', 'won', 'lost']

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

function KanbanCard({ lead }: { lead: CrmLead }) {
  const stageColor = LEAD_STAGE_COLORS[lead.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
  const priorityColor = PRIORITY_COLORS[lead.priority as keyof typeof PRIORITY_COLORS] ?? '#6b7280'
  return (
    <div className={styles.kanbanCard}>
      <div className={styles.kanbanCardTop}>
        <span className={styles.kanbanCardTitle}>{lead.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AiScoreBadge lead={lead} />
          <span
            className={styles.priorityDot}
            style={{ background: priorityColor }}
            title={`Приоритет: ${lead.priority}`}
          />
        </div>
      </div>
      {lead.source && (
        <div className={styles.kanbanCardSource}>
          <Target size={10} />
          {lead.source}
        </div>
      )}
      <div className={styles.kanbanCardFooter}>
        <span className={styles.kanbanCardAmount}>{formatRubles(lead.amount)}</span>
        <span className={styles.probBadge} style={{ color: stageColor, background: `color-mix(in srgb, ${stageColor} 12%, var(--color-bg))` }}>
          {lead.probability}%
        </span>
      </div>
    </div>
  )
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [stageFilter, setStageFilter] = useState<LeadStage | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editLead, setEditLead] = useState<CrmLead | null>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: qk.crmLeads(org?.id ?? 0, { limit: 500 }),
    queryFn: () => crmAPI.getLeads(org!.id, { limit: 500 }),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: dealStats } = useQuery({
    queryKey: qk.crmDealStats(org?.id ?? 0),
    queryFn: () => crmAPI.getDealStats(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: dealStages = [] } = useQuery({
    queryKey: qk.crmDealStages(org?.id ?? 0),
    queryFn: () => crmAPI.getDealStages(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 60_000,
  })

  const { data: leadSources = [] } = useQuery({
    queryKey: qk.crmLeadSources(org?.id ?? 0),
    queryFn: () => crmAPI.getLeadSources(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 60_000,
  })

  const leads = useMemo(() => data?.items ?? [], [data])

  const filtered = useMemo(() =>
    leads.filter((l) => {
      const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase())
      const matchStage = stageFilter === 'all' || l.stage === stageFilter
      return matchSearch && matchStage
    }), [leads, search, stageFilter])

  const byStage = useMemo(() => {
    const map: Record<LeadStage, CrmLead[]> = {
      new: [], qualification: [], proposal: [], negotiation: [], won: [], lost: [],
    }
    filtered.forEach((l) => {
      const stage = l.stage as LeadStage
      if (map[stage]) map[stage].push(l)
    })
    return map
  }, [filtered])

  const totalAmount = filtered.reduce((s, l) => s + l.amount, 0)

  const tableData = useMemo(() =>
    filtered.map((l) => ({ ...l, id: String(l.id) })),
    [filtered])

  const tableColumns: ColumnDef<(typeof tableData)[0]>[] = [
    {
      key: 'title',
      header: 'Сделка',
      sortable: true,
      renderCell: (row) => (
        <div>
          <div className={styles.dealTitle}>{row.title}</div>
          {row.description && (
            <div className={styles.dealDesc}>{row.description.slice(0, 60)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Сумма',
      sortable: true,
      renderCell: (row) => (
        <span className={styles.amountCell}>{formatRubles(row.amount)}</span>
      ),
    },
    {
      key: 'stage',
      header: 'Этап',
      renderCell: (row) => {
        const color = LEAD_STAGE_COLORS[row.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
        const label = LEAD_STAGE_LABELS[row.stage as keyof typeof LEAD_STAGE_LABELS] ?? row.stage
        return (
          <span
            className={styles.stagePill}
            style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))` }}
          >
            {label}
          </span>
        )
      },
    },
    {
      key: 'priority',
      header: 'Приоритет',
      renderCell: (row) => {
        const color = PRIORITY_COLORS[row.priority as keyof typeof PRIORITY_COLORS] ?? '#6b7280'
        return (
          <div className={styles.priorityCell}>
            <span className={styles.priorityDot} style={{ background: color }} />
            {PRIORITY_LABELS[row.priority] ?? row.priority}
          </div>
        )
      },
    },
    {
      key: 'probability',
      header: 'Вероятность',
      sortable: true,
      renderCell: (row) => {
        const color = LEAD_STAGE_COLORS[row.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
        return (
          <div className={styles.probRow}>
            <div className={styles.probTrack}>
              <div className={styles.probFill} style={{ width: `${row.probability}%`, background: color }} />
            </div>
            <span className={styles.probPct}>{row.probability}%</span>
          </div>
        )
      },
    },
    {
      key: 'id',
      header: 'AI Score',
      renderCell: (row) => {
        const lead = filtered.find((l) => String(l.id) === row.id)
        if (!lead) return null
        return <AiScoreBadge lead={lead} />
      },
    },
  ]

  const activeChips = [
    ...(stageFilter !== 'all' ? [{ id: 'stage', label: 'Этап', value: LEAD_STAGE_LABELS[stageFilter] ?? stageFilter }] : []),
    ...(search ? [{ id: 'search', label: 'Поиск', value: search }] : []),
  ]

  const stageTabs = [
    { id: 'all', label: 'Все этапы', count: filtered.length },
    ...STAGES.map((s) => ({
      id: s,
      label: LEAD_STAGE_LABELS[s],
      count: byStage[s].length,
    })),
  ]

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Лиды и сделки"
          breadcrumb={[{ label: 'CRM' }]}
          description={`${isLoading ? '...' : (data?.total ?? 0)} лидов · ${formatRubles(dealStats?.weightedPipeline ?? totalAmount)} weighted pipeline · ${dealStages.length || STAGES.length} этапов`}
          actions={
            <>
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'kanban' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('kanban')}
                  title="Воронка"
                >
                  <Columns size={14} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('table')}
                  title="Таблица"
                >
                  <List size={14} strokeWidth={1.75} />
                </button>
              </div>
              <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditLead(null); setFormOpen(true) }}>
                Новый лид
              </Button>
            </>
          }
          tabs={view === 'table' ? stageTabs : undefined}
          activeTab={view === 'table' ? stageFilter : undefined}
          onTabChange={(id) => setStageFilter(id as LeadStage | 'all')}
        />

        {view === 'table' && (
          <FilterBar
            chips={activeChips}
            onRemoveChip={(id) => {
              if (id === 'stage') setStageFilter('all')
              if (id === 'search') setSearch('')
            }}
            onClearAll={() => { setStageFilter('all'); setSearch('') }}
            totalCount={data?.total}
            filteredCount={filtered.length}
          >
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Поиск по лидам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FilterBar>
        )}

        {view === 'kanban' ? (
          <div className={styles.kanbanWrap}>
            {/* Stage totals summary bar */}
            <div className={styles.stageSummary}>
              <div className={styles.summaryTotal}>
                <CircleDollarSign size={15} strokeWidth={1.75} />
                <span>{formatRubles(totalAmount)}</span>
                <span className={styles.summaryLabel}>в работе</span>
              </div>
              <div className={styles.summarySeparator} />
              <div className={styles.summaryStats}>
                <TrendingUp size={13} strokeWidth={1.75} />
                <span>{formatRubles(dealStats?.wonAmount ?? 0)} выиграно</span>
              </div>
              <div className={styles.summarySeparator} />
              <div className={styles.summaryStats}>
                <Target size={13} strokeWidth={1.75} />
                <span>{leadSources.length} источников</span>
              </div>
            </div>

            <div className={styles.kanban}>
              {STAGES.map((stage) => {
                const stageLeads = byStage[stage]
                const stageColor = LEAD_STAGE_COLORS[stage]
                const stageSum = stageLeads.reduce((s, l) => s + l.amount, 0)
                return (
                  <div key={stage} className={styles.kanbanColumn}>
                    <div className={styles.columnHeader} style={{ '--col-color': stageColor } as React.CSSProperties}>
                      <div className={styles.columnTitleRow}>
                        <span className={styles.columnDot} style={{ background: stageColor }} />
                        <span className={styles.columnTitle}>{LEAD_STAGE_LABELS[stage]}</span>
                        <span className={styles.columnCount}>{stageLeads.length}</span>
                      </div>
                      {stageSum > 0 && (
                        <span className={styles.columnSum}>{formatRubles(stageSum)}</span>
                      )}
                    </div>

                    <div className={styles.columnCards}>
                      {stageLeads.map((lead) => (
                        <KanbanCard key={lead.id} lead={lead} />
                      ))}
                      {stageLeads.length === 0 && !isLoading && (
                        <div className={styles.columnEmpty}>
                          <ArrowRight size={14} className={styles.columnEmptyIcon} />
                          Нет лидов
                        </div>
                      )}
                    </div>

                    <button type="button" className={styles.addCardBtn}>
                      <Plus size={13} />
                      Добавить
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <DataTable
              columns={tableColumns}
              data={tableData}
              loading={isLoading}
              bulkActions={[
                {
                  id: 'delete',
                  label: 'Удалить',
                  icon: <Trash2 size={13} />,
                  variant: 'danger',
                  onClick: (ids) => {
                Promise.all(ids.map((id) => crmAPI.deleteLead(org!.id, Number(id))))
                  .then(() => {
                    queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'leads'] })
                    queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'lead-stats'] })
                  })
              },
                },
              ]}
            />
          </div>
        )}
      </div>

      <LeadForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditLead(null) }}
        existing={editLead}
      />
    </AppLayout>
  )
}
