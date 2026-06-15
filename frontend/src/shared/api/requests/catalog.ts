import { axiosAPI } from '../axios'

function normalizeList<T>(data: T[] | { items: T[]; total: number }) {
  return Array.isArray(data) ? { items: data, total: data.length } : data
}

export type ProductCategory = {
  id: number
  organizationId: number
  name: string
  parentId: number | null
  color: string | null
  createdAt: string
}

export type Product = {
  id: number
  organizationId: number
  categoryId: number | null
  name: string
  sku: string | null
  description: string | null
  price: number
  costPrice: number
  currency: string
  unit: string
  stockQuantity: number
  minStockQuantity: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export type CatalogService = {
  id: number
  organizationId: number
  name: string
  description: string | null
  category: string | null
  price: number
  currency: string
  unit: string
  durationHours: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type Warehouse = {
  id: number
  organizationId: number
  name: string
  code: string | null
  address: string | null
  responsibleUserId: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type StockMovement = {
  id: number
  organizationId: number
  productId: number
  warehouseId: number | null
  targetWarehouseId: number | null
  type: string
  quantity: number
  unitCost: number
  reason: string | null
  actorUserId: number | null
  createdAt: string
}

export type InventorySummary = {
  skuCount: number
  stockValue: number
  potentialRevenue: number
  potentialProfit: number
}

export const catalogAPI = {
  // Categories
  getCategories: (orgId: number) =>
    axiosAPI.get<ProductCategory[]>('/catalog/categories', { params: { orgId } }).then((r) => r.data),

  createCategory: (orgId: number, dto: { name: string; color?: string; parentId?: number }) =>
    axiosAPI.post<ProductCategory>('/catalog/categories', dto, { params: { orgId } }).then((r) => r.data),

  updateCategory: (orgId: number, id: number, dto: { name?: string; color?: string }) =>
    axiosAPI.put<ProductCategory>(`/catalog/categories/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteCategory: (orgId: number, id: number) =>
    axiosAPI.delete(`/catalog/categories/${id}`, { params: { orgId } }),

  // Products
  getProducts: (orgId: number, filter?: { q?: string; categoryId?: number; active?: boolean; limit?: number; offset?: number }) =>
    axiosAPI.get<Product[] | { items: Product[]; total: number }>('/catalog/products', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  getProductById: (orgId: number, id: number) =>
    axiosAPI.get<Product>(`/catalog/products/${id}`, { params: { orgId } }).then((r) => r.data),

  createProduct: (orgId: number, dto: Partial<Product>) =>
    axiosAPI.post<Product>('/catalog/products', dto, { params: { orgId } }).then((r) => r.data),

  updateProduct: (orgId: number, id: number, dto: Partial<Product>) =>
    axiosAPI.put<Product>(`/catalog/products/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteProduct: (orgId: number, id: number) =>
    axiosAPI.delete(`/catalog/products/${id}`, { params: { orgId } }),

  adjustStock: (orgId: number, id: number, delta: number, reason?: string) =>
    axiosAPI.patch<Product>(`/catalog/products/${id}/stock`, { delta, reason }, { params: { orgId } }).then((r) => r.data),

  // Services
  getServices: (orgId: number, filter?: { q?: string; category?: string; active?: boolean; limit?: number; offset?: number }) =>
    axiosAPI.get<CatalogService[] | { items: CatalogService[]; total: number }>('/catalog/services', {
      params: { orgId, ...filter },
    }).then((r) => normalizeList(r.data)),

  getServiceById: (orgId: number, id: number) =>
    axiosAPI.get<CatalogService>(`/catalog/services/${id}`, { params: { orgId } }).then((r) => r.data),

  createService: (orgId: number, dto: Partial<CatalogService>) =>
    axiosAPI.post<CatalogService>('/catalog/services', dto, { params: { orgId } }).then((r) => r.data),

  updateService: (orgId: number, id: number, dto: Partial<CatalogService>) =>
    axiosAPI.put<CatalogService>(`/catalog/services/${id}`, dto, { params: { orgId } }).then((r) => r.data),

  deleteService: (orgId: number, id: number) =>
    axiosAPI.delete(`/catalog/services/${id}`, { params: { orgId } }),

  getWarehouses: (orgId: number) =>
    axiosAPI.get<Warehouse[]>('/catalog/warehouses', { params: { orgId } }).then((r) => r.data),

  createWarehouse: (orgId: number, dto: { name: string; code?: string; address?: string; responsibleUserId?: number | null; active?: boolean }) =>
    axiosAPI.post<Warehouse>('/catalog/warehouses', dto, { params: { orgId } }).then((r) => r.data),

  getStockMovements: (orgId: number, productId?: number) =>
    axiosAPI.get<StockMovement[]>('/catalog/stock-movements', { params: { orgId, productId } }).then((r) => r.data),

  getInventorySummary: (orgId: number) =>
    axiosAPI.get<InventorySummary>('/catalog/inventory/summary', { params: { orgId } }).then((r) => r.data),
}
