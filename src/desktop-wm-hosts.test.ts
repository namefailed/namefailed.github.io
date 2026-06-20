// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  keyboardHost,
  lifecycleContext,
  maximizeContext,
  openWindowHost,
  tileLimitHost,
  type DesktopWmSelf,
} from './desktop-wm-hosts'

// Repo MockStorage pattern: this layer's neighbours persist via os-fs/tiles, so
// give every test a fresh, isolated localStorage even though this module itself
// reads none — keeps the file bulletproof inside the whole suite.
class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

/** A fake tiled window — only the surface these factories touch. */
interface FakeWin {
  command: string
  el: HTMLElement
  maximized: boolean
  isMaximized(): boolean
}

function makeWin(command: string): FakeWin {
  const el = document.createElement('div')
  return {
    command,
    el,
    maximized: false,
    isMaximized() { return this.maximized },
  }
}

/**
 * Build a fully-spied DesktopWmSelf backed by mutable state. Tests mutate
 * `windows`/`focusedId`/`maximizedId` and assert which spies fire and with what.
 */
function makeSelf(overrides: Partial<{ windows: FakeWin[]; focusedId: string | null; maximizedId: string | null }> = {}) {
  const state = {
    windows: overrides.windows ?? ([] as FakeWin[]),
    minimized: [] as { win: FakeWin }[],
    focusedId: overrides.focusedId ?? null as string | null,
    maximizedId: overrides.maximizedId ?? null as string | null,
  }

  const panes = document.createElement('div')
  const desktop = document.createElement('div')

  const spies = {
    closeLauncherOverlay: vi.fn(),
    closeWindow: vi.fn(),
    focusWindow: vi.fn(),
    restoreMinimized: vi.fn(),
    minimizeWindow: vi.fn(),
    toggleMaximizeContent: vi.fn(),
    unmaximizeContent: vi.fn(),
    enforceTileLimit: vi.fn(),
    appendToRightPane: vi.fn(),
    attachVerticalSplitters: vi.fn(),
    openWindow: vi.fn(async () => {}),
    prefersReducedMotion: vi.fn(() => false),
    focusTerminalIfAlreadyVisible: vi.fn(),
    sync: vi.fn(),
    syncDockVisibility: vi.fn(),
    fitOpenTerminal: vi.fn(),
    setFocusedId: vi.fn((v: string | null) => { state.focusedId = v }),
    setMaximizedId: vi.fn((v: string | null) => { state.maximizedId = v }),
    focusTaskbarIndex: vi.fn(),
    focusSpatial: vi.fn(),
    toggleShowDesktop: vi.fn(),
    minimizeWindowContent: vi.fn(),
  }

  const self = {
    get windows() { return state.windows },
    get minimized() { return state.minimized },
    launcherOverlay: { open: false } as unknown,
    panes,
    desktop,
    get layoutMaxVisible() { return 6 },
    getFocusedId: () => state.focusedId,
    setFocusedId: spies.setFocusedId,
    getMaximizedId: () => state.maximizedId,
    setMaximizedId: spies.setMaximizedId,
    prefersReducedMotion: spies.prefersReducedMotion,
    fitOpenTerminal: spies.fitOpenTerminal,
    closeLauncherOverlay: spies.closeLauncherOverlay,
    closeWindow: spies.closeWindow,
    focusWindow: spies.focusWindow,
    restoreMinimized: spies.restoreMinimized,
    minimizeWindow: spies.minimizeWindow,
    toggleMaximizeContent: spies.toggleMaximizeContent,
    unmaximizeContent: spies.unmaximizeContent,
    enforceTileLimit: spies.enforceTileLimit,
    appendToRightPane: spies.appendToRightPane,
    attachVerticalSplitters: spies.attachVerticalSplitters,
    sync: spies.sync,
    syncDockVisibility: spies.syncDockVisibility,
    openWindow: spies.openWindow,
    focusTaskbarIndex: spies.focusTaskbarIndex,
    focusSpatial: spies.focusSpatial,
    toggleShowDesktop: spies.toggleShowDesktop,
    focusTerminalIfAlreadyVisible: spies.focusTerminalIfAlreadyVisible,
  } as unknown as DesktopWmSelf

  return { self, state, spies, panes, desktop }
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { localStorage?: Storage }).localStorage
})

// ── openWindowHost ────────────────────────────────────────────────────────────

