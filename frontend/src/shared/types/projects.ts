export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived'
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical'
export type ProjectMemberRole = 'owner' | 'member' | 'viewer'

export type Project = {
  id: number
  organizationId: number
  name: string
  description: string | null
  status: ProjectStatus
  priority: ProjectPriority
  ownerUserId: number | null
  startDate: string | null
  endDate: string | null
  budget: number
  currency: string
  progress: number
  color: string | null
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
}

export type ProjectMember = {
  projectId: number
  userId: number
  role: ProjectMemberRole
  joinedAt: string | null
  firstname: string
  lastname: string | null
  email: string
}

export type CreateProjectDTO = {
  name: string
  description?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  startDate?: string | null
  endDate?: string | null
  budget?: number
  currency?: string
  color?: string
}

export type UpdateProjectDTO = Partial<CreateProjectDTO> & {
  progress?: number
}

export type ProjectListFilter = {
  q?: string
  status?: ProjectStatus
  priority?: ProjectPriority
  limit?: number
  offset?: number
}

export type ProjectListResponse = {
  items: Project[]
  total: number
}
