import { injectable, inject } from 'inversify'
import { TYPES } from '../types.js'
import type {
  AnalyticsPeriod,
  IAnalyticsRepository,
  OrganizationAnalytics,
} from '../entities/analytics/index.js'

const PERIOD_TO_DAYS: Record<Exclude<AnalyticsPeriod, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}


const ALL_FALLBACK_DAYS = 30

@injectable()
export class AnalyticsService {
  constructor(
    @inject(TYPES.AnalyticsRepository) private analyticsRepo: IAnalyticsRepository,
  ) {}

  async getOrganizationAnalytics(
    organizationId: number,
    period: AnalyticsPeriod,
    departmentId?: number,
  ): Promise<OrganizationAnalytics> {
    const to = new Date()
    let from: Date | null = null
    if (period !== 'all') {
      const days = PERIOD_TO_DAYS[period]
      from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
    }

    const trendFrom =
      from ?? new Date(to.getTime() - ALL_FALLBACK_DAYS * 24 * 60 * 60 * 1000)

    const [overview, trend, byDepartment, topPerformers] = await Promise.all([
      this.analyticsRepo.getOverview(organizationId, from, to, departmentId),
      this.analyticsRepo.getTrend(organizationId, trendFrom, to, departmentId),
      this.analyticsRepo.getByDepartment(organizationId, from, to, departmentId),
      this.analyticsRepo.getTopPerformers(organizationId, from, to, 5, departmentId),
    ])

    return {
      period,
      departmentId: departmentId ?? null,
      range: { from: from ? from.toISOString() : null, to: to.toISOString() },
      overview,
      trend,
      byDepartment,
      topPerformers,
    }
  }
}
