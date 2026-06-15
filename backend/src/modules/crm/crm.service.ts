import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import { NotFoundError, BadRequestError } from '../../infra/libs/errors.js'
import { wsHub } from '../../realtime/ws.hub.js'
import { AuditService } from '../../services/audit.service.js'
import { CrmRepository } from './crm.repository.js'
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
import type { CrmContact, CrmCompany, CrmLead } from '../../infra/database/drizzle/schema.js'

@injectable()
export class CrmService {
  constructor(
    @inject(TYPES.CrmRepository) private repo: CrmRepository,
    @inject(TYPES.AuditService) private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Segments
  // ---------------------------------------------------------------------------

  async getSegments(orgId: number) {
    return this.repo.findAllSegments(orgId)
  }

  async createSegment(orgId: number, dto: CreateSegmentDTO) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название сегмента обязательно')
    return this.repo.createSegment(orgId, { ...dto, name })
  }

  async deleteSegment(orgId: number, id: number): Promise<void> {
    const deleted = await this.repo.deleteSegment(orgId, id)
    if (!deleted) throw new NotFoundError('Сегмент не найден')
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  async getContacts(orgId: number, filter: CrmListFilter = {}) {
    return this.repo.findAllContacts(orgId, filter)
  }

  async getContactById(orgId: number, id: number): Promise<CrmContact> {
    const contact = await this.repo.findContactById(orgId, id)
    if (!contact) throw new NotFoundError('Контакт не найден')
    return contact
  }

  async createContact(orgId: number, userId: number, dto: CreateContactDTO): Promise<CrmContact> {
    const firstName = dto.firstName?.trim()
    if (!firstName) throw new BadRequestError('Имя контакта обязательно')

    const contact = await this.repo.createContact(orgId, userId, { ...dto, firstName })
    await this.logActivity(orgId, 'contact', contact.id, userId, 'created', {
      title: `${contact.firstName} ${contact.lastName ?? ''}`.trim(),
    })
    wsHub.broadcastOrg(orgId, { type: 'contact_created', orgId, contact: contact as unknown as Record<string, unknown> })
    return contact
  }

  async updateContact(orgId: number, id: number, userId: number, dto: UpdateContactDTO): Promise<CrmContact> {
    const existing = await this.getContactById(orgId, id)

    if (dto.firstName !== undefined) {
      const firstName = dto.firstName?.trim()
      if (!firstName) throw new BadRequestError('Имя контакта не может быть пустым')
      dto = { ...dto, firstName }
    }

    const updated = await this.repo.updateContact(orgId, id, dto)
    if (!updated) throw new NotFoundError('Контакт не найден')

    await this.logActivity(orgId, 'contact', id, userId, 'updated', {
      before: { firstName: existing.firstName, lastName: existing.lastName, status: existing.status },
      after: { firstName: updated.firstName, lastName: updated.lastName, status: updated.status },
    })
    wsHub.broadcastOrg(orgId, { type: 'contact_updated', orgId, contactId: id, patch: dto as unknown as Record<string, unknown> })
    return updated
  }

  async deleteContact(orgId: number, id: number, userId: number): Promise<void> {
    await this.getContactById(orgId, id)
    const deleted = await this.repo.deleteContact(orgId, id)
    if (!deleted) throw new NotFoundError('Контакт не найден')
    await this.logActivity(orgId, 'contact', id, userId, 'deleted', {})
  }

  async countContacts(orgId: number): Promise<number> {
    return this.repo.countContacts(orgId)
  }

  // ---------------------------------------------------------------------------
  // Companies
  // ---------------------------------------------------------------------------

  async getCompanies(orgId: number, filter: CrmListFilter = {}) {
    return this.repo.findAllCompanies(orgId, filter)
  }

  async getCompanyById(orgId: number, id: number): Promise<CrmCompany> {
    const company = await this.repo.findCompanyById(orgId, id)
    if (!company) throw new NotFoundError('Компания не найдена')
    return company
  }

  async createCompany(orgId: number, userId: number, dto: CreateCompanyDTO): Promise<CrmCompany> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название компании обязательно')

    const company = await this.repo.createCompany(orgId, userId, { ...dto, name })
    await this.logActivity(orgId, 'company', company.id, userId, 'created', { name: company.name })
    return company
  }

  async updateCompany(orgId: number, id: number, userId: number, dto: UpdateCompanyDTO): Promise<CrmCompany> {
    const existing = await this.getCompanyById(orgId, id)

    if (dto.name !== undefined) {
      const name = dto.name?.trim()
      if (!name) throw new BadRequestError('Название компании не может быть пустым')
      dto = { ...dto, name }
    }

    const updated = await this.repo.updateCompany(orgId, id, dto)
    if (!updated) throw new NotFoundError('Компания не найдена')

    await this.logActivity(orgId, 'company', id, userId, 'updated', {
      before: { name: existing.name, status: existing.status },
      after: { name: updated.name, status: updated.status },
    })
    return updated
  }

