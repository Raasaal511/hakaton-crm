import { injectable, inject } from 'inversify'
import { and, eq, isNull } from 'drizzle-orm'
import type { IPipelinesRepository, CreatePipelineDTO, UpdatePipelineDTO } from '../../../../entities/pipelines/index.js'
import { pipelinesSchema, type Pipeline } from '../schema.js'
import { TYPES } from '../../../../types.js'
import type { DB } from '../client.js'

@injectable()
export class PipelinesRepository implements IPipelinesRepository {
  constructor(@inject(TYPES.DB) private readonly db: DB) {}

  async getPipelinesByDepartmentId(departmentId: number): Promise<Pipeline[]> {
    return this.db
      .select()
      .from(pipelinesSchema)
      .where(
        and(
          eq(pipelinesSchema.departmentId, departmentId),
          isNull(pipelinesSchema.deletedAt),
        ),
      )
  }

  async getPipelineById(id: number): Promise<Pipeline | undefined> {
    const [pipeline] = await this.db
      .select()
      .from(pipelinesSchema)
      .where(
        and(
          eq(pipelinesSchema.id, id),
          isNull(pipelinesSchema.deletedAt),
        ),
      )
    return pipeline
  }

  async createPipeline(dto: CreatePipelineDTO): Promise<Pipeline> {
    const [pipeline] = await this.db
      .insert(pipelinesSchema)
      .values({
        name: dto.name,
        departmentId: dto.departmentId,
        isMainTemplate: dto.isMainTemplate ?? false,
      })
      .returning()

    return pipeline
  }

  async updatePipeline(dto: UpdatePipelineDTO & { id: number }): Promise<Pipeline> {
    const [pipeline] = await this.db
      .update(pipelinesSchema)
      .set(dto)
      .where(eq(pipelinesSchema.id, dto.id))
      .returning()

    return pipeline
  }

  async softDeletePipeline(id: number): Promise<void> {
    await this.db
      .update(pipelinesSchema)
      .set({ deletedAt: new Date() })
      .where(eq(pipelinesSchema.id, id))
  }
}

