import DOMPurify from 'dompurify'

/** Старые описания без тегов — оборачиваем в безопасный HTML перед санитайзом */
function legacyPlainToHtmlFragment(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('<')) return t
  const escaped = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br />')}</p>`
}

/**
 * Безопасный HTML для режима «только просмотр» (исполнитель).
 */
export function sanitizeTaskDescriptionForReadonly(html: string | null | undefined): string {
  if (html == null || !String(html).trim()) return ''
  const prepared = legacyPlainToHtmlFragment(String(html))
  return DOMPurify.sanitize(prepared, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'strike',
      'span',
      'h1',
      'h2',
      'h3',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
      'hr',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOW_DATA_ATTR: false,
  })
}

export function isSanitizedDescriptionEmpty(sanitized: string): boolean {
  if (!sanitized.trim()) return true
  if (typeof document === 'undefined') {
    return !sanitized.replace(/<[^>]+>/g, '').trim()
  }
  const div = document.createElement('div')
  div.innerHTML = sanitized
  return !(div.textContent || '').trim()
}
