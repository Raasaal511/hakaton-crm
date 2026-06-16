export type CreateContactDTO = {
  companyId?: number | null
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  position?: string
  source?: string
  status?: string
  segmentId?: number | null
  notes?: string
}
export type UpdateContactDTO = Partial<CreateContactDTO>

export type CreateCompanyDTO = {
  name: string
  industry?: string
  website?: string
  email?: string
  phone?: string
  city?: string
  address?: string
  employeesCount?: number | null
  annualRevenue?: number | null
  status?: string
  segmentId?: number | null
  notes?: string
}
export type UpdateCompanyDTO = Partial<CreateCompanyDTO>

export type CreateLeadDTO = {
  contactId?: number | null
  companyId?: number | null
  title: string
  description?: string
  amount?: number
  currency?: string
  stage?: string
  priority?: string
  probability?: number
  source?: string
  responsibleUserId?: number | null
  pipelineId?: number | null
  columnId?: number | null
  expectedCloseDate?: string | null
}
export type UpdateLeadDTO = Partial<CreateLeadDTO> & {
  lostReason?: string
}

export type MoveLeadDTO = {
  stage: string
  columnId?: number | null
  probability?: number
  lostReason?: string
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
  pipelineId?: number
}

export type CreateSegmentDTO = {
  name: string
  description?: string
  color?: string
}

export type CrmReportPeriod = '7d' | '30d' | '90d' | 'all'

export type CrmReports = {
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
