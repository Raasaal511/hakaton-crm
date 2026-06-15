export type CreateCategoryDTO = {
  name: string
  parentId?: number | null
  color?: string
}
export type UpdateCategoryDTO = Partial<CreateCategoryDTO>

export type CreateProductDTO = {
  categoryId?: number | null
  name: string
  sku?: string
  description?: string
  price?: number
  costPrice?: number
  currency?: string
  unit?: string
  stockQuantity?: number
  minStockQuantity?: number
  active?: boolean
}
export type UpdateProductDTO = Partial<CreateProductDTO>

export type AdjustStockDTO = {
  delta: number
  reason?: string
}

export type CreateServiceDTO = {
  name: string
  description?: string
  category?: string
  price?: number
  currency?: string
  unit?: string
  durationHours?: number | null
  active?: boolean
}
export type UpdateServiceDTO = Partial<CreateServiceDTO>

export type CatalogListFilter = {
  q?: string
  categoryId?: number
  active?: boolean
  limit?: number
  offset?: number
}
