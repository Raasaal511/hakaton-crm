import type { ButtonHTMLAttributes } from 'react'
import { cn } from 'shared/lib'
import styles from './Button.module.css'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(styles.button, styles[variant], className)}
      {...props}
    />
  )
}
