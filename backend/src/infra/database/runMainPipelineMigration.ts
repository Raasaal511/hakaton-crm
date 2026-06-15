import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from './drizzle/client.js'
import { columnSchema, pipelinesSchema, taskSchema } from './drizzle/schema.js'
import { mainPipelineColumnColor } from '../libs/mainPipelineColumnColors.js'

const MAIN_PIPELINE_NAME = 'Основная воронка'
const LEGACY_DEFAULT_NAME = 'По умолчанию'

const MAIN_COLUMN_NAMES = ['Задачи', 'В работе', 'На проверке', 'Завершенные'] as const

const LEGACY_FIRST_COLUMN_NAME = 'Задача'

/**
 * Ранее первая колонка называлась «Задача»; переименовываем в «Задачи» для существующих воронок.
 */
async function renameLegacyFirstColumnName(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  const rows = await tx
    .select({ id: columnSchema.id })
    .from(columnSchema)
    .innerJoin(pipelinesSchema, eq(columnSchema.pipelineId, pipelinesSchema.id))
    .where(
      and(
        isNull(pipelinesSchema.deletedAt),
        isNull(columnSchema.deletedAt),
        eq(columnSchema.name, LEGACY_FIRST_COLUMN_NAME),
        eq(columnSchema.position, 0),
        or(eq(pipelinesSchema.isMainTemplate, true), eq(pipelinesSchema.name, MAIN_PIPELINE_NAME)),
      ),
    )

  for (const row of rows) {
    await tx
      .update(columnSchema)
      .set({ name: MAIN_COLUMN_NAMES[0], updatedAt: new Date() })
      .where(eq(columnSchema.id, row.id))
  }
}

/** Индекс старой колонки (0..n-1 по position) → новая позиция 0..3 */
function mapOldIndexToNew(n: number, oldIdx: number): number {
  if (n <= 1) return 0
  if (oldIdx === 0) return 0
  if (oldIdx === n - 1) return 3
  const middleCount = n - 2
  const midPos = oldIdx - 1
  if (middleCount <= 1) return 1
  const half = Math.ceil(middleCount / 2)
  return midPos < half ? 1 : 2
}

function columnsMatchMain(cols: { name: string; position: number }[]): boolean {
  if (cols.length !== 4) return false
  const sorted = [...cols].sort((a, b) => a.position - b.position)
  return MAIN_COLUMN_NAMES.every((name, i) => sorted[i]?.name === name && sorted[i]?.position === i)
}

