import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import type { Slice } from '@tiptap/pm/model'
import { dropPoint } from '@tiptap/pm/transform'
import type { EditorView } from '@tiptap/pm/view'

export type TaskDescriptionDropCursorOptions = {
  width?: number
  color?: string | false
  class?: string | undefined
}

/** Копия поведения prosemirror-dropcursor с мгновенным сбросом и window dragend (см. комментарий над классом в репозитории). */
class TaskDescriptionDropCursorView {
  readonly editorView: EditorView

  cursorPos: number | null = null

  element: HTMLElement | null = null

  private readonly timeoutIdRef = { current: -1 }

  private readonly width: number

  private readonly lineColor?: string

  private readonly customClass?: string

  private readonly onDomDragOver: (e: DragEvent) => void

  private readonly onDomDragEnd: () => void

  private readonly onDomDrop: () => void

  private readonly onDomDragLeave: (e: DragEvent) => void

  private readonly onWindowDragEndCapture: () => void

  constructor(editorView: EditorView, opts: TaskDescriptionDropCursorOptions) {
    this.editorView = editorView
    this.width = opts.width ?? 1
    this.lineColor =
      opts.color === false ? undefined : (opts.color ?? 'black')
    this.customClass = opts.class

    this.onDomDragOver = (e) => this.dragover(e)
    this.onDomDragEnd = () => this.dragend()
    this.onDomDrop = () => this.drop()
    this.onDomDragLeave = (e) => this.dragleave(e)

    const dom = editorView.dom
    dom.addEventListener('dragover', this.onDomDragOver)
    dom.addEventListener('dragend', this.onDomDragEnd)
    dom.addEventListener('drop', this.onDomDrop)
    dom.addEventListener('dragleave', this.onDomDragLeave)

    this.onWindowDragEndCapture = () => {
      this.cancelScheduledRemoval()
      this.setCursor(null)
    }
    window.addEventListener('dragend', this.onWindowDragEndCapture, true)
  }

  cancelScheduledRemoval() {
    if (this.timeoutIdRef.current !== -1) {
      clearTimeout(this.timeoutIdRef.current)
      this.timeoutIdRef.current = -1
    }
  }

  destroy() {
    window.removeEventListener('dragend', this.onWindowDragEndCapture, true)

    const dom = this.editorView.dom
    dom.removeEventListener('dragover', this.onDomDragOver)
    dom.removeEventListener('dragend', this.onDomDragEnd)
    dom.removeEventListener('drop', this.onDomDrop)
    dom.removeEventListener('dragleave', this.onDomDragLeave)

    this.cancelScheduledRemoval()
    this.setCursor(null)
  }

  update(_editorView: EditorView, prevState: EditorState) {
    if (this.cursorPos != null && prevState.doc !== this.editorView.state.doc) {
      if (this.cursorPos > this.editorView.state.doc.content.size) {
        this.setCursor(null)
      } else {
        this.updateOverlay()
      }
    }
  }

  setCursor(pos: number | null) {
    if (pos === this.cursorPos) return
    this.cursorPos = pos

    if (pos == null) {
      try {
        if (this.element?.parentNode) {
          this.element.parentNode.removeChild(this.element)
        }
      } catch {
        /* отсоединён */
      }
      this.element = null
      return
    }
    this.updateOverlay()
  }

