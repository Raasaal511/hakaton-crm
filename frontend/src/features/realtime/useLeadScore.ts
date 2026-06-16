import { useQuery } from '@tanstack/react-query'
import { aiAPI } from 'shared/api/requests/ai'
import type { CrmLead } from 'shared/api/requests/crm'

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export function useLeadScore(lead: CrmLead | null) {
  return useQuery({
    queryKey: ['ai', 'lead-score', lead?.id, lead?.updatedAt],
    queryFn: () => aiAPI.scoreLead({
      title: lead!.title,
      amount: lead!.amount,
      stage: lead!.stage,
      priority: lead!.priority,
      probability: lead!.probability,
      source: lead!.source,
      description: lead!.description,
      daysSinceCreated: daysSince(lead!.createdAt),
    }),
    enabled: Boolean(lead),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  })
}
