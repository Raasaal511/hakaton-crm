export type FavoritePipelineListItem = {
  pipelineId: number
  pipelineName: string
  departmentId: number
  departmentName: string
}

/** Избранное с привязкой к организации — для сводного списка по всем пространствам. */
export type FavoritePipelineListItemWithOrg = FavoritePipelineListItem & {
  organizationId: number
  organizationName: string
}

export interface IUserFavoritePipelinesRepository {
  listForOrganization(userId: number, organizationId: number): Promise<FavoritePipelineListItem[]>
  listAllForUser(userId: number): Promise<FavoritePipelineListItemWithOrg[]>
  add(userId: number, pipelineId: number): Promise<void>
  remove(userId: number, pipelineId: number): Promise<void>
}
