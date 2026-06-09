import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { createCssVarCache } from './css-var-cache'

const mockGetComputedStyle = vi.fn((_el: Element) => ({
  getPropertyValue: (name: string) => (name === '--th-text' ? '#cdd6f4' : ''),
}))

beforeAll(() => {
  ;(globalThis as unknown as { getComputedStyle: typeof mockGetComputedStyle }).getComputedStyle =
    mockGetComputedStyle
  ;(globalThis as unknown as { window: unknown }).window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  ;(globalThis as unknown as { document: unknown }).document = {
    documentElement: {},
  }
})

beforeEach(() => {
  mockGetComputedStyle.mockClear()
})

describe('createCssVarCache', () => {
  it('caches CSS variable reads', () => {
    const source = vi.fn(() => document.documentElement)
    const cache = createCssVarCache(source)
    expect(cache.get('--th-text', '#000')).toBe('#cdd6f4')
    expect(cache.get('--th-text', '#000')).toBe('#cdd6f4')
    expect(source).toHaveBeenCalledOnce()
    cache.destroy()
  })

  it('clears cache on mrgrey-theme-change', () => {
    const listeners = new Map<string, () => void>()
    ;(window.addEventListener as ReturnType<typeof vi.fn>).mockImplementation(
      (type: string, fn: () => void) => listeners.set(type, fn),
    )
    const cache = createCssVarCache(() => document.documentElement)
    cache.get('--th-text', '#000')
    listeners.get('mrgrey-theme-change')?.()
    cache.get('--th-text', '#000')
    expect(mockGetComputedStyle).toHaveBeenCalledTimes(2)
    cache.destroy()
  })
})
