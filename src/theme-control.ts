import type { ITheme } from '@xterm/xterm'
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
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* localStorage unavailable */
  }
  window.dispatchEvent(new CustomEvent('mrgrey-theme-change'))
  return true
}

export function initThemeFromStorage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const id =
      stored && THEME_PACKS.some(p => p.id === stored) ? stored : 'mocha'
    applyTheme(id)
  } catch {
    applyTheme('mocha')
  }
}

export function listThemeSummaries(): ReadonlyArray<{ id: string; label: string }> {
  return THEME_PACKS.map(({ id, label }) => ({ id, label }))
}
