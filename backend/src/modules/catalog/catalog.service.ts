import { injectable, inject } from 'inversify'
import { TYPES } from '../../types.js'
import { NotFoundError, BadRequestError } from '../../infra/libs/errors.js'
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
  constructor(@inject(TYPES.CatalogRepository) private repo: CatalogRepository) {}

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

    return this.repo.createCategory(orgId, { ...dto, name })
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
    return updated
  }

  async deleteCategory(orgId: number, id: number): Promise<void> {
    await this.getCategoryById(orgId, id)
    const deleted = await this.repo.deleteCategory(orgId, id)
    if (!deleted) throw new NotFoundError('Категория не найдена')
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

    return this.repo.createProduct(orgId, { ...dto, name })
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
    return updated
  }

  async adjustStock(orgId: number, id: number, dto: AdjustStockDTO): Promise<Product> {
    const product = await this.getProductById(orgId, id)

    if (!Number.isInteger(dto.delta)) {
      throw new BadRequestError('delta должна быть целым числом')
    }

    const newStock = product.stockQuantity + dto.delta
    if (newStock < 0) {
      throw new BadRequestError(`Недостаточно товара на складе. Текущий остаток: ${product.stockQuantity}`)
    }

    const updated = await this.repo.adjustStock(orgId, id, dto)
    if (!updated) throw new NotFoundError('Товар не найден')
    return updated
  }

  async deleteProduct(orgId: number, id: number): Promise<void> {
    await this.getProductById(orgId, id)
    const deleted = await this.repo.deleteProduct(orgId, id)
    if (!deleted) throw new NotFoundError('Товар не найден')
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

    return this.repo.createService(orgId, { ...dto, name })
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
    return updated
  }

  async deleteService(orgId: number, id: number): Promise<void> {
    await this.getServiceById(orgId, id)
    const deleted = await this.repo.deleteService(orgId, id)
    if (!deleted) throw new NotFoundError('Услуга не найдена')
  }
}
