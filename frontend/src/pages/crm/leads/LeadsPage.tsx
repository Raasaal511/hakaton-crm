import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Columns,
  List,
  Target,
  CircleDollarSign,
  Trash2,
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
import { LEAD_STAGE_COLORS, PRIORITY_COLORS, formatRubles } from 'shared/lib/crmDemoData'
import { LeadForm } from 'features/crm/LeadForm'
import { LeadsKanbanBoard } from 'features/crm/leads/LeadsKanbanBoard'
import { useLeadScore } from 'features/realtime/useLeadScore'
import styles from './LeadsPage.module.css'

function scoreColor(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 45) return '#f59e0b'
  return '#ef4444'
}

function AiScoreBadge({ lead }: { lead: CrmLead }) {
  const { data, isLoading } = useLeadScore(lead)
  const score = data?.score ?? 0
  const color = scoreColor(score)

  if (isLoading) {
    return (
      <span className={styles.aiScoreBadge} style={{ color: '#6b7280', background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}>
        <Loader2 size={9} className={styles.spin} />
        AI
      </span>
    )
  }

  return (
    <span
      className={styles.aiScoreBadge}
      style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))`, borderColor: `color-mix(in srgb, ${color} 25%, transparent)` }}
      title={`AI Score: ${score}\n${data?.summary ?? ''}`}
    >
      <Sparkles size={9} />
      {score}
    </span>
  )
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Высокий',
  medium: 'Средний',
  low: 'Низкий',
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editLead, setEditLead] = useState<CrmLead | null>(null)
  const [defaultStage, setDefaultStage] = useState<string | undefined>()
  const org = organizationModel.selectors.useCurrentOrganization()
  const orgId = org?.id ?? 0
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: qk.crmLeads(orgId, { limit: 500 }),
    queryFn: () => crmAPI.getLeads(orgId, { limit: 500 }),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })

  const { data: dealStats } = useQuery({
    queryKey: qk.crmDealStats(orgId),
    queryFn: () => crmAPI.getDealStats(orgId),
    enabled: Boolean(orgId),
    staleTime: 30_000,
  })

  const { data: dealStages = [] } = useQuery({
    queryKey: qk.crmDealStages(orgId),
    queryFn: () => crmAPI.getDealStages(orgId),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: companiesData } = useQuery({
    queryKey: qk.crmCompanies(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getCompanies(orgId, { limit: 200 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: contactsData } = useQuery({
    queryKey: qk.crmContacts(orgId, { limit: 200 }),
    queryFn: () => crmAPI.getContacts(orgId, { limit: 200 }),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const { data: leadSources = [] } = useQuery({
    queryKey: qk.crmLeadSources(orgId),
    queryFn: () => crmAPI.getLeadSources(orgId),
    enabled: Boolean(orgId),
    staleTime: 60_000,
  })

  const stageLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of dealStages) map.set(s.code, s.name)
    return map
  }, [dealStages])

  const stageColorMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of dealStages) map.set(s.code, s.color ?? '#6366f1')
    return map
  }, [dealStages])

  const leads = useMemo(() => data?.items ?? [], [data])

  const filtered = useMemo(() =>
    leads.filter((l) => {
      const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase())
      const matchStage = stageFilter === 'all' || l.stage === stageFilter
      return matchSearch && matchStage
    }), [leads, search, stageFilter])

  const byStage = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of filtered) map.set(l.stage, (map.get(l.stage) ?? 0) + 1)
    return map
  }, [filtered])

  const totalAmount = filtered.reduce((s, l) => s + l.amount, 0)

  const tableData = useMemo(() =>
    filtered.map((l) => ({ ...l, id: String(l.id) })),
    [filtered])

  function openCreate(stageCode?: string) {
    setEditLead(null)
    setDefaultStage(stageCode)
    setFormOpen(true)
  }

  function openEdit(lead: CrmLead) {
    setEditLead(lead)
    setDefaultStage(undefined)
    setFormOpen(true)
  }

  const tableColumns: ColumnDef<(typeof tableData)[0]>[] = [
    {
      key: 'title',
      header: 'Сделка',
      renderCell: (row) => (
        <div>
          <div className={styles.dealTitle}>{row.title}</div>
          {row.description && <div className={styles.dealDesc}>{row.description.slice(0, 60)}</div>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Сумма',
      renderCell: (row) => <span className={styles.amountCell}>{formatRubles(row.amount)}</span>,
    },
    {
      key: 'stage',
      header: 'Этап',
      renderCell: (row) => {
        const color = stageColorMap.get(row.stage) ?? LEAD_STAGE_COLORS[row.stage as keyof typeof LEAD_STAGE_COLORS] ?? '#6b7280'
        const label = stageLabelMap.get(row.stage) ?? row.stage
        return (
          <span className={styles.stagePill} style={{ color, background: `color-mix(in srgb, ${color} 12%, var(--color-bg))` }}>
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
      renderCell: (row) => {
        const color = stageColorMap.get(row.stage) ?? '#6b7280'
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
    ...(stageFilter !== 'all'
      ? [{ id: 'stage', label: 'Этап', value: stageLabelMap.get(stageFilter) ?? stageFilter }]
      : []),
    ...(search ? [{ id: 'search', label: 'Поиск', value: search }] : []),
  ]

  const stageTabs = [
    { id: 'all', label: 'Все этапы', count: filtered.length },
    ...dealStages.map((s) => ({
      id: s.code,
      label: s.name,
      count: byStage.get(s.code) ?? 0,
    })),
  ]

  if (!orgId) {
    return (
      <AppLayout>
        <div className={styles.page}>
          <PageHeader title="Лиды и сделки" breadcrumb={[{ label: 'CRM' }]} />
          <div className={styles.noOrgHint}>Выберите организацию, чтобы просмотреть лиды.</div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Лиды и сделки"
          breadcrumb={[{ label: 'CRM' }]}
          description={`${isLoading ? '...' : (data?.total ?? 0)} лидов · ${formatRubles(dealStats?.weightedPipeline ?? totalAmount)} weighted pipeline · ${dealStages.length} этапов`}
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
              <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => openCreate()}>
                Новый лид
              </Button>
            </>
          }
          tabs={view === 'table' ? stageTabs : undefined}
          activeTab={view === 'table' ? stageFilter : undefined}
          onTabChange={(id) => setStageFilter(id)}
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
              <div className={styles.summarySeparator} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Поиск..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <LeadsKanbanBoard
              orgId={orgId}
              stages={dealStages}
              leads={filtered}
              companies={companiesData?.items ?? []}
              contacts={contactsData?.items ?? []}
              loading={isLoading}
              onAddLead={openCreate}
              onEditLead={openEdit}
            />
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <DataTable
              columns={tableColumns}
              data={tableData}
              loading={isLoading}
              onRowClick={(row) => {
                const lead = filtered.find((l) => String(l.id) === row.id)
                if (lead) openEdit(lead)
              }}
              bulkActions={[
                {
                  id: 'delete',
                  label: 'Удалить',
                  icon: <Trash2 size={13} />,
                  variant: 'danger',
                  onClick: (ids) => {
                    Promise.all(ids.map((id) => crmAPI.deleteLead(orgId, Number(id))))
                      .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['crm', orgId, 'leads'] })
                        queryClient.invalidateQueries({ queryKey: qk.crmLeadStats(orgId) })
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
        onClose={() => { setFormOpen(false); setEditLead(null); setDefaultStage(undefined) }}
        existing={editLead}
        defaultStage={defaultStage}
        stages={dealStages}
      />
    </AppLayout>
  )
}
