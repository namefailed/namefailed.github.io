import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  applyTheme,
  getThemeId,
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

beforeAll(() => {
  ;(globalThis as unknown as { document: unknown }).document = {
    documentElement: mockDocEl,
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    dispatchEvent: () => {},
  }
})

beforeEach(() => {
  localStorage.clear()
  mockDocEl.dataset = {}
  Object.keys(appliedCssVars).forEach(k => { delete appliedCssVars[k] })
  // Reset active theme to mocha between tests
  applyTheme('mocha')
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
})
