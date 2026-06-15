import path from 'node:path'

export function getTaskAttachmentsDir(): string {
    const fromEnv = process.env.TASK_ATTACHMENTS_DIR?.trim()
    if (fromEnv) return path.resolve(fromEnv)
    return path.resolve(process.cwd(), 'uploads', 'task-attachments')
}

export function sanitizeOriginalFileName(name: string): string {
    const base = name.replace(/[/\\]/g, '_').replace(/\0/g, '').trim() || 'file'
    return base.length > 500 ? base.slice(0, 500) : base
}
