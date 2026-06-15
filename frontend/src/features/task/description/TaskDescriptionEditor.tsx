import { useCallback, useEffect } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { GripVertical } from 'lucide-react'
import { TaskDescriptionDropCursor } from './taskDescriptionDropCursor'
import { TaskDescriptionBubbleToolbar } from './TaskDescriptionBubbleToolbar'
import { TaskDescriptionSlashMenu } from './TaskDescriptionSlashMenu'
import { TaskDescriptionKeyboardShortcuts } from './taskDescriptionKeyboardShortcuts'
import styles from './TaskDescriptionEditor.module.css'

type TaskDescriptionEditorProps = {
  /** HTML из API или старый plain text */
  initialHtml: string
  onChange: (html: string) => void
  /** Вызывается при реальном уходе фокуса с поля (не при переходе в меню «/»). */
  onFlushDescription?: () => void
}

function normalizeIncomingContent(raw: string): string {
  const t = raw?.trim() ?? ''
  if (!t) return ''
  if (t.startsWith('<')) return t
  const escaped = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br />')}</p>`
}

export function TaskDescriptionEditor({
  initialHtml,
  onChange,
  onFlushDescription,
}: TaskDescriptionEditorProps) {
  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      onChange(editor.getHTML())
    },
    [onChange],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        /** Свой DropCursor: немедленный сброс + window.dragend для ручки блока. */
        dropcursor: false,
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
        /** link и underline уже входят в StarterKit v3 — не дублировать отдельными extension */
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          HTMLAttributes: {
            class: styles.link,
            rel: 'noopener noreferrer nofollow',
            target: '_blank',
          },
        },
      }),
      TaskDescriptionDropCursor.configure({
        width: 2,
        color: false,
        class: 'task-description-drop-line',
      }),
      TaskDescriptionKeyboardShortcuts,
      Placeholder.configure({
        placeholder: 'Enter — новая строка, «/» — команды.',
        /** По умолчанию true и тогда текст виден только в одном «текущем» пустом блоке — легко «теряется» рядом с Trailing Node. */
        showOnlyCurrent: false,
      }),
    ],
    content: normalizeIncomingContent(initialHtml),
    editorProps: {
      attributes: {
        class: styles.proseMirror,
        spellCheck: 'true',
      },
    },
    onUpdate: handleUpdate,
  })

  useEffect(() => {
    if (!editor || !onFlushDescription) return
    const root = editor.view.dom as HTMLElement

    const onFocusOut = () => {
      requestAnimationFrame(() => {
        if (editor.isDestroyed) return
        const ae = document.activeElement as HTMLElement | null
        if (ae?.closest('.task-description-slash-root')) return
        if (editor.view.hasFocus()) return
        onFlushDescription()
      })
    }

    root.addEventListener('focusout', onFocusOut)
    return () => root.removeEventListener('focusout', onFocusOut)
  }, [editor, onFlushDescription])

  if (!editor) {
    return <div className={styles.editorShell} aria-hidden />
  }

  return (
    <div className={styles.wrap}>
      <DragHandle
        editor={editor}
        nested
        className={styles.dragHandleRoot}
        computePositionConfig={{
          placement: 'left-start',
          strategy: 'fixed',
        }}
      >
        <span className={styles.dragHandleInner}>
          <GripVertical size={18} strokeWidth={2} aria-hidden />
        </span>
      </DragHandle>

      <BubbleMenu
        editor={editor}
        shouldShow={({ editor: ed, state }) => {
          const { from, to } = state.selection
          if (from === to) return false
          return !ed.isActive('codeBlock')
        }}
        options={{
          placement: 'top',
          offset: 10,
          flip: true,
          shift: { padding: 8 },
        }}
      >
        <TaskDescriptionBubbleToolbar editor={editor} />
      </BubbleMenu>

      <div className={`${styles.editorShell} ${styles.taskDescriptionDropTargets}`}>
        <EditorContent editor={editor} />
      </div>

      <TaskDescriptionSlashMenu editor={editor} />
    </div>
  )
}
