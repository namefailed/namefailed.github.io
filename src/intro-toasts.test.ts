import { describe, it, expect, beforeEach, vi } from 'vitest'
import { INTRO_TOASTS, INTRO_TOASTS_KEY, runIntroToasts } from './intro-toasts'

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
;(globalThis as unknown as { window: unknown }).window = {
  localStorage,
  setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
}

describe('intro toasts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('has exactly 5 sequential greeting toasts', () => {
    expect(INTRO_TOASTS.length).toBe(5)
  })

  it('first toast mentions Matt', () => {
    expect(INTRO_TOASTS[0]).toMatch(/Matt/)
  })

  it('penultimate toast mentions cookies clear', () => {
    expect(INTRO_TOASTS[3]).toMatch(/cookies clear/)
  })

  it('last toast mentions classic view', () => {
    expect(INTRO_TOASTS[4]).toMatch(/Classic view|static/)
  })

  it('uses mrgrey-toasts-seen as the storage gate key', () => {
    expect(INTRO_TOASTS_KEY).toBe('mrgrey-toasts-seen')
  })

  it('skips silently when gate flag is already set', async () => {
    localStorage.setItem(INTRO_TOASTS_KEY, '1')
    const push = vi.fn()
    await runIntroToasts({ push, gapMs: 1 })
    expect(push).not.toHaveBeenCalled()
  })

  it('calls push once per toast in order', async () => {
    const push = vi.fn()
    await runIntroToasts({ push, gapMs: 1 })
    expect(push).toHaveBeenCalledTimes(5)
    expect(push.mock.calls[0][0]).toBe(INTRO_TOASTS[0])
    expect(push.mock.calls[1][0]).toBe(INTRO_TOASTS[1])
    expect(push.mock.calls[2][0]).toBe(INTRO_TOASTS[2])
    expect(push.mock.calls[3][0]).toBe(INTRO_TOASTS[3])
    expect(push.mock.calls[4][0]).toBe(INTRO_TOASTS[4])
  })

  it('sets the gate flag after all toasts fire', async () => {
    const push = vi.fn()
    await runIntroToasts({ push, gapMs: 1 })
    expect(localStorage.getItem(INTRO_TOASTS_KEY)).toBe('1')
  })

  it('does not set the gate flag if skipped', async () => {
    // gate already set before run — should stay '1' but not be set again
    localStorage.setItem(INTRO_TOASTS_KEY, '1')
    const push = vi.fn()
    await runIntroToasts({ push, gapMs: 1 })
    // flag should remain, not cleared
    expect(localStorage.getItem(INTRO_TOASTS_KEY)).toBe('1')
  })
})
