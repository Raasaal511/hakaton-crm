import { open } from 'node:fs/promises'
import { BadRequestError } from './errors.js'

/** Согласовано с лимитом @fastify/multipart в server.ts. Загрузка идёт потоком на диск, не в RAM целиком. */
export const MAX_TASK_ATTACHMENT_BYTES = 50 * 1024 * 1024

/** Не изображения: только явно безопасные для вложений форматы. */
const ALLOWED_NON_IMAGE_MIME = new Set<string>([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/msword',
    'application/x-apple-diskimage',
    'application/x-iso9660-image',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    // Архивы
    'application/zip',
    'application/x-zip-compressed',
    'application/x-7z-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-tar',
    'application/gzip',
    'application/x-gzip',
    'application/x-bzip2',
    'application/x-xz',
])

/**
 * Текстовые исходники по расширению (file-type часто не угадывает «чистый» UTF-8).
 * На сервере файлы не выполняются; отдаём с Content-Disposition: attachment.
 */
const UTF8_SOURCE_EXT_TO_MIME: Array<{ suffix: string; mime: string }> = [
    { suffix: '.tsx', mime: 'text/typescript' },
    { suffix: '.jsx', mime: 'text/javascript' },
    { suffix: '.mjs', mime: 'text/javascript' },
    { suffix: '.cjs', mime: 'text/javascript' },
    { suffix: '.py', mime: 'text/x-python' },
    { suffix: '.ts', mime: 'text/typescript' },
    { suffix: '.js', mime: 'text/javascript' },
    { suffix: '.json', mime: 'application/json' },
    { suffix: '.yaml', mime: 'text/yaml' },
    { suffix: '.yml', mime: 'text/yaml' },
    { suffix: '.md', mime: 'text/markdown' },
    { suffix: '.css', mime: 'text/css' },
    { suffix: '.scss', mime: 'text/x-scss' },
    { suffix: '.sql', mime: 'application/sql' },
    { suffix: '.sh', mime: 'text/x-shellscript' },
    { suffix: '.txt', mime: 'text/plain' },
]

/** Бинарные форматы только по расширению, если file-type не распознал. */
const BINARY_EXT_TO_MIME: Array<{ suffix: string; mime: string }> = [
    { suffix: '.dmg', mime: 'application/x-apple-diskimage' },
    { suffix: '.iso', mime: 'application/x-iso9660-image' },
    // Фоллбек по расширению для архивов, когда file-type не распознал.
    { suffix: '.zip', mime: 'application/zip' },
    { suffix: '.7z', mime: 'application/x-7z-compressed' },
    { suffix: '.rar', mime: 'application/vnd.rar' },
    { suffix: '.tar', mime: 'application/x-tar' },
    { suffix: '.gz', mime: 'application/gzip' },
    { suffix: '.tgz', mime: 'application/gzip' },
    { suffix: '.bz2', mime: 'application/x-bzip2' },
    { suffix: '.xz', mime: 'application/x-xz' },
]

function mimeFromSourceFilename(lowerName: string): string | null {
    for (const { suffix, mime } of UTF8_SOURCE_EXT_TO_MIME) {
        if (lowerName.endsWith(suffix)) return mime
    }
    return null
}

function binaryMimeFromFilename(lowerName: string): string | null {
    for (const { suffix, mime } of BINARY_EXT_TO_MIME) {
        if (lowerName.endsWith(suffix)) return mime
    }
    return null
}

async function readFileSlice(filePath: string, start: number, len: number): Promise<Buffer> {
    const fh = await open(filePath, 'r')
    try {
        const buf = Buffer.alloc(len)
        const { bytesRead } = await fh.read(buf, 0, len, start)
        return buf.subarray(0, bytesRead)
    } finally {
        await fh.close()
    }
}

function isProbablyUtf8Text(buffer: Buffer): boolean {
    if (buffer.length === 0) return false
    if (buffer.includes(0)) return false
    const sample = buffer.subarray(0, Math.min(buffer.length, 64 * 1024))
    try {
        const t = sample.toString('utf8')
        const head = t.slice(0, 4096).toLowerCase()
        if (/<\s*(!doctype|html)\b/i.test(head)) return false
        return true
    } catch {
        return false
    }
}

/**
 * Проверка после записи multipart во временный файл (без чтения всего файла в память).
 */
export async function assertAllowedTaskAttachmentUploadedFile(
    filePath: string,
    originalName: string,
    size: number,
): Promise<{ mime: string }> {
    if (size === 0) {
        throw new BadRequestError('Пустой файл не допускается')
    }
    if (size > MAX_TASK_ATTACHMENT_BYTES) {
        throw new BadRequestError(`Файл слишком большой (максимум ${MAX_TASK_ATTACHMENT_BYTES / 1024 / 1024} МБ)`)
    }

    const { fileTypeFromFile } = await import('file-type')
    const detected = await fileTypeFromFile(filePath)
    if (detected) {
        const mime = detected.mime as string
        if (mime === 'text/html') {
            throw new BadRequestError('HTML-файлы не принимаются как вложения')
        }
        if (mime === 'image/svg+xml') {
            throw new BadRequestError('Файлы SVG не принимаются из соображений безопасности')
        }
        if (mime.startsWith('image/')) {
            return { mime }
        }
        if (ALLOWED_NON_IMAGE_MIME.has(mime)) {
            return { mime }
        }
        if (mime === 'application/javascript' || mime === 'text/javascript') {
            return { mime: 'text/javascript' }
        }
        if (mime === 'text/x-python' || mime === 'application/x-python-code') {
            return { mime: 'text/x-python' }
        }
        if (mime === 'application/json' || mime === 'text/json') {
            return { mime: 'application/json' }
        }
        if (mime === 'text/plain' || mime === 'text/css') {
            return { mime }
        }
        throw new BadRequestError(
            'Недопустимый тип файла. Разрешены изображения, PDF, документы Office, архивы, аудио и видео в распространённых форматах.',
        )
    }

    const lower = originalName.toLowerCase()
    const fromExt = mimeFromSourceFilename(lower)
    if (fromExt) {
        const sampleLen = Math.min(65536, size)
        const sample = await readFileSlice(filePath, 0, sampleLen)
        if (isProbablyUtf8Text(sample)) {
            return { mime: fromExt }
        }
    }

    const bin = binaryMimeFromFilename(lower)
    if (bin) {
        return { mime: bin }
    }

    throw new BadRequestError(
        'Не удалось определить тип файла или формат не поддерживается. Загрузите проверенный файл (например фото, PDF или ZIP).',
    )
}
