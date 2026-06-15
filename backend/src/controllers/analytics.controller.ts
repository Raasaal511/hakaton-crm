import { inject, injectable } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../types.js'
import { AnalyticsService } from '../services/analytics.service.js'
import { OrganizationAccessService } from '../services/organization-access.service.js'
import type { IDepartmentRepository } from '../entities/department/index.js'
import { authMiddleware } from '../middlewares/authMiddleware.js'
import { validateParamId, requireOrgAccess } from '../middlewares/validationMiddleware.js'
import type { AnalyticsPeriod } from '../entities/analytics/index.js'

const ALLOWED_PERIODS: ReadonlyArray<AnalyticsPeriod> = ['7d', '30d', '90d', 'all']

function parsePeriod(raw: unknown): AnalyticsPeriod {
  if (typeof raw === 'string' && (ALLOWED_PERIODS as readonly string[]).includes(raw)) {
    return raw as AnalyticsPeriod
  }
  return '30d'
}

function parseOptionalDepartmentId(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) return undefined
  return n
}

@injectable()
export class AnalyticsController {
  constructor(
    @inject(TYPES.AnalyticsService) private analyticsService: AnalyticsService,
    @inject(TYPES.OrganizationAccessService) private orgAccessService: OrganizationAccessService,
    @inject(TYPES.DepartmentRepository) private departmentRepo: IDepartmentRepository,
  ) {}

  getOrganizationAnalytics: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Params: { organizationId: string }
      Querystring: { period?: string; departmentId?: string }
    }>(
      '/organizations/:organizationId/analytics',
      {
        preHandler: [
          authMiddleware,
          validateParamId('organizationId', 'id организации'),
          requireOrgAccess(this.orgAccessService, 'organizationId', 'manage'),
        ],
      },
      async (req, reply) => {
        const organizationId = Number(req.params.organizationId)
        const period = parsePeriod(req.query?.period)
        const rawDept = parseOptionalDepartmentId(req.query?.departmentId)
        let departmentId: number | undefined
        if (rawDept != null) {
          const dep = await this.departmentRepo.getDepartmentById(rawDept)
          if (!dep || dep.organizationId !== organizationId) {
            return reply.code(404).send({ message: 'Отдел не найден' })
          }
          departmentId = rawDept
        }
        const data = await this.analyticsService.getOrganizationAnalytics(
          organizationId,
          period,
          departmentId,
        )
        return reply.send(data)
      },
    )
  }
}
