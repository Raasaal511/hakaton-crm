import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import { NotFoundError, BadRequestError } from '../../infra/libs/errors.js'
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
  constructor(@inject(TYPES.CrmRepository) private repo: CrmRepository) {}

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
    return updated
  }

  async deleteLead(orgId: number, id: number, userId: number): Promise<void> {
    await this.getLeadById(orgId, id)
    const deleted = await this.repo.deleteLead(orgId, id)
    if (!deleted) throw new NotFoundError('Лид не найден')
    await this.logActivity(orgId, 'lead', id, userId, 'deleted', {})
  }

  async getKanbanBoard(orgId: number) {
    return this.repo.getKanban(orgId)
  }

  async getConversionStats(orgId: number) {
    return this.repo.getLeadStats(orgId)
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
    return this.repo.addActivity(orgId, entityType, entityId, actorUserId, kind, payload).catch(() => undefined)
  }

  async getEntityActivity(orgId: number, entityType: string, entityId: number) {
    return this.repo.getActivity(orgId, entityType, entityId)
  }
}
