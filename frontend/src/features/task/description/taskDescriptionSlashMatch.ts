import { findSuggestionMatch as tiptapFindSuggestionMatch } from '@tiptap/suggestion'
import type { Editor } from '@tiptap/core'

export type ActiveSlashPayload = {
  range: { from: number; to: number }
  query: string
  textToken: string
}

function findSlashMatchAt($position: Parameters<typeof tiptapFindSuggestionMatch>[0]['$position']) {
  const wide = tiptapFindSuggestionMatch({
    char: '/',
    allowSpaces: false,
    allowToIncludeChar: false,
    allowedPrefixes: null,
    startOfLine: false,
    $position,
  })
  if (!wide) return null

  const { from } = wide.range
  const doc = $position.doc
  const $slash = doc.resolve(from)

  if (!$slash.parent.type.isTextblock) return null

  if (from === $slash.start($slash.depth)) return wide

  const beforeSlash = doc.textBetween(from - 1, from, '', '\ufffc')
  if (beforeSlash === '/' || beforeSlash === ':') return null

  return wide
}

/**
 * Состояние «/команда» у каретки (без ProseMirror-плагина Suggestion).
 */
export function getActiveSlashNearCursor(editor: Editor): ActiveSlashPayload | null {
  if (!editor?.isEditable) return null

  const state = editor.state
  const { selection } = state

  if (!selection.empty || editor.view.composing) return null
  if (editor.isActive('codeBlock')) return null

  const raw = findSlashMatchAt(selection.$from)
  if (!raw) return null

  const textToken = state.doc.textBetween(raw.range.from, raw.range.to, '', '\ufffc')

  return {
    range: raw.range,
    query: raw.query,
    textToken,
  }
}
