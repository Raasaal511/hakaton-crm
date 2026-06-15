import { useCallback, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tasksAPI } from 'shared/api/requests/tasks'
import { qk } from 'shared/api/queryKeys'
import { usePersistentToggle } from 'shared/lib'
import type { TaskComment } from 'shared/types/tasks'
import styles from './TaskComments.module.css'

type TaskCommentsProps = {
  taskId: number
  /** Текущий пользователь может оставлять/редактировать свои комментарии. */
  canComment: boolean
  /** Менеджер отдела может удалять любые комментарии. */
  canModerate: boolean
  currentUserId: number | null
  /** Инициал текущего пользователя для аватара композера (опционально). */
  currentUserInitial?: string
}

const COMMENT_MAX_LENGTH = 4000
const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.platform)

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

function authorInitial(c: TaskComment): string {
  const s = c.author?.firstname?.[0] ?? c.author?.email?.[0] ?? '?'
  return s.toUpperCase()
}

function authorName(c: TaskComment): string {
  if (!c.author) return 'Пользователь удалён'
  const full = `${c.author.firstname} ${c.author.lastname}`.trim()
  return full || c.author.email || `ID ${c.authorId ?? ''}`
}

function isEdited(c: TaskComment): boolean {
  if (!c.updatedAt || !c.createdAt) return false
  const created = new Date(c.createdAt).getTime()
  const updated = new Date(c.updatedAt).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false
  return updated - created > 1500
}

