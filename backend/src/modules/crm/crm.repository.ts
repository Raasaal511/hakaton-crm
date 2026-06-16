import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import type { DB } from '../../infra/database/drizzle/client.js'
import {
  crmContactsSchema,
  crmCompaniesSchema,
  crmLeadsSchema,
  crmLeadSourcesSchema,
  crmDealStagesSchema,
  crmDealsSchema,
  crmDocumentsSchema,
  crmCommunicationsSchema,
  automationRulesSchema,
  salesQuotesSchema,
  salesInvoicesSchema,
  crmActivitySchema,
  crmSegmentsSchema,
  usersSchema,
  CrmContact,
  CrmCompany,
  CrmLead,
  CrmDeal,
  CrmDealStage,
  CrmLeadSource,
  CrmDocument,
  CrmCommunication,
  AutomationRule,
  SalesQuote,
  SalesInvoice,
} from '../../infra/database/drizzle/schema.js'
import { eq, and, isNull, ilike, desc, count, sql, or, gte, lte } from 'drizzle-orm'
import type {
  CreateContactDTO,
  UpdateContactDTO,
  CreateCompanyDTO,
  UpdateCompanyDTO,
  CreateLeadDTO,
  UpdateLeadDTO,
  MoveLeadDTO,
  CrmListFilter,
  LeadListFilter,
  CreateSegmentDTO,
  CrmReports,
} from './crm.types.js'

