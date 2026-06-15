/**
 * Текст для исполнителя: без разметки, с переносами между блоками.
 */
export function htmlDescriptionToPlainText(html: string | null | undefined): string {
  if (html == null || !String(html).trim()) return ''

  const raw = String(html).trim()
  if (typeof document === 'undefined') {
    return raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  const div = document.createElement('div')
  div.innerHTML = raw

  div.querySelectorAll('br').forEach((br) => {
    br.replaceWith(document.createTextNode('\n'))
  })

  const text = div.innerText ?? div.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

export function isHtmlDescriptionEmpty(html: string): boolean {
  const t = html.trim()
  if (!t) return true
  if (typeof document === 'undefined') {
    return !t.replace(/<[^>]+>/g, '').trim()
  }
  const div = document.createElement('div')
  div.innerHTML = t
  return !(div.textContent || '').trim()
}
