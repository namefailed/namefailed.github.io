// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mountTiledWindow,
  closeTiledWindow,
  minimizeTiledWindow,
  restoreMinimizedWindow,
  type WmLifecycleContext,
  type TiledLayoutMount,
} from './desktop-wm-lifecycle'
import type { MinimizedEntry, TiledWin } from './desktop-open-window'

// ── Fakes ─────────────────────────────────────────────────────────────────────

interface FakeWin {
  el: HTMLElement
  command: string
  maximized: boolean
  minimizedState: boolean
  disposed: number
  isMaximized(): boolean
  setMinimized(v: boolean): void
  dispose?(): void
}

/** A minimal TiledWin stand-in: a real happy-dom element plus the lifecycle hooks. */
function makeWin(command: string, opts: { maximized?: boolean; withDispose?: boolean } = {}): FakeWin {
  const el = document.createElement('div')
  el.dataset.cmd = command
  const win: FakeWin = {
    el,
    command,
    maximized: opts.maximized ?? false,
    minimizedState: false,
    disposed: 0,
    isMaximized() {
      return this.maximized
    },
    setMinimized(v: boolean) {
      this.minimizedState = v
    },
  }
  if (opts.withDispose) {
    win.dispose = () => {
      win.disposed += 1
    }
  }
  return win
}

interface CtxState {
  ctx: WmLifecycleContext
  windows: TiledWin[]
  minimized: MinimizedEntry[]
  focusedId: string | null
  calls: {
    unmaximizeContent: TiledWin[]
    focusTerminalIfAlreadyVisible: number
    attachVerticalSplitters: number
    sync: number
    appendToRightPane: TiledWin[]
    focusWindow: TiledWin[]
    closeLauncherOverlay: number
    enforceTileLimit: number
  }
}

function makeCtx(opts: { reducedMotion?: boolean; focusedId?: string | null } = {}): CtxState {
  const windows: TiledWin[] = []
  const minimized: MinimizedEntry[] = []
  const calls: CtxState['calls'] = {
    unmaximizeContent: [],
    focusTerminalIfAlreadyVisible: 0,
    attachVerticalSplitters: 0,
    sync: 0,
    appendToRightPane: [],
    focusWindow: [],
    closeLauncherOverlay: 0,
    enforceTileLimit: 0,
  }
  const state: CtxState = {
    windows,
    minimized,
    focusedId: opts.focusedId ?? null,
    calls,
    ctx: {
      windows,
      minimized,
      getFocusedId: () => state.focusedId,
      prefersReducedMotion: () => opts.reducedMotion ?? true,
      unmaximizeContent: w => {
        calls.unmaximizeContent.push(w)
        ;(w as unknown as FakeWin).maximized = false
      },
      focusTerminalIfAlreadyVisible: () => {
        calls.focusTerminalIfAlreadyVisible += 1
      },
      attachVerticalSplitters: () => {
        calls.attachVerticalSplitters += 1
      },
      sync: () => {
        calls.sync += 1
      },
      appendToRightPane: w => {
        calls.appendToRightPane.push(w)
        document.body.appendChild((w as unknown as FakeWin).el)
      },
      focusWindow: w => {
        calls.focusWindow.push(w)
        state.focusedId = (w as unknown as FakeWin).command
      },
      closeLauncherOverlay: () => {
        calls.closeLauncherOverlay += 1
      },
      enforceTileLimit: () => {
        calls.enforceTileLimit += 1
      },
    },
  }
  return state
}

