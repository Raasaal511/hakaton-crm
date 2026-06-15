import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { Bold, Italic, Link as LinkIcon, Strikethrough, Underline } from 'lucide-react'
import { TASK_DESC_OPEN_LINK } from './taskDescriptionKeyboardShortcuts'
import styles from './TaskDescriptionEditor.module.css'

type Props = {
  editor: Editor
}

export function TaskDescriptionBubbleToolbar({ editor }: Props) {
  const linkPanelId = useId()
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openLinkPanel = useCallback(() => {
    const href = editor.getAttributes('link').href as string | undefined
    setLinkUrl(href?.trim() ? href : 'https://')
    setLinkOpen(true)
  }, [editor])

  const closeLinkPanel = useCallback(() => {
    setLinkOpen(false)
  }, [])

  const applyLink = useCallback(() => {
    const trimmed = linkUrl.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (trimmed === '') {
      chain.unsetLink().run()
    } else {
      chain.setLink({ href: trimmed }).run()
    }
    setLinkOpen(false)
  }, [editor, linkUrl])

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    setLinkOpen(false)
  }, [editor])

  useEffect(() => {
    if (!linkOpen) return
    const t = setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [linkOpen])

  useEffect(() => {
    if (!linkOpen) return
    const onDown = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      setLinkOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [linkOpen])

  useEffect(() => {
    const fn = (e: Event) => {
      const ce = e as CustomEvent<{ editor: Editor }>
      if (ce.detail?.editor !== editor) return
      openLinkPanel()
    }
    window.addEventListener(TASK_DESC_OPEN_LINK, fn as EventListener)
    return () => window.removeEventListener(TASK_DESC_OPEN_LINK, fn as EventListener)
  }, [editor, openLinkPanel])

  return (
    <div className={styles.bubbleToolbar} role="toolbar" aria-label="Форматирование текста">
      <button
        type="button"
        className={styles.bubbleBtn}
        title="Жирный"
        aria-label="Жирный"
        aria-pressed={editor.isActive('bold')}
        data-active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={17} strokeWidth={2.25} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.bubbleBtn}
        title="Курсив"
        aria-label="Курсив"
        aria-pressed={editor.isActive('italic')}
        data-active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={17} strokeWidth={2.25} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.bubbleBtn}
        title="Подчёркнутый"
        aria-label="Подчёркнутый"
        aria-pressed={editor.isActive('underline')}
        data-active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline size={17} strokeWidth={2.25} aria-hidden />
      </button>
      <button
        type="button"
        className={styles.bubbleBtn}
        title="Зачёркнутый"
        aria-label="Зачёркнутый"
        aria-pressed={editor.isActive('strike')}
        data-active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={17} strokeWidth={2.25} aria-hidden />
      </button>

      <span className={styles.bubbleSep} aria-hidden />

      <div className={styles.bubbleLinkWrap} ref={containerRef}>
        <button
          type="button"
          className={styles.bubbleBtn}
          title="Ссылка"
          aria-label="Ссылка"
          aria-expanded={linkOpen}
          aria-controls={linkPanelId}
          aria-pressed={editor.isActive('link') || linkOpen}
          data-active={editor.isActive('link') || linkOpen}
          onClick={() => (linkOpen ? closeLinkPanel() : openLinkPanel())}
        >
          <LinkIcon size={17} strokeWidth={2.25} aria-hidden />
        </button>
        {linkOpen && (
          <div
            id={linkPanelId}
            className={styles.linkPanel}
            role="dialog"
            aria-label="Адрес ссылки"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                closeLinkPanel()
              }
            }}
          >
            <label className={styles.linkLabel}>
              <span>URL</span>
              <input
                ref={inputRef}
                type="url"
                className={styles.linkInput}
                placeholder="https://"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyLink()
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <div className={styles.linkActions}>
              <button type="button" className={styles.linkBtnPrimary} onClick={applyLink}>
                Сохранить
              </button>
              <button type="button" className={styles.linkBtnGhost} onClick={closeLinkPanel}>
                Отмена
              </button>
              {editor.isActive('link') && (
                <button type="button" className={styles.linkBtnDanger} onClick={removeLink}>
                  Убрать ссылку
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
