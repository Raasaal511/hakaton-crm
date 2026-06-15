import styles from './TaskDateRangePicker.module.css'

export type TaskTimeFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TaskTimeField({ label, value, onChange, disabled }: TaskTimeFieldProps) {
  return (
    <div className={styles.timeField}>
      <span className={styles.timeFieldLabel}>{label}</span>
      <input
        type="time"
        className={styles.timeInput}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
    </div>
  )
}

export type TaskTimeModeToggleProps = {
  allDay: boolean
  onChange: (allDay: boolean) => void
  disabled?: boolean
}

export function TaskTimeModeToggle({ allDay, onChange, disabled }: TaskTimeModeToggleProps) {
  return (
    <div className={styles.timeModeToggle} role="group" aria-label="Режим даты">
      <button
        type="button"
        className={`${styles.timeModeBtn} ${allDay ? styles.timeModeBtnActive : ''}`}
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        Весь день
      </button>
      <button
        type="button"
        className={`${styles.timeModeBtn} ${!allDay ? styles.timeModeBtnActive : ''}`}
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        Указать время
      </button>
    </div>
  )
}
