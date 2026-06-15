/** Дата-время завершения задачи для отображения автору. */
export function formatCompletionDate(iso: string | null | undefined): string | null {
  if (iso == null || iso === '') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}