/** Add a fake window to ctx.windows and mount it in the DOM so isConnected is true. */
function attach(state: CtxState, win: FakeWin): void {
  state.windows.push(win as unknown as TiledWin)
  document.body.appendChild(win.el)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

// ── mountTiledWindow ────────────────────────────────────────────────────────────

describe('mountTiledWindow', () => {
  it('mounts the tile at the given index, plays the entrance, and signals first-window', () => {
    vi.useFakeTimers()
    const mounted: Array<{ el: HTMLElement; index: number }> = []
    const layout: TiledLayoutMount = {
      mount: (el, index) => mounted.push({ el, index }),
    }
    const win = makeWin('whoami')
    document.body.appendChild(win.el)

    const firstWindow = vi.fn()
    window.addEventListener('mrgrey-first-window', firstWindow)

    mountTiledWindow(layout, win as unknown as TiledWin, 3)

    expect(mounted).toEqual([{ el: win.el, index: 3 }])
    // playWmMountAnim adds the entrance class
    expect(win.el.classList.contains('wm-animate-mount')).toBe(true)
    expect(firstWindow).toHaveBeenCalledTimes(1)

    // entrance class clears after the timed fallback fires — no pending timer left
    vi.runAllTimers()
    expect(win.el.classList.contains('wm-animate-mount')).toBe(false)

    window.removeEventListener('mrgrey-first-window', firstWindow)
  })

  it('clears the entrance class on animationend, not just on the timer', () => {
    vi.useFakeTimers()
    const layout: TiledLayoutMount = { mount: vi.fn() }
    const win = makeWin('links')
    document.body.appendChild(win.el)

    mountTiledWindow(layout, win as unknown as TiledWin, 0)
    expect(win.el.classList.contains('wm-animate-mount')).toBe(true)

    const ev = new Event('animationend') as AnimationEvent
    Object.defineProperty(ev, 'target', { value: win.el })
    win.el.dispatchEvent(ev)

    expect(win.el.classList.contains('wm-animate-mount')).toBe(false)
    vi.runAllTimers() // drain the fallback timer so nothing is pending
  })
})

// ── closeTiledWindow ────────────────────────────────────────────────────────────

describe('closeTiledWindow', () => {
  it('no-ops when the window is not tracked', () => {
    const state = makeCtx()
    const win = makeWin('ghost')
    document.body.appendChild(win.el)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(win.el.isConnected).toBe(true)
    expect(state.calls.sync).toBe(0)
    expect(state.calls.attachVerticalSplitters).toBe(0)
  })

  it('no-ops when the window is already animating closed', () => {
    const state = makeCtx()
    const win = makeWin('whoami')
    attach(state, win)
    win.el.classList.add('wm-animate-close')

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.windows).toHaveLength(1)
    expect(state.calls.sync).toBe(0)
  })

  it('removes the tile, disposes it, and re-syncs (reduced motion path)', () => {
    const state = makeCtx({ reducedMotion: true })
    const win = makeWin('whoami', { withDispose: true })
    attach(state, win)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.windows).toHaveLength(0)
    expect(win.el.isConnected).toBe(false)
    expect(win.disposed).toBe(1)
    expect(state.calls.attachVerticalSplitters).toBe(1)
    expect(state.calls.sync).toBe(1)
  })

  it('tolerates a window with no dispose() method', () => {
    const state = makeCtx({ reducedMotion: true })
    const win = makeWin('links') // no dispose
    attach(state, win)

    expect(() => closeTiledWindow(state.ctx, win as unknown as TiledWin)).not.toThrow()
    expect(state.windows).toHaveLength(0)
  })

  it('un-maximizes a maximized window before closing it', () => {
    const state = makeCtx({ reducedMotion: true })
    const win = makeWin('projects', { maximized: true })
    attach(state, win)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.unmaximizeContent).toEqual([win as unknown as TiledWin])
    expect(state.windows).toHaveLength(0)
  })

  it('hands focus to the terminal when closing the currently focused tile', () => {
    const state = makeCtx({ reducedMotion: true, focusedId: 'whoami' })
    const win = makeWin('whoami')
    attach(state, win)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.focusTerminalIfAlreadyVisible).toBe(1)
  })

  it('does not re-focus the terminal when closing an unfocused tile', () => {
    const state = makeCtx({ reducedMotion: true, focusedId: 'links' })
    const win = makeWin('whoami')
    attach(state, win)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.focusTerminalIfAlreadyVisible).toBe(0)
    expect(state.windows).toHaveLength(0)
  })

  it('animates first, then finalizes on the timer (motion path)', () => {
    vi.useFakeTimers()
    const state = makeCtx({ reducedMotion: false })
    const win = makeWin('whoami', { withDispose: true })
    attach(state, win)

    closeTiledWindow(state.ctx, win as unknown as TiledWin)

    // mid-animation: class applied, window still tracked
    expect(win.el.classList.contains('wm-animate-close')).toBe(true)
    expect(state.windows).toHaveLength(1)
    expect(state.calls.sync).toBe(0)

    vi.runAllTimers()

    expect(state.windows).toHaveLength(0)
    expect(win.el.isConnected).toBe(false)
    expect(win.disposed).toBe(1)
    expect(state.calls.sync).toBe(1)
  })
})

// ── minimizeTiledWindow ─────────────────────────────────────────────────────────

