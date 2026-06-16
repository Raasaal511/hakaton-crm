import { axiosAPI } from '../axios'

function normalizeList<T>(data: T[] | { items: T[]; total: number }) {
  return Array.isArray(data) ? { items: data, total: data.length } : data
}

export type CrmContact = {
  id: number
  organizationId: number
  companyId: number | null
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  position: string | null
  source: string | null
  status: string
  ownerUserId: number | null
  segmentId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CrmCompany = {
  id: number
  organizationId: number
  name: string
  industry: string | null
  website: string | null
  email: string | null
  phone: string | null
  city: string | null
  address: string | null
  employeesCount: number | null
  annualRevenue: number | null
  status: string
  ownerUserId: number | null
  segmentId: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type CrmLead = {
  id: number
  organizationId: number
  contactId: number | null
  companyId: number | null
  title: string
  description: string | null
  amount: number
  currency: string
  stage: string
  priority: string
  probability: number
  source: string | null
  responsibleUserId: number | null
  pipelineId: number | null
  columnId: number | null
  lostReason: string | null
  expectedCloseDate: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CrmSegment = {
  id: number
  organizationId: number
  name: string
  description: string | null
  color: string
  createdAt: string
  updatedAt: string
}

export type CrmLeadSource = {
  id: number
  organizationId: number
  name: string
  code: string | null
  color: string | null
  active: boolean
  createdAt: string
}

export type CrmDealStage = {
  id: number
  organizationId: number
  name: string
  code: string
  position: number
  probability: number
  color: string | null
  isWon: boolean
  isLost: boolean
  createdAt: string
  updatedAt: string
}

export type CrmDeal = {
  id: number
  organizationId: number
  leadId: number | null
  contactId: number | null
  companyId: number | null
  stageId: number | null
  title: string
  amount: number
  currency: string
  probability: number
  status: string
  source: string | null
  ownerUserId: number | null
  expectedCloseDate: string | null
  closedAt: string | null
  nextStep: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type DealStats = {
  totalDeals: number
  openAmount: number
  wonAmount: number
  weightedPipeline: number
}

export type CrmDocument = {
  id: number
  organizationId: number
  entityType: string
  entityId: number
  title: string
  kind: string
  fileName: string | null
  createdByUserId: number | null
  createdAt: string
}

export type CrmCommunication = {
  id: number
  organizationId: number
  entityType: string
  entityId: number
  channel: string
  direction: string
  subject: string | null
  body: string | null
  status: string
  actorUserId: number | null
  createdAt: string
}

export type AutomationRule = {
  id: number
  organizationId: number
  name: string
  description: string | null
  triggerType: string
  conditions: Record<string, unknown>
  actions: Record<string, unknown>[]
  active: boolean
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export type SalesQuote = {
  id: number
  organizationId: number
  dealId: number | null
  companyId: number | null
  contactId: number | null
  number: string
  status: string
  subtotal: number
  discount: number
  total: number
  currency: string
  validUntil: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export type SalesInvoice = {
  id: number
  organizationId: number
  dealId: number | null
  quoteId: number | null
  companyId: number | null
  contactId: number | null
  number: string
  status: string
  total: number
  paidAmount: number
  currency: string
  issuedAt: string | null
  dueAt: string | null
  paidAt: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export type KanbanBoard = Record<string, CrmLead[]>

export type LeadStats = {
  totalLeads: number
  totalAmount: number
  wonCount: number
  lostCount: number
  conversionRate: number
  byStage: { stage: string; count: number; amount: number }[]
}

export type CrmReportPeriod = '7d' | '30d' | '90d' | 'all'

export type CrmReportsResponse = {
  period: CrmReportPeriod
  range: { from: string | null; to: string }
  overview: {
    totalLeads: number
    totalAmount: number
    wonAmount: number
    wonCount: number
    lostCount: number
    conversionRate: number
    weightedPipeline: number
    contactCount: number
    companyCount: number
    newLeads: number
    newContacts: number
    newCompanies: number
  }
  funnel: {
    stage: string
    stageName: string
    color: string | null
    position: number
    count: number
    amount: number
    conversionFromPrev: number | null
  }[]
  trends: {
    leadsCreated: { date: string; count: number; amount: number }[]
    revenueWon: { date: string; amount: number }[]
  }
  byManager: {
    userId: number | null
    firstname: string
    lastname: string | null
    leadsCount: number
    wonCount: number
    totalAmount: number
    wonAmount: number
    conversionRate: number
  }[]
  bySource: { source: string; count: number; amount: number }[]
  contactsByStatus: { status: string; count: number }[]
  companiesByStatus: { status: string; count: number }[]
  sales: {
    quotesCount: number
    quotesAmount: number
    invoicesCount: number
    invoicesPaid: number
    invoicesOutstanding: number
  }
  communicationsByChannel: { channel: string; count: number }[]
}

export type CrmListFilter = {
  q?: string
  status?: string
  segmentId?: number
  ownerUserId?: number
  companyId?: number
  limit?: number
  offset?: number
}

export type LeadListFilter = CrmListFilter & {
  stage?: string
  priority?: string
  responsibleUserId?: number
}

export const crmAPI = {
  // Segments
  getSegments: (orgId: number) =>
    axiosAPI.get<CrmSegment[]>('/crm/segments', { params: { orgId } }).then((r) => r.data),

  createSegment: (orgId: number, dto: { name: string; description?: string; color?: string }) =>
    axiosAPI.post<CrmSegment>('/crm/segments', dto, { params: { orgId } }).then((r) => r.data),

  deleteSegment: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/segments/${id}`, { params: { orgId } }),

  // Contacts
  getContacts: (orgId: number, filter?: CrmListFilter) =>
    axiosAPI.get<CrmContact[] | { items: CrmContact[]; total: number }>('/crm/contacts', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  getContactById: (orgId: number, id: number) =>
    axiosAPI.get<CrmContact>(`/crm/contacts/${id}`, { params: { orgId } }).then((r) => r.data),

  createContact: (orgId: number, dto: Partial<CrmContact>) =>
    axiosAPI.post<CrmContact>('/crm/contacts', dto, { params: { orgId } }).then((r) => r.data),

  updateContact: (orgId: number, id: number, dto: Partial<CrmContact>) =>
    axiosAPI.put<CrmContact>(`/crm/contacts/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteContact: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/contacts/${id}`, { params: { orgId } }),

  // Companies
  getCompanies: (orgId: number, filter?: CrmListFilter) =>
    axiosAPI.get<CrmCompany[] | { items: CrmCompany[]; total: number }>('/crm/companies', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  getCompanyById: (orgId: number, id: number) =>
    axiosAPI.get<CrmCompany>(`/crm/companies/${id}`, { params: { orgId } }).then((r) => r.data),

  createCompany: (orgId: number, dto: Partial<CrmCompany>) =>
    axiosAPI.post<CrmCompany>('/crm/companies', dto, { params: { orgId } }).then((r) => r.data),

  updateCompany: (orgId: number, id: number, dto: Partial<CrmCompany>) =>
    axiosAPI.put<CrmCompany>(`/crm/companies/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteCompany: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/companies/${id}`, { params: { orgId } }),

  // Leads
  getLeads: (orgId: number, filter?: LeadListFilter) =>
    axiosAPI.get<CrmLead[] | { items: CrmLead[]; total: number }>('/crm/leads', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  getLeadById: (orgId: number, id: number) =>
    axiosAPI.get<CrmLead>(`/crm/leads/${id}`, { params: { orgId } }).then((r) => r.data),

  createLead: (orgId: number, dto: Partial<CrmLead>) =>
    axiosAPI.post<CrmLead>('/crm/leads', dto, { params: { orgId } }).then((r) => r.data),

  updateLead: (orgId: number, id: number, dto: Partial<CrmLead>) =>
    axiosAPI.put<CrmLead>(`/crm/leads/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  moveLead: (orgId: number, id: number, dto: { stage: string; columnId?: number | null; probability?: number; lostReason?: string }) =>
    axiosAPI.patch<CrmLead>(`/crm/leads/${id}/move`, dto, { params: { orgId } }).then((r) => r.data),

  deleteLead: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/leads/${id}`, { params: { orgId } }),

  getKanban: (orgId: number) =>
    axiosAPI.get<KanbanBoard>('/crm/leads/kanban', { params: { orgId } }).then((r) => r.data),

  getLeadStats: (orgId: number) =>
    axiosAPI.get<LeadStats>('/crm/leads/stats', { params: { orgId } }).then((r) => r.data),

  getLeadSources: (orgId: number) =>
    axiosAPI.get<CrmLeadSource[]>('/crm/lead-sources', { params: { orgId } }).then((r) => r.data),

  createLeadSource: (orgId: number, dto: { name: string; code?: string; color?: string }) =>
    axiosAPI.post<CrmLeadSource>('/crm/lead-sources', dto, { params: { orgId } }).then((r) => r.data),

  getDealStages: (orgId: number) =>
    axiosAPI.get<CrmDealStage[]>('/crm/deal-stages', { params: { orgId } }).then((r) => r.data),

  createDealStage: (orgId: number, dto: Partial<CrmDealStage> & { name: string }) =>
    axiosAPI.post<CrmDealStage>('/crm/deal-stages', dto, { params: { orgId } }).then((r) => r.data),

  updateDealStage: (orgId: number, id: number, dto: Partial<CrmDealStage>) =>
    axiosAPI.put<CrmDealStage>(`/crm/deal-stages/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  reorderDealStages: (orgId: number, order: { id: number; position: number }[]) =>
    axiosAPI.put<CrmDealStage[]>('/crm/deal-stages/reorder', { order }, { params: { orgId } }).then((r) => r.data),

  deleteDealStage: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/deal-stages/${id}`, { params: { orgId } }),

  getDeals: (orgId: number, filter?: CrmListFilter) =>
    axiosAPI.get<CrmDeal[] | { items: CrmDeal[]; total: number }>('/crm/deals', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  createDeal: (orgId: number, dto: Partial<CrmDeal> & { title: string }) =>
    axiosAPI.post<CrmDeal>('/crm/deals', dto, { params: { orgId } }).then((r) => r.data),

  getDealStats: (orgId: number) =>
    axiosAPI.get<DealStats>('/crm/deals/stats', { params: { orgId } }).then((r) => r.data),

  getReports: (orgId: number, period: CrmReportPeriod = '30d') =>
    axiosAPI.get<CrmReportsResponse>('/crm/reports', { params: { orgId, period } }).then((r) => r.data),

  getDocuments: (orgId: number, entityType: string, entityId: number) =>
    axiosAPI.get<CrmDocument[]>(`/crm/documents/${entityType}/${entityId}`, { params: { orgId } }).then((r) => r.data),

  createDocument: (orgId: number, dto: { entityType: string; entityId: number; title: string; kind?: string; fileName?: string; templateCode?: string; generatedPayload?: Record<string, unknown> }) =>
    axiosAPI.post<CrmDocument>('/crm/documents', dto, { params: { orgId } }).then((r) => r.data),

  getCommunications: (orgId: number, entityType: string, entityId: number) =>
    axiosAPI.get<CrmCommunication[]>(`/crm/communications/${entityType}/${entityId}`, { params: { orgId } }).then((r) => r.data),

  createCommunication: (orgId: number, dto: { entityType: string; entityId: number; channel: string; direction?: string; subject?: string; body?: string; status?: string }) =>
    axiosAPI.post<CrmCommunication>('/crm/communications', dto, { params: { orgId } }).then((r) => r.data),

  getAutomationRules: (orgId: number) =>
    axiosAPI.get<AutomationRule[]>('/crm/automation/rules', { params: { orgId } }).then((r) => r.data),

  createAutomationRule: (orgId: number, dto: { name: string; triggerType: string; description?: string; conditions?: Record<string, unknown>; actions?: Record<string, unknown>[]; active?: boolean }) =>
    axiosAPI.post<AutomationRule>('/crm/automation/rules', dto, { params: { orgId } }).then((r) => r.data),

  getQuotes: (orgId: number) =>
    axiosAPI.get<SalesQuote[]>('/crm/sales/quotes', { params: { orgId } }).then((r) => r.data),

  createQuote: (orgId: number, dto: Partial<SalesQuote> & { number: string }) =>
    axiosAPI.post<SalesQuote>('/crm/sales/quotes', dto, { params: { orgId } }).then((r) => r.data),

  updateQuote: (orgId: number, id: number, dto: Partial<SalesQuote>) =>
    axiosAPI.put<SalesQuote>(`/crm/sales/quotes/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteQuote: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/sales/quotes/${id}`, { params: { orgId } }),

  getInvoices: (orgId: number) =>
    axiosAPI.get<SalesInvoice[]>('/crm/sales/invoices', { params: { orgId } }).then((r) => r.data),

  createInvoice: (orgId: number, dto: Partial<SalesInvoice> & { number: string }) =>
    axiosAPI.post<SalesInvoice>('/crm/sales/invoices', dto, { params: { orgId } }).then((r) => r.data),

  updateInvoice: (orgId: number, id: number, dto: Partial<SalesInvoice>) =>
    axiosAPI.put<SalesInvoice>(`/crm/sales/invoices/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteInvoice: (orgId: number, id: number) =>
    axiosAPI.delete(`/crm/sales/invoices/${id}`, { params: { orgId } }),

  // Activity
  getActivity: (orgId: number, entityType: string, entityId: number) =>
    axiosAPI.get<{ items: unknown[] }>(`/crm/activity/${entityType}/${entityId}`, {
      params: { orgId },
    }).then((r) => r.data),

  getRecentActivity: (orgId: number, limit = 30) =>
    axiosAPI.get<{ items: RecentActivityItem[] }>('/crm/activity/recent', {
      params: { orgId, limit },
    }).then((r) => r.data),
}

export type RecentActivityItem = {
  type: 'activity' | 'communication'
  id: string
  kind: string
  entityType: string
  entityId: number
  payload: Record<string, unknown>
  actorUserId: number | null
  createdAt: string | null
}
