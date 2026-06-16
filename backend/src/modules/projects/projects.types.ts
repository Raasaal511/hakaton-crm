export type CreateProjectDTO = {
  name: string
  description?: string
  status?: string
  priority?: string
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
  status?: string
  priority?: string
  limit?: number
  offset?: number
}

export type AddProjectMemberDTO = {
  userId: number
  role?: string
}
