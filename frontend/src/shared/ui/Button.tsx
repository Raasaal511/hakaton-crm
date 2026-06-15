import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from 'shared/lib'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'danger' | 'outline'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const styleVariant = variant === 'danger' ? 'destructive' : variant

  return (
    <button
      className={cn(
        styles.button,
        styles[styleVariant],
        styles[`size-${size}`],
        fullWidth && styles.fullWidth,
        loading && styles.loading,
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden />
      ) : (
        <>
          {iconLeft && <span className={styles.iconLeft} aria-hidden>{iconLeft}</span>}
          {children}
          {iconRight && <span className={styles.iconRight} aria-hidden>{iconRight}</span>}
        </>
      )}
    </button>
  )
}
