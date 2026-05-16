import { describe, it, expect, beforeEach } from 'vitest'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

// @ts-expect-error mock for tests
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

describe('retro-fx default', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is disabled on first visit (storageGetBool fallback = false)', async () => {
    const { storageGetBool } = await import('./storage')
    expect(storageGetBool('mrgrey-retro-fx', false)).toBe(false)
  })

  it('respects user opt-in once stored', async () => {
    localStorage.setItem('mrgrey-retro-fx', '1')
    const { storageGetBool } = await import('./storage')
    expect(storageGetBool('mrgrey-retro-fx', false)).toBe(true)
  })

  it('respects user opt-out', async () => {
    localStorage.setItem('mrgrey-retro-fx', '0')
    const { storageGetBool } = await import('./storage')
    expect(storageGetBool('mrgrey-retro-fx', true)).toBe(false)
  })
})