export function TaskComments({
  taskId,
  canComment,
  canModerate,
  currentUserId,
  currentUserInitial,
}: TaskCommentsProps) {
  const queryClient = useQueryClient()
  const [open, , toggleOpen] = usePersistentToggle('task-page:comments-open', false)

  const commentsQuery = useQuery({
    queryKey: qk.taskComments(taskId),
    queryFn: () => tasksAPI.listComments(taskId),
    /** Счётчик в шапке: данные нужны до первого открытия блока. */
    enabled: Number.isFinite(taskId),
    staleTime: 30_000,
  })

  const comments = commentsQuery.data ?? []
  const loaded = commentsQuery.isSuccess
  const loading = commentsQuery.isFetching
  const loadError = commentsQuery.isError
    ? commentsQuery.error instanceof Error
      ? commentsQuery.error.message
      : 'Не удалось загрузить комментарии'
    : ''

  const setCommentsCache = useCallback(
    (updater: (prev: TaskComment[]) => TaskComment[]) => {
      queryClient.setQueryData<TaskComment[]>(qk.taskComments(taskId), (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient, taskId],
  )

  const [draft, setDraft] = useState('')
  const [postError, setPostError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [editError, setEditError] = useState('')

  const editRef = useRef<HTMLTextAreaElement>(null)

  const addMutation = useMutation({
    mutationFn: (body: string) => tasksAPI.addComment(taskId, body),
    onSuccess: (created) => {
      setCommentsCache((prev) => [...prev, created])
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      tasksAPI.updateComment(taskId, id, body),
    onSuccess: (updated) => {
      setCommentsCache((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tasksAPI.deleteComment(taskId, id),
    onSuccess: (_, id) => {
      setCommentsCache((prev) => prev.filter((c) => c.id !== id))
    },
  })

  const posting = addMutation.isPending
  const editBusy = updateMutation.isPending

  const submit = useCallback(async () => {
    const text = draft.trim()
    if (!text || posting) return
    if (text.length > COMMENT_MAX_LENGTH) {
      setPostError(`Не больше ${COMMENT_MAX_LENGTH} символов`)
      return
    }
    setPostError('')
    try {
      await addMutation.mutateAsync(text)
      setDraft('')
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Не удалось отправить комментарий')
    }
  }, [draft, posting, addMutation])

  const startEdit = (c: TaskComment) => {
    setEditingId(c.id)
    setEditDraft(c.body)
    setEditError('')
    setTimeout(() => editRef.current?.focus(), 0)
  }

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditDraft('')
    setEditError('')
  }, [])

  const saveEdit = useCallback(async () => {
    if (editingId == null) return
    const text = editDraft.trim()
    if (!text || editBusy) return
    if (text.length > COMMENT_MAX_LENGTH) {
      setEditError(`Не больше ${COMMENT_MAX_LENGTH} символов`)
      return
    }
    setEditError('')
    try {
      await updateMutation.mutateAsync({ id: editingId, body: text })
      cancelEdit()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Не удалось сохранить')
    }
  }, [cancelEdit, editBusy, editDraft, editingId, updateMutation])

  const removeComment = async (id: number) => {
    if (!window.confirm('Удалить комментарий?')) return
    try {
      await deleteMutation.mutateAsync(id)
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Не удалось удалить комментарий')
    }
  }

  const submitHotkey = useMemo(() => (IS_MAC ? '⌘ + ↵' : 'Ctrl + Enter'), [])

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const onEditKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    }
  }

  const count = comments.length
  const composerInitial = currentUserInitial?.[0]?.toUpperCase() || '·'

  return (
    <section className={styles.section} aria-label="Комментарии">
      <button
        type="button"
        className={styles.collapseHead}
        onClick={toggleOpen}
        aria-expanded={open}
      >
        <svg
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
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
            d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={styles.sectionTitle}>Комментарии</span>
        {loaded ? (
          count > 0 ? <span className={styles.count}>{count}</span> : null
        ) : loading ? (
          <span className={styles.count}>…</span>
        ) : null}
        {!canComment && !open ? <span className={styles.hint}>Только просмотр</span> : null}
      </button>

      <div
        className={styles.collapse}
        data-open={open}
        aria-hidden={!open}
        {...(!open ? { inert: '' as unknown as boolean } : {})}
      >
        <div className={styles.collapseInner}>
      {loadError ? (
        <div className={styles.empty}>{loadError}</div>
      ) : !loaded && loading ? (
        <div className={styles.empty}>Загрузка…</div>
      ) : count === 0 ? (
        <div className={styles.empty}>Пока нет комментариев.</div>
      ) : (
        <ol className={styles.list}>
          {comments.map((c) => {
            const isOwn = currentUserId != null && c.authorId === currentUserId
            const canDelete = isOwn || canModerate
            const canEdit = isOwn
            const editing = editingId === c.id
            return (
              <li key={c.id} className={`${styles.item} ${isOwn ? styles.itemOwn : ''}`}>
                <span className={styles.avatar} aria-hidden>
                  {authorInitial(c)}
                </span>
                <div className={styles.content}>
                  <div className={styles.head}>
                    <span className={styles.author}>{authorName(c)}</span>
                    {isOwn ? <span className={styles.youTag}>Вы</span> : null}
                    <span className={styles.metaDot} aria-hidden />
                    <span className={styles.date}>{formatDateTime(c.createdAt)}</span>
                    {isEdited(c) ? (
                      <span className={styles.edited} title={formatDateTime(c.updatedAt)}>
                        изменено
                      </span>
                    ) : null}
                    {!editing && (canEdit || canDelete) ? (
                      <span className={styles.actions}>
                        {canEdit ? (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => startEdit(c)}
                            aria-label="Редактировать"
                            title="Редактировать"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path
                                d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => void removeComment(c.id)}
                            aria-label="Удалить"
                            title="Удалить"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                      </span>
                    ) : null}
                  </div>

                  {editing ? (
                    <div className={styles.editForm}>
                      <textarea
                        ref={editRef}
                        className={styles.textarea}
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={onEditKey}
                        maxLength={COMMENT_MAX_LENGTH}
                        disabled={editBusy}
                      />
                      <div className={styles.composerFooter}>
                        <span className={styles.composerMeta}>
                          {editError ? (
                            <span className={styles.error}>{editError}</span>
                          ) : (
                            <>
                              <span className={styles.kbd}>Esc</span>
                              <span>отмена</span>
                            </>
                          )}
                        </span>
                        <div className={styles.actionsRow}>
                          <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={cancelEdit}
                            disabled={editBusy}
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => void saveEdit()}
                            disabled={editBusy || editDraft.trim().length === 0}
                          >
                            {editBusy ? 'Сохранение…' : 'Сохранить'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className={styles.body}>{c.body}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {canComment ? (
        <div className={styles.composer}>
          <span className={`${styles.avatar} ${styles.avatarAccent}`} aria-hidden>
            {composerInitial}
          </span>
          <div className={styles.composerField}>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder="Добавьте комментарий…"
              maxLength={COMMENT_MAX_LENGTH}
              disabled={posting}
              rows={2}
            />
            <div className={styles.composerFooter}>
              <span className={styles.composerMeta}>
                {postError ? (
                  <span className={styles.error}>{postError}</span>
                ) : (
                  <>
                    <span className={styles.kbd}>{submitHotkey}</span>
                    <span>отправить</span>
                  </>
                )}
              </span>
              <div className={styles.actionsRow}>
                {draft.length > 0 ? (
                  <button
                    type="button"
                    className={styles.btnGhost}
                    onClick={() => setDraft('')}
                    disabled={posting}
                  >
                    Очистить
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void submit()}
                  disabled={posting || draft.trim().length === 0}
                >
                  {posting ? 'Отправка…' : 'Комментировать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : count === 0 ? null : (
        <div className={styles.readonlyStub}>
          У вас нет прав на комментирование этой задачи.
        </div>
      )}
        </div>
      </div>
    </section>
  )
}
