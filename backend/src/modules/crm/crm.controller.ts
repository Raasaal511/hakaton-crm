import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../../types.js'
import { CrmService } from './crm.service.js'
import { RbacService, type CoreCapability } from '../../services/rbac.service.js'
import { authMiddleware } from '../../middlewares/authMiddleware.js'
import { BadRequestError } from '../../infra/libs/errors.js'
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
import type { CrmReportPeriod } from './crm.types.js'

@injectable()
export class CrmController {
  constructor(
    @inject(TYPES.CrmService) private crmService: CrmService,
    @inject(TYPES.RbacService) private rbac: RbacService,
  ) {}

  private async ensure(req: { user?: { id: number } }, orgId: number, capability: CoreCapability) {
    await this.rbac.ensureCapability(orgId, req.user!.id, capability)
  }

  // ---------------------------------------------------------------------------
  // Segments
  // ---------------------------------------------------------------------------

  getSegments: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/segments',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        const segments = await this.crmService.getSegments(orgId)
        return reply.send(segments)
      },
    )
  }

  createSegment: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateSegmentDTO }>(
      '/crm/segments',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        const segment = await this.crmService.createSegment(orgId, req.body)
        return reply.status(201).send(segment)
      },
    )
  }

  deleteSegment: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/segments/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id сегмента')
        await this.ensure(req, orgId, 'crm.delete')
        await this.crmService.deleteSegment(orgId, id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  getContacts: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: {
        orgId: string
        q?: string
        status?: string
        segmentId?: string
        ownerUserId?: string
        companyId?: string
        limit?: string
        offset?: string
      }
    }>(
      '/crm/contacts',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')

        const filter: CrmListFilter = {
          q: req.query.q,
          status: req.query.status,
          segmentId: req.query.segmentId ? Number(req.query.segmentId) : undefined,
          ownerUserId: req.query.ownerUserId ? Number(req.query.ownerUserId) : undefined,
          companyId: req.query.companyId ? Number(req.query.companyId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const result = await this.crmService.getContacts(orgId, filter)
        return reply.send(result)
      },
    )
  }

  createContact: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateContactDTO }>(
      '/crm/contacts',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        const contact = await this.crmService.createContact(orgId, req.user!.id, req.body)
        return reply.status(201).send(contact)
      },
    )
  }

  getContactById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/contacts/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id контакта')
        await this.ensure(req, orgId, 'crm.read')
        const contact = await this.crmService.getContactById(orgId, id)
        return reply.send(contact)
      },
    )
  }

  updateContact: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateContactDTO }>(
      '/crm/contacts/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id контакта')
        await this.ensure(req, orgId, 'crm.write')
        const contact = await this.crmService.updateContact(orgId, id, req.user!.id, req.body)
        return reply.send(contact)
      },
    )
  }

  deleteContact: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/contacts/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id контакта')
        await this.ensure(req, orgId, 'crm.delete')
        await this.crmService.deleteContact(orgId, id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Companies
  // ---------------------------------------------------------------------------

  getCompanies: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: {
        orgId: string
        q?: string
        status?: string
        segmentId?: string
        ownerUserId?: string
        limit?: string
        offset?: string
      }
    }>(
      '/crm/companies',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')

        const filter: CrmListFilter = {
          q: req.query.q,
          status: req.query.status,
          segmentId: req.query.segmentId ? Number(req.query.segmentId) : undefined,
          ownerUserId: req.query.ownerUserId ? Number(req.query.ownerUserId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const companies = await this.crmService.getCompanies(orgId, filter)
        return reply.send(companies)
      },
    )
  }

  createCompany: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateCompanyDTO }>(
      '/crm/companies',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        const company = await this.crmService.createCompany(orgId, req.user!.id, req.body)
        return reply.status(201).send(company)
      },
    )
  }

  getCompanyById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/companies/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id компании')
        await this.ensure(req, orgId, 'crm.read')
        const company = await this.crmService.getCompanyById(orgId, id)
        return reply.send(company)
      },
    )
  }

  updateCompany: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateCompanyDTO }>(
      '/crm/companies/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id компании')
        await this.ensure(req, orgId, 'crm.write')
        const company = await this.crmService.updateCompany(orgId, id, req.user!.id, req.body)
        return reply.send(company)
      },
    )
  }

  deleteCompany: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/companies/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id компании')
        await this.ensure(req, orgId, 'crm.delete')
        await this.crmService.deleteCompany(orgId, id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------------

  getLeads: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: {
        orgId: string
        q?: string
        stage?: string
        priority?: string
        responsibleUserId?: string
        pipelineId?: string
        companyId?: string
        limit?: string
        offset?: string
      }
    }>(
      '/crm/leads',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')

        const filter: LeadListFilter = {
          q: req.query.q,
          stage: req.query.stage,
          priority: req.query.priority,
          responsibleUserId: req.query.responsibleUserId ? Number(req.query.responsibleUserId) : undefined,
          pipelineId: req.query.pipelineId ? Number(req.query.pipelineId) : undefined,
          companyId: req.query.companyId ? Number(req.query.companyId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const leads = await this.crmService.getLeads(orgId, filter)
        return reply.send(leads)
      },
    )
  }

  getLeadKanban: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/leads/kanban',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        const board = await this.crmService.getKanbanBoard(orgId)
        return reply.send(board)
      },
    )
  }

  getLeadStats: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/leads/stats',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        const stats = await this.crmService.getConversionStats(orgId)
        return reply.send(stats)
      },
    )
  }

  createLead: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateLeadDTO }>(
      '/crm/leads',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        const lead = await this.crmService.createLead(orgId, req.user!.id, req.body)
        return reply.status(201).send(lead)
      },
    )
  }

  getLeadById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/leads/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id лида')
        await this.ensure(req, orgId, 'crm.read')
        const lead = await this.crmService.getLeadById(orgId, id)
        return reply.send(lead)
      },
    )
  }

  updateLead: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateLeadDTO }>(
      '/crm/leads/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id лида')
        await this.ensure(req, orgId, 'crm.write')
        const lead = await this.crmService.updateLead(orgId, id, req.user!.id, req.body)
        return reply.send(lead)
      },
    )
  }

  moveLead: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Querystring: { orgId: string }; Params: { id: string }; Body: MoveLeadDTO }>(
      '/crm/leads/:id/move',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id лида')
        await this.ensure(req, orgId, 'crm.write')
        const lead = await this.crmService.moveLead(orgId, id, req.user!.id, req.body)
        return reply.send(lead)
      },
    )
  }

  deleteLead: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/leads/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id лида')
        await this.ensure(req, orgId, 'crm.delete')
        await this.crmService.deleteLead(orgId, id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // CRM Core: sources, deals, documents, communications, automation
  // ---------------------------------------------------------------------------

  getLeadSources: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/lead-sources',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getLeadSources(orgId))
      },
    )
  }

  createLeadSource: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: { name: string; code?: string; color?: string } }>(
      '/crm/lead-sources',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.status(201).send(await this.crmService.createLeadSource(orgId, req.user!.id, req.body))
      },
    )
  }

  getDealStages: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/deal-stages',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getDealStages(orgId))
      },
    )
  }

  createDealStage: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: { name: string; code?: string; position?: number; probability?: number; color?: string; isWon?: boolean; isLost?: boolean } }>(
      '/crm/deal-stages',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.status(201).send(await this.crmService.createDealStage(orgId, req.user!.id, req.body))
      },
    )
  }

  updateDealStage: FastifyPluginAsync = async (fastify) => {
    fastify.put<{
      Params: { id: string }
      Querystring: { orgId: string }
      Body: { name?: string; code?: string; position?: number; probability?: number; color?: string | null; isWon?: boolean; isLost?: boolean }
    }>(
      '/crm/deal-stages/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.send(await this.crmService.updateDealStage(orgId, id, req.user!.id, req.body))
      },
    )
  }

  reorderDealStages: FastifyPluginAsync = async (fastify) => {
    fastify.put<{
      Querystring: { orgId: string }
      Body: { order: { id: number; position: number }[] }
    }>(
      '/crm/deal-stages/reorder',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.send(await this.crmService.reorderDealStages(orgId, req.user!.id, req.body.order ?? []))
      },
    )
  }

  deleteDealStage: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Params: { id: string }; Querystring: { orgId: string } }>(
      '/crm/deal-stages/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        await this.crmService.deleteDealStage(orgId, id, req.user!.id)
        return reply.status(204).send()
      },
    )
  }

  getDeals: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string; q?: string; companyId?: string; ownerUserId?: string; limit?: string; offset?: string } }>(
      '/crm/deals',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getDeals(orgId, {
          q: req.query.q,
          companyId: req.query.companyId ? Number(req.query.companyId) : undefined,
          ownerUserId: req.query.ownerUserId ? Number(req.query.ownerUserId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }))
      },
    )
  }

  createDeal: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createDeal']>[2] }>(
      '/crm/deals',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.status(201).send(await this.crmService.createDeal(orgId, req.user!.id, req.body))
      },
    )
  }

  getDealStats: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/deals/stats',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getDealStats(orgId))
      },
    )
  }

  getReports: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string; period?: CrmReportPeriod } }>(
      '/crm/reports',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        const period = req.query.period ?? '30d'
        if (!['7d', '30d', '90d', 'all'].includes(period)) {
          throw new BadRequestError('period должен быть 7d, 30d, 90d или all')
        }
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getReports(orgId, period))
      },
    )
  }

  getDocuments: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { type: string; id: string } }>(
      '/crm/documents/:type/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const entityId = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!entityId) throw new BadRequestError('Некорректный id сущности')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getDocuments(orgId, req.params.type, entityId))
      },
    )
  }

  createDocument: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createDocument']>[2] }>(
      '/crm/documents',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.status(201).send(await this.crmService.createDocument(orgId, req.user!.id, req.body))
      },
    )
  }

  getCommunications: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { type: string; id: string } }>(
      '/crm/communications/:type/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const entityId = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!entityId) throw new BadRequestError('Некорректный id сущности')
        await this.ensure(req, orgId, 'crm.read')
        return reply.send(await this.crmService.getCommunications(orgId, req.params.type, entityId))
      },
    )
  }

  createCommunication: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createCommunication']>[2] }>(
      '/crm/communications',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.write')
        return reply.status(201).send(await this.crmService.createCommunication(orgId, req.user!.id, req.body))
      },
    )
  }

  getAutomationRules: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/automation/rules',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'automation.manage')
        return reply.send(await this.crmService.getAutomationRules(orgId))
      },
    )
  }

  createAutomationRule: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createAutomationRule']>[2] }>(
      '/crm/automation/rules',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'automation.manage')
        return reply.status(201).send(await this.crmService.createAutomationRule(orgId, req.user!.id, req.body))
      },
    )
  }

  getQuotes: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/sales/quotes',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'sales.read')
        return reply.send(await this.crmService.getQuotes(orgId))
      },
    )
  }

  createQuote: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createQuote']>[2] }>(
      '/crm/sales/quotes',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'sales.write')
        return reply.status(201).send(await this.crmService.createQuote(orgId, req.user!.id, req.body))
      },
    )
  }

  updateQuote: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: Parameters<CrmService['updateQuote']>[3] }>(
      '/crm/sales/quotes/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id')
        await this.ensure(req, orgId, 'sales.write')
        return reply.send(await this.crmService.updateQuote(orgId, req.user!.id, id, req.body))
      },
    )
  }

  deleteQuote: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/sales/quotes/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id')
        await this.ensure(req, orgId, 'sales.write')
        await this.crmService.deleteQuote(orgId, req.user!.id, id)
        return reply.status(204).send()
      },
    )
  }

  getInvoices: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/crm/sales/invoices',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'sales.read')
        return reply.send(await this.crmService.getInvoices(orgId))
      },
    )
  }

  createInvoice: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: Parameters<CrmService['createInvoice']>[2] }>(
      '/crm/sales/invoices',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'sales.write')
        return reply.status(201).send(await this.crmService.createInvoice(orgId, req.user!.id, req.body))
      },
    )
  }

  updateInvoice: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: Parameters<CrmService['updateInvoice']>[3] }>(
      '/crm/sales/invoices/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id')
        await this.ensure(req, orgId, 'sales.write')
        return reply.send(await this.crmService.updateInvoice(orgId, req.user!.id, id, req.body))
      },
    )
  }

  deleteInvoice: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/crm/sales/invoices/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id')
        await this.ensure(req, orgId, 'sales.write')
        await this.crmService.deleteInvoice(orgId, req.user!.id, id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Activity
  // ---------------------------------------------------------------------------

  getActivity: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: { orgId: string }
      Params: { type: string; id: string }
    }>(
      '/crm/activity/:type/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const entityId = Number(req.params.id)
        const entityType = req.params.type

        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!entityId) throw new BadRequestError('Некорректный id сущности')
        await this.ensure(req, orgId, 'crm.read')
        if (!['contact', 'company', 'lead'].includes(entityType)) {
          throw new BadRequestError('Тип сущности должен быть contact, company или lead')
        }

        const activity = await this.crmService.getEntityActivity(orgId, entityType, entityId)
        return reply.send(activity)
      },
    )

    fastify.get<{
      Querystring: { orgId: string; limit?: string }
    }>(
      '/crm/activity/recent',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const limit = Math.min(Number(req.query.limit ?? 30), 100)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'crm.read')
        const items = await this.crmService.getRecentActivity(orgId, limit)
        return reply.send({ items })
      },
    )
  }
}
