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

  it('focuses the last remaining tile when terminal is not open', () => {
    const focusWindow = vi.fn()
    const clearUnfocused = vi.fn()
    const whoami = { command: 'whoami' }
    const resume = { command: 'resume' }
    focusTerminalTileIfVisible([whoami, resume] as never, { focusWindow, clearUnfocused })
    expect(focusWindow).toHaveBeenCalledWith(resume)
    expect(clearUnfocused).not.toHaveBeenCalled()
  })

  it('clears focus when no tiles remain', () => {
    const focusWindow = vi.fn()
    const clearUnfocused = vi.fn()
    focusTerminalTileIfVisible([] as never, { focusWindow, clearUnfocused })
    expect(clearUnfocused).toHaveBeenCalledOnce()
  })
})
