import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import type { DB } from '../../infra/database/drizzle/client.js'
import {
  productCategoriesSchema,
  productPriceHistorySchema,
  productsSchema,
  stockMovementsSchema,
  servicesSchema,
  warehousesSchema,
  Product,
  CatalogService,
  ProductCategory,
  Warehouse,
  StockMovement,
} from '../../infra/database/drizzle/schema.js'
import { eq, and, isNull, ilike, sql, desc } from 'drizzle-orm'
import type {
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CreateProductDTO,
  UpdateProductDTO,
  AdjustStockDTO,
  CreateServiceDTO,
  UpdateServiceDTO,
  CatalogListFilter,
} from './catalog.types.js'

@injectable()
export class CatalogRepository {
  constructor(@inject(TYPES.DB) private db: DB) {}

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async findAllCategories(orgId: number): Promise<ProductCategory[]> {
    return this.db
      .select()
      .from(productCategoriesSchema)
      .where(eq(productCategoriesSchema.organizationId, orgId))
      .orderBy(productCategoriesSchema.name)
  }

  async findCategoryById(orgId: number, id: number): Promise<ProductCategory | null> {
    const rows = await this.db
      .select()
      .from(productCategoriesSchema)
      .where(
        and(
          eq(productCategoriesSchema.id, id),
          eq(productCategoriesSchema.organizationId, orgId),
        ),
      )
    return rows[0] ?? null
  }

  async createCategory(orgId: number, dto: CreateCategoryDTO): Promise<ProductCategory> {
    const [row] = await this.db
      .insert(productCategoriesSchema)
      .values({
        organizationId: orgId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        color: dto.color ?? null,
      })
      .returning()
    return row!
  }

  async updateCategory(orgId: number, id: number, dto: UpdateCategoryDTO): Promise<ProductCategory | null> {
    const patch: Partial<typeof productCategoriesSchema.$inferInsert> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.parentId !== undefined) patch.parentId = dto.parentId
    if (dto.color !== undefined) patch.color = dto.color

