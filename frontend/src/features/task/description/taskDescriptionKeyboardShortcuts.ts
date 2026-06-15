import { Extension } from '@tiptap/core'

export const TASK_DESC_OPEN_LINK = 'task-description-open-link'

/** Открывает панель ссылки по Mod+K (через CustomEvent для нужного экземпляра редактора). */
export const TaskDescriptionKeyboardShortcuts = Extension.create({
  name: 'taskDescriptionKeyboardShortcuts',

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const ed = this.editor
        if (ed.state.selection.empty) return false
        window.dispatchEvent(
          new CustomEvent(TASK_DESC_OPEN_LINK, {
            detail: { editor: ed },
          }),
        )
        return true
      },
    }
  },
})