describe('minimizeTiledWindow', () => {
  it('no-ops when the window is not tracked', () => {
    const state = makeCtx()
    const win = makeWin('ghost')

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.minimized).toHaveLength(0)
    expect(state.calls.sync).toBe(0)
  })

  it('no-ops when the window is already animating closed', () => {
    const state = makeCtx()
    const win = makeWin('whoami')
    attach(state, win)
    win.el.classList.add('wm-animate-close')

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.windows).toHaveLength(1)
    expect(state.minimized).toHaveLength(0)
  })

  it('moves the tile from windows into the minimized dock (reduced motion)', () => {
    const state = makeCtx({ reducedMotion: true })
    const win = makeWin('whoami')
    attach(state, win)

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.windows).toHaveLength(0)
    expect(state.minimized).toEqual([{ win: win as unknown as TiledWin }])
    expect(win.minimizedState).toBe(true)
    expect(win.el.isConnected).toBe(false)
    expect(state.calls.attachVerticalSplitters).toBe(1)
    expect(state.calls.sync).toBe(1)
  })

  it('un-maximizes before minimizing', () => {
    const state = makeCtx({ reducedMotion: true })
    const win = makeWin('projects', { maximized: true })
    attach(state, win)

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.unmaximizeContent).toEqual([win as unknown as TiledWin])
    expect(state.minimized).toHaveLength(1)
  })

  it('hands focus to the terminal when minimizing the focused tile', () => {
    const state = makeCtx({ reducedMotion: true, focusedId: 'whoami' })
    const win = makeWin('whoami')
    attach(state, win)

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.focusTerminalIfAlreadyVisible).toBe(1)
  })

  it('does not re-focus the terminal when minimizing an unfocused tile', () => {
    const state = makeCtx({ reducedMotion: true, focusedId: 'links' })
    const win = makeWin('whoami')
    attach(state, win)

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(state.calls.focusTerminalIfAlreadyVisible).toBe(0)
  })

  it('animates first, then finalizes on the timer (motion path)', () => {
    vi.useFakeTimers()
    const state = makeCtx({ reducedMotion: false })
    const win = makeWin('whoami')
    attach(state, win)

    minimizeTiledWindow(state.ctx, win as unknown as TiledWin)

    expect(win.el.classList.contains('wm-animate-close')).toBe(true)
    expect(state.windows).toHaveLength(1)
    expect(state.minimized).toHaveLength(0)

    vi.runAllTimers()

    expect(state.windows).toHaveLength(0)
    expect(state.minimized).toHaveLength(1)
    expect(win.minimizedState).toBe(true)
  })
})

// ── restoreMinimizedWindow ──────────────────────────────────────────────────────

describe('restoreMinimizedWindow', () => {
  it('no-ops when the entry is not in the minimized list', () => {
    const state = makeCtx()
    const win = makeWin('whoami')
    const orphan: MinimizedEntry = { win: win as unknown as TiledWin }

    restoreMinimizedWindow(state.ctx, orphan)

    expect(state.windows).toHaveLength(0)
    expect(state.calls.appendToRightPane).toHaveLength(0)
    expect(state.calls.closeLauncherOverlay).toBe(0)
    expect(state.calls.focusWindow).toHaveLength(0)
  })

  it('restores a minimized tile back into the tiling pane and focuses it', () => {
    const state = makeCtx()
    const win = makeWin('whoami')
    win.minimizedState = true
    const entry: MinimizedEntry = { win: win as unknown as TiledWin }
    state.minimized.push(entry)

    restoreMinimizedWindow(state.ctx, entry)

    expect(state.minimized).toHaveLength(0)
    expect(state.calls.closeLauncherOverlay).toBe(1)
    expect(state.calls.enforceTileLimit).toBe(1)
    expect(win.minimizedState).toBe(false)
    expect(state.calls.appendToRightPane).toEqual([win as unknown as TiledWin])
    expect(state.windows).toEqual([win as unknown as TiledWin])
    expect(state.calls.attachVerticalSplitters).toBe(1)
    expect(state.calls.focusWindow).toEqual([win as unknown as TiledWin])
    expect(state.focusedId).toBe('whoami')
  })

  it('restores the correct entry when several are docked', () => {
    const state = makeCtx()
    const a = makeWin('links')
    const b = makeWin('projects')
    const entryA: MinimizedEntry = { win: a as unknown as TiledWin }
    const entryB: MinimizedEntry = { win: b as unknown as TiledWin }
    state.minimized.push(entryA, entryB)

    restoreMinimizedWindow(state.ctx, entryB)

    expect(state.minimized).toEqual([entryA])
    expect(state.windows).toEqual([b as unknown as TiledWin])
    expect(state.focusedId).toBe('projects')
  })
})
