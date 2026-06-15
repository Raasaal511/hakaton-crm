export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'

export type Organization = {
  id: number
  name: string
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
  isPlatformOrganization?: boolean
  isPersonal?: boolean
  ownerUserId?: number
  /** Роль текущего пользователя в организации (из GET /organizations). */
  myRole?: OrganizationRole
}

export type OrganizationMember = {
  id: number
  email: string
  firstname: string
  lastname: string
  role: OrganizationRole
}

export type MemberDepartmentInfo = {
  departmentId: number
  departmentName: string
  role: 'member' | 'admin'
}

export type OrganizationMemberWithDepartments = OrganizationMember & {
  departments: MemberDepartmentInfo[]
}

export type AddUserToOrganizationDTO = {
  email: string
  role: OrganizationRole
}

export type AnalyticsPeriod = '7d' | '30d' | '90d' | 'all'

export type OrganizationAnalytics = {
  period: AnalyticsPeriod
  /** Выбранный отдел; `null` — вся организация */
  departmentId: number | null
  range: { from: string | null; to: string }
  overview: {
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
  trend: Array<{ date: string; created: number; completed: number }>
  byDepartment: Array<{
    departmentId: number
    name: string
    active: number
    completed: number
    overdue: number
  }>
  topPerformers: Array<{
    userId: number
    firstname: string
    lastname: string
    completed: number
    active: number
    overdue: number
  }>
}
