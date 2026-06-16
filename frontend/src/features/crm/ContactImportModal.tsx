import { useState, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react'
import { FormModal, formStyles as s } from 'shared/ui/FormModal/FormModal'
import { crmAPI } from 'shared/api/requests/crm'
import { qk } from 'shared/api/queryKeys'
import { organizationModel } from 'entities/organization'
import styles from './ContactImportModal.module.css'

// ── CSV parser (no deps) ──────────────────────────────────────────────────────
type ParsedRow = {
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  status: string
}

const EXPECTED_HEADERS = ['firstname', 'lastname', 'email', 'phone', 'position', 'status']

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
  if (lines.length < 2) return { rows: [], errors: ['Файл пустой или содержит только заголовок'] }

  const rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase())

  // Flexible header detection
  const idx = {
    firstName: rawHeaders.findIndex((h) => h.includes('firstname') || h === 'first_name' || h === 'имя'),
    lastName:  rawHeaders.findIndex((h) => h.includes('lastname')  || h === 'last_name'  || h === 'фамилия'),
    email:     rawHeaders.findIndex((h) => h === 'email' || h === 'e-mail' || h === 'почта'),
    phone:     rawHeaders.findIndex((h) => h === 'phone' || h === 'телефон' || h === 'tel'),
    position:  rawHeaders.findIndex((h) => h === 'position' || h === 'должность' || h === 'job_title'),
    status:    rawHeaders.findIndex((h) => h === 'status' || h === 'статус'),
  }

  if (idx.firstName < 0) return { rows: [], errors: ['Не найдена колонка "firstName" (или "имя")'] }

  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const firstName = idx.firstName >= 0 ? cells[idx.firstName] ?? '' : ''
    if (!firstName.trim()) {
      errors.push(`Строка ${i + 1}: пропущена — нет имени`)
      continue
    }
    rows.push({
      firstName,
      lastName:  idx.lastName  >= 0 ? cells[idx.lastName]  ?? '' : '',
      email:     idx.email     >= 0 ? cells[idx.email]     ?? '' : '',
      phone:     idx.phone     >= 0 ? cells[idx.phone]     ?? '' : '',
      position:  idx.position  >= 0 ? cells[idx.position]  ?? '' : '',
      status:    idx.status    >= 0 ? (cells[idx.status] ?? 'active') : 'active',
    })
  }

  return { rows, errors }
}

// ── Component ─────────────────────────────────────────────────────────────────
type Props = { open: boolean; onClose: () => void }

type ImportRow = ParsedRow & { _valid: boolean; _error?: string }

