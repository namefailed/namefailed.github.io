import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  HINTS,
  isHintDismissed,
  dismissHint,
  resetAllHints,
  hintKey,
} from './hint-bubbles'

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

// Minimal window mock for Node/Vitest
beforeAll(() => {
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
  }
})

describe('hint catalog', () => {
  beforeEach(() => window.localStorage.clear())

  it('has 3 first-visit folder bubbles', () => {
    expect(HINTS.length).toBe(3)
  })

  it('every hint targets a desktop folder tile', () => {
    const cmds = HINTS.map(h => h.targetCmd).sort()
    expect(cmds).toEqual(['apps-folder', 'games-folder', 'portfolio-folder'])
  })

  it('hintKey uses mrgrey-hint-<id> namespace', () => {
    expect(hintKey('portfolio-folder')).toBe('mrgrey-hint-portfolio-folder')
  })

  it('dismiss + check round-trips', () => {
    expect(isHintDismissed('portfolio-folder')).toBe(false)
    dismissHint('portfolio-folder')
    expect(isHintDismissed('portfolio-folder')).toBe(true)
  })

  it('resetAllHints clears every hint flag', () => {
    dismissHint('portfolio-folder')
    dismissHint('apps-folder')
    resetAllHints()
    expect(isHintDismissed('portfolio-folder')).toBe(false)
    expect(isHintDismissed('apps-folder')).toBe(false)
  })
})