describe('openWindowHost', () => {
  it('exposes live getters for windows and minimized', () => {
    const { self, state } = makeSelf()
    const host = openWindowHost(self)
    const w = makeWin('whoami')
    state.windows.push(w as never)
    state.minimized.push({ win: w })
    expect(host.windows).toBe(state.windows)
    expect(host.minimized).toBe(state.minimized)
    expect(host.windows[0]).toBe(w)
  })

  it('forwards every action to self with the same argument', () => {
    const { self, spies } = makeSelf()
    const host = openWindowHost(self)
    const w = makeWin('links') as never

    host.closeLauncherOverlay()
    host.closeWindow(w)
    host.focusWindow(w)
    host.restoreMinimized({ win: w } as never)
    host.minimizeWindow(w)
    host.toggleMaximizeContent(w)
    host.enforceTileLimit()
    host.appendToRightPane(w)
    host.attachVerticalSplitters()

    expect(spies.closeLauncherOverlay).toHaveBeenCalledOnce()
    expect(spies.closeWindow).toHaveBeenCalledWith(w)
    expect(spies.focusWindow).toHaveBeenCalledWith(w)
    expect(spies.restoreMinimized).toHaveBeenCalledWith({ win: w })
    expect(spies.minimizeWindow).toHaveBeenCalledWith(w)
    expect(spies.toggleMaximizeContent).toHaveBeenCalledWith(w)
    expect(spies.enforceTileLimit).toHaveBeenCalledOnce()
    expect(spies.appendToRightPane).toHaveBeenCalledWith(w)
    expect(spies.attachVerticalSplitters).toHaveBeenCalledOnce()
  })

  it('openWindow returns the underlying promise from self', async () => {
    const { self, spies } = makeSelf()
    const host = openWindowHost(self)
    const spec = { command: 'terminal', title: 'terminal', content: [] }
    await host.openWindow(spec as never)
    expect(spies.openWindow).toHaveBeenCalledWith(spec)
  })
})

// ── lifecycleContext ──────────────────────────────────────────────────────────

describe('lifecycleContext', () => {
  it('exposes live getters and the current focused id', () => {
    const { self, state } = makeSelf({ focusedId: 'resume' })
    const ctx = lifecycleContext(self)
    const w = makeWin('resume')
    state.windows.push(w as never)
    expect(ctx.windows).toBe(state.windows)
    expect(ctx.minimized).toBe(state.minimized)
    expect(ctx.getFocusedId()).toBe('resume')
  })

  it('forwards lifecycle hooks to self', () => {
    const { self, spies } = makeSelf()
    const ctx = lifecycleContext(self)
    const w = makeWin('paint') as never

    expect(ctx.prefersReducedMotion()).toBe(false)
    ctx.unmaximizeContent(w)
    ctx.focusTerminalIfAlreadyVisible()
    ctx.attachVerticalSplitters()
    ctx.sync()
    ctx.appendToRightPane(w)
    ctx.focusWindow(w)
    ctx.closeLauncherOverlay()
    ctx.enforceTileLimit()

    expect(spies.prefersReducedMotion).toHaveBeenCalledOnce()
    expect(spies.unmaximizeContent).toHaveBeenCalledWith(w)
    expect(spies.focusTerminalIfAlreadyVisible).toHaveBeenCalledOnce()
    expect(spies.attachVerticalSplitters).toHaveBeenCalledOnce()
    expect(spies.sync).toHaveBeenCalledOnce()
    expect(spies.appendToRightPane).toHaveBeenCalledWith(w)
    expect(spies.focusWindow).toHaveBeenCalledWith(w)
    expect(spies.closeLauncherOverlay).toHaveBeenCalledOnce()
    expect(spies.enforceTileLimit).toHaveBeenCalledOnce()
  })
})

// ── maximizeContext ───────────────────────────────────────────────────────────

