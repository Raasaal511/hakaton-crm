/**
 * Builds an AiContext from live TanStack Query cache.
 * Falls back to reasonable defaults if data isn't loaded yet.
 */
import { queryClient } from 'shared/api/queryClient'
import { qk } from 'shared/api/queryKeys'
import { formatRubles } from 'shared/lib/crmDemoData'
import type { AiContext } from './aiTemplates'

export function buildAiContext(orgId?: number, overrides?: Partial<AiContext>): AiContext {
  const qc = queryClient

  // Try to read from TanStack cache (already fetched by pages)
  const leadStats = orgId
    ? (qc.getQueryData(qk.crmLeadStats(orgId)) as {
        totalLeads: number
        totalAmount: number
        conversionRate: number
        byStage: { stage: string; count: number; amount: number }[]
        wonCount: number
      } | undefined)
    : undefined

  const contactsData = orgId
    ? (qc.getQueryData(qk.crmContacts(orgId, { limit: 1 })) as { total?: number } | undefined)
    : undefined

  const leadsData = orgId
    ? (qc.getQueryData(qk.crmLeads(orgId, { limit: 10 })) as {
        items?: { title: string; amount: number }[]
      } | undefined)
    : undefined

  // Derive values from cache or use fallbacks
  const leadCount = leadStats?.totalLeads ?? 0
  const contactCount = contactsData?.total ?? 0
  const totalAmount = leadStats?.totalAmount ?? 0
  const wonAmount = leadStats?.byStage?.find((s) => s.stage === 'won')?.amount ?? 0
  const conversionRate = leadStats?.conversionRate ?? 0
  const topLead = leadsData?.items?.sort((a, b) => b.amount - a.amount)[0]

  const defaults: AiContext = {
    leadCount,
    dealCount: leadCount,
    contactCount,
    topDealTitle: topLead?.title ?? 'Нет активных сделок',
    topDealAmount: topLead ? formatRubles(topLead.amount) : '—',
    pipelineValue: formatRubles(totalAmount),
    wonAmount: formatRubles(wonAmount),
    conversionRate: `${Math.round(conversionRate * 100)}%`,
    orgName: 'Meridian',
    managerName: 'Алексей Петров',
  }

  return { ...defaults, ...overrides }
}
