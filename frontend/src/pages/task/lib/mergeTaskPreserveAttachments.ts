import type { Task } from 'shared/types/tasks'

/**
 * PATCH /tasks/:id возвращает «урезанную» задачу без полей, которые есть только
 * в GET (departmentId, и т.д.). Сохраняем предыдущее состояние под слоем next,
 * чтобы такие поля не пропадали при частичном ответе.
 */
export function mergeTaskPreserveAttachments(prev: Task | null, next: Task): Task {
  return {
    ...(prev ?? {}),
    ...next,
    attachments: next.attachments ?? prev?.attachments ?? [],
  }
}
