type CsvRow = Record<string, string | number | null | undefined>

function escapeCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function downloadCsv(filename: string, rows: CsvRow[], columns: { key: string; header: string }[]) {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(','),
  ).join('\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
