/**
 * Apply and persist the active colour pack: set every --th-* var on <html>, swap
 * the live xterm palette, and remember the choice in localStorage (mrgrey-theme).
 */
import type { ITheme } from '@xterm/xterm'
import { storageGet, storageSet } from './storage'
import { THEME_PACKS, type ThemePack } from './theme-packs'

const STORAGE_KEY = 'mrgrey-theme'

let activeId = 'mocha'

export function getActivePack(): ThemePack {
  return THEME_PACKS.find(p => p.id === activeId) ?? THEME_PACKS[0]!
}

export function getThemeId(): string {
  return activeId
}

export function getActiveTerminalTheme(): ITheme {
  return getActivePack().terminal
}

export function getMatrixRainPalette(): readonly string[] {
  return getActivePack().matrixRain
}

/** Apply named theme; returns false if id is unknown */
export function applyTheme(id: string): boolean {
  const pack = THEME_PACKS.find(p => p.id === id)
  if (!pack) return false
  activeId = id
  document.documentElement.dataset.theme = id
  for (const [key, val] of Object.entries(pack.css)) {
    document.documentElement.style.setProperty(key, val)
  }
  storageSet(STORAGE_KEY, id)
  window.dispatchEvent(new CustomEvent('mrgrey-theme-change'))
  return true
}

export function initThemeFromStorage(): void {
  const stored = storageGet(STORAGE_KEY)
  const id =
    stored && THEME_PACKS.some(p => p.id === stored) ? stored : 'mocha'
  applyTheme(id)
}

export function listThemeSummaries(): ReadonlyArray<{ id: string; label: string }> {
  return THEME_PACKS.map(({ id, label }) => ({ id, label }))
}
