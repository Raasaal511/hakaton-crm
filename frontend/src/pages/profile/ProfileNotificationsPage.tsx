import { useEffect, useState } from 'react'
import { ProfileSettingsLayout } from './ProfileSettingsLayout'
import { useUserPreferences } from './useUserPreferences'
import {
  disableWebPush,
  enableWebPushWithPrompt,
  getWebPushSubscribed,
} from 'shared/lib/webPushSubscription'
import { hasAuthToken } from 'shared/lib'
import type { UserNotificationPreferences } from 'shared/types/userPreferences'
import shared from './ProfileSettingsShared.module.css'
import styles from './ProfileNotificationsPage.module.css'

function getErrorMessage(e: unknown, fallback: string) {
  const msg =
    (e as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ??
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message
  return msg ?? (e instanceof Error ? e.message : fallback)
}

type ToggleRowProps = {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ label, hint, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className={shared.toggleRow}>
      <div className={shared.toggleRowText}>
        <div className={shared.toggleLabel}>{label}</div>
        <p className={shared.toggleHint}>{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${shared.switch} ${checked ? shared.switchOn : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className={shared.switchKnob} />
      </button>
    </div>
  )
}

const ASSIGNEE_ROWS: Array<{
  key: keyof UserNotificationPreferences
  label: string
  hint: string
}> = [
  {
    key: 'taskAssigned',
    label: 'Назначение исполнителем',
    hint: 'Когда вас добавляют исполнителем задачи',
  },
  {
    key: 'taskCompleted',
    label: 'Завершение задачи',
    hint: 'Когда задача, где вы исполнитель, переведена в завершающую колонку',
  },
]

const ADMIN_ROWS: Array<{
  key: keyof UserNotificationPreferences
  label: string
  hint: string
}> = [
  {
    key: 'deptAdminTaskCreated',
    label: 'Новая задача в разделе',
    hint: 'Для администраторов раздела',
  },
  {
    key: 'deptAdminTaskCompleted',
    label: 'Завершение в разделе',
    hint: 'Для администраторов раздела',
  },
  {
    key: 'deptAdminTaskMoved',
    label: 'Перенос задачи',
    hint: 'Для администраторов раздела',
  },
  {
    key: 'deptAdminAssigneesChanged',
    label: 'Смена исполнителей',
    hint: 'Для администраторов раздела',
  },
]

export function ProfileNotificationsPage() {
  const { preferences, saving, error, persist } = useUserPreferences()
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [pushMessage, setPushMessage] = useState<string | null>(null)

  useEffect(() => {
    setPushSupported(
      !import.meta.env.DEV &&
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window,
    )
  }, [])

  useEffect(() => {
    if (!pushSupported || !hasAuthToken()) return
    void getWebPushSubscribed().then(setPushSubscribed)
  }, [pushSupported])

  const togglesDisabled = saving || !preferences.notifications.pushEnabled

  const setNotification = (key: keyof UserNotificationPreferences, value: boolean) => {
    void persist({
      notifications: { ...preferences.notifications, [key]: value },
    })
  }

  const handleDisablePush = async () => {
    setPushError(null)
    setPushMessage(null)
    setPushBusy(true)
    try {
      await disableWebPush()
      setPushSubscribed(false)
      setPushMessage('Браузерные уведомления отключены')
    } catch (e: unknown) {
      setPushError(getErrorMessage(e, 'Не удалось отключить'))
    } finally {
      setPushBusy(false)
    }
  }

  const handleEnablePush = async () => {
    setPushError(null)
    setPushMessage(null)
    setPushBusy(true)
    try {
      const result = await enableWebPushWithPrompt()
      if (result === 'synced') {
        setPushSubscribed(true)
        setPushMessage('Браузерные уведомления включены')
        if (!preferences.notifications.pushEnabled) {
          void persist({ notifications: { ...preferences.notifications, pushEnabled: true } })
        }
        return
      }
      if (result === 'denied') {
        setPushError('Разрешите уведомления в настройках браузера')
        return
      }
      if (result === 'not_configured') {
        setPushError('Push на сервере не настроен (ключи VAPID)')
        return
      }
      setPushError('Не удалось включить уведомления')
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <ProfileSettingsLayout>
      {pushSupported ? (
        <section className={`${shared.panel} ${styles.browserPanel}`}>
          <div className={styles.browserHead}>
            <div>
              <h2 className={shared.panelTitle}>Браузер</h2>
              <p className={shared.panelDesc} style={{ marginBottom: 0 }}>
                {pushSubscribed
                  ? 'Устройство подписано на push-уведомления'
                  : 'Подключите уведомления, чтобы получать оповещения'}
              </p>
            </div>
            <button
              type="button"
              className={`${styles.bellBtn} ${pushSubscribed ? styles.bellBtnOn : ''}`}
              disabled={pushBusy}
              aria-pressed={pushSubscribed}
              onClick={() => {
                if (pushSubscribed) void handleDisablePush()
                else void handleEnablePush()
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {pushSubscribed ? (
                  <>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </>
                ) : (
                  <>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <path d="M18.63 13A17.66 17.66 0 0 1 12 21.5" />
                    <path d="M6.26 6.26A6 6 0 0 0 6 8c0 7-3 9-3 9h13" />
                    <path d="M1 1l22 22" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {pushError ? <p className={`${shared.status} ${shared.statusError}`}>{pushError}</p> : null}
          {pushMessage ? <p className={`${shared.status} ${shared.statusOk}`}>{pushMessage}</p> : null}
        </section>
      ) : (
        <section className={shared.panel}>
          <p className={shared.panelDesc}>
            В режиме разработки push недоступен. В production подключите service worker и VAPID.
          </p>
        </section>
      )}

      <section className={shared.panel}>
        <h2 className={shared.panelTitle}>
          Типы уведомлений
          {saving ? <span className={shared.savingBadge}>Сохранение…</span> : null}
        </h2>
        <p className={shared.panelDesc}>
          Отключённые типы не будут отправляться, даже если браузер подписан.
        </p>

        <div className={shared.toggleRowStandalone}>
          <ToggleRow
            label="Все push-уведомления"
            hint="Общий выключатель для аккаунта"
            checked={preferences.notifications.pushEnabled}
            disabled={saving}
            onChange={(v) => setNotification('pushEnabled', v)}
          />
        </div>

        <h3 className={styles.groupTitle}>Исполнитель</h3>
        <div className={shared.toggleList}>
          {ASSIGNEE_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              label={row.label}
              hint={row.hint}
              checked={preferences.notifications[row.key]}
              disabled={togglesDisabled}
              onChange={(v) => setNotification(row.key, v)}
            />
          ))}
        </div>

        <h3 className={styles.groupTitle}>Администратор раздела</h3>
        <div className={shared.toggleList}>
          {ADMIN_ROWS.map((row) => (
            <ToggleRow
              key={row.key}
              label={row.label}
              hint={row.hint}
              checked={preferences.notifications[row.key]}
              disabled={togglesDisabled}
              onChange={(v) => setNotification(row.key, v)}
            />
          ))}
        </div>
      </section>

      {error ? <p className={`${shared.status} ${shared.statusError}`}>{error}</p> : null}
    </ProfileSettingsLayout>
  )
}
