/**
 * Builds AiContext from TanStack Query cache and/or live fetches.
 * Scans all cached lead queries (any filter) so AI sees data from LeadsPage too.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryClient } from 'shared/api/queryClient'
import { qk } from 'shared/api/queryKeys'
import { crmAPI, type CrmLead, type LeadStats } from 'shared/api/requests/crm'
import { formatRubles } from 'shared/lib/crmDemoData'
import type { AiContext, AiLeadSummary } from './aiTemplates'

type LeadsList = { items: CrmLead[]; total: number }

function toLeadSummary(lead: CrmLead): AiLeadSummary {
  return {
    title: lead.title,
    stage: lead.stage,
    amount: lead.amount,
    priority: lead.priority,
    probability: lead.probability,
  }
}

function getCachedLeadsList(orgId: number): LeadsList | undefined {
  const entries = queryClient.getQueriesData<LeadsList>({
    queryKey: ['crm', orgId, 'leads'],
  })

  let best: LeadsList | undefined
  for (const [, data] of entries) {
    if (!data?.items?.length) continue
    if (!best || data.items.length > best.items.length) {
      best = {
        items: data.items,
        total: data.total ?? data.items.length,
      }
    }
  }
  return best
}

function getCachedContactsTotal(orgId: number): number | undefined {
  const entries = queryClient.getQueriesData<{ total?: number }>({
    queryKey: ['crm', orgId, 'contacts'],
  })

  for (const [, data] of entries) {
    if (data?.total != null) return data.total
  }
  return undefined
}

function deriveStatsFromLeads(items: CrmLead[]): Pick<LeadStats, 'totalLeads' | 'totalAmount' | 'byStage' | 'wonCount' | 'conversionRate'> {
  const byStageMap = new Map<string, { count: number; amount: number }>()
  let totalAmount = 0

  for (const lead of items) {
    totalAmount += lead.amount
    const row = byStageMap.get(lead.stage) ?? { count: 0, amount: 0 }
    row.count += 1
    row.amount += lead.amount
    byStageMap.set(lead.stage, row)
  }

  const byStage = [...byStageMap.entries()].map(([stage, { count, amount }]) => ({ stage, count, amount }))
  const wonCount = byStageMap.get('won')?.count ?? 0
  const lostCount = byStageMap.get('lost')?.count ?? 0
  const closed = wonCount + lostCount

  return {
    totalLeads: items.length,
    totalAmount,
    byStage,
    wonCount,
    conversionRate: closed > 0 ? wonCount / closed : 0,
  }
}

export type BuildAiContextOptions = Partial<AiContext> & {
  leadStats?: LeadStats | null
  leadsList?: LeadsList | null
  contactCount?: number | null
}

export function buildAiContext(orgId?: number, options: BuildAiContextOptions = {}): AiContext {
  const cachedLeadStats = orgId
    ? (queryClient.getQueryData(qk.crmLeadStats(orgId)) as LeadStats | undefined)
    : undefined

  const cachedLeads = orgId ? getCachedLeadsList(orgId) : undefined
  const cachedContactsTotal = orgId ? getCachedContactsTotal(orgId) : undefined

  const leadStats = options.leadStats ?? cachedLeadStats
  const leadsList = options.leadsList ?? cachedLeads
  const derivedStats = !leadStats && leadsList?.items.length
    ? deriveStatsFromLeads(leadsList.items)
    : undefined

  const leadCount = leadStats?.totalLeads ?? derivedStats?.totalLeads ?? leadsList?.total ?? 0
  const contactCount = options.contactCount ?? cachedContactsTotal ?? 0
  const totalAmount = leadStats?.totalAmount ?? derivedStats?.totalAmount ?? 0
  const byStage = leadStats?.byStage ?? derivedStats?.byStage ?? []
  const wonAmount = byStage.find((s) => s.stage === 'won')?.amount ?? 0
  const conversionRate = leadStats?.conversionRate ?? derivedStats?.conversionRate ?? 0

  const sortedLeads = [...(leadsList?.items ?? [])].sort((a, b) => b.amount - a.amount)
  const topLead = sortedLeads[0]
  const leads = sortedLeads.slice(0, 30).map(toLeadSummary)

  const defaults: AiContext = {
    leadCount,
    dealCount: leadCount,
    contactCount,
    topDealTitle: topLead?.title ?? (leadCount > 0 ? 'Сделка без названия' : 'Нет активных сделок'),
    topDealAmount: topLead ? formatRubles(topLead.amount) : '—',
    pipelineValue: formatRubles(totalAmount),
    wonAmount: formatRubles(wonAmount),
    conversionRate: `${Math.round(conversionRate * 100)}%`,
    orgName: 'Meridian',
    managerName: 'Менеджер',
    leads,
  }

  const { leadStats: _s, leadsList: _l, contactCount: _c, ...overrides } = options
  return { ...defaults, ...overrides }
}

/** Загружает CRM-данные для AI и возвращает актуальный контекст */
export function useAiContext(
  orgId?: number,
  meta?: { orgName?: string; managerName?: string; enabled?: boolean },
): { ctx: AiContext; isReady: boolean } {
  const enabled = meta?.enabled !== false && Boolean(orgId)

  const leadStatsQuery = useQuery({
    queryKey: qk.crmLeadStats(orgId!),
    queryFn: () => crmAPI.getLeadStats(orgId!),
    enabled,
    staleTime: 60_000,
  })

  const leadsListQuery = useQuery({
    queryKey: qk.crmLeads(orgId!, { ai: true, limit: 50 }),
    queryFn: () => crmAPI.getLeads(orgId!, { limit: 50 }),
    enabled,
    staleTime: 60_000,
  })

  const contactsQuery = useQuery({
    queryKey: qk.crmContacts(orgId!, { limit: 1 }),
    queryFn: () => crmAPI.getContacts(orgId!, { limit: 1 }),
    enabled,
    staleTime: 60_000,
  })

  const ctx = useMemo(
    () => buildAiContext(orgId, {
      leadStats: leadStatsQuery.data,
      leadsList: leadsListQuery.data,
      contactCount: contactsQuery.data?.total,
      orgName: meta?.orgName,
      managerName: meta?.managerName,
    }),
    [orgId, leadStatsQuery.data, leadsListQuery.data, contactsQuery.data?.total, meta?.orgName, meta?.managerName],
  )

  const isReady = !enabled || (leadStatsQuery.isFetched && leadsListQuery.isFetched)

  return { ctx, isReady }
}
