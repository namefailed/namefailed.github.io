/** Resolves `/static/` for http(s); uses `static/index.html` next to `index.html` for `file:` pages. */
export function resolveStaticPortfolioHref(): string {
  const configuredBase = import.meta.env.BASE_URL ?? '/'
  const pathSegments = `${configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`}static/`

  if (typeof window === 'undefined') return '/static/'
  try {
    if (window.location.protocol === 'file:') {
      return new URL('static/index.html', window.location.href).href
    }
    return new URL(pathSegments, window.location.origin).href
  } catch {
    return new URL('static/index.html', window.location.href).href
  }
}
