import { useEffect, useState } from 'react'
import { tagsAPI } from 'shared/api/requests/tags'
import { Button } from 'shared/ui'
import type { Tag } from 'shared/types/tags'
import styles from './DepartmentSettingsTags.module.css'

type Props = {
  departmentId: number
  canManage: boolean
  /** На отдельной странице заголовок уже в шапке */
  showHeading?: boolean
  onClose?: () => void
}

export function DepartmentSettingsTags({
  departmentId,
  canManage,
  showHeading = true,
}: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    tagsAPI
      .getByDepartment(departmentId)
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setLoading(false))
  }, [departmentId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newTagName.trim()
    if (!name || !canManage) return

    setCreating(true)
    setError('')
    try {
      const tag = await tagsAPI.createByDepartment(departmentId, name)
      setTags((prev) => [...prev, tag])
      setNewTagName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания тега')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (tag: Tag) => {
    if (!canManage || !confirm(`Удалить тег "${tag.name}"?`)) return

    try {
      await tagsAPI.deleteByDepartment(departmentId, tag.id)
      setTags((prev) => prev.filter((t) => t.id !== tag.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления')
    }
  }

  return (
    <div className={styles.section}>
      {showHeading ? (
        <>
          <h3 className={styles.sectionTitle}>Теги раздела</h3>
          <p className={styles.sectionDesc}>Теги можно назначать задачам в этом разделе</p>
        </>
      ) : null}

      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <>
          <div className={styles.tagsList}>
            {tags.map((tag) => (
              <div key={tag.id} className={styles.tagRow}>
                <span className={styles.tagName}>{tag.name}</span>
                {canManage && (
                  <button
                    type="button"
                    className={styles.tagDelete}
                    onClick={() => handleDelete(tag)}
                    title="Удалить"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {tags.length === 0 && (
              <p className={styles.empty}>Нет тегов. Добавьте первый.</p>
            )}
          </div>

          {canManage && (
            <form onSubmit={handleCreate} className={styles.addForm}>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Название тега"
                className={styles.input}
                disabled={creating}
              />
              <Button type="submit" variant="primary" disabled={creating || !newTagName.trim()}>
                {creating ? '...' : 'Добавить'}
              </Button>
            </form>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </>
      )}
    </div>
  )
}
