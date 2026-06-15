import { useState, useEffect, useRef } from 'react'
import styles from './InlineEdit.module.css'

type InlineEditProps = {
  value: string
  onSave: (value: string) => Promise<void> | void
  placeholder?: string
  className?: string
  inputClassName?: string
  multiline?: boolean
  /** false — только просмотр, без перехода в режим редактирования */
  editable?: boolean
  /**
   * Счётчик: при увеличении до 1, 2, … (например `setN((v) => v + 1)` с начальным 0)
   * переключает в режим редактирования. Значения 0 и `undefined` не открывают редактор.
   */
  openEditorSignal?: number
}

export function InlineEdit({
  value,
  onSave,
  placeholder,
  className = '',
  inputClassName = '',
  multiline = false,
  editable = true,
  openEditorSignal,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const lastOpenedBySignal = useRef<number | null>(null)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  useEffect(() => {
    if (openEditorSignal == null || openEditorSignal < 1) return
    if (lastOpenedBySignal.current === openEditorSignal) return
    lastOpenedBySignal.current = openEditorSignal
    if (editable) setIsEditing(true)
  }, [openEditorSignal, editable])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    if (editValue.trim() === value) {
      setIsEditing(false)
      return
    }

    try {
      setIsSaving(true)
      await onSave(editValue.trim())
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save:', error)
      setEditValue(value) // Revert on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter' && e.ctrlKey && multiline) {
      e.preventDefault()
      handleSave()
    }
  }

  if (isEditing) {
    const InputComponent = multiline ? 'textarea' : 'input'
    
    return (
      <InputComponent
        ref={inputRef as any}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSaving}
        className={`${styles.input} ${inputClassName}`}
        rows={multiline ? 3 : undefined}
      />
    )
  }

  if (!editable) {
    return (
      <div className={`${styles.display} ${styles.displayReadOnly} ${className}`}>{value || placeholder}</div>
    )
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`${styles.display} ${className}`}
      title="Нажмите для редактирования"
    >
      {value || placeholder}
    </div>
  )
}