  async deleteCompany(orgId: number, id: number, userId: number): Promise<void> {
    await this.getCompanyById(orgId, id)
    const deleted = await this.repo.deleteCompany(orgId, id)
    if (!deleted) throw new NotFoundError('Компания не найдена')
    await this.logActivity(orgId, 'company', id, userId, 'deleted', {})
  }

  async countCompanies(orgId: number): Promise<number> {
    return this.repo.countCompanies(orgId)
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------

  async getLeads(orgId: number, filter: LeadListFilter = {}) {
    return this.repo.findAllLeads(orgId, filter)
  }

  async getLeadById(orgId: number, id: number): Promise<CrmLead> {
    const lead = await this.repo.findLeadById(orgId, id)
    if (!lead) throw new NotFoundError('Лид не найден')
    return lead
  }

  async createLead(orgId: number, userId: number, dto: CreateLeadDTO): Promise<CrmLead> {
    const title = dto.title?.trim()
    if (!title) throw new BadRequestError('Название лида обязательно')

    if (dto.probability !== undefined && (dto.probability < 0 || dto.probability > 100)) {
      throw new BadRequestError('Вероятность должна быть от 0 до 100')
    }

    const lead = await this.repo.createLead(orgId, { ...dto, title })
    await this.logActivity(orgId, 'lead', lead.id, userId, 'created', {
      title: lead.title,
      stage: lead.stage,
      amount: lead.amount,
    })
    wsHub.broadcastOrg(orgId, { type: 'lead_created', orgId, lead: lead as unknown as Record<string, unknown> })
    return lead
  }

  async updateLead(orgId: number, id: number, userId: number, dto: UpdateLeadDTO): Promise<CrmLead> {
    const existing = await this.getLeadById(orgId, id)

    if (dto.title !== undefined) {
      const title = dto.title?.trim()
      if (!title) throw new BadRequestError('Название лида не может быть пустым')
      dto = { ...dto, title }
    }

    if (dto.probability !== undefined && (dto.probability < 0 || dto.probability > 100)) {
      throw new BadRequestError('Вероятность должна быть от 0 до 100')
    }

    const updated = await this.repo.updateLead(orgId, id, dto)
    if (!updated) throw new NotFoundError('Лид не найден')

    await this.logActivity(orgId, 'lead', id, userId, 'updated', {
      before: { title: existing.title, stage: existing.stage, amount: existing.amount },
      after: { title: updated.title, stage: updated.stage, amount: updated.amount },
    })
    wsHub.broadcastOrg(orgId, { type: 'lead_updated', orgId, leadId: id, patch: dto as unknown as Record<string, unknown> })
    return updated
  }

  async moveLead(orgId: number, id: number, userId: number, dto: MoveLeadDTO): Promise<CrmLead> {
    const existing = await this.getLeadById(orgId, id)
    if (!dto.stage?.trim()) throw new BadRequestError('Стадия обязательна')

    if (dto.probability !== undefined && (dto.probability < 0 || dto.probability > 100)) {
      throw new BadRequestError('Вероятность должна быть от 0 до 100')
    }

    const updated = await this.repo.moveLead(orgId, id, dto)
    if (!updated) throw new NotFoundError('Лид не найден')

    await this.logActivity(orgId, 'lead', id, userId, 'stage_changed', {
      from: existing.stage,
      to: updated.stage,
      lostReason: dto.lostReason ?? null,
    })
    wsHub.broadcastOrg(orgId, { type: 'lead_moved', orgId, leadId: id, stage: updated.stage, columnId: updated.columnId })
    return updated
  }

  async deleteLead(orgId: number, id: number, userId: number): Promise<void> {
    await this.getLeadById(orgId, id)
    const deleted = await this.repo.deleteLead(orgId, id)
    if (!deleted) throw new NotFoundError('Лид не найден')
    await this.logActivity(orgId, 'lead', id, userId, 'deleted', {})
    wsHub.broadcastOrg(orgId, { type: 'lead_deleted', orgId, leadId: id })
  }

  async getKanbanBoard(orgId: number) {
    return this.repo.getKanban(orgId)
  }

  async getConversionStats(orgId: number) {
    return this.repo.getLeadStats(orgId)
  }

  // ---------------------------------------------------------------------------
  // CRM Core: sources, deals, documents, communications, automation
  // ---------------------------------------------------------------------------

  async getLeadSources(orgId: number) {
    return this.repo.findLeadSources(orgId)
  }

  async createLeadSource(orgId: number, userId: number, dto: { name: string; code?: string; color?: string }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название источника обязательно')
    const source = await this.repo.createLeadSource(orgId, { ...dto, name })
    await this.logActivity(orgId, 'lead_source', source.id, userId, 'created', { name })
    return source
  }

  async getDealStages(orgId: number) {
    return this.repo.findDealStages(orgId)
  }

  async createDealStage(orgId: number, userId: number, dto: {
    name: string
    code?: string
    position?: number
    probability?: number
    color?: string
    isWon?: boolean
    isLost?: boolean
  }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название этапа обязательно')
    const code = dto.code?.trim() || name.toLowerCase().replace(/\s+/g, '_')
    const stage = await this.repo.createDealStage(orgId, { ...dto, name, code })
    await this.logActivity(orgId, 'deal_stage', stage.id, userId, 'created', { name, code })
    return stage
  }

  async getDeals(orgId: number, filter: LeadListFilter = {}) {
    return this.repo.findDeals(orgId, filter)
  }

  async createDeal(orgId: number, userId: number, dto: {
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
  }) {
    const title = dto.title?.trim()
    if (!title) throw new BadRequestError('Название сделки обязательно')
    if (dto.probability !== undefined && (dto.probability < 0 || dto.probability > 100)) {
      throw new BadRequestError('Вероятность должна быть от 0 до 100')
    }
    const deal = await this.repo.createDeal(orgId, userId, { ...dto, title })
    await this.logActivity(orgId, 'deal', deal.id, userId, 'created', { title, amount: deal.amount })
    wsHub.broadcastOrg(orgId, { type: 'deal_created', orgId, deal: deal as unknown as Record<string, unknown> })
    return deal
  }

  async getDealStats(orgId: number) {
    return this.repo.getDealStats(orgId)
  }

  async getDocuments(orgId: number, entityType: string, entityId: number) {
    return this.repo.listDocuments(orgId, entityType, entityId)
  }

  async createDocument(orgId: number, userId: number, dto: {
    entityType: string
    entityId: number
    title: string
    kind?: string
    fileName?: string
    templateCode?: string
    generatedPayload?: Record<string, unknown>
  }) {
    if (!dto.title?.trim()) throw new BadRequestError('Название документа обязательно')
    const doc = await this.repo.createDocument(orgId, userId, { ...dto, title: dto.title.trim() })
    await this.logActivity(orgId, dto.entityType, dto.entityId, userId, 'document_created', { documentId: doc.id, title: doc.title })
    return doc
  }

  async getCommunications(orgId: number, entityType: string, entityId: number) {
    return this.repo.listCommunications(orgId, entityType, entityId)
  }

  async createCommunication(orgId: number, userId: number, dto: {
    entityType: string
    entityId: number
    channel: string
    direction?: string
    subject?: string
    body?: string
    status?: string
  }) {
    if (!['email', 'telegram', 'phone', 'note'].includes(dto.channel)) {
      throw new BadRequestError('Канал должен быть email, telegram, phone или note')
    }
    const communication = await this.repo.createCommunication(orgId, userId, dto)
    await this.logActivity(orgId, dto.entityType, dto.entityId, userId, 'communication_created', {
      communicationId: communication.id,
      channel: communication.channel,
    })
    return communication
  }

  async getAutomationRules(orgId: number) {
    return this.repo.listAutomationRules(orgId)
  }

  async createAutomationRule(orgId: number, userId: number, dto: {
    name: string
    description?: string
    triggerType: string
    conditions?: Record<string, unknown>
    actions?: Record<string, unknown>[]
    active?: boolean
  }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название правила обязательно')
    if (!dto.triggerType?.trim()) throw new BadRequestError('Тип триггера обязателен')
    const rule = await this.repo.createAutomationRule(orgId, userId, { ...dto, name })
    await this.logActivity(orgId, 'automation_rule', rule.id, userId, 'created', { name, triggerType: rule.triggerType })
    return rule
  }

  async getQuotes(orgId: number) {
    return this.repo.listQuotes(orgId)
  }

  async createQuote(orgId: number, userId: number, dto: Parameters<CrmRepository['createQuote']>[2]) {
    if (!dto.number?.trim()) throw new BadRequestError('Номер КП обязателен')
    const quote = await this.repo.createQuote(orgId, userId, { ...dto, number: dto.number.trim() })
    await this.logActivity(orgId, 'quote', quote.id, userId, 'created', { number: quote.number, total: quote.total })
    return quote
  }

  async getInvoices(orgId: number) {
    return this.repo.listInvoices(orgId)
  }

  async createInvoice(orgId: number, userId: number, dto: Parameters<CrmRepository['createInvoice']>[2]) {
    if (!dto.number?.trim()) throw new BadRequestError('Номер счета обязателен')
    const invoice = await this.repo.createInvoice(orgId, userId, { ...dto, number: dto.number.trim() })
    await this.logActivity(orgId, 'invoice', invoice.id, userId, 'created', { number: invoice.number, total: invoice.total })
    return invoice
  }

  // ---------------------------------------------------------------------------
  // Activity
  // ---------------------------------------------------------------------------

  async logActivity(
    orgId: number,
    entityType: string,
    entityId: number,
    actorUserId: number | null,
    kind: string,
    payload: Record<string, unknown>,
  ) {
    await this.audit.record({
      organizationId: orgId,
      actorUserId,
      entityType: `crm.${entityType}`,
      entityId,
      action: kind,
      payload,
    }).catch(() => undefined)
    return this.repo.addActivity(orgId, entityType, entityId, actorUserId, kind, payload).catch(() => undefined)
  }

  async getEntityActivity(orgId: number, entityType: string, entityId: number) {
    return this.repo.getActivity(orgId, entityType, entityId)
  }
}
