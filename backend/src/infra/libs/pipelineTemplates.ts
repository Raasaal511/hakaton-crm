/**
 * Готовые шаблоны воронок для быстрой настройки канбан-досок.
 * Это статические пресеты — никакой БД не нужно. При создании из шаблона
 * на их основе генерируются обычные пользовательские воронки и колонки.
 *
 * Цвета подобраны так, чтобы статусы визуально читались на доске:
 * серый → синий → жёлтый → зелёный/красный.
 */

export type PipelineTemplateColumn = {
  /** Имя колонки на доске. */
  name: string
  /** HEX-цвет. Допускается null — тогда колонка будет «без цвета». */
  color: string | null
}

export type PipelineTemplate = {
  /** Стабильный машинный ключ для API. */
  key: string
  /** Дефолтное имя создаваемой воронки. Можно переопределить в запросе. */
  name: string
  /** Короткое человекочитаемое описание шаблона. */
  description: string
  /** Эмодзи-иконка для UI. */
  icon: string
  /** Колонки в порядке слева направо. */
  columns: PipelineTemplateColumn[]
}

export const PIPELINE_TEMPLATES: readonly PipelineTemplate[] = [
  {
    key: 'kanban-basic',
    name: 'Базовый канбан',
    description: 'Минимальный набор для любой команды: что нужно сделать, что в работе и что готово.',
    icon: '🗂️',
    columns: [
      { name: 'Задачи', color: '#64748b' },
      { name: 'В работе', color: '#2563eb' },
      { name: 'На проверке', color: '#d97706' },
      { name: 'Завершенные', color: '#16a34a' }
    ],
  },
  {
    key: 'it-project',
    name: 'IT-проект',
    description: 'Разработка с код-ревью и QA: от бэклога до релиза.',
    icon: '💻',
    columns: [
      { name: 'Бэклог', color: '#64748b' },
      { name: 'К разработке', color: '#0ea5e9' },
      { name: 'В разработке', color: '#2563eb' },
      { name: 'Code Review', color: '#a855f7' },
      { name: 'Тестирование (QA)', color: '#d97706' },
      { name: 'Готово к релизу', color: '#16a34a' },
    ],
  },
  {
    key: 'bug-tracker',
    name: 'Баг-трекер',
    description: 'Поток обработки багов: от поступления до подтверждённого фикса.',
    icon: '🐞',
    columns: [
      { name: 'Новые', color: '#ef4444' },
      { name: 'Триаж', color: '#f97316' },
      { name: 'В работе', color: '#2563eb' },
      { name: 'Фикс на проверке', color: '#d97706' },
      { name: 'Закрыто', color: '#16a34a' },
    ],
  },
  {
    key: 'content',
    name: 'Контент-план',
    description: 'Производство контента: от идей до публикации.',
    icon: '✍️',
    columns: [
      { name: 'Идеи', color: '#a855f7' },
      { name: 'Черновик', color: '#64748b' },
      { name: 'Редактура', color: '#2563eb' },
      { name: 'Готово к публикации', color: '#d97706' },
      { name: 'Опубликовано', color: '#16a34a' },
    ],
  },
  {
    key: 'sales',
    name: 'Воронка продаж',
    description: 'Классические этапы B2B-сделок: лид → оплата.',
    icon: '💼',
    columns: [
      { name: 'Лид', color: '#64748b' },
      { name: 'Квалификация', color: '#0ea5e9' },
      { name: 'Презентация', color: '#2563eb' },
      { name: 'Переговоры', color: '#a855f7' },
      { name: 'Договор', color: '#d97706' },
      { name: 'Оплачено', color: '#16a34a' },
    ],
  },
  {
    key: 'hr-recruitment',
    name: 'Подбор персонала',
    description: 'Воронка найма: от отклика до оффера.',
    icon: '🧑‍💼',
    columns: [
      { name: 'Отклики', color: '#64748b' },
      { name: 'Скрининг', color: '#0ea5e9' },
      { name: 'Интервью', color: '#2563eb' },
      { name: 'Тестовое задание', color: '#a855f7' },
      { name: 'Финальный этап', color: '#d97706' },
      { name: 'Оффер принят', color: '#16a34a' },
    ],
  },
  {
    key: 'design-process',
    name: 'Дизайн-процесс',
    description: 'Поток продуктового дизайна: исследование, макеты, апрув.',
    icon: '🎨',
    columns: [
      { name: 'Бриф', color: '#64748b' },
      { name: 'Исследование', color: '#a855f7' },
      { name: 'Концепт', color: '#0ea5e9' },
      { name: 'Макеты', color: '#2563eb' },
      { name: 'Согласование', color: '#d97706' },
      { name: 'Принято', color: '#16a34a' },
    ],
  },
] as const

export function getPipelineTemplateByKey(key: string): PipelineTemplate | null {
  return PIPELINE_TEMPLATES.find((t) => t.key === key) ?? null
}
