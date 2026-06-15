export type Tag = {
  id: number
  name: string
  organizationId: number
  departmentId?: number | null
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}
