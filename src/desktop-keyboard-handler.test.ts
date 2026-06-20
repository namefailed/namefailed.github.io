// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import {
  dispatchDesktopKeyboard,
  handleDesktopGlobalKey,
  shouldInterceptDesktopChord,
} from './desktop-keyboard-handler'

function host() {
  return {
    openTerminal: vi.fn(),
    focusTaskbarIndex: vi.fn(),
    focusSpatial: vi.fn(),
    closeFocusedOrTerminal: vi.fn(),
    minimizeFocusedOrTerminal: vi.fn(),
    toggleMaximizeFocused: vi.fn(),
    toggleShowDesktop: vi.fn(),
  }
}

describe('shouldInterceptDesktopChord', () => {
  it('requires Ctrl without Alt/Meta', () => {
    expect(shouldInterceptDesktopChord({ ctrlKey: true, altKey: false, metaKey: false })).toBe(
      true,
    )
    expect(shouldInterceptDesktopChord({ ctrlKey: true, altKey: true, metaKey: false })).toBe(
      false,
    )
  })

  it('rejects when Ctrl is absent', () => {
    expect(shouldInterceptDesktopChord({ ctrlKey: false, altKey: false, metaKey: false })).toBe(
      false,
    )
  })

  it('rejects Ctrl combined with Meta (e.g. global OS chords)', () => {
    expect(shouldInterceptDesktopChord({ ctrlKey: true, altKey: false, metaKey: true })).toBe(
      false,
    )
  })
})

describe('dispatchDesktopKeyboard', () => {
  it('opens terminal on Ctrl+T', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('t', h)).toBe(true)
    expect(h.openTerminal).toHaveBeenCalledOnce()
  })

  it('focuses dock slot on Ctrl+1', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('1', h)).toBe(true)
    expect(h.focusTaskbarIndex).toHaveBeenCalledWith(0)
  })

  it('ignores unreserved keys', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('x', h)).toBe(false)
  })

  it('toggles show-desktop on Ctrl+D', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('d', h)).toBe(true)
    expect(h.toggleShowDesktop).toHaveBeenCalledOnce()
  })

  it('maps the last dock slot Ctrl+9 to index 8', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('9', h)).toBe(true)
    expect(h.focusTaskbarIndex).toHaveBeenCalledWith(8)
  })

  it('does not treat 0 as a dock slot', () => {
    const h = host()
    // '0' is not a reserved chord key, so it must not focus a slot.
    expect(dispatchDesktopKeyboard('0', h)).toBe(false)
    expect(h.focusTaskbarIndex).not.toHaveBeenCalled()
  })

  it.each([
    ['h', 'h'],
    ['l', 'l'],
    ['k', 'k'],
    ['j', 'j'],
  ] as const)('routes spatial focus for Ctrl+%s', (key, dir) => {
    const h = host()
    expect(dispatchDesktopKeyboard(key, h)).toBe(true)
    expect(h.focusSpatial).toHaveBeenCalledWith(dir)
  })

  it('closes the focused window on Ctrl+Q', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('q', h)).toBe(true)
    expect(h.closeFocusedOrTerminal).toHaveBeenCalledOnce()
  })

  it('minimizes the focused window on Ctrl+M', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('m', h)).toBe(true)
    expect(h.minimizeFocusedOrTerminal).toHaveBeenCalledOnce()
  })

  it('toggles maximize on Ctrl+F', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('f', h)).toBe(true)
    expect(h.toggleMaximizeFocused).toHaveBeenCalledOnce()
  })

  it('normalizes uppercase keys (Shift held) before dispatch', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('M', h)).toBe(true)
    expect(h.minimizeFocusedOrTerminal).toHaveBeenCalledOnce()
  })

  it('ignores a non-chord key without touching the host', () => {
    const h = host()
    expect(dispatchDesktopKeyboard('a', h)).toBe(false)
    expect(h.openTerminal).not.toHaveBeenCalled()
    expect(h.focusSpatial).not.toHaveBeenCalled()
    expect(h.toggleMaximizeFocused).not.toHaveBeenCalled()
  })
})

describe('handleDesktopGlobalKey', () => {
  function keyEvent(init: KeyboardEventInit): KeyboardEvent {
    const ev = new KeyboardEvent('keydown', init)
    vi.spyOn(ev, 'preventDefault')
    vi.spyOn(ev, 'stopImmediatePropagation')
    return ev
  }

  it('handles a reserved chord, consuming the event', () => {
    const h = host()
    const ev = keyEvent({ key: 'T', ctrlKey: true })
    expect(handleDesktopGlobalKey(ev, h)).toBe(true)
    expect(h.openTerminal).toHaveBeenCalledOnce()
    expect(ev.preventDefault).toHaveBeenCalledOnce()
    expect(ev.stopImmediatePropagation).toHaveBeenCalledOnce()
  })

  it('ignores chords without Ctrl and leaves the event intact', () => {
    const h = host()
    const ev = keyEvent({ key: 't', ctrlKey: false })
    expect(handleDesktopGlobalKey(ev, h)).toBe(false)
    expect(h.openTerminal).not.toHaveBeenCalled()
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ev.stopImmediatePropagation).not.toHaveBeenCalled()
  })

  it('passes through Ctrl chords that are not reserved (e.g. Ctrl+C copy)', () => {
    const h = host()
    const ev = keyEvent({ key: 'c', ctrlKey: true })
    expect(handleDesktopGlobalKey(ev, h)).toBe(false)
    expect(ev.preventDefault).not.toHaveBeenCalled()
    expect(ev.stopImmediatePropagation).not.toHaveBeenCalled()
  })

  it('does not intercept when Alt is also held', () => {
    const h = host()
    const ev = keyEvent({ key: 'd', ctrlKey: true, altKey: true })
    expect(handleDesktopGlobalKey(ev, h)).toBe(false)
    expect(h.toggleShowDesktop).not.toHaveBeenCalled()
    expect(ev.preventDefault).not.toHaveBeenCalled()
  })
})
