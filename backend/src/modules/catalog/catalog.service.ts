import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import { NotFoundError, BadRequestError } from '../../infra/libs/errors.js'
import { AuditService } from '../../services/audit.service.js'
import { CatalogRepository } from './catalog.repository.js'
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
import type { Product, CatalogService as CatalogServiceRow, ProductCategory } from '../../infra/database/drizzle/schema.js'

@injectable()
export class CatalogService {
  constructor(
    @inject(TYPES.CatalogRepository) private repo: CatalogRepository,
    @inject(TYPES.AuditService) private audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  async getCategories(orgId: number): Promise<ProductCategory[]> {
    return this.repo.findAllCategories(orgId)
  }

  async getCategoryById(orgId: number, id: number): Promise<ProductCategory> {
    const category = await this.repo.findCategoryById(orgId, id)
    if (!category) throw new NotFoundError('Категория не найдена')
    return category
  }

  async createCategory(orgId: number, dto: CreateCategoryDTO): Promise<ProductCategory> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название категории обязательно')

    if (dto.parentId) {
      const parent = await this.repo.findCategoryById(orgId, dto.parentId)
      if (!parent) throw new BadRequestError('Родительская категория не найдена')
    }

    const category = await this.repo.createCategory(orgId, { ...dto, name })
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.category', entityId: category.id, action: 'created', payload: { name } }).catch(() => undefined)
    return category
  }

  async updateCategory(orgId: number, id: number, dto: UpdateCategoryDTO): Promise<ProductCategory> {
    await this.getCategoryById(orgId, id)

    if (dto.name !== undefined) {
      const name = dto.name?.trim()
      if (!name) throw new BadRequestError('Название категории не может быть пустым')
      dto = { ...dto, name }
    }

    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestError('Категория не может быть родителем самой себя')
      const parent = await this.repo.findCategoryById(orgId, dto.parentId)
      if (!parent) throw new BadRequestError('Родительская категория не найдена')
    }

