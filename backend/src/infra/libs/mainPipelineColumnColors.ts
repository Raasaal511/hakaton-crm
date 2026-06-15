/**
 * Базовые цвета колонок основной воронки (по position 0…3).
 * Совпадают с порядком: Задачи, В работе, На проверке, Завершенные.
 */
export const MAIN_PIPELINE_COLUMN_COLORS = [
  '#64748b',
  '#2563eb',
  '#d97706',
  '#16a34a',
] as const

export function mainPipelineColumnColor(position: number): string | null {
  if (position >= 0 && position < MAIN_PIPELINE_COLUMN_COLORS.length) {
    return MAIN_PIPELINE_COLUMN_COLORS[position]
  }
  return null
}
