import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../../types.js'
import { CrmService } from './crm.service.js'
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

@injectable()
export class CrmController {
  constructor(@inject(TYPES.CrmService) private crmService: CrmService) {}

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

        const filter: CrmListFilter = {
          q: req.query.q,
          status: req.query.status,
          segmentId: req.query.segmentId ? Number(req.query.segmentId) : undefined,
          ownerUserId: req.query.ownerUserId ? Number(req.query.ownerUserId) : undefined,
          companyId: req.query.companyId ? Number(req.query.companyId) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const contacts = await this.crmService.getContacts(orgId, filter)
        return reply.send(contacts)
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
        await this.crmService.deleteLead(orgId, id, req.user!.id)
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
        if (!['contact', 'company', 'lead'].includes(entityType)) {
          throw new BadRequestError('Тип сущности должен быть contact, company или lead')
        }

        const activity = await this.crmService.getEntityActivity(orgId, entityType, entityId)
        return reply.send(activity)
      },
    )
  }
}