export function ContactImportModal({ open, onClose }: Props) {
  const org = organizationModel.selectors.useCurrentOrganization()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<ImportRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [importedCount, setImportedCount] = useState(0)

  const importMutation = useMutation({
    mutationFn: async (validRows: ParsedRow[]) => {
      let count = 0
      for (const row of validRows) {
        await crmAPI.createContact(org!.id, {
          firstName: row.firstName,
          lastName:  row.lastName  || undefined,
          email:     row.email     || undefined,
          phone:     row.phone     || undefined,
          position:  row.position  || undefined,
          status:    row.status    || 'active',
        })
        count++
      }
      return count
    },
    onSuccess: (count) => {
      setImportedCount(count)
      setStep('done')
      queryClient.invalidateQueries({ queryKey: ['crm', org?.id, 'contacts'] })
    },
  })

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setParseErrors(['Поддерживаются только .csv файлы'])
      return
    }
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { rows: parsed, errors } = parseCSV(text)
      setParseErrors(errors)
      setRows(parsed.map((r) => ({ ...r, _valid: true })))
      if (parsed.length > 0) setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleClose() {
    setStep('upload')
    setRows([])
    setParseErrors([])
    setFileName('')
    setImportedCount(0)
    onClose()
  }

  const validRows = rows.filter((r) => r._valid)

  function downloadTemplate() {
    const csv = 'firstName,lastName,email,phone,position,status\nИван,Иванов,ivan@example.com,+79001234567,Директор,active\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contacts_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <FormModal
      title="Импорт контактов"
      open={open}
      onClose={handleClose}
      footer={
        step === 'upload' ? (
          <>
            <button type="button" className={s.cancelBtn} onClick={handleClose}>Отмена</button>
            <button type="button" className={s.submitBtn} disabled>Продолжить</button>
          </>
        ) : step === 'preview' ? (
          <>
            <button type="button" className={s.cancelBtn} onClick={() => setStep('upload')}>Назад</button>
            <button
              type="button"
              className={s.submitBtn}
              disabled={validRows.length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate(validRows)}
            >
              {importMutation.isPending && <Loader2 size={13} className={s.spin} />}
              Импортировать {validRows.length} контакт{validRows.length === 1 ? '' : validRows.length < 5 ? 'а' : 'ов'}
            </button>
          </>
        ) : (
          <button type="button" className={s.submitBtn} onClick={handleClose}>Закрыть</button>
        )
      }
    >
      {step === 'upload' && (
        <div className={s.form}>
          <div
            className={`${styles.dropZone} ${dragging ? styles.dragging : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className={styles.hiddenInput}
              onChange={handleFileChange}
            />
            <Upload size={32} strokeWidth={1.5} className={styles.dropIcon} />
            <p className={styles.dropTitle}>Перетащите CSV файл или нажмите для выбора</p>
            <p className={styles.dropSub}>Поддерживается формат .csv (UTF-8)</p>
          </div>

          <div className={styles.templateHint}>
            <FileText size={13} />
            <span>Нужен шаблон?</span>
            <button type="button" className={styles.templateLink} onClick={downloadTemplate}>
              Скачать пример CSV
            </button>
          </div>

          <div className={styles.formatInfo}>
            <p className={styles.formatTitle}>Ожидаемые колонки CSV:</p>
            <code className={styles.formatCode}>firstName, lastName, email, phone, position, status</code>
            <p className={styles.formatNote}>Также поддерживаются русские заголовки: имя, фамилия, почта, телефон</p>
          </div>

          {parseErrors.length > 0 && (
            <div className={styles.errorBox}>
              <AlertCircle size={14} />
              <span>{parseErrors[0]}</span>
            </div>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className={s.form}>
          <div className={styles.previewHeader}>
            <FileText size={14} />
            <span className={styles.previewFile}>{fileName}</span>
            <span className={styles.previewCount}>{validRows.length} контактов</span>
          </div>

          {parseErrors.length > 0 && (
            <div className={styles.warnBox}>
              <AlertCircle size={13} />
              <span>{parseErrors.length} строк пропущено: {parseErrors[0]}{parseErrors.length > 1 ? ` и ещё ${parseErrors.length - 1}` : ''}</span>
            </div>
          )}

          <div className={styles.previewTableWrap}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Фамилия</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Должность</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className={!r._valid ? styles.invalidRow : ''}>
                    <td>{r.firstName || <span className={styles.missing}>—</span>}</td>
                    <td>{r.lastName  || <span className={styles.missing}>—</span>}</td>
                    <td>{r.email     || <span className={styles.missing}>—</span>}</td>
                    <td>{r.phone     || <span className={styles.missing}>—</span>}</td>
                    <td>{r.position  || <span className={styles.missing}>—</span>}</td>
                    <td>{r.status    || 'active'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 10 && (
              <div className={styles.previewMore}>...и ещё {rows.length - 10} строк</div>
            )}
          </div>

          {importMutation.isError && (
            <div className={styles.errorBox}>
              <AlertCircle size={13} />
              <span>Ошибка импорта: {(importMutation.error as Error)?.message}</span>
            </div>
          )}
        </div>
      )}

      {step === 'done' && (
        <div className={styles.doneWrap}>
          <CheckCircle2 size={48} className={styles.doneIcon} strokeWidth={1.5} />
          <p className={styles.doneTitle}>Импорт завершён</p>
          <p className={styles.doneSub}>Добавлено контактов: <strong>{importedCount}</strong></p>
        </div>
      )}
    </FormModal>
  )
}