    const rows = await this.db
      .update(productCategoriesSchema)
      .set(patch)
      .where(
        and(
          eq(productCategoriesSchema.id, id),
          eq(productCategoriesSchema.organizationId, orgId),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async deleteCategory(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .delete(productCategoriesSchema)
      .where(
        and(
          eq(productCategoriesSchema.id, id),
          eq(productCategoriesSchema.organizationId, orgId),
        ),
      )
      .returning({ id: productCategoriesSchema.id })
    return rows.length > 0
  }

  // ---------------------------------------------------------------------------
  // Warehouses and stock ledger
  // ---------------------------------------------------------------------------

  async findWarehouses(orgId: number): Promise<Warehouse[]> {
    return this.db
      .select()
      .from(warehousesSchema)
      .where(eq(warehousesSchema.organizationId, orgId))
      .orderBy(warehousesSchema.name)
  }

  async createWarehouse(orgId: number, dto: {
    name: string
    code?: string
    address?: string
    responsibleUserId?: number | null
    active?: boolean
  }): Promise<Warehouse> {
    const [row] = await this.db.insert(warehousesSchema).values({
      organizationId: orgId,
      name: dto.name,
      code: dto.code ?? null,
      address: dto.address ?? null,
      responsibleUserId: dto.responsibleUserId ?? null,
      active: dto.active ?? true,
    }).returning()
    return row!
  }

  async findStockMovements(orgId: number, productId?: number): Promise<StockMovement[]> {
    const conditions = [eq(stockMovementsSchema.organizationId, orgId)]
    if (productId) conditions.push(eq(stockMovementsSchema.productId, productId))
    return this.db
      .select()
      .from(stockMovementsSchema)
      .where(and(...conditions))
      .orderBy(desc(stockMovementsSchema.createdAt))
      .limit(200)
  }

  async getInventorySummary(orgId: number): Promise<{
    skuCount: number
    stockValue: number
    potentialRevenue: number
    potentialProfit: number
  }> {
    const rows = await this.db
      .select({
        skuCount: sql<number>`count(*)::int`,
        stockValue: sql<number>`coalesce(sum(${productsSchema.stockQuantity} * ${productsSchema.costPrice}), 0)::int`,
        potentialRevenue: sql<number>`coalesce(sum(${productsSchema.stockQuantity} * ${productsSchema.price}), 0)::int`,
        potentialProfit: sql<number>`coalesce(sum(${productsSchema.stockQuantity} * (${productsSchema.price} - ${productsSchema.costPrice})), 0)::int`,
      })
      .from(productsSchema)
      .where(and(eq(productsSchema.organizationId, orgId), isNull(productsSchema.deletedAt)))

    return {
      skuCount: Number(rows[0]?.skuCount ?? 0),
      stockValue: Number(rows[0]?.stockValue ?? 0),
      potentialRevenue: Number(rows[0]?.potentialRevenue ?? 0),
      potentialProfit: Number(rows[0]?.potentialProfit ?? 0),
    }
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async findAllProducts(orgId: number, filter: CatalogListFilter = {}): Promise<Product[]> {
    const conditions = [
      eq(productsSchema.organizationId, orgId),
      isNull(productsSchema.deletedAt),
    ]

    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(
        ilike(productsSchema.name, pattern),
      )
    }
    if (filter.categoryId) {
      conditions.push(eq(productsSchema.categoryId, filter.categoryId))
    }
    if (filter.active !== undefined) {
      conditions.push(eq(productsSchema.active, filter.active))
    }

    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    return this.db
      .select()
      .from(productsSchema)
      .where(and(...conditions))
      .orderBy(productsSchema.name)
      .limit(limit)
      .offset(offset)
  }

  async findProductById(orgId: number, id: number): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(productsSchema)
      .where(
        and(
          eq(productsSchema.id, id),
          eq(productsSchema.organizationId, orgId),
          isNull(productsSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async findProductBySku(orgId: number, sku: string): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(productsSchema)
      .where(
        and(
          eq(productsSchema.organizationId, orgId),
          eq(productsSchema.sku, sku),
          isNull(productsSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async createProduct(orgId: number, dto: CreateProductDTO): Promise<Product> {
    const [row] = await this.db
      .insert(productsSchema)
      .values({
        organizationId: orgId,
        categoryId: dto.categoryId ?? null,
        name: dto.name,
        sku: dto.sku ?? null,
        description: dto.description ?? null,
        price: dto.price ?? 0,
        costPrice: dto.costPrice ?? 0,
        currency: dto.currency ?? 'RUB',
        unit: dto.unit ?? 'шт',
        stockQuantity: dto.stockQuantity ?? 0,
        minStockQuantity: dto.minStockQuantity ?? 0,
        active: dto.active ?? true,
      })
      .returning()
    await this.recordPriceHistory(orgId, row!.id, row!.price, row!.costPrice, null)
    if ((dto.stockQuantity ?? 0) > 0) {
      await this.recordStockMovement(orgId, row!.id, {
        delta: row!.stockQuantity,
        type: 'inventory',
        reason: 'initial_stock',
        unitCost: row!.costPrice,
      }, null)
    }
    return row!
  }

  async updateProduct(orgId: number, id: number, dto: UpdateProductDTO): Promise<Product | null> {
    const patch: Partial<typeof productsSchema.$inferInsert> = {}
    if (dto.categoryId !== undefined) patch.categoryId = dto.categoryId
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.sku !== undefined) patch.sku = dto.sku
    if (dto.description !== undefined) patch.description = dto.description
    if (dto.price !== undefined) patch.price = dto.price
    if (dto.costPrice !== undefined) patch.costPrice = dto.costPrice
    if (dto.currency !== undefined) patch.currency = dto.currency
    if (dto.unit !== undefined) patch.unit = dto.unit
    if (dto.stockQuantity !== undefined) patch.stockQuantity = dto.stockQuantity
    if (dto.minStockQuantity !== undefined) patch.minStockQuantity = dto.minStockQuantity
    if (dto.active !== undefined) patch.active = dto.active

    const rows = await this.db
      .update(productsSchema)
      .set(patch)
      .where(
        and(
          eq(productsSchema.id, id),
          eq(productsSchema.organizationId, orgId),
          isNull(productsSchema.deletedAt),
        ),
      )
      .returning()
    const updated = rows[0] ?? null
    if (updated && (dto.price !== undefined || dto.costPrice !== undefined)) {
      await this.recordPriceHistory(orgId, updated.id, updated.price, updated.costPrice, null)
    }
    return updated
  }

  async adjustStock(orgId: number, id: number, dto: AdjustStockDTO, actorUserId: number | null = null): Promise<Product | null> {
    const rows = await this.db
      .update(productsSchema)
      .set({
        stockQuantity: sql`${productsSchema.stockQuantity} + ${dto.delta}`,
      })
      .where(
        and(
          eq(productsSchema.id, id),
          eq(productsSchema.organizationId, orgId),
          isNull(productsSchema.deletedAt),
        ),
      )
      .returning()
    const updated = rows[0] ?? null
    if (updated) {
      await this.recordStockMovement(orgId, id, dto, actorUserId)
    }
    return updated
  }

  async recordStockMovement(
    orgId: number,
    productId: number,
    dto: AdjustStockDTO,
    actorUserId: number | null,
  ): Promise<void> {
    await this.db.insert(stockMovementsSchema).values({
      organizationId: orgId,
      productId,
      warehouseId: dto.warehouseId ?? null,
      targetWarehouseId: dto.targetWarehouseId ?? null,
      type: dto.type ?? 'adjustment',
      quantity: dto.delta,
      unitCost: dto.unitCost ?? 0,
      reason: dto.reason ?? null,
      actorUserId,
    })
  }

  async recordPriceHistory(
    orgId: number,
    productId: number,
    price: number,
    costPrice: number,
    changedByUserId: number | null,
  ): Promise<void> {
    await this.db.insert(productPriceHistorySchema).values({
      organizationId: orgId,
      productId,
      price,
      costPrice,
      changedByUserId,
    })
  }

  async deleteProduct(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(productsSchema)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(productsSchema.id, id),
          eq(productsSchema.organizationId, orgId),
          isNull(productsSchema.deletedAt),
        ),
      )
      .returning({ id: productsSchema.id })
    return rows.length > 0
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  async findAllServices(orgId: number, filter: CatalogListFilter = {}): Promise<CatalogService[]> {
    const conditions = [
      eq(servicesSchema.organizationId, orgId),
      isNull(servicesSchema.deletedAt),
    ]

    if (filter.q) {
      const pattern = `%${filter.q.trim().slice(0, 200).replace(/[%_\\]/g, '')}%`
      conditions.push(ilike(servicesSchema.name, pattern))
    }
    if (filter.active !== undefined) {
      conditions.push(eq(servicesSchema.active, filter.active))
    }

    const limit = filter.limit ?? 50
    const offset = filter.offset ?? 0

    return this.db
      .select()
      .from(servicesSchema)
      .where(and(...conditions))
      .orderBy(servicesSchema.name)
      .limit(limit)
      .offset(offset)
  }

  async findServiceById(orgId: number, id: number): Promise<CatalogService | null> {
    const rows = await this.db
      .select()
      .from(servicesSchema)
      .where(
        and(
          eq(servicesSchema.id, id),
          eq(servicesSchema.organizationId, orgId),
          isNull(servicesSchema.deletedAt),
        ),
      )
    return rows[0] ?? null
  }

  async createService(orgId: number, dto: CreateServiceDTO): Promise<CatalogService> {
    const [row] = await this.db
      .insert(servicesSchema)
      .values({
        organizationId: orgId,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category ?? null,
        price: dto.price ?? 0,
        currency: dto.currency ?? 'RUB',
        unit: dto.unit ?? 'час',
        durationHours: dto.durationHours ?? null,
        active: dto.active ?? true,
      })
      .returning()
    return row!
  }

  async updateService(orgId: number, id: number, dto: UpdateServiceDTO): Promise<CatalogService | null> {
    const patch: Partial<typeof servicesSchema.$inferInsert> = {}
    if (dto.name !== undefined) patch.name = dto.name
    if (dto.description !== undefined) patch.description = dto.description
    if (dto.category !== undefined) patch.category = dto.category
    if (dto.price !== undefined) patch.price = dto.price
    if (dto.currency !== undefined) patch.currency = dto.currency
    if (dto.unit !== undefined) patch.unit = dto.unit
    if (dto.durationHours !== undefined) patch.durationHours = dto.durationHours
    if (dto.active !== undefined) patch.active = dto.active

    const rows = await this.db
      .update(servicesSchema)
      .set(patch)
      .where(
        and(
          eq(servicesSchema.id, id),
          eq(servicesSchema.organizationId, orgId),
          isNull(servicesSchema.deletedAt),
        ),
      )
      .returning()
    return rows[0] ?? null
  }

  async deleteService(orgId: number, id: number): Promise<boolean> {
    const rows = await this.db
      .update(servicesSchema)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(servicesSchema.id, id),
          eq(servicesSchema.organizationId, orgId),
          isNull(servicesSchema.deletedAt),
        ),
      )
      .returning({ id: servicesSchema.id })
    return rows.length > 0
  }
}
