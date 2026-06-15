import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { TaskAttachment } from 'shared/types/tasks'
import { tasksAPI } from 'shared/api/requests/tasks'
import { formatFileSize } from '../lib/formatFileSize'
import { isPdfAttachment } from '../lib/isPdfAttachment'
import styles from '../TaskPage.module.css'

type Props = {
  taskId: number
  attachment: TaskAttachment
  /** Может ли текущий пользователь удалить именно это вложение (учитывает автора файла, автора задачи и роль). */
  canDelete: boolean
  onDeleted: (id: number) => void
}

function LightboxCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className={styles.imageLightboxClose} aria-label="Закрыть" onClick={onClose}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6l12 12M18 6L6 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}

export function TaskAttachmentCard({ taskId, attachment, canDelete, onDeleted }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewErr, setPreviewErr] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const previewUrlRef = useRef<string | null>(null)
  const isImage = attachment.mimeType?.startsWith('image/') ?? false
  const isPdf = isPdfAttachment(attachment)

  const setBlobPreviewUrl = useCallback((blob: Blob) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    setPreviewUrl(url)
    return url
  }, [])

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    tasksAPI
      .getAttachmentBlob(taskId, attachment.id)
      .then((blob) => {
        if (cancelled) return
        setBlobPreviewUrl(blob)
      })
      .catch(() => {
        if (!cancelled) setPreviewErr(true)
      })
    return () => {
      cancelled = true
    }
  }, [taskId, attachment.id, isImage, setBlobPreviewUrl])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxOpen])

  const loadPreviewBlob = useCallback(async () => {
    if (previewUrlRef.current) return previewUrlRef.current
    if (previewErr) throw new Error('preview failed')
    setPreviewLoading(true)
    try {
      const blob = await tasksAPI.getAttachmentBlob(taskId, attachment.id)
      const typedBlob = isPdf
        ? new Blob([blob], { type: 'application/pdf' })
        : blob
      return setBlobPreviewUrl(typedBlob)
    } catch {
      setPreviewErr(true)
      throw new Error('preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }, [attachment.id, isPdf, previewErr, setBlobPreviewUrl, taskId])

  const handleOpenPreview = async () => {
    if (isImage && previewUrl && !previewErr) {
      setLightboxOpen(true)
      return
    }
    if (!isPdf || previewErr) return
    setLightboxOpen(true)
    if (!previewUrlRef.current) {
      try {
        await loadPreviewBlob()
      } catch {
        /* previewErr set */
      }
    }
  }

  const handleDownload = async () => {
    const blob = await tasksAPI.getAttachmentBlob(taskId, attachment.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async () => {
    if (!window.confirm('Удалить вложение?')) return
    setDeleting(true)
    try {
      await tasksAPI.deleteAttachment(taskId, attachment.id)
      onDeleted(attachment.id)
    } catch {
      /* axios interceptor sets message */
    } finally {
      setDeleting(false)
    }
  }

  const lightbox =
    lightboxOpen
      ? createPortal(
          <div
            className={styles.imageLightbox}
            role="dialog"
            aria-modal="true"
            aria-label={attachment.fileName}
          >
            <button
              type="button"
              className={styles.imageLightboxBackdrop}
              aria-label="Закрыть"
              onClick={() => setLightboxOpen(false)}
            />
            <div
              className={`${styles.imageLightboxInner} ${isPdf ? styles.imageLightboxInnerPdf : ''}`.trim()}
            >
              {isImage && previewUrl ? (
                <img
                  src={previewUrl}
                  alt={attachment.fileName}
                  className={styles.imageLightboxImg}
                />
              ) : null}
              {isPdf && previewLoading ? (
                <div className={styles.pdfLightboxLoading}>Загрузка PDF…</div>
              ) : null}
              {isPdf && previewErr ? (
                <div className={styles.pdfLightboxError}>Не удалось открыть PDF</div>
              ) : null}
              {isPdf && previewUrl && !previewLoading ? (
                <iframe
                  src={previewUrl}
                  title={attachment.fileName}
                  className={styles.imageLightboxPdf}
                />
              ) : null}
              <LightboxCloseButton onClose={() => setLightboxOpen(false)} />
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className={styles.attachmentCard}>
      {lightbox}
      <div className={styles.attachmentPreview}>
        {isImage && previewUrl && !previewErr ? (
          <button
            type="button"
            className={styles.attachmentPreviewOpen}
            onClick={() => setLightboxOpen(true)}
            aria-label={`Открыть ${attachment.fileName}`}
            title="Открыть"
          >
            <img src={previewUrl} alt="" className={styles.attachmentImage} />
          </button>
        ) : isPdf && !previewErr ? (
          <button
            type="button"
            className={styles.attachmentPdfOpen}
            onClick={() => void handleOpenPreview()}
            aria-label={`Просмотреть ${attachment.fileName}`}
            title="Просмотреть"
          >
            <span className={styles.attachmentPdfBadge}>PDF</span>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : (
          <div className={styles.attachmentFileIcon} aria-hidden>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
      <div className={styles.attachmentMeta}>
        <span className={styles.attachmentName} title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className={styles.attachmentSize}>
          {formatFileSize(attachment.sizeBytes)}
          {attachment.uploadedBy ? (
            <>
              <span aria-hidden> · </span>
              <span
                className={styles.attachmentUploader}
                title={attachment.uploadedBy.email || undefined}
              >
                {`${attachment.uploadedBy.firstname} ${attachment.uploadedBy.lastname}`.trim() ||
                  attachment.uploadedBy.email ||
                  `ID ${attachment.uploadedBy.id}`}
              </span>
            </>
          ) : null}
        </span>
      </div>
      <div className={styles.attachmentActions}>
        {isPdf && !previewErr ? (
          <button
            type="button"
            className={styles.attachmentBtn}
            onClick={() => void handleOpenPreview()}
            title="Просмотреть"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
            </svg>
          </button>
        ) : null}
        <button type="button" className={styles.attachmentBtn} onClick={handleDownload} title="Скачать">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17h16"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {canDelete ? (
          <button
            type="button"
            className={`${styles.attachmentBtn} ${styles.attachmentBtnDanger}`}
            onClick={handleDelete}
            disabled={deleting}
            title="Удалить"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
    </div>
  )
}
