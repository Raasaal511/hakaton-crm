import { getPaginationPageItems } from 'shared/lib/paginationPageNumbers'
import styles from './PaginationBar.module.css'

type PaginationBarProps = {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
}: PaginationBarProps) {
  if (totalPages <= 1 || totalItems <= 0) return null

  const safePage = Math.min(Math.max(1, page), totalPages)
  const fromCount = (safePage - 1) * pageSize + 1
  const toCount = Math.min(safePage * pageSize, totalItems)
  const pageItems = getPaginationPageItems(safePage, totalPages)

  return (
    <nav className={styles.bar} aria-label="Навигация по страницам">
      <p className={styles.info}>
        {fromCount}–{toCount} из {totalItems} · стр. {safePage} / {totalPages}
      </p>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.navBtn}
          disabled={disabled || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Предыдущая страница"
        >
          ←
        </button>
        {pageItems.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className={styles.ellipsis} aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={`${styles.pageBtn} ${item === safePage ? styles.pageBtnActive : ''}`}
              disabled={disabled || item === safePage}
              aria-label={`Страница ${item}`}
              aria-current={item === safePage ? 'page' : undefined}
              onClick={() => onPageChange(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className={styles.navBtn}
          disabled={disabled || safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Следующая страница"
        >
          →
        </button>
      </div>
    </nav>
  )
}
