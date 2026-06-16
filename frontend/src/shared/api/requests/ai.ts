import { axiosAPI } from '../axios'

export type LeadScoreResult = {
  score: number
  confidence: 'high' | 'medium' | 'low'
  summary: string
  recommendations: string[]
  source?: 'deepseek' | 'local'
}

export type InsightResult = {
  insights: string[]
  nextAction: string
}

export type ContactEnrichResult = {
  suggestedSegment: string
  potentialValue: string
  engagementTip: string
}

export type EmailDraft = {
  subject: string
  body: string
}

export type AiStatus = {
  available: boolean
  model: string
  hasKey: boolean
}

export const aiAPI = {
  getStatus: () =>
    axiosAPI.get<AiStatus>('/ai/status').then((r) => r.data).catch(() => ({ available: false, model: 'local', hasKey: false } as AiStatus)),

  scoreLead: (data: {
    title: string
    amount?: number
    stage?: string
    priority?: string
    probability?: number
    source?: string | null
    description?: string | null
    daysSinceCreated?: number
  }) =>
    axiosAPI.post<LeadScoreResult>('/ai/lead-score', data).then((r) => r.data),

  getInsights: (entityType: 'lead' | 'contact' | 'company', data: Record<string, unknown>) =>
    axiosAPI.post<InsightResult>('/ai/insights', { entityType, data }).then((r) => r.data),

  enrichContact: (data: { firstName: string; lastName?: string | null; email?: string | null; position?: string | null; company?: string }) =>
    axiosAPI.post<ContactEnrichResult>('/ai/enrich-contact', data).then((r) => r.data),

  generateEmailDraft: (data: { recipientName: string; subject: string; purpose: string; senderName?: string }) =>
    axiosAPI.post<EmailDraft>('/ai/email-draft', data).then((r) => r.data),

  chat: (messages: { role: 'user' | 'assistant'; content: string }[], systemPrompt?: string) =>
    axiosAPI.post<{ content: string; source: 'deepseek' | 'local' }>('/ai/chat', { messages, systemPrompt }).then((r) => r.data),
}
