import { describe, it, expect, vi } from 'vitest'
import {
  dispatchDesktopKeyboard,
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
})
