import type { LucideIcon } from 'lucide-react'

export type ActivityTone =
  | 'success'
  | 'info'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'purple'
  | 'pink'
  | 'neutral'

export type ActivityMeta = {
  label: string
  verb: string
  Icon: LucideIcon
  tone: ActivityTone
  /** Имеет ли смысл раскрывать полные подробности (помимо встроенного превью). */
  hasDetails: boolean
}

export type UserRef = { id?: number; firstname?: string; lastname?: string; name?: string }
export type TagRef = { id?: number; name?: string }
