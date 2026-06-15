import type { TaskAttachment } from 'shared/types/tasks'

export function isPdfAttachment(attachment: TaskAttachment): boolean {
  if (attachment.mimeType === 'application/pdf') return true
  return attachment.fileName.toLowerCase().endsWith('.pdf')
}