  updateOverlay() {
    if (this.cursorPos == null) return

    const $pos = this.editorView.state.doc.resolve(this.cursorPos)
    const isBlock = !$pos.parent.inlineContent
    let rect: { left: number; right: number; top: number; bottom: number } | null =
      null

    const editorDOM = this.editorView.dom
    const editorRect = editorDOM.getBoundingClientRect()
    const scaleX = editorRect.width / editorDOM.offsetWidth || 1
    const scaleY = editorRect.height / editorDOM.offsetHeight || 1

    if (isBlock) {
      const before = $pos.nodeBefore
      const after = $pos.nodeAfter
      if (before || after) {
        const domNode = this.editorView.nodeDOM(
          this.cursorPos - (before ? before.nodeSize : 0),
        )
        if (
          domNode &&
          (domNode instanceof HTMLElement || domNode instanceof SVGElement)
        ) {
          const nodeRect = domNode.getBoundingClientRect()
          let top = before ? nodeRect.bottom : nodeRect.top
          if (before && after) {
            const mid = this.editorView.nodeDOM(this.cursorPos)
            if (
              mid &&
              (mid instanceof HTMLElement || mid instanceof SVGElement)
            ) {
              top = (top + mid.getBoundingClientRect().top) / 2
            }
          }
          const halfWidth = (this.width / 2) * scaleY
          rect = {
            left: nodeRect.left,
            right: nodeRect.right,
            top: top - halfWidth,
            bottom: top + halfWidth,
          }
        }
      }
    }

    if (!rect) {
      const coords = this.editorView.coordsAtPos(this.cursorPos)
      const halfWidth = (this.width / 2) * scaleX
      rect = {
        left: coords.left - halfWidth,
        right: coords.left + halfWidth,
        top: coords.top,
        bottom: coords.bottom,
      }
    }

    let parent: HTMLElement = editorDOM.ownerDocument.body
    const op = editorDOM.offsetParent
    if (op instanceof HTMLElement) parent = op

    if (!this.element) {
      this.element = parent.appendChild(document.createElement('div'))
      if (this.customClass) this.element.className = this.customClass
      this.element.style.cssText =
        'position: absolute; z-index: 50; pointer-events: none;'
      if (this.lineColor) this.element.style.backgroundColor = this.lineColor
    }
    this.element.classList.toggle('prosemirror-dropcursor-block', isBlock)
    this.element.classList.toggle('prosemirror-dropcursor-inline', !isBlock)

    let parentLeft: number
    let parentTop: number
    if (
      parent === document.body &&
      typeof getComputedStyle === 'function' &&
      getComputedStyle(parent).position === 'static'
    ) {
      parentLeft = -window.scrollX
      parentTop = -window.scrollY
    } else {
      const pr = parent.getBoundingClientRect()
      const parentScaleX = parent.offsetWidth ? pr.width / parent.offsetWidth : 1
      const parentScaleY = parent.offsetHeight ? pr.height / parent.offsetHeight : 1
      parentLeft = pr.left - parent.scrollLeft * parentScaleX
      parentTop = pr.top - parent.scrollTop * parentScaleY
    }

    this.element.style.left = (rect.left - parentLeft) / scaleX + 'px'
    this.element.style.top = (rect.top - parentTop) / scaleY + 'px'
    this.element.style.width = (rect.right - rect.left) / scaleX + 'px'
    this.element.style.height = (rect.bottom - rect.top) / scaleY + 'px'
  }

  scheduleRemoval(ms: number) {
    this.cancelScheduledRemoval()
    this.timeoutIdRef.current = window.setTimeout(() => {
      this.timeoutIdRef.current = -1
      this.setCursor(null)
    }, ms)
  }

  dragover(event: DragEvent) {
    if (!this.editorView.editable) return

    const posAt = this.editorView.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    })

    if (!posAt) return

    const nodeInner =
      posAt.inside >= 0
        ? this.editorView.state.doc.nodeAt(posAt.inside)
        : undefined

    const disableDropCursor = nodeInner?.type.spec.disableDropCursor
    const disabled =
      typeof disableDropCursor === 'function'
        ? disableDropCursor(this.editorView, posAt, event)
        : !!disableDropCursor

    if (disabled) return

    let targetPos = posAt.pos
    const dragging = this.editorView.dragging as { slice?: Slice } | undefined
    if (dragging?.slice != null) {
      const point = dropPoint(this.editorView.state.doc, targetPos, dragging.slice)
      if (point != null) targetPos = point
    }

    this.setCursor(targetPos)
    /** Fallback: если dragend потерян, убрать линию (было до 5000 ms в prosemirror-dropcursor). */
    this.scheduleRemoval(750)
  }

  dragend() {
    this.cancelScheduledRemoval()
    this.setCursor(null)
  }

  drop() {
    this.cancelScheduledRemoval()
    this.setCursor(null)
  }

  dragleave(event: DragEvent) {
    const rt = event.relatedTarget
    const stillInside =
      rt instanceof Node &&
      typeof this.editorView.dom.contains === 'function' &&
      this.editorView.dom.contains(rt)
    if (!stillInside) this.setCursor(null)
  }
}

const taskDropCursorPluginKey = new PluginKey('taskDescriptionDropCursor')

export const TaskDescriptionDropCursor =
  Extension.create<TaskDescriptionDropCursorOptions>({
    name: 'taskDescriptionDropCursor',

    addOptions() {
      return {
        width: 1,
        color: 'black',
        class: undefined,
      }
    },

    addProseMirrorPlugins() {
      const opts = this.options
      return [
        new Plugin({
          key: taskDropCursorPluginKey,
          view(editorView: EditorView) {
            return new TaskDescriptionDropCursorView(editorView, opts)
          },
        }),
      ]
    },
  })
