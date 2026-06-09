import { describe, it, expect, afterEach } from 'vitest'
import { prefersReducedMotion } from './prefers-reduced-motion'

describe('prefersReducedMotion', () => {
  const prev = globalThis.window

  afterEach(() => {
    ;(globalThis as { window?: typeof prev }).window = prev
  })

  it('returns false when matchMedia is unavailable', () => {
    ;(globalThis as { window: unknown }).window = {}
    expect(prefersReducedMotion()).toBe(false)
  })

  it('reads the reduce media query', () => {
    ;(globalThis as { window: unknown }).window = {
      matchMedia: (q: string) => ({
        matches: q === '(prefers-reduced-motion: reduce)',
      }),
    }
    expect(prefersReducedMotion()).toBe(true)
  })
})
