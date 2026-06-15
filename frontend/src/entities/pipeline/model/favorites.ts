import { createStore, createEvent } from 'effector'
import { useUnit } from 'effector-react'
import type { FavoritePipelineLink } from 'shared/types/pipelines'

type FavoritesByOrg = Record<number, FavoritePipelineLink[]>

export const setFavoritePipelinesForOrg = createEvent<{
  organizationId: number
  items: FavoritePipelineLink[]
}>()

/** После успешного POST `/pipelines/:id/favorite`. */
export const addFavoritePipelineToStore = createEvent<{
  organizationId: number
  item: FavoritePipelineLink
}>()

export const removeFavoritePipelineFromStore = createEvent<{
  organizationId: number
  pipelineId: number
}>()

export const clearFavoritePipelines = createEvent<void>()

export const $favoritePipelinesByOrg = createStore<FavoritesByOrg>({})
  .on(setFavoritePipelinesForOrg, (state, { organizationId, items }) => ({
    ...state,
    [organizationId]: items,
  }))
  .on(addFavoritePipelineToStore, (state, { organizationId, item }) => {
    const cur = state[organizationId] ?? []
    if (cur.some((x) => x.pipelineId === item.pipelineId)) {
      return { ...state, [organizationId]: cur }
    }
    return { ...state, [organizationId]: [item, ...cur] }
  })
  .on(removeFavoritePipelineFromStore, (state, { organizationId, pipelineId }) => ({
    ...state,
    [organizationId]: (state[organizationId] ?? []).filter((x) => x.pipelineId !== pipelineId),
  }))
  .on(clearFavoritePipelines, () => ({}))

export const useFavoritesForOrganization = (organizationId: number) =>
  useUnit($favoritePipelinesByOrg.map((s) => s[organizationId] ?? []))
