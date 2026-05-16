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

  it('has 4 first-visit bubbles', () => {
    expect(HINTS.length).toBe(4)
  })

  it('every hint targets a portfolio tile', () => {
    const cmds = HINTS.map(h => h.targetCmd).sort()
    expect(cmds).toEqual(['links', 'projects', 'resume', 'whoami'])
  })

  it('hintKey uses mrgrey-hint-<id> namespace', () => {
    expect(hintKey('resume')).toBe('mrgrey-hint-resume')
  })

  it('dismiss + check round-trips', () => {
    expect(isHintDismissed('resume')).toBe(false)
    dismissHint('resume')
    expect(isHintDismissed('resume')).toBe(true)
  })

  it('resetAllHints clears every hint flag', () => {
    dismissHint('resume')
    dismissHint('projects')
    resetAllHints()
    expect(isHintDismissed('resume')).toBe(false)
    expect(isHintDismissed('projects')).toBe(false)
  })
})
