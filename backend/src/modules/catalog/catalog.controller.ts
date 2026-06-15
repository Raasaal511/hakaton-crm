import { injectable, inject } from 'inversify'
import type { FastifyPluginAsync } from 'fastify'
import { TYPES } from '../../types.js'
import { CatalogService } from './catalog.service.js'
import { RbacService, type CoreCapability } from '../../services/rbac.service.js'
import { authMiddleware } from '../../middlewares/authMiddleware.js'
import { BadRequestError } from '../../infra/libs/errors.js'
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
export class CatalogController {
  constructor(
    @inject(TYPES.CatalogService) private catalogService: CatalogService,
    @inject(TYPES.RbacService) private rbac: RbacService,
  ) {}

  private async ensure(req: { user?: { id: number } }, orgId: number, capability: CoreCapability) {
    await this.rbac.ensureCapability(orgId, req.user!.id, capability)
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  getCategories: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/catalog/categories',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')
        const categories = await this.catalogService.getCategories(orgId)
        return reply.send(categories)
      },
    )
  }

  createCategory: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateCategoryDTO }>(
      '/catalog/categories',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.write')
        const category = await this.catalogService.createCategory(orgId, req.body)
        return reply.status(201).send(category)
      },
    )
  }

  updateCategory: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateCategoryDTO }>(
      '/catalog/categories/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id категории')
        await this.ensure(req, orgId, 'catalog.write')
        const category = await this.catalogService.updateCategory(orgId, id, req.body)
        return reply.send(category)
      },
    )
  }

  deleteCategory: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/catalog/categories/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id категории')
        await this.ensure(req, orgId, 'catalog.write')
        await this.catalogService.deleteCategory(orgId, id)
        return reply.status(204).send()
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Warehouses and inventory
  // ---------------------------------------------------------------------------

  getWarehouses: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/catalog/warehouses',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')
        return reply.send(await this.catalogService.getWarehouses(orgId))
      },
    )
  }

  createWarehouse: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: { name: string; code?: string; address?: string; responsibleUserId?: number | null; active?: boolean } }>(
      '/catalog/warehouses',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.inventory')
        return reply.status(201).send(await this.catalogService.createWarehouse(orgId, req.user!.id, req.body))
      },
    )
  }

  getStockMovements: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string; productId?: string } }>(
      '/catalog/stock-movements',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')
        return reply.send(await this.catalogService.getStockMovements(
          orgId,
          req.query.productId ? Number(req.query.productId) : undefined,
        ))
      },
    )
  }

  getInventorySummary: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string } }>(
      '/catalog/inventory/summary',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')
        return reply.send(await this.catalogService.getInventorySummary(orgId))
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  getProducts: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: {
        orgId: string
        q?: string
        categoryId?: string
        active?: string
        limit?: string
        offset?: string
      }
    }>(
      '/catalog/products',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')

        const filter: CatalogListFilter = {
          q: req.query.q,
          categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
          active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const products = await this.catalogService.getProducts(orgId, filter)
        return reply.send(products)
      },
    )
  }

  createProduct: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateProductDTO }>(
      '/catalog/products',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.write')
        const product = await this.catalogService.createProduct(orgId, req.body)
        return reply.status(201).send(product)
      },
    )
  }

  getProductById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/catalog/products/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id товара')
        await this.ensure(req, orgId, 'catalog.read')
        const product = await this.catalogService.getProductById(orgId, id)
        return reply.send(product)
      },
    )
  }

  updateProduct: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateProductDTO }>(
      '/catalog/products/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id товара')
        await this.ensure(req, orgId, 'catalog.write')
        const product = await this.catalogService.updateProduct(orgId, id, req.body)
        return reply.send(product)
      },
    )
  }

  deleteProduct: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/catalog/products/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id товара')
        await this.ensure(req, orgId, 'catalog.write')
        await this.catalogService.deleteProduct(orgId, id)
        return reply.status(204).send()
      },
    )
  }

  adjustStock: FastifyPluginAsync = async (fastify) => {
    fastify.patch<{ Querystring: { orgId: string }; Params: { id: string }; Body: AdjustStockDTO }>(
      '/catalog/products/:id/stock',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id товара')
        await this.ensure(req, orgId, 'catalog.inventory')
        const product = await this.catalogService.adjustStock(orgId, id, req.user!.id, req.body)
        return reply.send(product)
      },
    )
  }

  // ---------------------------------------------------------------------------
  // Services
  // ---------------------------------------------------------------------------

  getServices: FastifyPluginAsync = async (fastify) => {
    fastify.get<{
      Querystring: {
        orgId: string
        q?: string
        active?: string
        limit?: string
        offset?: string
      }
    }>(
      '/catalog/services',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.read')

        const filter: CatalogListFilter = {
          q: req.query.q,
          active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
          limit: req.query.limit ? Number(req.query.limit) : 50,
          offset: req.query.offset ? Number(req.query.offset) : 0,
        }

        const services = await this.catalogService.getServices(orgId, filter)
        return reply.send(services)
      },
    )
  }

  createService: FastifyPluginAsync = async (fastify) => {
    fastify.post<{ Querystring: { orgId: string }; Body: CreateServiceDTO }>(
      '/catalog/services',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        await this.ensure(req, orgId, 'catalog.write')
        const service = await this.catalogService.createService(orgId, req.body)
        return reply.status(201).send(service)
      },
    )
  }

  getServiceById: FastifyPluginAsync = async (fastify) => {
    fastify.get<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/catalog/services/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id услуги')
        await this.ensure(req, orgId, 'catalog.read')
        const service = await this.catalogService.getServiceById(orgId, id)
        return reply.send(service)
      },
    )
  }

  updateService: FastifyPluginAsync = async (fastify) => {
    fastify.put<{ Querystring: { orgId: string }; Params: { id: string }; Body: UpdateServiceDTO }>(
      '/catalog/services/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id услуги')
        await this.ensure(req, orgId, 'catalog.write')
        const service = await this.catalogService.updateService(orgId, id, req.body)
        return reply.send(service)
      },
    )
  }

  deleteService: FastifyPluginAsync = async (fastify) => {
    fastify.delete<{ Querystring: { orgId: string }; Params: { id: string } }>(
      '/catalog/services/:id',
      { preHandler: [authMiddleware] },
      async (req, reply) => {
        const orgId = Number(req.query.orgId)
        const id = Number(req.params.id)
        if (!orgId) throw new BadRequestError('orgId обязателен')
        if (!id) throw new BadRequestError('Некорректный id услуги')
        await this.ensure(req, orgId, 'catalog.write')
        await this.catalogService.deleteService(orgId, id)
        return reply.status(204).send()
      },
    )
  }
}
