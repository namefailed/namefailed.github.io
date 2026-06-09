import { describe, it, expect, vi } from 'vitest'
import { focusTerminalTileIfVisible } from './desktop-wm-focus'

describe('focusTerminalTileIfVisible', () => {
  it('focuses open terminal tile', () => {
    const focusWindow = vi.fn()
    const clearUnfocused = vi.fn()
    const term = { command: 'terminal' }
    focusTerminalTileIfVisible([term] as never, { focusWindow, clearUnfocused })
    expect(focusWindow).toHaveBeenCalledWith(term)
    expect(clearUnfocused).not.toHaveBeenCalled()
  })

  it('clears focus when no terminal tile is visible', () => {
    const focusWindow = vi.fn()
    const clearUnfocused = vi.fn()
    focusTerminalTileIfVisible([{ command: 'whoami' }] as never, { focusWindow, clearUnfocused })
    expect(clearUnfocused).toHaveBeenCalledOnce()
  })
})
