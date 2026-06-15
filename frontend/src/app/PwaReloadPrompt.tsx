import { useRegisterSW } from 'virtual:pwa-register/react'
import { isStandalonePwa } from 'shared/lib'
import { Button } from 'shared/ui/Button'
import styles from './PwaReloadPrompt.module.css'

export function PwaReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh || !isStandalonePwa()) return null

  return (
    <div className={styles.bar} role="status">
      <span className={styles.text}>Доступна новая версия приложения</span>
      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          className={styles.later}
          onClick={() => setNeedRefresh(false)}
        >
          Позже
        </Button>
        <Button type="button" onClick={() => void updateServiceWorker(true)}>
          Обновить
        </Button>
      </div>
    </div>
  )
}
