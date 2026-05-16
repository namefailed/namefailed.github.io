import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { buildBootLines, BOOT_LINES, runBootSplash } from './boot-splash'

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

// Minimal document + window mock for Node/Vitest (no jsdom dependency)
beforeAll(() => {
  const makeEl = (): Record<string, unknown> => {
    const el: Record<string, unknown> = {
      className: '',
      textContent: '',
      innerHTML: '',
      dataset: {},
      style: {},
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false,
      },
      appendChild: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      remove: () => {},
      scrollHeight: 0,
    }
    Object.defineProperty(el, 'scrollTop', { get: () => 0, set: () => {} })
    return el
  }
  ;(globalThis as unknown as { document: unknown }).document = {
    createElement: (_tag: string) => makeEl(),
    body: { appendChild: () => {}, querySelector: () => null },
    querySelector: () => null,
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
  }
})

describe('runBootSplash gate', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('skips silently if already seen', async () => {
    localStorage.setItem('mrgrey-boot-seen', '1')
    await runBootSplash({ lineInterval: 1, holdMs: 1, fadeMs: 1 })
    // If skipped, flag stays '1' and no error is thrown
    expect(localStorage.getItem('mrgrey-boot-seen')).toBe('1')
  })

  it('sets the gate flag when it runs', async () => {
    await runBootSplash({ lineInterval: 1, holdMs: 1, fadeMs: 1 })
    expect(localStorage.getItem('mrgrey-boot-seen')).toBe('1')
  })
})

describe('boot-splash lines', () => {
  it('exports the full dmesg list', () => {
    expect(BOOT_LINES.length).toBeGreaterThanOrEqual(20)
  })

  it('first line is kernel banner', () => {
    expect(BOOT_LINES[0].kind).toBe('info')
    expect(BOOT_LINES[0].text).toMatch(/kernel/)
  })

  it('last line is handoff', () => {
    expect(BOOT_LINES[BOOT_LINES.length - 1].text).toMatch(/handing off/)
  })

  it('buildBootLines returns one DOM-row per line plus section dividers', () => {
    const rows = buildBootLines()
    const sections = new Set(BOOT_LINES.map(l => l.section).filter(Boolean))
    expect(rows.length).toBe(BOOT_LINES.length + sections.size)
  })
})
