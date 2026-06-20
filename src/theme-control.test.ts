import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  applyTheme,
  getThemeId,
  getActivePack,
  getActiveTerminalTheme,
  getMatrixRainPalette,
  listThemeSummaries,
  initThemeFromStorage,
} from './theme-control'
import { THEME_PACKS } from './theme-packs'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

const appliedCssVars: Record<string, string> = {}
const mockDocEl = {
  dataset: {} as Record<string, string>,
  style: {
    setProperty: (key: string, val: string) => { appliedCssVars[key] = val },
  },
}

const dispatchedEventTypes: string[] = []

beforeAll(() => {
  ;(globalThis as unknown as { document: unknown }).document = {
    documentElement: mockDocEl,
  }
  // Minimal CustomEvent shim so applyTheme's `new CustomEvent(...)` works in Node.
  ;(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = class {
    type: string
    constructor(type: string) { this.type = type }
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    dispatchEvent: (e: { type: string }) => { dispatchedEventTypes.push(e.type) },
  }
})

beforeEach(() => {
  localStorage.clear()
  mockDocEl.dataset = {}
  Object.keys(appliedCssVars).forEach(k => { delete appliedCssVars[k] })
  dispatchedEventTypes.length = 0
  // Reset active theme to mocha between tests
  applyTheme('mocha')
  dispatchedEventTypes.length = 0
})

describe('listThemeSummaries', () => {
  it('returns every theme pack', () => {
    const summaries = listThemeSummaries()
    expect(summaries.length).toBe(THEME_PACKS.length)
  })

  it('every summary has id and label', () => {
    for (const s of listThemeSummaries()) {
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThan(0)
      expect(typeof s.label).toBe('string')
      expect(s.label.length).toBeGreaterThan(0)
    }
  })

  it('includes mocha as the default', () => {
    const ids = listThemeSummaries().map(s => s.id)
    expect(ids).toContain('mocha')
  })

  it('includes all expected theme ids', () => {
    const ids = listThemeSummaries().map(s => s.id)
    for (const expected of ['mocha', 'dracula', 'nord', 'gruvbox', 'tokyo-night', 'solarized', 'one-dark']) {
      expect(ids).toContain(expected)
    }
  })
})

describe('applyTheme', () => {
  it('returns true for a valid theme id', () => {
    expect(applyTheme('dracula')).toBe(true)
  })

  it('returns false for an unknown theme id', () => {
    expect(applyTheme('not-a-theme')).toBe(false)
  })

  it('sets document.documentElement.dataset.theme', () => {
    applyTheme('nord')
    expect(mockDocEl.dataset.theme).toBe('nord')
  })

  it('persists the chosen theme id to storage', () => {
    applyTheme('gruvbox')
    expect(localStorage.getItem('mrgrey-theme')).toBe('gruvbox')
  })

  it('applies css variables to document.documentElement', () => {
    applyTheme('mocha')
    // Mocha should set some CSS vars
    expect(Object.keys(appliedCssVars).length).toBeGreaterThan(0)
  })

  it('does not change state on invalid id', () => {
    applyTheme('dracula')
    applyTheme('not-a-theme')
    expect(getThemeId()).toBe('dracula')
  })
})

describe('getThemeId', () => {
  it('returns mocha by default (after beforeEach reset)', () => {
    expect(getThemeId()).toBe('mocha')
  })

  it('reflects the last applied theme', () => {
    applyTheme('tokyo-night')
    expect(getThemeId()).toBe('tokyo-night')
  })
})

describe('initThemeFromStorage', () => {
  it('falls back to mocha when no stored preference exists', () => {
    initThemeFromStorage()
    expect(getThemeId()).toBe('mocha')
  })

  it('applies the stored theme id', () => {
    localStorage.setItem('mrgrey-theme', 'solarized')
    initThemeFromStorage()
    expect(getThemeId()).toBe('solarized')
  })

  it('falls back to mocha when stored id is invalid', () => {
    localStorage.setItem('mrgrey-theme', 'made-up-theme')
    initThemeFromStorage()
    expect(getThemeId()).toBe('mocha')
  })

  it('round-trips a non-default choice through storage', () => {
    // applyTheme writes the id to storage...
    applyTheme('one-dark')
    const persisted = localStorage.getItem('mrgrey-theme')
    expect(persisted).toBe('one-dark')
    // ...and a later init (e.g. fresh page load) reads exactly that back.
    // Reset the in-memory active id without touching storage, proving init
    // restores from the persisted value rather than leftover module state.
    applyTheme('mocha')
    localStorage.setItem('mrgrey-theme', persisted!)
    initThemeFromStorage()
    expect(getThemeId()).toBe('one-dark')
  })

  it('treats an empty stored value as no preference (mocha)', () => {
    localStorage.setItem('mrgrey-theme', '')
    initThemeFromStorage()
    expect(getThemeId()).toBe('mocha')
  })
})

describe('getActivePack', () => {
  it('returns the mocha pack by default', () => {
    const pack = getActivePack()
    expect(pack.id).toBe('mocha')
    expect(pack).toBe(THEME_PACKS.find(p => p.id === 'mocha'))
  })

  it('returns the pack matching the last applied theme', () => {
    applyTheme('nord')
    const pack = getActivePack()
    expect(pack.id).toBe('nord')
    expect(pack.label).toBe('Nord')
    expect(pack).toBe(THEME_PACKS.find(p => p.id === 'nord'))
  })

  it('returns the exact pack object for every known theme', () => {
    for (const known of THEME_PACKS) {
      applyTheme(known.id)
      expect(getActivePack()).toBe(known)
    }
  })
})

describe('getActiveTerminalTheme', () => {
  it('returns the active pack terminal palette (mocha default)', () => {
    const terminal = getActiveTerminalTheme()
    expect(terminal).toBe(THEME_PACKS.find(p => p.id === 'mocha')!.terminal)
    expect(terminal.background).toBe('#1e1e2e')
  })

  it('tracks the terminal palette of the applied theme', () => {
    applyTheme('dracula')
    const terminal = getActiveTerminalTheme()
    expect(terminal).toBe(THEME_PACKS.find(p => p.id === 'dracula')!.terminal)
    expect(terminal.background).toBe('#282a36')
    expect(terminal.foreground).toBe('#f8f8f2')
  })
})

describe('getMatrixRainPalette', () => {
  it('returns the active pack rain tints (mocha default)', () => {
    const palette = getMatrixRainPalette()
    expect(palette).toBe(THEME_PACKS.find(p => p.id === 'mocha')!.matrixRain)
    expect(palette).toHaveLength(8)
  })

  it('tracks the rain palette of the applied theme', () => {
    applyTheme('gruvbox')
    const palette = getMatrixRainPalette()
    expect(palette).toBe(THEME_PACKS.find(p => p.id === 'gruvbox')!.matrixRain)
    expect(palette[0]).toBe('#fb4934')
  })
})

describe('applyTheme side effects', () => {
  it('dispatches the mrgrey-theme-change event on success', () => {
    applyTheme('tokyo-night')
    expect(dispatchedEventTypes).toContain('mrgrey-theme-change')
  })

  it('does not dispatch any event for an unknown id', () => {
    applyTheme('not-a-theme')
    expect(dispatchedEventTypes).toEqual([])
  })

  it('applies every css var from the pack to documentElement', () => {
    const pack = THEME_PACKS.find(p => p.id === 'dracula')!
    applyTheme('dracula')
    for (const [key, val] of Object.entries(pack.css)) {
      expect(appliedCssVars[key]).toBe(val)
    }
  })

  it('leaves css vars untouched for an unknown id', () => {
    Object.keys(appliedCssVars).forEach(k => { delete appliedCssVars[k] })
    applyTheme('not-a-theme')
    expect(Object.keys(appliedCssVars)).toHaveLength(0)
  })

  it('does not persist an unknown id to storage', () => {
    localStorage.setItem('mrgrey-theme', 'nord')
    applyTheme('not-a-theme')
    expect(localStorage.getItem('mrgrey-theme')).toBe('nord')
  })
})
