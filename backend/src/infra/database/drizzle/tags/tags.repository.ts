import { inject, injectable } from "inversify";
import { CreateTagDTO, ITagsRepository, UpdateTagDTO } from "../../../../entities/tags";
import { Tag, tagsSchema, taskTagsSchema } from "../schema";
import { TYPES } from "../../../../types";
import { DB } from "../client";
import { and, eq, ilike, isNull } from "drizzle-orm";

@injectable()
export class TagsRepository implements ITagsRepository {
  constructor(@inject(TYPES.DB) private db: DB) { }

  async getTagsByDepartmentId(departmentId: number): Promise<Tag[]> {
    const rows = await this.db
      .select()
      .from(tagsSchema)
      .where(
        and(
          eq(tagsSchema.departmentId, departmentId),
          isNull(tagsSchema.deletedAt),
        ),
      )
    return rows
  }

  async searchTagsByDepartment(departmentId: number, query: string): Promise<Tag[]> {
    const pattern = `%${query}%`
    const rows = await this.db
      .select()
      .from(tagsSchema)
      .where(
        and(
          eq(tagsSchema.departmentId, departmentId),
          isNull(tagsSchema.deletedAt),
          ilike(tagsSchema.name, pattern),
        ),
      )
    return rows
  }

  async getTagsByTaskId(taskId: number): Promise<Tag[]> {
    const rows = await this.db
      .select({
        tagId: tagsSchema.id,
        name: tagsSchema.name,
        organizationId: tagsSchema.organizationId,
        departmentId: tagsSchema.departmentId,
        createdAt: tagsSchema.createdAt,
        updatedAt: tagsSchema.updatedAt,
        deletedAt: tagsSchema.deletedAt,
      })
      .from(tagsSchema)
      .innerJoin(taskTagsSchema, eq(taskTagsSchema.tagId, tagsSchema.id))
      .where(
        and(
          eq(taskTagsSchema.taskId, taskId),
          isNull(tagsSchema.deletedAt),
        ),
      )

    return rows.map((row) => ({
      id: row.tagId,
      name: row.name,
      organizationId: row.organizationId,
      departmentId: row.departmentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    }))
  }

  async setTagsForTask(taskId: number, tagIds: number[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(taskTagsSchema)
        .where(eq(taskTagsSchema.taskId, taskId))

      if (!tagIds.length) return

      const values = Array.from(new Set(tagIds)).map((tagId) => ({
        taskId,
        tagId,
      }))

      await tx
        .insert(taskTagsSchema)
        .values(values)
    })
  }

  async getTagById(id: number): Promise<Tag | null> {
    const [tag] = await this.db
      .select()
      .from(tagsSchema)
      .where(eq(tagsSchema.id, id))
    return tag
  }

  async createTag(dto: CreateTagDTO): Promise<Tag> {
    const [tag] = await this.db
      .insert(tagsSchema)
      .values(dto)
      .returning()
    return tag
  }

  async updateTag(id: number, dto: UpdateTagDTO): Promise<Tag> {
    const [tag] = await this.db
      .update(tagsSchema)
      .set(dto)
      .where(eq(tagsSchema.id, id))
      .returning()
    return tag
  }

  async deleteTag(id: number): Promise<void> {
    await this.db
      .update(tagsSchema)
      .set({ deletedAt: new Date() })
      .where(eq(tagsSchema.id, id))
  }
}