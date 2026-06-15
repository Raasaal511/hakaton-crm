import { createStore, createEvent } from 'effector'
import { useUnit } from 'effector-react'
import type { Pipeline } from 'shared/types/pipelines'

export const setPipelines = createEvent<{ departmentId: number; pipelines: Pipeline[] }>()
export const addPipeline = createEvent<Pipeline>()
export const editPipeline = createEvent<Pipeline>()
export const delPipeline = createEvent<number>()

type PipelinesState = Record<number, Pipeline[]>

export const $pipelinesByDepartment = createStore<PipelinesState>({})
  .on(setPipelines, (state, { departmentId, pipelines }) => ({
    ...state,
    [departmentId]: pipelines,
  }))
  .on(addPipeline, (state, pipeline) => {
    const list = state[pipeline.departmentId] ?? []
    return {
      ...state,
      [pipeline.departmentId]: [...list, pipeline],
    }
  })
  .on(editPipeline, (state, pipeline) => {
    const list = state[pipeline.departmentId] ?? []
    return {
      ...state,
      [pipeline.departmentId]: list.map((p) => (p.id === pipeline.id ? pipeline : p)),
    }
  })
  .on(delPipeline, (state, id) => {
    const next: PipelinesState = {}
    for (const [deptId, list] of Object.entries(state)) {
      const depIdNum = Number(deptId)
      next[depIdNum] = list.filter((p) => p.id !== id)
    }
    return next
  })

export const usePipelinesForDepartment = (departmentId: number) =>
  useUnit($pipelinesByDepartment.map((state) => state[departmentId] ?? []))

export const selectors = {
  usePipelinesForDepartment,
}

export {
  setFavoritePipelinesForOrg,
  addFavoritePipelineToStore,
  removeFavoritePipelineFromStore,
  clearFavoritePipelines,
  $favoritePipelinesByOrg,
  useFavoritesForOrganization,
} from './favorites'

