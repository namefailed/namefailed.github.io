// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  WM_MOUNT_MS,
  WM_UNMOUNT_MS,
  playWmMountAnim,
  animateWmThenRemove,
} from './desktop-wm-animations'

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Construct an animationend event whose `target` is `el` (the guard checks e.target === el). */
function animationEnd(target: EventTarget): AnimationEvent {
  const ev = new Event('animationend') as AnimationEvent
  Object.defineProperty(ev, 'target', { value: target })
  return ev
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

// ── exported durations ──────────────────────────────────────────────────────────

describe('animation durations', () => {
  it('exposes the documented mount/unmount durations', () => {
    expect(WM_MOUNT_MS).toBe(640)
    expect(WM_UNMOUNT_MS).toBe(400)
  })
})

// ── playWmMountAnim ──────────────────────────────────────────────────────────────

describe('playWmMountAnim', () => {
  it('drops a stale close class and applies the entrance class', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    el.classList.add('wm-animate-close')
    document.body.appendChild(el)

    playWmMountAnim(el)

    expect(el.classList.contains('wm-animate-close')).toBe(false)
    expect(el.classList.contains('wm-animate-mount')).toBe(true)

    vi.runAllTimers() // drain the fallback timer so nothing is pending
  })

  it('clears the entrance class on animationend whose target is the element', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)

    playWmMountAnim(el)
    expect(el.classList.contains('wm-animate-mount')).toBe(true)

    el.dispatchEvent(animationEnd(el))

    expect(el.classList.contains('wm-animate-mount')).toBe(false)
    vi.runAllTimers()
  })

  it('ignores animationend bubbling up from a descendant (target !== el)', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const child = document.createElement('span')
    el.appendChild(child)
    document.body.appendChild(el)

    playWmMountAnim(el)
    // event whose target is the child must NOT finish the parent's animation
    el.dispatchEvent(animationEnd(child))

    expect(el.classList.contains('wm-animate-mount')).toBe(true)

    vi.runAllTimers()
    expect(el.classList.contains('wm-animate-mount')).toBe(false)
  })

  it('clears the entrance class on the timed fallback after WM_MOUNT_MS', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)

    playWmMountAnim(el)
    expect(el.classList.contains('wm-animate-mount')).toBe(true)

    // not yet — one tick short of the duration
    vi.advanceTimersByTime(WM_MOUNT_MS - 1)
    expect(el.classList.contains('wm-animate-mount')).toBe(true)

    vi.advanceTimersByTime(1)
    expect(el.classList.contains('wm-animate-mount')).toBe(false)
  })

  it('honours a custom mount duration', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)

    playWmMountAnim(el, 100)

    vi.advanceTimersByTime(99)
    expect(el.classList.contains('wm-animate-mount')).toBe(true)
    vi.advanceTimersByTime(1)
    expect(el.classList.contains('wm-animate-mount')).toBe(false)
  })

  it('finishes only once — a late timer after animationend is a no-op', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const removeSpy = vi.spyOn(el, 'removeEventListener')
    document.body.appendChild(el)

    playWmMountAnim(el)

    // First finish via animationend removes the listener exactly once.
    el.dispatchEvent(animationEnd(el))
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('wm-animate-mount')).toBe(false)

    // The fallback timer still fires, but `done` guards it: no second removeEventListener.
    vi.runAllTimers()
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })
})

// ── animateWmThenRemove ──────────────────────────────────────────────────────────

describe('animateWmThenRemove', () => {
  it('runs done() synchronously and skips animation under reduced motion', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done, { reducedMotion: true })

    expect(done).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('wm-animate-close')).toBe(false)
  })

  it('runs done() synchronously when the element is detached', () => {
    const el = document.createElement('div') // never appended → !isConnected
    const done = vi.fn<() => void>()

    expect(el.isConnected).toBe(false)
    animateWmThenRemove(el, done)

    expect(done).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('wm-animate-close')).toBe(false)
  })

  it('applies the close class and defers done() to the animation (motion path)', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done)

    // mid-animation: class on, done not yet called
    expect(el.classList.contains('wm-animate-close')).toBe(true)
    expect(done).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(done).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('wm-animate-close')).toBe(false)
  })

  it('finalizes on animationend whose target is the element', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done)
    el.dispatchEvent(animationEnd(el))

    expect(done).toHaveBeenCalledTimes(1)
    expect(el.classList.contains('wm-animate-close')).toBe(false)

    vi.runAllTimers() // late fallback timer is guarded
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('ignores animationend bubbling from a descendant (target !== el)', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const child = document.createElement('span')
    el.appendChild(child)
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done)
    el.dispatchEvent(animationEnd(child))

    // descendant event must not finalize
    expect(done).not.toHaveBeenCalled()
    expect(el.classList.contains('wm-animate-close')).toBe(true)

    vi.runAllTimers()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('finalizes on the timed fallback after WM_UNMOUNT_MS', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done)

    vi.advanceTimersByTime(WM_UNMOUNT_MS - 1)
    expect(done).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('honours a custom unmount duration', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done, { unmountMs: 50 })

    vi.advanceTimersByTime(49)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('invokes done() exactly once even when both animationend and timer fire', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    const removeSpy = vi.spyOn(el, 'removeEventListener')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done)

    el.dispatchEvent(animationEnd(el))
    expect(done).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)

    vi.runAllTimers()
    expect(done).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledTimes(1)
  })

  it('reducedMotion:false with a connected element still animates', () => {
    vi.useFakeTimers()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const done = vi.fn<() => void>()

    animateWmThenRemove(el, done, { reducedMotion: false })

    expect(el.classList.contains('wm-animate-close')).toBe(true)
    expect(done).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(done).toHaveBeenCalledTimes(1)
  })
})
