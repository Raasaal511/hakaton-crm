import { useRef, useState } from 'react'
import type { TaskAttachment } from 'shared/types/tasks'
import styles from '../TaskPage.module.css'
import { TaskAttachmentCard } from './TaskAttachmentCard'

type Props = {
  taskId: number
  attachments: TaskAttachment[]
  attachmentsOpen: boolean
  onToggleOpen: () => void
  attachmentsListLoading: boolean
  attachmentsListError: string
  attachmentsListSuccess: boolean
  attachUploading: boolean
  canEditContent: boolean
  canUploadAttachment: boolean
  currentUserId?: number | null
  onUploadFiles: (files: File[]) => void | Promise<void>
  onAttachmentDeleted: (id: number) => void
}

export function TaskAttachmentsSection({
  taskId,
  attachments,
  attachmentsOpen,
  onToggleOpen,
  attachmentsListLoading,
  attachmentsListError,
  attachmentsListSuccess,
  attachUploading,
  canEditContent,
  canUploadAttachment,
  currentUserId,
  onUploadFiles,
  onAttachmentDeleted,
}: Props) {
  const [attachDrag, setAttachDrag] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={styles.attachmentsSection}>
      <button
        type="button"
        className={styles.collapseHead}
        onClick={onToggleOpen}
        aria-expanded={attachmentsOpen}
      >
        <svg
          className={`${styles.collapseChevron} ${attachmentsOpen ? styles.collapseChevronOpen : ''}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.sectionTitle}>Вложения</span>
        {attachmentsListLoading && attachments.length === 0 ? (
          <span className={styles.attachmentsCount}>…</span>
        ) : null}
        {attachments.length > 0 ? (
          <span className={styles.attachmentsCount}>{attachments.length}</span>
        ) : null}
        {!canUploadAttachment && attachmentsListSuccess && attachments.length === 0 ? (
          <span className={styles.collapseHint}>Нет файлов</span>
        ) : null}
      </button>

      <div
        className={styles.collapse}
        data-open={attachmentsOpen}
        aria-hidden={!attachmentsOpen}
        inert={!attachmentsOpen}
      >
        <div className={styles.collapseInner}>
          {attachmentsListError ? (
            <p className={styles.collapseHint} role="alert">
              {attachmentsListError}
            </p>
          ) : null}
          {attachmentsListLoading ? (
            <p className={styles.collapseHint}>Загрузка списка файлов…</p>
          ) : null}
          {canUploadAttachment ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className={styles.attachInputHidden}
                onChange={(e) => {
                  const list = e.target.files
                  if (list?.length) void onUploadFiles(Array.from(list))
                  e.target.value = ''
                }}
              />
              <div
                className={`${styles.attachDropZone} ${attachDrag ? styles.attachDropZoneActive : ''}`}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setAttachDrag(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (e.currentTarget === e.target) setAttachDrag(false)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setAttachDrag(false)
                  const list = e.dataTransfer.files
                  if (list?.length) void onUploadFiles(Array.from(list))
                }}
              >
                <div className={styles.attachDropInner}>
                  <span className={styles.attachDropIcon} aria-hidden>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <div className={styles.attachDropText}>
                    <span className={styles.attachDropTitle}>
                      {attachUploading
                        ? 'Загрузка…'
                        : 'Перетащите файлы сюда или выберите с диска'}
                    </span>
                    <span className={styles.attachDropHint}>До 50 МБ на файл</span>
                  </div>
                  <button
                    type="button"
                    className={styles.attachPickBtn}
                    disabled={attachUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Выбрать файлы
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {attachments.length > 0 ? (
            <div className={styles.attachmentsGrid}>
              {attachments.map((a) => {
                const isUploader =
                  currentUserId != null &&
                  a.uploadedByUserId != null &&
                  a.uploadedByUserId === currentUserId
                return (
                  <TaskAttachmentCard
                    key={a.id}
                    taskId={taskId}
                    attachment={a}
                    canDelete={canEditContent || isUploader}
                    onDeleted={onAttachmentDeleted}
                  />
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