describe('maximizeContext', () => {
  it('reads and writes the maximized id through self', () => {
    const { self, state } = makeSelf({ maximizedId: 'p5' })
    const ctx = maximizeContext(self)
    expect(ctx.getMaximizedId()).toBe('p5')
    ctx.setMaximizedId('snake')
    expect(state.maximizedId).toBe('snake')
    ctx.setMaximizedId(null)
    expect(state.maximizedId).toBeNull()
  })

  it('exposes the real panes and desktop elements', () => {
    const { self, panes, desktop } = makeSelf()
    const ctx = maximizeContext(self)
    expect(ctx.panes).toBe(panes)
    expect(ctx.desktop).toBe(desktop)
  })

  it('findOpenWindow matches by command and returns undefined when absent', () => {
    const a = makeWin('whoami')
    const b = makeWin('links')
    const { self } = makeSelf({ windows: [a, b] })
    const ctx = maximizeContext(self)
    expect(ctx.findOpenWindow('links')).toBe(b)
    expect(ctx.findOpenWindow('nope')).toBeUndefined()
  })

  it('forwards layout callbacks to the matching self methods', () => {
    const { self, spies } = makeSelf()
    const ctx = maximizeContext(self)
    const w = makeWin('edit') as never

    ctx.unmaximizeContent(w)
    ctx.syncDockVisibility()
    ctx.onAfterMaximizeLayout()
    ctx.attachVerticalSplitters()
    ctx.sync()

    expect(spies.unmaximizeContent).toHaveBeenCalledWith(w)
    expect(spies.syncDockVisibility).toHaveBeenCalledOnce()
    // onAfterMaximizeLayout is wired to fitOpenTerminal, not a same-named method.
    expect(spies.fitOpenTerminal).toHaveBeenCalledOnce()
    expect(spies.attachVerticalSplitters).toHaveBeenCalledOnce()
    expect(spies.sync).toHaveBeenCalledOnce()
  })
})

// ── tileLimitHost ─────────────────────────────────────────────────────────────

describe('tileLimitHost', () => {
  it('exposes windows, minimized, the visible cap, and focused id', () => {
    const { self, state } = makeSelf({ focusedId: 'pong' })
    const host = tileLimitHost(self)
    const w = makeWin('pong')
    state.windows.push(w as never)
    expect(host.windows).toBe(state.windows)
    expect(host.minimized).toBe(state.minimized)
    expect(host.maxVisible).toBe(6)
    expect(host.getFocusedId()).toBe('pong')
  })

  it('writes the focused id and forwards unmaximize', () => {
    const { self, state, spies } = makeSelf()
    const host = tileLimitHost(self)
    host.setFocusedId('explorer')
    expect(state.focusedId).toBe('explorer')
    const w = makeWin('explorer') as never
    host.unmaximizeContent(w)
    expect(spies.unmaximizeContent).toHaveBeenCalledWith(w)
  })
})

// ── keyboardHost (the previously-uncovered hot path) ──────────────────────────

