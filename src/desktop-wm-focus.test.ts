// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { focusTerminalTileIfVisible, focusSubtarget } from './desktop-wm-focus'
import type { TiledWin } from './desktop-open-window'

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

  it('prefers an open terminal even when other tiles follow it', () => {
    const focusWindow = vi.fn()
    const clearUnfocused = vi.fn()
    const term = { command: 'terminal' }
    const projects = { command: 'projects' }
    focusTerminalTileIfVisible([term, projects] as never, { focusWindow, clearUnfocused })
    expect(focusWindow).toHaveBeenCalledWith(term)
    expect(focusWindow).not.toHaveBeenCalledWith(projects)
    expect(clearUnfocused).not.toHaveBeenCalled()
  })
})

describe('focusSubtarget', () => {
  /** Build a fake tile whose only relevant surface is the named focus method. */
  function tileWith(command: string, method: string) {
    const fn = vi.fn<() => void>()
    return { win: { command, [method]: fn } as unknown as TiledWin, fn }
  }

  it('routes terminal focus into the shell', () => {
    const { win, fn } = tileWith('terminal', 'focusShell')
    focusSubtarget(win)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('routes edit focus into the editor', () => {
    const { win, fn } = tileWith('edit', 'focusEditor')
    focusSubtarget(win)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('routes explorer focus into the panel', () => {
    const { win, fn } = tileWith('explorer', 'focusPanel')
    focusSubtarget(win)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('routes browse focus into the address bar', () => {
    const { win, fn } = tileWith('browse', 'focusAddressBar')
    focusSubtarget(win)
    expect(fn).toHaveBeenCalledOnce()
  })

  it.each(['paint', 'snake', 'pong'])('routes %s focus into the canvas', command => {
    const { win, fn } = tileWith(command, 'focusCanvas')
    focusSubtarget(win)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('does nothing for a command with no focus subtarget', () => {
    const focusShell = vi.fn<() => void>()
    const focusEditor = vi.fn<() => void>()
    const focusPanel = vi.fn<() => void>()
    const focusAddressBar = vi.fn<() => void>()
    const focusCanvas = vi.fn<() => void>()
    const win = {
      command: 'whoami',
      focusShell,
      focusEditor,
      focusPanel,
      focusAddressBar,
      focusCanvas,
    } as unknown as TiledWin
    expect(() => focusSubtarget(win)).not.toThrow()
    expect(focusShell).not.toHaveBeenCalled()
    expect(focusEditor).not.toHaveBeenCalled()
    expect(focusPanel).not.toHaveBeenCalled()
    expect(focusAddressBar).not.toHaveBeenCalled()
    expect(focusCanvas).not.toHaveBeenCalled()
  })
})