async function backfillMainPipelineColumnColors(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<void> {
  const rows = await tx
    .select({ id: columnSchema.id, position: columnSchema.position })
    .from(columnSchema)
    .innerJoin(pipelinesSchema, eq(columnSchema.pipelineId, pipelinesSchema.id))
    .where(
      and(
        eq(pipelinesSchema.isMainTemplate, true),
        isNull(pipelinesSchema.deletedAt),
        isNull(columnSchema.deletedAt),
        inArray(columnSchema.position, [0, 1, 2, 3]),
        or(isNull(columnSchema.color), eq(columnSchema.color, '')),
      ),
    )

  for (const row of rows) {
    const color = mainPipelineColumnColor(row.position)
    if (!color) continue
    await tx
      .update(columnSchema)
      .set({ color, updatedAt: new Date() })
      .where(eq(columnSchema.id, row.id))
  }
}

/**
 * Идемпотентно: объединяет «По умолчанию» с «Основная воронка», приводит основную воронку к 4 колонкам.
 */
export async function runMainPipelineMigration(): Promise<void> {
  await db.transaction(async (tx) => {
    await renameLegacyFirstColumnName(tx)

    const allPipelines = await tx
      .select()
      .from(pipelinesSchema)
      .where(isNull(pipelinesSchema.deletedAt))

    const byDept = new Map<number, typeof allPipelines>()
    for (const p of allPipelines) {
      const list = byDept.get(p.departmentId) ?? []
      list.push(p)
      byDept.set(p.departmentId, list)
    }

    for (const [, pipes] of byDept) {
      const main = pipes.find((p) => p.name === MAIN_PIPELINE_NAME)
      const legacy = pipes.find((p) => p.name === LEGACY_DEFAULT_NAME)

      if (main && legacy) {
        const mainCols = await tx
          .select()
          .from(columnSchema)
          .where(and(eq(columnSchema.pipelineId, main.id), isNull(columnSchema.deletedAt)))
          .orderBy(asc(columnSchema.position))
        const firstMainCol = mainCols[0]
        if (!firstMainCol) continue

        const legacyCols = await tx
          .select()
          .from(columnSchema)
          .where(and(eq(columnSchema.pipelineId, legacy.id), isNull(columnSchema.deletedAt)))

        const legacyColIds = legacyCols.map((c) => c.id)
        if (legacyColIds.length > 0) {
          await tx
            .update(taskSchema)
            .set({ columnId: firstMainCol.id, updatedAt: new Date() })
            .where(and(inArray(taskSchema.columnId, legacyColIds), isNull(taskSchema.deletedAt)))
        }

        for (const c of legacyCols) {
          await tx
            .update(columnSchema)
            .set({ deletedAt: new Date() })
            .where(eq(columnSchema.id, c.id))
        }

        await tx
          .update(pipelinesSchema)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(pipelinesSchema.id, legacy.id))
      } else if (!main && legacy) {
        await tx
          .update(pipelinesSchema)
          .set({ name: MAIN_PIPELINE_NAME, updatedAt: new Date() })
          .where(eq(pipelinesSchema.id, legacy.id))
      }
    }

    const mainPipelines = await tx
      .select()
      .from(pipelinesSchema)
      .where(and(eq(pipelinesSchema.name, MAIN_PIPELINE_NAME), isNull(pipelinesSchema.deletedAt)))

    for (const pipeline of mainPipelines) {
      const cols = await tx
        .select()
        .from(columnSchema)
        .where(and(eq(columnSchema.pipelineId, pipeline.id), isNull(columnSchema.deletedAt)))
        .orderBy(asc(columnSchema.position))

      if (pipeline.isMainTemplate && columnsMatchMain(cols)) {
        continue
      }

      if (cols.length === 4 && columnsMatchMain(cols)) {
        await tx
          .update(pipelinesSchema)
          .set({ isMainTemplate: true, updatedAt: new Date() })
          .where(eq(pipelinesSchema.id, pipeline.id))
        continue
      }

      const n = cols.length
      if (n === 0) {
        for (let pos = 0; pos < 4; pos++) {
          await tx.insert(columnSchema).values({
            name: MAIN_COLUMN_NAMES[pos],
            position: pos,
            departmentId: pipeline.departmentId,
            pipelineId: pipeline.id,
            color: mainPipelineColumnColor(pos),
          })
        }
        await tx
          .update(pipelinesSchema)
          .set({ isMainTemplate: true, updatedAt: new Date() })
          .where(eq(pipelinesSchema.id, pipeline.id))
        continue
      }

      const newColRows = await tx
        .insert(columnSchema)
        .values(
          MAIN_COLUMN_NAMES.map((name, pos) => ({
            name,
            position: pos,
            departmentId: pipeline.departmentId,
            pipelineId: pipeline.id,
            color: mainPipelineColumnColor(pos),
          })),
        )
        .returning()

      const byPos = new Map<number, number>()
      for (const row of newColRows) {
        byPos.set(row.position, row.id)
      }

      for (let i = 0; i < n; i++) {
        const oldCol = cols[i]
        const targetPos = mapOldIndexToNew(n, i)
        const newColId = byPos.get(targetPos)
        if (newColId == null) continue

        await tx
          .update(taskSchema)
          .set({ columnId: newColId, updatedAt: new Date() })
          .where(and(eq(taskSchema.columnId, oldCol.id), isNull(taskSchema.deletedAt)))
      }

      for (const c of cols) {
        await tx
          .update(columnSchema)
          .set({ deletedAt: new Date() })
          .where(eq(columnSchema.id, c.id))
      }

      for (const pos of [0, 1, 2, 3]) {
        const colId = byPos.get(pos)
        if (colId == null) continue
        const tasksInCol = await tx
          .select({ id: taskSchema.id })
          .from(taskSchema)
          .where(and(eq(taskSchema.columnId, colId), isNull(taskSchema.deletedAt)))
          .orderBy(asc(taskSchema.id))
        let p = 0
        for (const t of tasksInCol) {
          await tx
            .update(taskSchema)
            .set({ position: p, updatedAt: new Date() })
            .where(eq(taskSchema.id, t.id))
          p += 1
        }
      }

      await tx
        .update(pipelinesSchema)
        .set({ isMainTemplate: true, updatedAt: new Date() })
        .where(eq(pipelinesSchema.id, pipeline.id))
    }

    await backfillMainPipelineColumnColors(tx)
  })
}
