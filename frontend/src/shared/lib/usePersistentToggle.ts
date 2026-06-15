import { useCallback, useEffect, useState } from 'react'

/**
 * Хранит булевый «свёрнут/развёрнут» в localStorage по ключу.
 *
 * Инициализация ленивая: значение из localStorage читается прямо на первом
 * рендере, без последующего «перебивания» через `useEffect`. Это устраняет
 * визуальный мигающий рендер и связанные с ним гонки кликов сразу после
 * первой смены состояния.
 *
 * SSR-безопасно: если `window` недоступен, отдаём `defaultValue`.
 * Слушаем `storage`, чтобы синхронизировать вкладки.
 */
export function usePersistentToggle(
    key: string,
    defaultValue: boolean,
): [boolean, (next: boolean) => void, () => void] {
    const [value, setValue] = useState<boolean>(() => {
        if (typeof window === 'undefined') return defaultValue
        try {
            const raw = window.localStorage.getItem(key)
            if (raw === '1') return true
            if (raw === '0') return false
        } catch {
            /* localStorage недоступен — оставляем defaultValue */
        }
        return defaultValue
    })

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== key || e.newValue == null) return
            setValue(e.newValue === '1')
        }
        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [key])

    const set = useCallback(
        (next: boolean) => {
            setValue(next)
            queueMicrotask(() => {
                try {
                    window.localStorage.setItem(key, next ? '1' : '0')
                } catch {
                    /* ignore */
                }
            })
        },
        [key],
    )

    const toggle = useCallback(() => {
        setValue((prev) => {
            const next = !prev
            queueMicrotask(() => {
                try {
                    window.localStorage.setItem(key, next ? '1' : '0')
                } catch {
                    /* ignore */
                }
            })
            return next
        })
    }, [key])

    return [value, set, toggle]
}
