import { useState, useMemo } from 'react'
import { Plus, Search, LayoutGrid, List, Package } from 'lucide-react'
import { AppLayout } from 'shared/ui'
import { DEMO_PRODUCTS, type CrmProduct, type ProductCategory, formatRubles } from 'shared/lib/crmDemoData'
import styles from './ProductsPage.module.css'

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  software: 'Программное обеспечение',
  hardware: 'Оборудование',
  service: 'Сервис',
  license: 'Лицензии',
}

function ProductCard({ product }: { product: CrmProduct }) {
  return (
    <div className={`${styles.productCard} ${!product.active ? styles.productCardInactive : ''}`}>
      <div className={styles.productCardIcon} style={{ background: product.imageColor }}>
        <Package size={20} color="#fff" />
      </div>
      <div className={styles.productCardBody}>
        <div className={styles.productName}>{product.name}</div>
        <div className={styles.productSku}>SKU: {product.sku}</div>
        <div className={styles.productDesc}>{product.description}</div>
      </div>
      <div className={styles.productCardFooter}>
        <div className={styles.productPrice}>{formatRubles(product.price)}<span className={styles.productUnit}> / {product.unit}</span></div>
        <div className={styles.productMeta}>
          <span className={`${styles.stockBadge} ${product.stock > 10 ? styles.stockOk : product.stock > 0 ? styles.stockLow : styles.stockOut}`}>
            {product.stock > 0 ? `${product.stock} ед.` : 'Нет в наличии'}
          </span>
          {!product.active && <span className={styles.inactiveBadge}>Неактивен</span>}
        </div>
      </div>
      <div className={styles.productTags}>
        {product.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
      </div>
    </div>
  )
}

function ProductRow({ product }: { product: CrmProduct }) {
  return (
    <tr>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: product.imageColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Package size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{product.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{product.sku}</div>
          </div>
        </div>
      </td>
      <td><span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{CATEGORY_LABELS[product.category]}</span></td>
      <td><span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{formatRubles(product.price)}</span> <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>/ {product.unit}</span></td>
      <td>
        <span className={`${styles.stockBadge} ${product.stock > 10 ? styles.stockOk : product.stock > 0 ? styles.stockLow : styles.stockOut}`}>
          {product.stock > 0 ? `${product.stock}` : '0'}
        </span>
      </td>
      <td>
        <span className={`${styles.statusBadge} ${product.active ? styles.statusActive : styles.statusInactive}`}>
          {product.active ? 'Активен' : 'Неактивен'}
        </span>
      </td>
    </tr>
  )
}

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ProductCategory | 'all'>('all')
  const [view, setView] = useState<'grid' | 'table'>('grid')

  const filtered = useMemo(() =>
    DEMO_PRODUCTS.filter((p) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === 'all' || p.category === category
      return matchSearch && matchCat
    }), [search, category])

  const totalValue = filtered.reduce((s, p) => s + p.price * Math.min(p.stock, 1), 0)

  return (
    <AppLayout>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.pageTitle}>Каталог товаров</h1>
            <p className={styles.pageSubtitle}>{DEMO_PRODUCTS.length} позиций · {DEMO_PRODUCTS.filter((p) => p.active).length} активных</p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`}>
              <Plus size={14} />
              Новый товар
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input className={styles.searchInput} type="text" placeholder="Поиск по названию, SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className={styles.filterTabs}>
              {(['all', 'software', 'hardware', 'license', 'service'] as const).map((c) => (
                <button key={c} type="button" className={`${styles.filterTab} ${category === c ? styles.filterTabActive : ''}`} onClick={() => setCategory(c)}>
                  {c === 'all' ? 'Все' : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
            <div className={styles.viewToggle}>
              <button type="button" className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => setView('grid')} title="Сетка"><LayoutGrid size={14} /></button>
              <button type="button" className={`${styles.viewBtn} ${view === 'table' ? styles.viewBtnActive : ''}`} onClick={() => setView('table')} title="Список"><List size={14} /></button>
            </div>
          </div>

          {view === 'grid' ? (
            <div className={styles.productGrid}>
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Товар</th><th>Категория</th><th>Цена</th><th>Остаток</th><th>Статус</th></tr></thead>
                <tbody>{filtered.map((p) => <ProductRow key={p.id} product={p} />)}</tbody>
              </table>
            </div>
          )}

          {filtered.length === 0 && (
            <div className={styles.empty}><Package size={40} strokeWidth={1.5} /><p>Товары не найдены</p></div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
