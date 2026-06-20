import { afterEach, describe, expect, it } from 'vitest'
import type { Desktop } from './desktop'
import { getDesktopRef, setDesktopRef } from './os-registry'

/**
 * os-registry holds a single module-level reference to the active Desktop.
 * There is no public reset, so each test installs its own fake and the
 * suite leaves the last fake in place rather than a real Desktop. We pin
 * the ref back to a fresh sentinel after every test for isolation hygiene.
 */

/** Minimal stand-in for Desktop — the registry only stores/returns the reference. */
function makeFakeDesktop(tag: string): Desktop {
  return { __tag: tag } as unknown as Desktop
}

afterEach(() => {
  // Leave a known sentinel so a leaked value never masquerades as a real Desktop.
  setDesktopRef(makeFakeDesktop('__afterEach_sentinel__'))
})

describe('os-registry', () => {
  it('returns the exact Desktop instance that was set', () => {
    const desktop = makeFakeDesktop('first')
    setDesktopRef(desktop)
    expect(getDesktopRef()).toBe(desktop)
  })

  it('overwrites the previous reference on a second set', () => {
    const first = makeFakeDesktop('first')
    const second = makeFakeDesktop('second')

    setDesktopRef(first)
    expect(getDesktopRef()).toBe(first)

    setDesktopRef(second)
    expect(getDesktopRef()).toBe(second)
    expect(getDesktopRef()).not.toBe(first)
  })

  it('returns the same reference across repeated reads without mutating it', () => {
    const desktop = makeFakeDesktop('stable')
    setDesktopRef(desktop)

    const a = getDesktopRef()
    const b = getDesktopRef()
    expect(a).toBe(desktop)
    expect(b).toBe(desktop)
    expect(a).toBe(b)
  })

  it('preserves object identity rather than copying the Desktop', () => {
    const desktop = makeFakeDesktop('identity') as unknown as { __tag: string }
    setDesktopRef(desktop as unknown as Desktop)

    desktop.__tag = 'mutated'
    expect((getDesktopRef() as unknown as { __tag: string }).__tag).toBe('mutated')
  })
})
