import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { clearFirstVisitFlags } from './first-visit-flags'
import { HINTS, hintKey } from './hint-bubbles'
import { BOOT_SPLASH_KEY } from './boot-splash'
import { GUIDE_KEY } from './welcome-guide'
import { INTRO_TOASTS_KEY } from './intro-toasts'

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

beforeAll(() => {
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
  }
})

const allFirstVisitKeys = [
  BOOT_SPLASH_KEY,
  GUIDE_KEY,
  INTRO_TOASTS_KEY,
  ...HINTS.map(h => hintKey(h.targetCmd)),
]

describe('clearFirstVisitFlags', () => {
  beforeEach(() => localStorage.clear())

  it('removes all first-visit flag keys when they are set', () => {
    // Populate every key
    for (const key of allFirstVisitKeys) {
      localStorage.setItem(key, '1')
    }
    clearFirstVisitFlags()
    for (const key of allFirstVisitKeys) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })

  it('is a no-op when no flags are set (does not throw)', () => {
    expect(() => clearFirstVisitFlags()).not.toThrow()
  })

  it('covers exactly boot-splash, guide, toasts, and all folder hint keys', () => {
    const hintKeys = HINTS.map(h => hintKey(h.targetCmd))
    expect(allFirstVisitKeys).toContain(BOOT_SPLASH_KEY)
    expect(allFirstVisitKeys).toContain(GUIDE_KEY)
    expect(allFirstVisitKeys).toContain(INTRO_TOASTS_KEY)
    expect(hintKeys.length).toBe(3)
    expect(allFirstVisitKeys.length).toBe(6) // 3 + 3 hints
  })

  it('does not remove unrelated keys (e.g. theme, wallpaper, apt)', () => {
    localStorage.setItem('mrgrey-theme', 'dracula')
    localStorage.setItem('mrgrey-wallpaper', '/wallpaper.jpg')
    localStorage.setItem('mrgrey-apt-cowsay', '1')
    clearFirstVisitFlags()
    expect(localStorage.getItem('mrgrey-theme')).toBe('dracula')
    expect(localStorage.getItem('mrgrey-wallpaper')).toBe('/wallpaper.jpg')
    expect(localStorage.getItem('mrgrey-apt-cowsay')).toBe('1')
  })

  it('clears guide key (mrgrey-guide-seen) that was missing from old cookies clear', () => {
    localStorage.setItem(GUIDE_KEY, '1')
    clearFirstVisitFlags()
    expect(localStorage.getItem(GUIDE_KEY)).toBeNull()
  })
})