@injectable()
export class CrmRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  // ---------------------------------------------------------------------------
  // Segments
  // ---------------------------------------------------------------------------

  async findAllSegments(orgId: number) {
    return this.db
      .select()
      .from(crmSegmentsSchema)
      .where(eq(crmSegmentsSchema.organizationId, orgId))
      .orderBy(crmSegmentsSchema.name)
  }

  async createSegment(orgId: number, dto: CreateSegmentDTO) {
    const [row] = await this.db
      .insert(crmSegmentsSchema)
      .values({
        organizationId: orgId,
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? '#4361ee',
      })
      .returning()
    return row!
  }

  async deleteSegment(orgId: number, id: number): Promise<boolean> {
    const result = await this.db
      .delete(crmSegmentsSchema)
      .where(and(eq(crmSegmentsSchema.id, id), eq(crmSegmentsSchema.organizationId, orgId)))
      .returning({ id: crmSegmentsSchema.id })
    return result.length > 0
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  private contactFilterConditions(orgId: number, filter: CrmListFilter = {}) {
    const conditions = [
      eq(crmContactsSchema.organizationId, orgId),
      isNull(crmContactsSchema.deletedAt),
    ]

    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(
        or(
          ilike(crmContactsSchema.firstName, pattern),
          ilike(crmContactsSchema.lastName, pattern),
          ilike(crmContactsSchema.email, pattern),
          ilike(crmContactsSchema.phone, pattern),
        )!,
      )
    }
    if (filter.status) {
      conditions.push(eq(crmContactsSchema.status, filter.status))
    }
    if (filter.segmentId) {
      conditions.push(eq(crmContactsSchema.segmentId, filter.segmentId))
    }
    if (filter.ownerUserId) {
      conditions.push(eq(crmContactsSchema.ownerUserId, filter.ownerUserId))
    }
    if (filter.companyId) {
      conditions.push(eq(crmContactsSchema.companyId, filter.companyId))
    }

    return conditions
  }

  async findAllContacts(orgId: number, filter: CrmListFilter = {}) {
    const conditions = this.contactFilterConditions(orgId, filter)
    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    return this.db
      .select()
      .from(crmContactsSchema)
      .where(and(...conditions))
      .orderBy(desc(crmContactsSchema.createdAt))
      .limit(limit)
      .offset(offset)
  }

  async findContactById(orgId: number, id: number): Promise<CrmContact | null> {
    const rows = await this.db
      .select()
      .from(crmContactsSchema)
      .where(
        and(
          eq(crmContactsSchema.id, id),
          eq(crmContactsSchema.organizationId, orgId),
          isNull(crmContactsSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async createContact(orgId: number, ownerUserId: number, dto: CreateContactDTO): Promise<CrmContact> {
    const [row] = await this.db
      .insert(crmContactsSchema)
      .values({
        organizationId: orgId,
        ownerUserId,
        companyId: dto.companyId ?? null,
        firstName: dto.firstName,
        lastName: dto.lastName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        position: dto.position ?? null,
        source: dto.source ?? null,
        status: dto.status ?? 'active',
        segmentId: dto.segmentId ?? null,
        notes: dto.notes ?? null,
      })
      .returning()
    return row!
  }

  async updateContact(orgId: number, id: number, dto: UpdateContactDTO): Promise<CrmContact | null> {
    const patch: Partial<typeof crmContactsSchema.$inferInsert> = {}
    if (dto.companyId !== undefined) patch.companyId = dto.companyId
    if (dto.firstName !== undefined) patch.firstName = dto.firstName
    if (dto.lastName !== undefined) patch.lastName = dto.lastName
    if (dto.email !== undefined) patch.email = dto.email
    if (dto.phone !== undefined) patch.phone = dto.phone
    if (dto.position !== undefined) patch.position = dto.position
    if (dto.source !== undefined) patch.source = dto.source
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.segmentId !== undefined) patch.segmentId = dto.segmentId
    if (dto.notes !== undefined) patch.notes = dto.notes

    const rows = await this.db
      .update(crmContactsSchema)
      .set(patch)
      .where(
        and(
          eq(crmContactsSchema.id, id),
          eq(crmContactsSchema.organizationId, orgId),
          isNull(crmContactsSchema.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async deleteContact(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(crmContactsSchema)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmContactsSchema.id, id),
          eq(crmContactsSchema.organizationId, orgId),
          isNull(crmContactsSchema.deletedAt),
        ),
      )
      .returning({ id: crmContactsSchema.id })
    return rows.length > 0
  }

  async countContacts(orgId: number, filter: CrmListFilter = {}): Promise<number> {
    const conditions = this.contactFilterConditions(orgId, filter)
    const rows = await this.db
      .select({ n: count() })
      .from(crmContactsSchema)
      .where(and(...conditions))
    return Number(rows[0]?.n ?? 0)
  }

  // ---------------------------------------------------------------------------
  // Companies
  // ---------------------------------------------------------------------------

  async findAllCompanies(orgId: number, filter: CrmListFilter = {}) {
    const conditions = [
      eq(crmCompaniesSchema.organizationId, orgId),
      isNull(crmCompaniesSchema.deletedAt),
    ]

    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(
        or(
          ilike(crmCompaniesSchema.name, pattern),
          ilike(crmCompaniesSchema.email, pattern),
          ilike(crmCompaniesSchema.phone, pattern),
          ilike(crmCompaniesSchema.city, pattern),
        )!,
      )
    }
    if (filter.status) {
      conditions.push(eq(crmCompaniesSchema.status, filter.status))
    }
    if (filter.segmentId) {
      conditions.push(eq(crmCompaniesSchema.segmentId, filter.segmentId))
    }
    if (filter.ownerUserId) {
      conditions.push(eq(crmCompaniesSchema.ownerUserId, filter.ownerUserId))
    }

    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    return this.db
      .select()
      .from(crmCompaniesSchema)
      .where(and(...conditions))
      .orderBy(desc(crmCompaniesSchema.createdAt))
      .limit(limit)
      .offset(offset)
  }

  async findCompanyById(orgId: number, id: number): Promise<CrmCompany | null> {
    const rows = await this.db
      .select()
      .from(crmCompaniesSchema)
      .where(
        and(
          eq(crmCompaniesSchema.id, id),
          eq(crmCompaniesSchema.organizationId, orgId),
          isNull(crmCompaniesSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async createCompany(orgId: number, ownerUserId: number, dto: CreateCompanyDTO): Promise<CrmCompany> {
    const [row] = await this.db
      .insert(crmCompaniesSchema)
      .values({
        organizationId: orgId,
        ownerUserId,
        name: dto.name,
        industry: dto.industry ?? null,
        website: dto.website ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        address: dto.address ?? null,
        employeesCount: dto.employeesCount ?? null,
        annualRevenue: dto.annualRevenue ?? null,
        status: dto.status ?? 'active',
        segmentId: dto.segmentId ?? null,
        notes: dto.notes ?? null,
      })
      .returning()
    return row!
  }

  async updateCompany(orgId: number, id: number, dto: UpdateCompanyDTO): Promise<CrmCompany | null> {
    const patch: Partial<typeof crmCompaniesSchema.$inferInsert> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.industry !== undefined) patch.industry = dto.industry
    if (dto.website !== undefined) patch.website = dto.website
    if (dto.email !== undefined) patch.email = dto.email
    if (dto.phone !== undefined) patch.phone = dto.phone
    if (dto.city !== undefined) patch.city = dto.city
    if (dto.address !== undefined) patch.address = dto.address
    if (dto.employeesCount !== undefined) patch.employeesCount = dto.employeesCount
    if (dto.annualRevenue !== undefined) patch.annualRevenue = dto.annualRevenue
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.segmentId !== undefined) patch.segmentId = dto.segmentId
    if (dto.notes !== undefined) patch.notes = dto.notes

    const rows = await this.db
      .update(crmCompaniesSchema)
      .set(patch)
      .where(
        and(
          eq(crmCompaniesSchema.id, id),
          eq(crmCompaniesSchema.organizationId, orgId),
          isNull(crmCompaniesSchema.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async deleteCompany(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(crmCompaniesSchema)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmCompaniesSchema.id, id),
          eq(crmCompaniesSchema.organizationId, orgId),
          isNull(crmCompaniesSchema.deletedAt),
        ),
      )
      .returning({ id: crmCompaniesSchema.id })
    return rows.length > 0
  }

  async countCompanies(orgId: number): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(crmCompaniesSchema)
      .where(and(eq(crmCompaniesSchema.organizationId, orgId), isNull(crmCompaniesSchema.deletedAt)))
    return Number(rows[0]?.n ?? 0)
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------

  async findAllLeads(orgId: number, filter: LeadListFilter = {}) {
    const conditions = [
      eq(crmLeadsSchema.organizationId, orgId),
      isNull(crmLeadsSchema.deletedAt),
    ]

    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(ilike(crmLeadsSchema.title, pattern))
    }
    if (filter.stage) {
      conditions.push(eq(crmLeadsSchema.stage, filter.stage))
    }
    if (filter.priority) {
      conditions.push(eq(crmLeadsSchema.priority, filter.priority))
    }
    if (filter.responsibleUserId) {
      conditions.push(eq(crmLeadsSchema.responsibleUserId, filter.responsibleUserId))
    }
    if (filter.pipelineId) {
      conditions.push(eq(crmLeadsSchema.pipelineId, filter.pipelineId))
    }
    if (filter.companyId) {
      conditions.push(eq(crmLeadsSchema.companyId, filter.companyId))
    }

    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    return this.db
      .select()
      .from(crmLeadsSchema)
      .where(and(...conditions))
      .orderBy(desc(crmLeadsSchema.createdAt))
      .limit(limit)
      .offset(offset)
  }

  async findLeadById(orgId: number, id: number): Promise<CrmLead | null> {
    const rows = await this.db
      .select()
      .from(crmLeadsSchema)
      .where(
        and(
          eq(crmLeadsSchema.id, id),
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async createLead(orgId: number, dto: CreateLeadDTO): Promise<CrmLead> {
    const [row] = await this.db
      .insert(crmLeadsSchema)
      .values({
        organizationId: orgId,
        contactId: dto.contactId ?? null,
        companyId: dto.companyId ?? null,
        title: dto.title,
        description: dto.description ?? null,
        amount: dto.amount ?? 0,
        currency: dto.currency ?? 'RUB',
        stage: dto.stage ?? 'new',
        priority: dto.priority ?? 'medium',
        probability: dto.probability ?? 0,
        source: dto.source ?? null,
        responsibleUserId: dto.responsibleUserId ?? null,
        pipelineId: dto.pipelineId ?? null,
        columnId: dto.columnId ?? null,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
      })
      .returning()
    return row!
  }

  async updateLead(orgId: number, id: number, dto: UpdateLeadDTO): Promise<CrmLead | null> {
    const patch: Partial<typeof crmLeadsSchema.$inferInsert> = {}
    if (dto.contactId !== undefined) patch.contactId = dto.contactId
    if (dto.companyId !== undefined) patch.companyId = dto.companyId
    if (dto.title !== undefined) patch.title = dto.title
    if (dto.description !== undefined) patch.description = dto.description
    if (dto.amount !== undefined) patch.amount = dto.amount
    if (dto.currency !== undefined) patch.currency = dto.currency
    if (dto.stage !== undefined) patch.stage = dto.stage
    if (dto.priority !== undefined) patch.priority = dto.priority
    if (dto.probability !== undefined) patch.probability = dto.probability
    if (dto.source !== undefined) patch.source = dto.source
    if (dto.responsibleUserId !== undefined) patch.responsibleUserId = dto.responsibleUserId
    if (dto.pipelineId !== undefined) patch.pipelineId = dto.pipelineId
    if (dto.columnId !== undefined) patch.columnId = dto.columnId
    if (dto.lostReason !== undefined) patch.lostReason = dto.lostReason
    if (dto.expectedCloseDate !== undefined) {
      patch.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null
    }

    const rows = await this.db
      .update(crmLeadsSchema)
      .set(patch)
      .where(
        and(
          eq(crmLeadsSchema.id, id),
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async moveLead(orgId: number, id: number, dto: MoveLeadDTO): Promise<CrmLead | null> {
    const patch: Partial<typeof crmLeadsSchema.$inferInsert> = {
      stage: dto.stage,
    }
    if (dto.columnId !== undefined) patch.columnId = dto.columnId
    if (dto.probability !== undefined) patch.probability = dto.probability
    if (dto.lostReason !== undefined) patch.lostReason = dto.lostReason
    if (dto.stage === 'won' || dto.stage === 'lost') {
      patch.closedAt = new Date()
    } else {
      patch.closedAt = null
    }

    const rows = await this.db
      .update(crmLeadsSchema)
      .set(patch)
      .where(
        and(
          eq(crmLeadsSchema.id, id),
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async deleteLead(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(crmLeadsSchema)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(crmLeadsSchema.id, id),
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
      .returning({ id: crmLeadsSchema.id })
    return rows.length > 0
  }

  async getKanban(orgId: number): Promise<Record<string, CrmLead[]>> {
    const leads = await this.db
      .select()
      .from(crmLeadsSchema)
      .where(
        and(
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
      .orderBy(crmLeadsSchema.stage, desc(crmLeadsSchema.createdAt))

    const board: Record<string, CrmLead[]> = {}
    for (const lead of leads) {
      if (!board[lead.stage]) board[lead.stage] = []
      board[lead.stage]!.push(lead)
    }
    return board
  }

  async getLeadStats(orgId: number): Promise<{
    totalLeads: number
    totalAmount: number
    byStage: { stage: string; count: number; amount: number }[]
    wonCount: number
    lostCount: number
    conversionRate: number
  }> {
    const rows = await this.db
      .select({
        stage: crmLeadsSchema.stage,
        cnt: count(),
        total: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
      })
      .from(crmLeadsSchema)
      .where(
        and(
          eq(crmLeadsSchema.organizationId, orgId),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
      .groupBy(crmLeadsSchema.stage)

    let totalLeads = 0
    let totalAmount = 0
    let wonCount = 0
    let lostCount = 0

    const byStage = rows.map((r) => {
      const cnt = Number(r.cnt)
      const amount = Number(r.total)
      totalLeads += cnt
      totalAmount += amount
      if (r.stage === 'won') wonCount = cnt
      if (r.stage === 'lost') lostCount = cnt
      return { stage: r.stage, count: cnt, amount }
    })

    const closed = wonCount + lostCount
    const conversionRate = closed > 0 ? Math.round((wonCount / closed) * 1000) / 1000 : 0

    return { totalLeads, totalAmount, byStage, wonCount, lostCount, conversionRate }
  }

  // ---------------------------------------------------------------------------
  // CRM Core: sources, deals, documents, communications, automation
  // ---------------------------------------------------------------------------

  async findLeadSources(orgId: number): Promise<CrmLeadSource[]> {
    return this.db
      .select()
      .from(crmLeadSourcesSchema)
      .where(eq(crmLeadSourcesSchema.organizationId, orgId))
      .orderBy(crmLeadSourcesSchema.name)
  }

  async createLeadSource(orgId: number, dto: { name: string; code?: string; color?: string }): Promise<CrmLeadSource> {
    const [row] = await this.db.insert(crmLeadSourcesSchema).values({
      organizationId: orgId,
      name: dto.name,
      code: dto.code ?? null,
      color: dto.color ?? null,
    }).returning()
    return row!
  }

  async findDealStages(orgId: number): Promise<CrmDealStage[]> {
    return this.db
      .select()
      .from(crmDealStagesSchema)
      .where(eq(crmDealStagesSchema.organizationId, orgId))
      .orderBy(crmDealStagesSchema.position)
  }

  async createDealStage(orgId: number, dto: {
    name: string
    code: string
    position?: number
    probability?: number
    color?: string
    isWon?: boolean
    isLost?: boolean
  }): Promise<CrmDealStage> {
    const [row] = await this.db.insert(crmDealStagesSchema).values({
      organizationId: orgId,
      name: dto.name,
      code: dto.code,
      position: dto.position ?? 0,
      probability: dto.probability ?? 0,
      color: dto.color ?? null,
      isWon: dto.isWon ?? false,
      isLost: dto.isLost ?? false,
    }).returning()
    return row!
  }

  async findDealStageById(orgId: number, id: number): Promise<CrmDealStage | null> {
    const rows = await this.db
      .select()
      .from(crmDealStagesSchema)
      .where(and(eq(crmDealStagesSchema.id, id), eq(crmDealStagesSchema.organizationId, orgId)))
    return rows[0] ?? null
  }

  async updateDealStage(orgId: number, id: number, dto: {
    name?: string
    code?: string
    position?: number
    probability?: number
    color?: string | null
    isWon?: boolean
    isLost?: boolean
  }): Promise<CrmDealStage | null> {
    const patch: Partial<typeof crmDealStagesSchema.$inferInsert> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.code !== undefined) patch.code = dto.code
    if (dto.position !== undefined) patch.position = dto.position
    if (dto.probability !== undefined) patch.probability = dto.probability
    if (dto.color !== undefined) patch.color = dto.color
    if (dto.isWon !== undefined) patch.isWon = dto.isWon
    if (dto.isLost !== undefined) patch.isLost = dto.isLost

    const rows = await this.db
      .update(crmDealStagesSchema)
      .set(patch)
      .where(and(eq(crmDealStagesSchema.id, id), eq(crmDealStagesSchema.organizationId, orgId)))
      .returning()
    return rows[0] ?? null
  }

  async reorderDealStages(orgId: number, order: { id: number; position: number }[]): Promise<CrmDealStage[]> {
    await Promise.all(
      order.map(({ id, position }) =>
        this.db
          .update(crmDealStagesSchema)
          .set({ position })
          .where(and(eq(crmDealStagesSchema.id, id), eq(crmDealStagesSchema.organizationId, orgId))),
      ),
    )
    return this.findDealStages(orgId)
  }

  async countLeadsInStage(orgId: number, stageCode: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(crmLeadsSchema)
      .where(
        and(
          eq(crmLeadsSchema.organizationId, orgId),
          eq(crmLeadsSchema.stage, stageCode),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
    return Number(row?.value ?? 0)
  }

  async moveLeadsToStage(orgId: number, fromStageCode: string, toStageCode: string): Promise<void> {
    await this.db
      .update(crmLeadsSchema)
      .set({ stage: toStageCode })
      .where(
        and(
          eq(crmLeadsSchema.organizationId, orgId),
          eq(crmLeadsSchema.stage, fromStageCode),
          isNull(crmLeadsSchema.deletedAt),
        ),
      )
  }

  async deleteDealStage(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(crmDealStagesSchema)
      .where(and(eq(crmDealStagesSchema.id, id), eq(crmDealStagesSchema.organizationId, orgId)))
      .returning({ id: crmDealStagesSchema.id })
    return rows.length > 0
  }

  async findDeals(orgId: number, filter: LeadListFilter = {}): Promise<CrmDeal[]> {
    const conditions = [
      eq(crmDealsSchema.organizationId, orgId),
      isNull(crmDealsSchema.deletedAt),
    ]
    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(ilike(crmDealsSchema.title, pattern))
    }
    if (filter.companyId) conditions.push(eq(crmDealsSchema.companyId, filter.companyId))
    if (filter.ownerUserId) conditions.push(eq(crmDealsSchema.ownerUserId, filter.ownerUserId))

    return this.db
      .select()
      .from(crmDealsSchema)
      .where(and(...conditions))
      .orderBy(desc(crmDealsSchema.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0)
  }

  async createDeal(orgId: number, ownerUserId: number, dto: {
    title: string
    leadId?: number | null
    contactId?: number | null
    companyId?: number | null
    stageId?: number | null
    amount?: number
    currency?: string
    probability?: number
    source?: string
    expectedCloseDate?: string | null
    nextStep?: string
    notes?: string
  }): Promise<CrmDeal> {
    const [row] = await this.db.insert(crmDealsSchema).values({
      organizationId: orgId,
      ownerUserId,
      title: dto.title,
      leadId: dto.leadId ?? null,
      contactId: dto.contactId ?? null,
      companyId: dto.companyId ?? null,
      stageId: dto.stageId ?? null,
      amount: dto.amount ?? 0,
      currency: dto.currency ?? 'RUB',
      probability: dto.probability ?? 0,
      source: dto.source ?? null,
      expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
      nextStep: dto.nextStep ?? null,
      notes: dto.notes ?? null,
    }).returning()
    return row!
  }

  async getDealStats(orgId: number): Promise<{
    totalDeals: number
    openAmount: number
    wonAmount: number
    weightedPipeline: number
  }> {
    const rows = await this.db
      .select({
        cnt: count(),
        openAmount: sql<number>`coalesce(sum(case when ${crmDealsSchema.status} = 'open' then ${crmDealsSchema.amount} else 0 end), 0)::int`,
        wonAmount: sql<number>`coalesce(sum(case when ${crmDealsSchema.status} = 'won' then ${crmDealsSchema.amount} else 0 end), 0)::int`,
        weightedPipeline: sql<number>`coalesce(sum((${crmDealsSchema.amount} * ${crmDealsSchema.probability}) / 100), 0)::int`,
      })
      .from(crmDealsSchema)
      .where(and(eq(crmDealsSchema.organizationId, orgId), isNull(crmDealsSchema.deletedAt)))

    return {
      totalDeals: Number(rows[0]?.cnt ?? 0),
      openAmount: Number(rows[0]?.openAmount ?? 0),
      wonAmount: Number(rows[0]?.wonAmount ?? 0),
      weightedPipeline: Number(rows[0]?.weightedPipeline ?? 0),
    }
  }

  async listDocuments(orgId: number, entityType: string, entityId: number): Promise<CrmDocument[]> {
    return this.db.select().from(crmDocumentsSchema).where(and(
      eq(crmDocumentsSchema.organizationId, orgId),
      eq(crmDocumentsSchema.entityType, entityType),
      eq(crmDocumentsSchema.entityId, entityId),
    )).orderBy(desc(crmDocumentsSchema.createdAt))
  }

  async createDocument(orgId: number, userId: number, dto: {
    entityType: string
    entityId: number
    title: string
    kind?: string
    fileName?: string
    templateCode?: string
    generatedPayload?: Record<string, unknown>
  }): Promise<CrmDocument> {
    const [row] = await this.db.insert(crmDocumentsSchema).values({
      organizationId: orgId,
      createdByUserId: userId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      title: dto.title,
      kind: dto.kind ?? 'attachment',
      fileName: dto.fileName ?? null,
      templateCode: dto.templateCode ?? null,
      generatedPayload: dto.generatedPayload ?? {},
    }).returning()
    return row!
  }

  async listCommunications(orgId: number, entityType: string, entityId: number): Promise<CrmCommunication[]> {
    return this.db.select().from(crmCommunicationsSchema).where(and(
      eq(crmCommunicationsSchema.organizationId, orgId),
      eq(crmCommunicationsSchema.entityType, entityType),
      eq(crmCommunicationsSchema.entityId, entityId),
    )).orderBy(desc(crmCommunicationsSchema.createdAt))
  }

  async createCommunication(orgId: number, userId: number, dto: {
    entityType: string
    entityId: number
    channel: string
    direction?: string
    subject?: string
    body?: string
    status?: string
  }): Promise<CrmCommunication> {
    const [row] = await this.db.insert(crmCommunicationsSchema).values({
      organizationId: orgId,
      actorUserId: userId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      channel: dto.channel,
      direction: dto.direction ?? 'outbound',
      subject: dto.subject ?? null,
      body: dto.body ?? null,
      status: dto.status ?? 'draft',
    }).returning()
    return row!
  }

  async listAutomationRules(orgId: number): Promise<AutomationRule[]> {
    return this.db
      .select()
      .from(automationRulesSchema)
      .where(eq(automationRulesSchema.organizationId, orgId))
      .orderBy(desc(automationRulesSchema.createdAt))
  }

  async createAutomationRule(orgId: number, userId: number, dto: {
    name: string
    description?: string
    triggerType: string
    conditions?: Record<string, unknown>
    actions?: Record<string, unknown>[]
    active?: boolean
  }): Promise<AutomationRule> {
    const [row] = await this.db.insert(automationRulesSchema).values({
      organizationId: orgId,
      createdByUserId: userId,
      name: dto.name,
      description: dto.description ?? null,
      triggerType: dto.triggerType,
      conditions: dto.conditions ?? {},
      actions: dto.actions ?? [],
      active: dto.active ?? true,
    }).returning()
    return row!
  }

  async listQuotes(orgId: number): Promise<SalesQuote[]> {
    return this.db
      .select()
      .from(salesQuotesSchema)
      .where(eq(salesQuotesSchema.organizationId, orgId))
      .orderBy(desc(salesQuotesSchema.createdAt))
      .limit(100)
  }

  async createQuote(orgId: number, userId: number, dto: {
    dealId?: number | null
    companyId?: number | null
    contactId?: number | null
    number: string
    status?: string
    subtotal?: number
    discount?: number
    total?: number
    currency?: string
    validUntil?: string | null
  }): Promise<SalesQuote> {
    const [row] = await this.db.insert(salesQuotesSchema).values({
      organizationId: orgId,
      createdByUserId: userId,
      dealId: dto.dealId ?? null,
      companyId: dto.companyId ?? null,
      contactId: dto.contactId ?? null,
      number: dto.number,
      status: dto.status ?? 'draft',
      subtotal: dto.subtotal ?? 0,
      discount: dto.discount ?? 0,
      total: dto.total ?? dto.subtotal ?? 0,
      currency: dto.currency ?? 'RUB',
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    }).returning()
    return row!
  }

  async findQuoteById(orgId: number, id: number): Promise<SalesQuote | null> {
    const rows = await this.db
      .select()
      .from(salesQuotesSchema)
      .where(and(eq(salesQuotesSchema.id, id), eq(salesQuotesSchema.organizationId, orgId)))
      .limit(1)
    return rows[0] ?? null
  }

  async updateQuote(orgId: number, id: number, dto: {
    dealId?: number | null
    companyId?: number | null
    contactId?: number | null
    number?: string
    status?: string
    subtotal?: number
    discount?: number
    total?: number
    currency?: string
    validUntil?: string | null
  }): Promise<SalesQuote | null> {
    const patch: Partial<typeof salesQuotesSchema.$inferInsert> = {}
    if (dto.dealId !== undefined) patch.dealId = dto.dealId
    if (dto.companyId !== undefined) patch.companyId = dto.companyId
    if (dto.contactId !== undefined) patch.contactId = dto.contactId
    if (dto.number !== undefined) patch.number = dto.number
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.subtotal !== undefined) patch.subtotal = dto.subtotal
    if (dto.discount !== undefined) patch.discount = dto.discount
    if (dto.total !== undefined) patch.total = dto.total
    if (dto.currency !== undefined) patch.currency = dto.currency
    if (dto.validUntil !== undefined) patch.validUntil = dto.validUntil ? new Date(dto.validUntil) : null

    const rows = await this.db
      .update(salesQuotesSchema)
      .set(patch)
      .where(and(eq(salesQuotesSchema.id, id), eq(salesQuotesSchema.organizationId, orgId)))
      .returning()
    return rows[0] ?? null
  }

  async deleteQuote(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(salesQuotesSchema)
      .where(and(eq(salesQuotesSchema.id, id), eq(salesQuotesSchema.organizationId, orgId)))
      .returning({ id: salesQuotesSchema.id })
    return rows.length > 0
  }

  async listInvoices(orgId: number): Promise<SalesInvoice[]> {
    return this.db
      .select()
      .from(salesInvoicesSchema)
      .where(eq(salesInvoicesSchema.organizationId, orgId))
      .orderBy(desc(salesInvoicesSchema.createdAt))
      .limit(100)
  }

  async createInvoice(orgId: number, userId: number, dto: {
    dealId?: number | null
    quoteId?: number | null
    number: string
    status?: string
    total?: number
    paidAmount?: number
    currency?: string
    issuedAt?: string | null
    dueAt?: string | null
  }): Promise<SalesInvoice> {
    const [row] = await this.db.insert(salesInvoicesSchema).values({
      organizationId: orgId,
      createdByUserId: userId,
      dealId: dto.dealId ?? null,
      quoteId: dto.quoteId ?? null,
      number: dto.number,
      status: dto.status ?? 'draft',
      total: dto.total ?? 0,
      paidAmount: dto.paidAmount ?? 0,
      currency: dto.currency ?? 'RUB',
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    }).returning()
    return row!
  }

  async findInvoiceById(orgId: number, id: number): Promise<SalesInvoice | null> {
    const rows = await this.db
      .select()
      .from(salesInvoicesSchema)
      .where(and(eq(salesInvoicesSchema.id, id), eq(salesInvoicesSchema.organizationId, orgId)))
      .limit(1)
    return rows[0] ?? null
  }

  async updateInvoice(orgId: number, id: number, dto: {
    dealId?: number | null
    quoteId?: number | null
    number?: string
    status?: string
    total?: number
    paidAmount?: number
    currency?: string
    issuedAt?: string | null
    dueAt?: string | null
    paidAt?: string | null
  }): Promise<SalesInvoice | null> {
    const patch: Partial<typeof salesInvoicesSchema.$inferInsert> = {}
    if (dto.dealId !== undefined) patch.dealId = dto.dealId
    if (dto.quoteId !== undefined) patch.quoteId = dto.quoteId
    if (dto.number !== undefined) patch.number = dto.number
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.total !== undefined) patch.total = dto.total
    if (dto.paidAmount !== undefined) patch.paidAmount = dto.paidAmount
    if (dto.currency !== undefined) patch.currency = dto.currency
    if (dto.issuedAt !== undefined) patch.issuedAt = dto.issuedAt ? new Date(dto.issuedAt) : null
    if (dto.dueAt !== undefined) patch.dueAt = dto.dueAt ? new Date(dto.dueAt) : null
    if (dto.paidAt !== undefined) patch.paidAt = dto.paidAt ? new Date(dto.paidAt) : null

    const rows = await this.db
      .update(salesInvoicesSchema)
      .set(patch)
      .where(and(eq(salesInvoicesSchema.id, id), eq(salesInvoicesSchema.organizationId, orgId)))
      .returning()
    return rows[0] ?? null
  }

  async deleteInvoice(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(salesInvoicesSchema)
      .where(and(eq(salesInvoicesSchema.id, id), eq(salesInvoicesSchema.organizationId, orgId)))
      .returning({ id: salesInvoicesSchema.id })
    return rows.length > 0
  }

  // ---------------------------------------------------------------------------
  // Activity
  // ---------------------------------------------------------------------------

  async addActivity(
    orgId: number,
    entityType: string,
    entityId: number,
    actorUserId: number | null,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    const [row] = await this.db
      .insert(crmActivitySchema)
      .values({
        organizationId: orgId,
        entityType,
        entityId,
        actorUserId,
        kind,
        payload,
      })
      .returning()
    return row!
  }

  async getActivity(orgId: number, entityType: string, entityId: number) {
    return this.db
      .select()
      .from(crmActivitySchema)
      .where(
        and(
          eq(crmActivitySchema.organizationId, orgId),
          eq(crmActivitySchema.entityType, entityType),
          eq(crmActivitySchema.entityId, entityId),
        ),
      )
      .orderBy(desc(crmActivitySchema.createdAt))
      .limit(100)
  }

  async getRecentActivity(orgId: number, limit = 30) {
    const activities = await this.db
      .select()
      .from(crmActivitySchema)
      .where(eq(crmActivitySchema.organizationId, orgId))
      .orderBy(desc(crmActivitySchema.createdAt))
      .limit(limit)

    const communications = await this.db
      .select()
      .from(crmCommunicationsSchema)
      .where(eq(crmCommunicationsSchema.organizationId, orgId))
      .orderBy(desc(crmCommunicationsSchema.createdAt))
      .limit(limit)

    const actItems = activities.map((a) => ({
      type: 'activity' as const,
      id: `act_${a.id}`,
      kind: a.kind,
      entityType: a.entityType,
      entityId: a.entityId,
      payload: a.payload,
      actorUserId: a.actorUserId,
      createdAt: a.createdAt,
    }))

    const commItems = communications.map((c) => ({
      type: 'communication' as const,
      id: `comm_${c.id}`,
      kind: `communication_${c.channel}` as string,
      entityType: c.entityType,
      entityId: c.entityId,
      payload: { channel: c.channel, direction: c.direction, subject: c.subject, body: c.body, status: c.status } as Record<string, unknown>,
      actorUserId: c.actorUserId,
      createdAt: c.createdAt,
    }))

    return [...actItems, ...commItems]
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, limit)
  }

  // ---------------------------------------------------------------------------
  // Reports
  // ---------------------------------------------------------------------------

  async getCrmReports(orgId: number, from: Date | null, to: Date, trendFrom: Date): Promise<CrmReports> {
    const leadBase = and(
      eq(crmLeadsSchema.organizationId, orgId),
      isNull(crmLeadsSchema.deletedAt),
    )

    const inPeriod = (col: { getSQLType(): unknown }) => {
      const conds = [lte(col as typeof crmLeadsSchema.createdAt, to)]
      if (from) conds.unshift(gte(col as typeof crmLeadsSchema.createdAt, from))
      return and(...conds)
    }

    const inTrend = (col: typeof crmLeadsSchema.createdAt) =>
      and(gte(col, trendFrom), lte(col, to))

    const [
      dealStages,
      leadByStageRows,
      overviewRow,
      newLeadsRow,
      contactCountRow,
      companyCountRow,
      newContactsRow,
      newCompaniesRow,
      contactsStatusRows,
      companiesStatusRows,
      leadsTrendRows,
      revenueTrendRows,
      managerRows,
      sourceRows,
      quotesRow,
      invoicesRow,
      commRows,
    ] = await Promise.all([
      this.findDealStages(orgId),

      this.db
        .select({
          stage: crmLeadsSchema.stage,
          cnt: count(),
          total: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
        })
        .from(crmLeadsSchema)
        .where(leadBase)
        .groupBy(crmLeadsSchema.stage),

      this.db
        .select({
          totalLeads: count(),
          totalAmount: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
          weightedPipeline: sql<number>`coalesce(sum((${crmLeadsSchema.amount} * ${crmLeadsSchema.probability}) / 100), 0)::int`,
        })
        .from(crmLeadsSchema)
        .where(leadBase),

      this.db
        .select({ n: count() })
        .from(crmLeadsSchema)
        .where(and(leadBase, inPeriod(crmLeadsSchema.createdAt))),

      this.db
        .select({ n: count() })
        .from(crmContactsSchema)
        .where(and(eq(crmContactsSchema.organizationId, orgId), isNull(crmContactsSchema.deletedAt))),

      this.db
        .select({ n: count() })
        .from(crmCompaniesSchema)
        .where(and(eq(crmCompaniesSchema.organizationId, orgId), isNull(crmCompaniesSchema.deletedAt))),

      this.db
        .select({ n: count() })
        .from(crmContactsSchema)
        .where(and(
          eq(crmContactsSchema.organizationId, orgId),
          isNull(crmContactsSchema.deletedAt),
          inPeriod(crmContactsSchema.createdAt),
        )),

      this.db
        .select({ n: count() })
        .from(crmCompaniesSchema)
        .where(and(
          eq(crmCompaniesSchema.organizationId, orgId),
          isNull(crmCompaniesSchema.deletedAt),
          inPeriod(crmCompaniesSchema.createdAt),
        )),

      this.db
        .select({ status: crmContactsSchema.status, cnt: count() })
        .from(crmContactsSchema)
        .where(and(eq(crmContactsSchema.organizationId, orgId), isNull(crmContactsSchema.deletedAt)))
        .groupBy(crmContactsSchema.status),

      this.db
        .select({ status: crmCompaniesSchema.status, cnt: count() })
        .from(crmCompaniesSchema)
        .where(and(eq(crmCompaniesSchema.organizationId, orgId), isNull(crmCompaniesSchema.deletedAt)))
        .groupBy(crmCompaniesSchema.status),

      this.db
        .select({
          date: sql<string>`date_trunc('day', ${crmLeadsSchema.createdAt})::date`,
          cnt: count(),
          total: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
        })
        .from(crmLeadsSchema)
        .where(and(leadBase, inTrend(crmLeadsSchema.createdAt)))
        .groupBy(sql`date_trunc('day', ${crmLeadsSchema.createdAt})::date`)
        .orderBy(sql`date_trunc('day', ${crmLeadsSchema.createdAt})::date`),

      this.db
        .select({
          date: sql<string>`date_trunc('day', coalesce(${crmLeadsSchema.closedAt}, ${crmLeadsSchema.updatedAt}))::date`,
          total: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
        })
        .from(crmLeadsSchema)
        .innerJoin(
          crmDealStagesSchema,
          and(
            eq(crmDealStagesSchema.organizationId, orgId),
            eq(crmDealStagesSchema.code, crmLeadsSchema.stage),
            eq(crmDealStagesSchema.isWon, true),
          ),
        )
        .where(and(
          leadBase,
          gte(sql`coalesce(${crmLeadsSchema.closedAt}, ${crmLeadsSchema.updatedAt})`, trendFrom),
          lte(sql`coalesce(${crmLeadsSchema.closedAt}, ${crmLeadsSchema.updatedAt})`, to),
        ))
        .groupBy(sql`date_trunc('day', coalesce(${crmLeadsSchema.closedAt}, ${crmLeadsSchema.updatedAt}))::date`)
        .orderBy(sql`date_trunc('day', coalesce(${crmLeadsSchema.closedAt}, ${crmLeadsSchema.updatedAt}))::date`),

      this.db
        .select({
          userId: crmLeadsSchema.responsibleUserId,
          firstname: usersSchema.firstname,
          lastname: usersSchema.lastname,
          leadsCount: count(),
          wonCount: sql<number>`coalesce(sum(case when ${crmDealStagesSchema.isWon} then 1 else 0 end), 0)::int`,
          totalAmount: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
          wonAmount: sql<number>`coalesce(sum(case when ${crmDealStagesSchema.isWon} then ${crmLeadsSchema.amount} else 0 end), 0)::int`,
        })
        .from(crmLeadsSchema)
        .leftJoin(usersSchema, eq(usersSchema.id, crmLeadsSchema.responsibleUserId))
        .leftJoin(
          crmDealStagesSchema,
          and(
            eq(crmDealStagesSchema.organizationId, orgId),
            eq(crmDealStagesSchema.code, crmLeadsSchema.stage),
          ),
        )
        .where(leadBase)
        .groupBy(crmLeadsSchema.responsibleUserId, usersSchema.firstname, usersSchema.lastname),

      this.db
        .select({
          source: sql<string>`coalesce(${crmLeadsSchema.source}, 'Не указан')`,
          cnt: count(),
          total: sql<number>`coalesce(sum(${crmLeadsSchema.amount}), 0)::int`,
        })
        .from(crmLeadsSchema)
        .where(leadBase)
        .groupBy(sql`coalesce(${crmLeadsSchema.source}, 'Не указан')`),

      this.db
        .select({
          cnt: count(),
          total: sql<number>`coalesce(sum(${salesQuotesSchema.total}), 0)::int`,
        })
        .from(salesQuotesSchema)
        .where(and(
          eq(salesQuotesSchema.organizationId, orgId),
          inPeriod(salesQuotesSchema.createdAt),
        )),

      this.db
        .select({
          cnt: count(),
          paid: sql<number>`coalesce(sum(${salesInvoicesSchema.paidAmount}), 0)::int`,
          outstanding: sql<number>`coalesce(sum(${salesInvoicesSchema.total} - ${salesInvoicesSchema.paidAmount}), 0)::int`,
        })
        .from(salesInvoicesSchema)
        .where(and(
          eq(salesInvoicesSchema.organizationId, orgId),
          inPeriod(salesInvoicesSchema.createdAt),
        )),

      this.db
        .select({
          channel: crmCommunicationsSchema.channel,
          cnt: count(),
        })
        .from(crmCommunicationsSchema)
        .where(and(
          eq(crmCommunicationsSchema.organizationId, orgId),
          inPeriod(crmCommunicationsSchema.createdAt),
        ))
        .groupBy(crmCommunicationsSchema.channel),
    ])

    const stageMap = new Map(leadByStageRows.map((r) => [r.stage, { count: Number(r.cnt), amount: Number(r.total) }]))
    const wonStages = new Set(dealStages.filter((s) => s.isWon).map((s) => s.code))
    const lostStages = new Set(dealStages.filter((s) => s.isLost).map((s) => s.code))

    let wonCount = 0
    let lostCount = 0
    let wonAmount = 0
    for (const [stage, data] of stageMap) {
      if (wonStages.has(stage)) { wonCount += data.count; wonAmount += data.amount }
      if (lostStages.has(stage)) lostCount += data.count
    }

    const closed = wonCount + lostCount
    const conversionRate = closed > 0 ? Math.round((wonCount / closed) * 1000) / 1000 : 0

    const funnelStages = dealStages.length > 0
      ? dealStages
      : [...stageMap.keys()].map((code, i) => ({
          code,
          name: code,
          color: '#6366f1',
          position: i + 1,
          isWon: code === 'won',
          isLost: code === 'lost',
        } as CrmDealStage))

    let prevCount: number | null = null
    const funnel = funnelStages.map((stage) => {
      const data = stageMap.get(stage.code) ?? { count: 0, amount: 0 }
      const conversionFromPrev =
        prevCount != null && prevCount > 0
          ? Math.round((data.count / prevCount) * 1000) / 1000
          : null
      if (!stage.isWon && !stage.isLost) prevCount = data.count
      return {
        stage: stage.code,
        stageName: stage.name,
        color: stage.color,
        position: stage.position,
        count: data.count,
        amount: data.amount,
        conversionFromPrev,
      }
    })

    const formatDate = (d: unknown) => {
      if (d instanceof Date) return d.toISOString().slice(0, 10)
      return String(d).slice(0, 10)
    }

    return {
      overview: {
        totalLeads: Number(overviewRow[0]?.totalLeads ?? 0),
        totalAmount: Number(overviewRow[0]?.totalAmount ?? 0),
        wonAmount,
        wonCount,
        lostCount,
        conversionRate,
        weightedPipeline: Number(overviewRow[0]?.weightedPipeline ?? 0),
        contactCount: Number(contactCountRow[0]?.n ?? 0),
        companyCount: Number(companyCountRow[0]?.n ?? 0),
        newLeads: Number(newLeadsRow[0]?.n ?? 0),
        newContacts: Number(newContactsRow[0]?.n ?? 0),
        newCompanies: Number(newCompaniesRow[0]?.n ?? 0),
      },
      funnel,
      trends: {
        leadsCreated: leadsTrendRows.map((r) => ({
          date: formatDate(r.date),
          count: Number(r.cnt),
          amount: Number(r.total),
        })),
        revenueWon: revenueTrendRows.map((r) => ({
          date: formatDate(r.date),
          amount: Number(r.total),
        })),
      },
      byManager: managerRows
        .map((r) => {
          const lc = Number(r.leadsCount)
          const wc = Number(r.wonCount)
          return {
            userId: r.userId,
            firstname: r.firstname ?? 'Без',
            lastname: r.lastname ?? (r.userId == null ? 'ответственного' : null),
            leadsCount: lc,
            wonCount: wc,
            totalAmount: Number(r.totalAmount),
            wonAmount: Number(r.wonAmount),
            conversionRate: lc > 0 ? Math.round((wc / lc) * 1000) / 1000 : 0,
          }
        })
        .sort((a, b) => b.wonAmount - a.wonAmount),
      bySource: sourceRows.map((r) => ({
        source: String(r.source),
        count: Number(r.cnt),
        amount: Number(r.total),
      })),
      contactsByStatus: contactsStatusRows.map((r) => ({
        status: r.status,
        count: Number(r.cnt),
      })),
      companiesByStatus: companiesStatusRows.map((r) => ({
        status: r.status,
        count: Number(r.cnt),
      })),
      sales: {
        quotesCount: Number(quotesRow[0]?.cnt ?? 0),
        quotesAmount: Number(quotesRow[0]?.total ?? 0),
        invoicesCount: Number(invoicesRow[0]?.cnt ?? 0),
        invoicesPaid: Number(invoicesRow[0]?.paid ?? 0),
        invoicesOutstanding: Number(invoicesRow[0]?.outstanding ?? 0),
      },
      communicationsByChannel: commRows.map((r) => ({
        channel: r.channel,
        count: Number(r.cnt),
      })),
    }
  }
}
