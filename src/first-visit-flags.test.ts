import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import {
  clearFirstVisitFlags,
  dismissLegacyOnboardingUi,
  FIRST_RUN_KEY,
  SUPPRESSED_LEGACY_KEYS,
} from './first-visit-flags'
import { BOOT_SPLASH_KEY } from './boot-splash'
import { GUIDE_KEY } from './welcome-guide'
import { EMPTY_HINT_KEY } from './desktop-empty-cta'

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
  ;(globalThis as unknown as { document: Document }).document = {
    body: null,
    querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    addEventListener: () => {},
  } as unknown as Document
  ;(globalThis as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver =
    class {
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof MutationObserver
})

const allFirstVisitKeys = [
  BOOT_SPLASH_KEY,
  GUIDE_KEY,
  EMPTY_HINT_KEY,
  ...SUPPRESSED_LEGACY_KEYS,
]

describe('dismissLegacyOnboardingUi', () => {
  beforeEach(() => localStorage.clear())

  it('marks suppressed legacy keys as dismissed', () => {
    dismissLegacyOnboardingUi()
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-portfolio-folder')).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-apps-folder')).toBe('1')
    expect(localStorage.getItem('mrgrey-hint-games-folder')).toBe('1')
  })

  it('does not mark the welcome guide as seen', () => {
    dismissLegacyOnboardingUi()
    expect(localStorage.getItem(GUIDE_KEY)).toBeNull()
  })

  it('removes legacy hint bubble nodes from the DOM', () => {
    const remove = vi.fn()
    const bubble = { remove } as unknown as Element
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([bubble] as unknown as NodeListOf<Element>)
    dismissLegacyOnboardingUi()
    expect(remove).toHaveBeenCalledOnce()
  })
})

describe('clearFirstVisitFlags', () => {
  beforeEach(() => localStorage.clear())

  it('removes all first-visit flag keys when they are set', () => {
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

  it('does not remove unrelated keys (e.g. theme, wallpaper, apt)', () => {
    localStorage.setItem('mrgrey-theme', 'dracula')
    localStorage.setItem('mrgrey-wallpaper', '/wallpaper.jpg')
    localStorage.setItem('mrgrey-apt-cowsay', '1')
    clearFirstVisitFlags()
    expect(localStorage.getItem('mrgrey-theme')).toBe('dracula')
    expect(localStorage.getItem('mrgrey-wallpaper')).toBe('/wallpaper.jpg')
    expect(localStorage.getItem('mrgrey-apt-cowsay')).toBe('1')
  })
})
