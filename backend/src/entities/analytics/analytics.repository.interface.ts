import type {
  OrganizationAnalyticsByDepartment,
  OrganizationAnalyticsOverview,
  OrganizationAnalyticsTopPerformer,
  OrganizationAnalyticsTrendPoint,
} from './analytics.types.js'

export interface IAnalyticsRepository {
  getOverview(
    organizationId: number,
    from: Date | null,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsOverview>

  getTrend(
    organizationId: number,
    from: Date,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsTrendPoint[]>

  getByDepartment(
    organizationId: number,
    from: Date | null,
    to: Date,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsByDepartment[]>

  getTopPerformers(
    organizationId: number,
    from: Date | null,
    to: Date,
    limit: number,
    departmentId?: number,
  ): Promise<OrganizationAnalyticsTopPerformer[]>
}
