/** Default Browse target when none is supplied (launcher, dock, or bare `browse`). */
export const DEFAULT_BROWSER_URL = 'https://en.wikipedia.org/wiki/Linux'

/** Normalizes URL bar input: blocks dangerous schemes, assumes https for host-like input. */
export function normalizeBrowserUrl(input: string): string {
  const t = input.trim()
  if (!t) return 'about:blank'
  const blocked = /^(javascript|data|vbscript):/i
  if (blocked.test(t)) return 'about:blank'
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
      const u = new URL(t)
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href
      if (u.protocol === 'about:') {
        const href = u.href.toLowerCase()
        if (href === 'about:blank' || href.startsWith('about:blank#')) return 'about:blank'
        return 'about:blank'
      }
      return 'about:blank'
    }
    return new URL('https://' + t).href
  } catch {
    return 'about:blank'
  }
}
