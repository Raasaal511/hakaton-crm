export type PaginationPageItem = number | 'ellipsis'

/** Номера страниц для UI: 1 … 4 5 6 … 12 */
export function getPaginationPageItems(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PaginationPageItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const current = Math.min(Math.max(1, currentPage), totalPages)
  const left = Math.max(2, current - siblingCount)
  const right = Math.min(totalPages - 1, current + siblingCount)
  const items: PaginationPageItem[] = [1]

  if (left > 2) items.push('ellipsis')
  for (let p = left; p <= right; p += 1) items.push(p)
  if (right < totalPages - 1) items.push('ellipsis')
  items.push(totalPages)

  return items
}
