import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePreference } from 'shared/lib'
import { ACCENT_PALETTE } from 'shared/lib/accent'
import type { AccentId } from 'shared/types/userPreferences'
import { ProfileSettingsLayout } from './ProfileSettingsLayout'
import { useUserPreferences } from './useUserPreferences'
import styles from './ProfileAppearancePage.module.css'
import shared from './ProfileSettingsShared.module.css'

const THEME_OPTIONS: Array<{
  value: ThemePreference
  label: string
  Icon: typeof Sun
}> = [
  { value: 'light', label: 'Светлая', Icon: Sun },
  { value: 'dark', label: 'Тёмная', Icon: Moon },
  { value: 'system', label: 'Системная', Icon: Monitor },
]

export function ProfileAppearancePage() {
  const { preferences, saving, error, persist } = useUserPreferences()
  const { resolved, setPreference } = useTheme()

  const onTheme = (theme: ThemePreference) => {
    setPreference(theme)
    void persist({ appearance: { ...preferences.appearance, theme } })
  }

  const onAccent = (accentId: AccentId) => {
    void persist({ appearance: { ...preferences.appearance, accentId } })
  }

  return (
    <ProfileSettingsLayout>
      <section className={shared.panel}>
        <h2 className={shared.panelTitle}>Тема</h2>
        <p className={shared.panelDesc}>Светлая, тёмная или как в системе.</p>
        <div className={styles.themeGrid} role="group" aria-label="Тема оформления">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = preferences.appearance.theme === value
            return (
              <button
                key={value}
                type="button"
                className={`${styles.themeCard} ${active ? styles.themeCardActive : ''}`}
                aria-pressed={active}
                disabled={saving}
                onClick={() => onTheme(value)}
              >
                <span className={styles.themeIconWrap}>
                  <Icon size={22} strokeWidth={1.75} aria-hidden />
                </span>
                <span className={styles.themeLabel}>{label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className={shared.panel}>
        <h2 className={shared.panelTitle}>
          Акцентный цвет
          {saving ? <span className={shared.savingBadge}>Сохранение…</span> : null}
        </h2>
        <p className={shared.panelDesc}>
          Кнопки, ссылки и выделения на доске. Нейтральные цвета (текст, фон) не меняются.
        </p>
        <div className={styles.palette} role="radiogroup" aria-label="Акцентный цвет">
          {ACCENT_PALETTE.map((item) => {
            const active = preferences.appearance.accentId === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`${styles.swatch} ${active ? styles.swatchActive : ''}`}
                title={item.label}
                disabled={saving}
                onClick={() => onAccent(item.id)}
              >
                <span className={styles.swatchColor} style={{ background: item.swatch }} />
                <span className={styles.swatchLabel}>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className={styles.preview} data-theme-preview={resolved}>
          <p className={styles.previewTitle}>Превью</p>
          <div className={styles.previewRow}>
            <button type="button" className={styles.previewPrimary}>
              Основная кнопка
            </button>
            <a href="#preview" className={styles.previewLink} onClick={(e) => e.preventDefault()}>
              Ссылка
            </a>
          </div>
          <span className={styles.previewChip}>Активный элемент</span>
        </div>
      </section>

      {error ? <p className={`${shared.status} ${shared.statusError}`}>{error}</p> : null}
    </ProfileSettingsLayout>
  )
}
