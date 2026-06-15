import { useMemo } from 'react'
import {
  sanitizeTaskDescriptionForReadonly,
  isSanitizedDescriptionEmpty,
} from './sanitizeTaskDescriptionHtml'
import styles from './TaskDescriptionPlain.module.css'

type TaskDescriptionPlainProps = {
  html: string | null | undefined
}

export function TaskDescriptionPlain({ html }: TaskDescriptionPlainProps) {
  const { safe, empty } = useMemo(() => {
    const safe = sanitizeTaskDescriptionForReadonly(html)
    return { safe, empty: isSanitizedDescriptionEmpty(safe) }
  }, [html])

  if (empty) {
    return (
      <div className={styles.empty} data-placeholder>
        Нет описания
      </div>
    )
  }

  return (
    <div
      className={styles.readOnlyDoc}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  )
}
