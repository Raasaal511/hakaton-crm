import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import type { SlashCommandsListHandle } from './SlashCommandsList'
import { SlashCommandsList } from './SlashCommandsList'
import { filterSlashCommandItems, type SlashCommandDefinition } from './slashCommandItems'
import type { ActiveSlashPayload } from './taskDescriptionSlashMatch'
import { getActiveSlashNearCursor } from './taskDescriptionSlashMatch'

type Props = { editor: Editor }

function rectFromPmCoords(coords: { left: number; top: number; right: number; bottom: number }) {
  return new DOMRect(coords.left, coords.top, coords.right - coords.left, coords.bottom - coords.top)
}

/** Позиционирование у каретки (конец паттерна /…). */
function caretRect(editor: Editor, pos: number): DOMRect | null {
  try {
    return rectFromPmCoords(editor.view.coordsAtPos(pos))
  } catch {
    return null
  }
}

export function TaskDescriptionSlashMenu({ editor }: Props) {
  const shellRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<SlashCommandsListHandle>(null)

  const slash = useEditorState({
    editor,
    selector: ({ editor: ed }): ActiveSlashPayload | null => getActiveSlashNearCursor(ed),
    equalityFn: (a, b): boolean => {
      if (!a || !b) return a === b
      return (
        a.range.from === b.range.from &&
        a.range.to === b.range.to &&
        a.query === b.query &&
        a.textToken === b.textToken
      )
    },
  })

  const items = useMemo(
    () => (slash ? filterSlashCommandItems(slash.query) : []),
    [slash],
  )

  const positionPopover = useCallback(() => {
    const el = shellRef.current
    if (!el || !slash) return

    const rect = caretRect(editor, editor.state.selection.from)
      ?? caretRect(editor, slash.range.to)
      ?? caretRect(editor, slash.range.from)
    if (!rect) return

    const margin = 10
    const vw = window.innerWidth
    const vh = window.innerHeight

    el.style.position = 'fixed'
    el.style.zIndex = '2147483600'

    requestAnimationFrame(() => {
      const menuRect = el.getBoundingClientRect()
      let left = rect.left
      let top = rect.bottom + 6

      if (left + menuRect.width + margin > vw) {
        left = Math.max(margin, vw - menuRect.width - margin)
      }
      if (left < margin) left = margin

      if (top + menuRect.height + margin > vh) {
        top = Math.max(margin, rect.top - menuRect.height - 6)
      }

      el.style.left = `${left}px`
      el.style.top = `${top}px`
    })
  }, [editor, slash])

  useLayoutEffect(() => {
    if (!slash) return
    positionPopover()
    const id = window.requestAnimationFrame(positionPopover)
    return () => window.cancelAnimationFrame(id)
  }, [slash, items, positionPopover])

  useEffect(() => {
    if (!slash) return

    window.addEventListener('scroll', positionPopover, true)
    window.addEventListener('resize', positionPopover)
    return () => {
      window.removeEventListener('scroll', positionPopover, true)
      window.removeEventListener('resize', positionPopover)
    }
  }, [slash, positionPopover])

  useEffect(() => {
    if (!slash) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) return

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        editor.chain().focus().deleteRange(slash.range).run()
        return
      }

      if (items.length === 0) return

      const handled = listRef.current?.onKeyDown({
        view: editor.view,
        event: e,
        range: slash.range,
      })
      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [editor, slash, items])

  if (!slash) return null

  return createPortal(
    <div ref={shellRef} className="task-description-slash-root react-renderer" role="presentation">
      <SlashCommandsList
        ref={listRef}
        editor={editor}
        range={slash.range}
        query={slash.query}
        text={slash.textToken}
        items={items}
        decorationNode={null}
        command={(item: SlashCommandDefinition) => item.command({ editor, range: slash.range })}
      />
    </div>,
    document.body,
  )
}
