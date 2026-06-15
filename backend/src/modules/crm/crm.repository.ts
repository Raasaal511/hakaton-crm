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
import { eq, and, isNull, ilike, desc, count, sql, or } from 'drizzle-orm'
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

  async findAllContacts(orgId: number, filter: CrmListFilter = {}) {
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

  async countContacts(orgId: number): Promise<number> {
    const rows = await this.db
      .select({ n: count() })
      .from(crmContactsSchema)
      .where(and(eq(crmContactsSchema.organizationId, orgId), isNull(crmContactsSchema.deletedAt)))
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
}
