/** Cache getComputedStyle CSS variable reads; invalidate on theme change. */

export type CssVarCache = {
  get: (name: string, fallback: string) => string
  refresh: () => void
  destroy: () => void
}

export function createCssVarCache(source: () => Element): CssVarCache {
  const cache = new Map<string, string>()

  const get = (name: string, fallback: string): string => {
    const hit = cache.get(name)
    if (hit !== undefined) return hit
    const raw = getComputedStyle(source()).getPropertyValue(name).trim()
    const val = raw || fallback
    cache.set(name, val)
    return val
  }

  const refresh = (): void => {
    cache.clear()
  }

  const onThemeChange = (): void => refresh()
  window.addEventListener('mrgrey-theme-change', onThemeChange)

  return {
    get,
    refresh,
    destroy: () => window.removeEventListener('mrgrey-theme-change', onThemeChange),
  }
}