describe('keyboardHost', () => {
  it('openTerminal opens a terminal window with the expected spec', () => {
    const { self, spies } = makeSelf()
    const host = keyboardHost(self)
    host.openTerminal()
    expect(spies.openWindow).toHaveBeenCalledWith({ command: 'terminal', title: 'terminal', content: [] })
  })

  it('forwards focusTaskbarIndex, focusSpatial and toggleShowDesktop', () => {
    const { self, spies } = makeSelf()
    const host = keyboardHost(self)
    host.focusTaskbarIndex(2)
    host.focusSpatial('l')
    host.toggleShowDesktop()
    expect(spies.focusTaskbarIndex).toHaveBeenCalledWith(2)
    expect(spies.focusSpatial).toHaveBeenCalledWith('l')
    expect(spies.toggleShowDesktop).toHaveBeenCalledOnce()
  })

  describe('closeFocusedOrTerminal', () => {
    it('closes the focused window when one is focused and found', () => {
      const focused = makeWin('links')
      const term = makeWin('terminal')
      const { self, spies } = makeSelf({ windows: [term, focused], focusedId: 'links' })
      keyboardHost(self).closeFocusedOrTerminal()
      expect(spies.closeWindow).toHaveBeenCalledWith(focused)
      expect(spies.closeWindow).toHaveBeenCalledTimes(1)
    })

    it('does nothing when a focused id is set but no matching window exists', () => {
      const term = makeWin('terminal')
      const { self, spies } = makeSelf({ windows: [term], focusedId: 'ghost' })
      keyboardHost(self).closeFocusedOrTerminal()
      // returns early without touching the terminal fallback
      expect(spies.closeWindow).not.toHaveBeenCalled()
    })

    it('falls back to closing the terminal tile when nothing is focused', () => {
      const term = makeWin('terminal')
      const other = makeWin('whoami')
      const { self, spies } = makeSelf({ windows: [other, term], focusedId: null })
      keyboardHost(self).closeFocusedOrTerminal()
      expect(spies.closeWindow).toHaveBeenCalledWith(term)
      expect(spies.closeWindow).toHaveBeenCalledTimes(1)
    })

    it('does nothing when nothing is focused and no terminal is open', () => {
      const other = makeWin('whoami')
      const { self, spies } = makeSelf({ windows: [other], focusedId: null })
      keyboardHost(self).closeFocusedOrTerminal()
      expect(spies.closeWindow).not.toHaveBeenCalled()
    })
  })

  describe('minimizeFocusedOrTerminal', () => {
    it('minimizes the focused window when one is focused and found', () => {
      const focused = makeWin('resume')
      const term = makeWin('terminal')
      const { self, spies } = makeSelf({ windows: [term, focused], focusedId: 'resume' })
      keyboardHost(self).minimizeFocusedOrTerminal()
      expect(spies.minimizeWindow).toHaveBeenCalledWith(focused)
      expect(spies.minimizeWindow).toHaveBeenCalledTimes(1)
    })

    it('does nothing when a focused id is set but no matching window exists', () => {
      const term = makeWin('terminal')
      const { self, spies } = makeSelf({ windows: [term], focusedId: 'ghost' })
      keyboardHost(self).minimizeFocusedOrTerminal()
      expect(spies.minimizeWindow).not.toHaveBeenCalled()
    })

    it('falls back to minimizing the terminal tile when nothing is focused', () => {
      const term = makeWin('terminal')
      const other = makeWin('p5')
      const { self, spies } = makeSelf({ windows: [other, term], focusedId: null })
      keyboardHost(self).minimizeFocusedOrTerminal()
      expect(spies.minimizeWindow).toHaveBeenCalledWith(term)
      expect(spies.minimizeWindow).toHaveBeenCalledTimes(1)
    })

    it('does nothing when nothing is focused and no terminal is open', () => {
      const other = makeWin('p5')
      const { self, spies } = makeSelf({ windows: [other], focusedId: null })
      keyboardHost(self).minimizeFocusedOrTerminal()
      expect(spies.minimizeWindow).not.toHaveBeenCalled()
    })
  })

  describe('toggleMaximizeFocused', () => {
    // toggleMaximizeContent schedules onAfterMaximizeLayout via rAF; use fake
    // timers so nothing stays pending when the environment tears down.
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => {
      vi.runOnlyPendingTimers()
      vi.useRealTimers()
    })

    it('maximizes the focused, non-maximized window via the maximize context', () => {
      const win = makeWin('snake')
      const { self, state, panes, desktop, spies } = makeSelf({ windows: [win], focusedId: 'snake' })
      keyboardHost(self).toggleMaximizeFocused()
      // toggleMaximizeContent applies the maximized class + state through the ctx
      expect(win.el.classList.contains('maximized')).toBe(true)
      expect(panes.classList.contains('max-content')).toBe(true)
      expect(desktop.dataset.maximized).toBe('1')
      expect(state.maximizedId).toBe('snake')
      expect(spies.syncDockVisibility).toHaveBeenCalledOnce()
      // the rAF-scheduled post-layout hook runs fitOpenTerminal once flushed
      expect(spies.fitOpenTerminal).not.toHaveBeenCalled()
      vi.advanceTimersToNextTimer()
      expect(spies.fitOpenTerminal).toHaveBeenCalledOnce()
    })

    it('unmaximizes a focused window that is already maximized', () => {
      const win = makeWin('snake')
      win.maximized = true
      win.el.classList.add('maximized')
      const { self, state, panes, spies } = makeSelf({ windows: [win], focusedId: 'snake', maximizedId: 'snake' })
      panes.classList.add('max-content')
      keyboardHost(self).toggleMaximizeFocused()
      // already-maximized path runs the in-module unmaximize: strips classes,
      // clears the id, re-attaches splitters and re-syncs.
      expect(win.el.classList.contains('maximized')).toBe(false)
      expect(panes.classList.contains('max-content')).toBe(false)
      expect(state.maximizedId).toBeNull()
      expect(spies.attachVerticalSplitters).toHaveBeenCalledOnce()
      expect(spies.sync).toHaveBeenCalledOnce()
    })

    it('does nothing when no window is focused', () => {
      const win = makeWin('snake')
      const { self, state } = makeSelf({ windows: [win], focusedId: null })
      keyboardHost(self).toggleMaximizeFocused()
      expect(win.el.classList.contains('maximized')).toBe(false)
      expect(state.maximizedId).toBeNull()
    })

    it('does nothing when the focused id matches no open window', () => {
      const win = makeWin('snake')
      const { self, state } = makeSelf({ windows: [win], focusedId: 'ghost' })
      keyboardHost(self).toggleMaximizeFocused()
      expect(win.el.classList.contains('maximized')).toBe(false)
      expect(state.maximizedId).toBeNull()
    })
  })
})
