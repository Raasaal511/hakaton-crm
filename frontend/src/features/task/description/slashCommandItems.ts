import type { Editor, Range } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  TextQuote,
} from 'lucide-react'

export type SlashCommandRun = (opts: { editor: Editor; range: Range }) => void

export type SlashCommandDefinition = {
  title: string
  subtitle: string
  Icon: LucideIcon
  keywords: string[]
  command: SlashCommandRun
}

export const SLASH_COMMAND_ITEMS: SlashCommandDefinition[] = [
  {
    title: 'Текст',
    subtitle: 'Обычный абзац',
    Icon: Pilcrow,
    keywords: ['text', 'paragraph', 'p', 'абзац', 'текст'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run()
    },
  },
  {
    title: 'Заголовок 1',
    subtitle: 'Крупный заголовок раздела',
    Icon: Heading1,
    keywords: ['h1', 'heading', 'title', 'заголовок'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Заголовок 2',
    subtitle: 'Подраздел',
    Icon: Heading2,
    keywords: ['h2', 'heading', 'заголовок'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Заголовок 3',
    subtitle: 'Меньший заголовок',
    Icon: Heading3,
    keywords: ['h3', 'heading', 'заголовок'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Маркированный список',
    subtitle: 'Список с точками',
    Icon: List,
    keywords: ['bullet', 'list', 'ul', 'список', 'маркер'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Нумерованный список',
    subtitle: 'Шаги по порядку',
    Icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'ol', 'список', 'номер'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Цитата',
    subtitle: 'Выделить мысль или примечание',
    Icon: TextQuote,
    keywords: ['quote', 'blockquote', 'цитата'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Разделитель',
    subtitle: 'Горизонтальная линия между блоками',
    Icon: Minus,
    keywords: ['divider', 'hr', 'line', 'линия', 'разделитель'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run()
    },
  },
]

export function filterSlashCommandItems(query: string): SlashCommandDefinition[] {
  const q = query.trim().toLowerCase()
  if (!q) return SLASH_COMMAND_ITEMS
  return SLASH_COMMAND_ITEMS.filter((item) => {
    const haystack = [item.title, item.subtitle, ...item.keywords].join(' ').toLowerCase()
    if (haystack.includes(q)) return true
    if (item.title.toLowerCase().startsWith(q)) return true
    return item.keywords.some((k) => k.startsWith(q))
  })
}