    const updated = await this.repo.updateCategory(orgId, id, dto)
    if (!updated) throw new NotFoundError('Категория не найдена')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.category', entityId: id, action: 'updated', payload: dto as Record<string, unknown> }).catch(() => undefined)
    return updated
  }

  async deleteCategory(orgId: number, id: number): Promise<void> {
    await this.getCategoryById(orgId, id)
    const deleted = await this.repo.deleteCategory(orgId, id)
    if (!deleted) throw new NotFoundError('Категория не найдена')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.category', entityId: id, action: 'deleted' }).catch(() => undefined)
  }

  // ---------------------------------------------------------------------------
  // Warehouses and inventory
  // ---------------------------------------------------------------------------

  async getWarehouses(orgId: number) {
    return this.repo.findWarehouses(orgId)
  }

  async createWarehouse(orgId: number, userId: number, dto: {
    name: string
    code?: string
    address?: string
    responsibleUserId?: number | null
    active?: boolean
  }) {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название склада обязательно')
    const warehouse = await this.repo.createWarehouse(orgId, { ...dto, name })
    await this.audit.record({
      organizationId: orgId,
      actorUserId: userId,
      entityType: 'catalog.warehouse',
      entityId: warehouse.id,
      action: 'created',
      payload: { name },
    }).catch(() => undefined)
    return warehouse
  }

  async getStockMovements(orgId: number, productId?: number) {
    return this.repo.findStockMovements(orgId, productId)
  }

  async getInventorySummary(orgId: number) {
    return this.repo.getInventorySummary(orgId)
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async getProducts(orgId: number, filter: CatalogListFilter = {}): Promise<Product[]> {
    return this.repo.findAllProducts(orgId, filter)
  }

  async getProductById(orgId: number, id: number): Promise<Product> {
    const product = await this.repo.findProductById(orgId, id)
    if (!product) throw new NotFoundError('Товар не найден')
    return product
  }

  async createProduct(orgId: number, dto: CreateProductDTO): Promise<Product> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название товара обязательно')

    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestError('Цена не может быть отрицательной')
    }
    if (dto.costPrice !== undefined && dto.costPrice < 0) {
      throw new BadRequestError('Себестоимость не может быть отрицательной')
    }
    if (dto.stockQuantity !== undefined && dto.stockQuantity < 0) {
      throw new BadRequestError('Количество на складе не может быть отрицательным')
    }

    if (dto.sku) {
      const existing = await this.repo.findProductBySku(orgId, dto.sku)
      if (existing) throw new BadRequestError(`Товар с артикулом "${dto.sku}" уже существует`)
    }

    if (dto.categoryId) {
      const category = await this.repo.findCategoryById(orgId, dto.categoryId)
      if (!category) throw new BadRequestError('Категория не найдена')
    }

    const product = await this.repo.createProduct(orgId, { ...dto, name })
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.product', entityId: product.id, action: 'created', payload: { name, sku: product.sku } }).catch(() => undefined)
    return product
  }

  async updateProduct(orgId: number, id: number, dto: UpdateProductDTO): Promise<Product> {
    await this.getProductById(orgId, id)

    if (dto.name !== undefined) {
      const name = dto.name?.trim()
      if (!name) throw new BadRequestError('Название товара не может быть пустым')
      dto = { ...dto, name }
    }

    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestError('Цена не может быть отрицательной')
    }
    if (dto.costPrice !== undefined && dto.costPrice < 0) {
      throw new BadRequestError('Себестоимость не может быть отрицательной')
    }

    if (dto.sku) {
      const existing = await this.repo.findProductBySku(orgId, dto.sku)
      if (existing && existing.id !== id) {
        throw new BadRequestError(`Товар с артикулом "${dto.sku}" уже существует`)
      }
    }

    if (dto.categoryId) {
      const category = await this.repo.findCategoryById(orgId, dto.categoryId)
      if (!category) throw new BadRequestError('Категория не найдена')
    }

    const updated = await this.repo.updateProduct(orgId, id, dto)
    if (!updated) throw new NotFoundError('Товар не найден')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.product', entityId: id, action: 'updated', payload: dto as Record<string, unknown> }).catch(() => undefined)
    return updated
  }

  async adjustStock(orgId: number, id: number, userId: number, dto: AdjustStockDTO): Promise<Product> {
    const product = await this.getProductById(orgId, id)

    if (!Number.isInteger(dto.delta)) {
      throw new BadRequestError('delta должна быть целым числом')
    }

    const newStock = product.stockQuantity + dto.delta
    if (newStock < 0) {
      throw new BadRequestError(`Недостаточно товара на складе. Текущий остаток: ${product.stockQuantity}`)
    }

    const updated = await this.repo.adjustStock(orgId, id, dto, userId)
    if (!updated) throw new NotFoundError('Товар не найден')
    await this.audit.record({
      organizationId: orgId,
      actorUserId: userId,
      entityType: 'catalog.stock',
      entityId: id,
      action: dto.type ?? 'adjustment',
      payload: { delta: dto.delta, newStock: updated.stockQuantity, reason: dto.reason ?? null },
    }).catch(() => undefined)
    return updated
  }

  async deleteProduct(orgId: number, id: number): Promise<void> {
    await this.getProductById(orgId, id)
    const deleted = await this.repo.deleteProduct(orgId, id)
    if (!deleted) throw new NotFoundError('Товар не найден')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.product', entityId: id, action: 'deleted' }).catch(() => undefined)
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  async getServices(orgId: number, filter: CatalogListFilter = {}): Promise<CatalogServiceRow[]> {
    return this.repo.findAllServices(orgId, filter)
  }

  async getServiceById(orgId: number, id: number): Promise<CatalogServiceRow> {
    const service = await this.repo.findServiceById(orgId, id)
    if (!service) throw new NotFoundError('Услуга не найдена')
    return service
  }

  async createService(orgId: number, dto: CreateServiceDTO): Promise<CatalogServiceRow> {
    const name = dto.name?.trim()
    if (!name) throw new BadRequestError('Название услуги обязательно')

    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestError('Цена не может быть отрицательной')
    }
    if (dto.durationHours !== undefined && dto.durationHours !== null && dto.durationHours < 0) {
      throw new BadRequestError('Длительность не может быть отрицательной')
    }

    const service = await this.repo.createService(orgId, { ...dto, name })
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.service', entityId: service.id, action: 'created', payload: { name } }).catch(() => undefined)
    return service
  }

  async updateService(orgId: number, id: number, dto: UpdateServiceDTO): Promise<CatalogServiceRow> {
    await this.getServiceById(orgId, id)

    if (dto.name !== undefined) {
      const name = dto.name?.trim()
      if (!name) throw new BadRequestError('Название услуги не может быть пустым')
      dto = { ...dto, name }
    }

    if (dto.price !== undefined && dto.price < 0) {
      throw new BadRequestError('Цена не может быть отрицательной')
    }

    const updated = await this.repo.updateService(orgId, id, dto)
    if (!updated) throw new NotFoundError('Услуга не найдена')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.service', entityId: id, action: 'updated', payload: dto as Record<string, unknown> }).catch(() => undefined)
    return updated
  }

  async deleteService(orgId: number, id: number): Promise<void> {
    await this.getServiceById(orgId, id)
    const deleted = await this.repo.deleteService(orgId, id)
    if (!deleted) throw new NotFoundError('Услуга не найдена')
    await this.audit.record({ organizationId: orgId, entityType: 'catalog.service', entityId: id, action: 'deleted' }).catch(() => undefined)
  }
}
