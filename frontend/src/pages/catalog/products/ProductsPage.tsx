import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Package, LayoutGrid, List, Trash2 } from 'lucide-react'
import { AppLayout, Button } from 'shared/ui'
import { PageHeader } from 'shared/ui/PageHeader/PageHeader'
import { FilterBar } from 'shared/ui/FilterBar/FilterBar'
import { DataTable, type ColumnDef } from 'shared/ui/DataTable/DataTable'
import { formatRubles } from 'shared/lib/crmDemoData'
import { organizationModel } from 'entities/organization'
import { catalogAPI, type Product } from 'shared/api/requests/catalog'
import { qk } from 'shared/api/queryKeys'
import { ProductForm } from 'features/catalog/ProductForm'
import styles from './ProductsPage.module.css'

type ProductRow = Omit<Product, 'id'> & { id: string; numericId: number }

function adaptRow(p: Product): ProductRow {
  const { id, ...rest } = p
  return { ...rest, id: String(id), numericId: id }
}

const ICON_COLOR = '#7c3aed'

function ProductGridCard({ product }: { product: Product }) {
  const stockClass = product.stockQuantity > 10
    ? styles.stockOk
    : product.stockQuantity > 0 ? styles.stockLow : styles.stockOut
  return (
    <div className={`${styles.gridCard} ${!product.active ? styles.gridCardInactive : ''}`}>
      <div className={styles.gridCardIcon} style={{ background: product.stockQuantity === 0 ? '#dc2626' : ICON_COLOR }}>
        <Package size={22} color="#fff" strokeWidth={1.5} />
      </div>
      <div className={styles.gridCardBody}>
        <div className={styles.gridCardName}>{product.name}</div>
        {product.sku && <div className={styles.gridCardSku}>SKU: {product.sku}</div>}
        <div className={styles.gridCardDesc}>{product.description}</div>
      </div>
      <div className={styles.gridCardFooter}>
        <div className={styles.gridCardPrice}>
          {formatRubles(product.price)}
          <span className={styles.gridCardUnit}> / {product.unit}</span>
        </div>
        <span className={`${styles.stockPill} ${stockClass}`}>
          {product.stockQuantity > 0 ? `${product.stockQuantity} ед.` : 'Нет в наличии'}
        </span>
      </div>
    </div>
  )
}

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [view, setView] = useState<'grid' | 'table'>('table')
  const [formOpen, setFormOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()

  const { data: productsData, isLoading } = useQuery({
    queryKey: qk.catalogProducts(org?.id ?? 0, { limit: 500 }),
    queryFn: () => catalogAPI.getProducts(org!.id, { limit: 500 }),
    enabled: Boolean(org?.id),
    staleTime: 30_000,
  })

  const { data: categoriesData = [] } = useQuery({
    queryKey: qk.catalogCategories(org?.id ?? 0),
    queryFn: () => catalogAPI.getCategories(org!.id),
    enabled: Boolean(org?.id),
    staleTime: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => catalogAPI.deleteProduct(org!.id, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'products'] }),
  })

  const products = useMemo(() => productsData?.items ?? [], [productsData])

  const categoryMap = useMemo(
    () => Object.fromEntries(categoriesData.map((c) => [c.id, c.name])),
    [categoriesData],
  )

  const categoryOptions = useMemo(
    () => ['all', ...Array.from(new Set(products.map((p) => p.categoryId != null ? String(p.categoryId) : 'none')))],
    [products],
  )

  const filtered = useMemo(() =>
    products.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCat = categoryFilter === 'all' || String(p.categoryId ?? 'none') === categoryFilter
      return matchSearch && matchCat
    }), [products, search, categoryFilter])

  const tableData: ProductRow[] = useMemo(() => filtered.map(adaptRow), [filtered])

  const columns: ColumnDef<ProductRow>[] = [
    {
      key: 'name',
      header: 'Товар',
      sortable: true,
      renderCell: (row) => (
        <div className={styles.productCell}>
          <div className={styles.productIcon} style={{ background: row.stockQuantity === 0 ? '#dc2626' : ICON_COLOR }}>
            <Package size={14} color="#fff" strokeWidth={1.5} />
          </div>
          <div className={styles.productCellInfo}>
            <span className={styles.productName}>{row.name}</span>
            {row.sku && <span className={styles.productSku}>SKU: {row.sku}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'categoryId',
      header: 'Категория',
      renderCell: (row) => (
        <span className={styles.catPill}>
          {row.categoryId != null ? (categoryMap[row.categoryId] ?? 'Без категории') : 'Без категории'}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Цена',
      sortable: true,
      renderCell: (row) => (
        <span className={styles.priceCell}>
          {formatRubles(row.price)}
          <span className={styles.priceUnit}> / {row.unit}</span>
        </span>
      ),
    },
    {
      key: 'stockQuantity',
      header: 'Остаток',
      sortable: true,
      renderCell: (row) => {
        const cls = row.stockQuantity > 10 ? styles.stockOk : row.stockQuantity > 0 ? styles.stockLow : styles.stockOut
        return (
          <span className={`${styles.stockPill} ${cls}`}>
            {row.stockQuantity > 0 ? `${row.stockQuantity} ед.` : 'Нет'}
          </span>
        )
      },
    },
    {
      key: 'active',
      header: 'Статус',
      renderCell: (row) => (
        <span className={row.active ? styles.statusActive : styles.statusInactive}>
          {row.active ? 'Активен' : 'Скрыт'}
        </span>
      ),
    },
  ]

  const bulkActions = [
    {
      id: 'delete',
      label: 'Удалить',
      icon: <Trash2 size={13} />,
      variant: 'danger' as const,
      onClick: (ids: string[]) => {
        Promise.all(ids.map((id) => deleteMutation.mutate(Number(id))))
          .then(() => queryClient.invalidateQueries({ queryKey: ['catalog', org?.id, 'products'] }))
      },
    },
  ]

  const activeChips = [
    ...(search ? [{ id: 'search', label: 'Поиск', value: search }] : []),
    ...(categoryFilter !== 'all' ? [{ id: 'category', label: 'Категория', value: categoryMap[Number(categoryFilter)] ?? categoryFilter }] : []),
  ]

  return (
    <AppLayout>
      <div className={styles.page}>
        <PageHeader
          title="Товары"
          breadcrumb={[{ label: 'Каталог' }]}
          description={isLoading ? 'Загрузка...' : `${productsData?.total ?? 0} товаров`}
          actions={
            <>
              <div className={styles.viewToggle}>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('grid')}
                  title="Сетка"
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  type="button"
                  className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`}
                  onClick={() => setView('table')}
                  title="Таблица"
                >
                  <List size={14} />
                </button>
              </div>
              <Button
                variant="primary"
                size="sm"
                iconLeft={<Plus size={13} />}
                onClick={() => { setEditProduct(null); setFormOpen(true) }}
              >
                Добавить товар
              </Button>
            </>
          }
          tabs={[
            { id: 'all', label: 'Все' },
            ...categoryOptions.filter((o) => o !== 'all').map((id) => ({
              id,
              label: id === 'none' ? 'Без категории' : (categoryMap[Number(id)] ?? id),
            })),
          ]}
          activeTab={categoryFilter}
          onTabChange={(id) => setCategoryFilter(id)}
        />

        <FilterBar
          chips={activeChips}
          onRemoveChip={(id) => {
            if (id === 'search') setSearch('')
            if (id === 'category') setCategoryFilter('all')
          }}
          onClearAll={() => { setSearch(''); setCategoryFilter('all') }}
          totalCount={productsData?.total}
          filteredCount={filtered.length}
        >
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Поиск по названию, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterBar>

        {view === 'grid' ? (
          <div className={styles.body}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                <Package size={40} strokeWidth={1.5} />
                <p className={styles.emptyTitle}>{search ? 'Товары не найдены' : 'Нет товаров'}</p>
                <p className={styles.emptyText}>
                  {search ? 'Измените критерии поиска' : 'Добавьте первый товар в каталог'}
                </p>
                {!search && (
                  <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditProduct(null); setFormOpen(true) }}>
                    Добавить товар
                  </Button>
                )}
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map((p) => <ProductGridCard key={p.id} product={p} />)}
              </div>
            )}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <DataTable
              columns={columns}
              data={tableData}
              loading={isLoading}
              bulkActions={bulkActions}
              onRowClick={(row) => { setEditProduct(products.find((p) => p.id === row.numericId) ?? null); setFormOpen(true) }}
              emptyState={
                <div className={styles.emptyState}>
                  <Package size={40} strokeWidth={1.5} />
                  <p className={styles.emptyTitle}>{search ? 'Товары не найдены' : 'Нет товаров'}</p>
                  <p className={styles.emptyText}>
                    {search ? 'Измените критерии поиска' : 'Добавьте первый товар в каталог'}
                  </p>
                  {!search && (
                    <Button variant="primary" size="sm" iconLeft={<Plus size={13} />} onClick={() => { setEditProduct(null); setFormOpen(true) }}>
                      Добавить товар
                    </Button>
                  )}
                </div>
              }
            />
          </div>
        )}

        <ProductForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditProduct(null) }}
          existing={editProduct}
        />
      </div>
    </AppLayout>
  )
}
