import { describe, it, expect, vi, beforeEach } from 'vitest'
import { animateCounter, prefersReducedMotion, typewriter } from './static-motion'

describe('prefersReducedMotion', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    })
  })

  it('returns true when reduce motion is preferred', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    })
    expect(prefersReducedMotion()).toBe(true)
  })

  it('returns false when motion is allowed', () => {
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('animateCounter', () => {
  it('sets final value immediately when reduced motion is on', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    })
    const numEl = { textContent: '0' }
    animateCounter(numEl, 15, '+')
    expect(numEl.textContent).toBe('15+')
  })

  it('animates toward the target when motion is allowed', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    })
    const numEl = { textContent: '0' }
    const times = [0, 475, 950]
    let i = 0
    const raf = vi.fn((cb: (now: number) => void) => {
      cb(times[i++] ?? 950)
      return i
    })
    animateCounter(numEl, 10, '', 950, raf)
    expect(numEl.textContent).toBe('10')
    expect(raf.mock.calls.length).toBeGreaterThan(1)
  })
})

describe('typewriter', () => {
  it('writes full text immediately when reduced motion is on', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
    })
    const target = { textContent: '' } as unknown as HTMLElement
    typewriter(target, 'Hello')
    expect(target.textContent).toBe('Hello')
  })

  it('types character-by-character when motion is allowed', () => {
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false })),
    })
    const cursor = {
      classList: { add: vi.fn() },
      insertAdjacentText: vi.fn(),
    }
    const target = {
      textContent: '',
      appendChild: vi.fn(),
    } as unknown as HTMLElement
    const schedule = vi.fn((fn: () => void) => {
      fn()
      return 0
    })
    typewriter(target, 'Hi', {
      delayMs: 0,
      speedMs: 0,
      schedule: (fn, _ms) => schedule(fn),
      createCursor: () => cursor as unknown as HTMLElement,
    })
    expect(cursor.insertAdjacentText).toHaveBeenCalled()
    expect(target.appendChild).toHaveBeenCalled()
  })
})
