/** Resolves `/phoeme/` for http(s); uses `phoeme/index.html` beside `index.html` for `file:` pages. */
export function resolvePhoemeSiteHref(): string {
  const configuredBase = import.meta.env.BASE_URL ?? '/'
  const pathSegments = `${configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`}phoeme/`

  if (typeof window === 'undefined') return '/phoeme/'
  try {
    if (window.location.protocol === 'file:') {
      return new URL('phoeme/index.html', window.location.href).href
    }
    return new URL(pathSegments, window.location.origin).href
  } catch {
    return new URL('phoeme/index.html', window.location.href).href
  }
}
