export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all'

export type OrganizationAnalyticsOverview = {
  membersCount: number
  departmentsCount: number
  pipelinesCount: number
  activeTasks: number
  createdInPeriod: number
  completedInPeriod: number
  overdueTasks: number
  completionRate: number
  avgCycleDays: number | null
}

export type OrganizationAnalyticsTrendPoint = {
  date: string
  created: number
  completed: number
}

export type OrganizationAnalyticsByDepartment = {
  departmentId: number
  name: string
  active: number
  completed: number
  overdue: number
}

export type OrganizationAnalyticsTopPerformer = {
  userId: number
  firstname: string
  lastname: string
  completed: number
  active: number
  overdue: number
}

export type OrganizationAnalytics = {
  period: AnalyticsPeriod
  /** Выбранный отдел для фильтрации; `null` — вся организация */
  departmentId: number | null
  range: { from: string | null; to: string }
  overview: OrganizationAnalyticsOverview
  trend: OrganizationAnalyticsTrendPoint[]
  byDepartment: OrganizationAnalyticsByDepartment[]
  topPerformers: OrganizationAnalyticsTopPerformer[]
}
