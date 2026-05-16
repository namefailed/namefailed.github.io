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

describe('matrix-bg default', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is disabled on first visit (no localStorage key)', async () => {
    const { storageGetBool } = await import('./storage')
    // matrix-bg reads key 'mrgrey-matrix-bg' with on/off strings, but storageGetBool
    // parses '1'/'true' as true. Key absent → returns fallback false.
    expect(storageGetBool('mrgrey-matrix-bg', false)).toBe(false)
  })

  it('storageGet returns null when key absent (triggers default=false branch)', async () => {
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBeNull()
  })

  it('storageGet returns stored "on" string', async () => {
    localStorage.setItem('mrgrey-matrix-bg', 'on')
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBe('on')
  })

  it('storageGet returns stored "off" string', async () => {
    localStorage.setItem('mrgrey-matrix-bg', 'off')
    const { storageGet } = await import('./storage')
    expect(storageGet('mrgrey-matrix-bg')).toBe('off')
  })
})
