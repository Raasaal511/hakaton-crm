import { injectable, inject } from "inversify";
import { CreateColumnDTO, IColumnsRepository, UpdateColumnDTO } from "../../../../entities/columnts";
import { Column, columnSchema } from "../schema";
import { TYPES } from "../../../../types";
import { DB } from "../client";
import { and, eq, isNull } from "drizzle-orm";

@injectable()
export class ColumnRepository implements IColumnsRepository {
    constructor(@inject(TYPES.DB) private db: DB) { }

    async getColumnsByDepartmentId(departmentId: number): Promise<Column[]> {
        const columns = await this.db
            .select()
            .from(columnSchema)
            .where(
                and(
                    eq(columnSchema.departmentId, departmentId),
                    isNull(columnSchema.deletedAt)
                )
            )
            .orderBy(columnSchema.position)
        return columns
    }

    async getColumnsByPipelineId(pipelineId: number): Promise<Column[]> {
        const columns = await this.db
            .select()
            .from(columnSchema)
            .where(
                and(
                    eq(columnSchema.pipelineId, pipelineId),
                    isNull(columnSchema.deletedAt)
                )
            )
            .orderBy(columnSchema.position)
        return columns
    }

    async getColumnById(columnId: number): Promise<Column | undefined> {
        const [column] = await this.db
            .select()
            .from(columnSchema)
            .where(and(eq(columnSchema.id, columnId), isNull(columnSchema.deletedAt)))
        return column
    }

    async createColumn(dto: CreateColumnDTO): Promise<Column> {
        const [column] = await this.db
            .insert(columnSchema)
            .values({
                name: dto.name,
                position: dto.position,
                departmentId: dto.departmentId,
                pipelineId: dto.pipelineId ?? null,
                color: dto.color ?? null,
            })
            .returning()

        return column
    }

    async updateColumn(dto: UpdateColumnDTO & { id: number; }): Promise<Column> {
        const [column] = await this.db
            .update(columnSchema)
            .set(dto)
            .where(eq(columnSchema.id, dto.id))
            .returning()

        return column
    }

    async softDeleteColumn(columnId: number): Promise<void> {
        await this.db
            .update(columnSchema)
            .set({ deletedAt: new Date() })
            .where(eq(columnSchema.id, columnId))
    }

    async reorderColumns(departmentId: number, columnIds: number[]): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < columnIds.length; i++) {
                await tx
                    .update(columnSchema)
                    .set({ position: i, updatedAt: new Date() })
                    .where(
                        and(
                            eq(columnSchema.id, columnIds[i]),
                            eq(columnSchema.departmentId, departmentId)
                        )
                    )
            }
        })
    }

    async reorderColumnsByPipeline(pipelineId: number, columnIds: number[]): Promise<void> {
        await this.db.transaction(async (tx) => {
            for (let i = 0; i < columnIds.length; i++) {
                await tx
                    .update(columnSchema)
                    .set({ position: i, updatedAt: new Date() })
                    .where(
                        and(
                            eq(columnSchema.id, columnIds[i]),
                            eq(columnSchema.pipelineId, pipelineId)
                        )
                    )
            }
        })
    }
}