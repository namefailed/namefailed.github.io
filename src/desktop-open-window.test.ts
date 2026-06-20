// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  editWindowSpecFromPath,
  explorerFileOpenSpec,
  isMiniGameCommand,
  p5WindowSpecFromPath,
  resolveBrowserUrl,
  resolveEditorPath,
  resolveExplorerPath,
  windowChromeCallbacks,
} from './desktop-open-window'
import type { WindowSpec } from './appwindow'

describe('isMiniGameCommand', () => {
  it('recognizes paint/snake/pong', () => {
    expect(isMiniGameCommand('paint')).toBe(true)
    expect(isMiniGameCommand('cube')).toBe(false)
    expect(isMiniGameCommand('resume')).toBe(false)
  })
})

describe('resolveEditorPath', () => {
  it('defaults to notes.txt', () => {
    expect(resolveEditorPath({ command: 'edit', title: 'edit', content: [] })).toBe('notes.txt')
  })

  it('uses editorPath when provided', () => {
    expect(
      resolveEditorPath({
        command: 'edit',
        title: 'edit',
        content: [],
        editorPath: '~/docs/readme.md',
      }),
    ).toBe('~/docs/readme.md')
  })
})

describe('resolveExplorerPath', () => {
  it('normalizes explorer path with home default', () => {
    expect(resolveExplorerPath({ command: 'explorer', title: 'explorer', content: [] })).toBe(
      '/home/namefailed',
    )
  })
})

describe('resolveBrowserUrl', () => {
  it('normalizes default browser URL', () => {
    const url = resolveBrowserUrl({ command: 'browse', title: 'browse', content: [] })
    expect(url.startsWith('https://')).toBe(true)
  })
})

describe('p5WindowSpecFromPath', () => {
  it('uses basename as title', () => {
    expect(p5WindowSpecFromPath('/home/sketches/demo.js')).toEqual({
      command: 'p5',
      title: 'demo.js',
      content: [],
      p5SketchPath: '/home/sketches/demo.js',
    })
  })
})

describe('explorerFileOpenSpec', () => {
  it('routes .js files to p5 viewer', () => {
    expect(explorerFileOpenSpec('/home/sketches/a.js')).toEqual(
      p5WindowSpecFromPath('/home/sketches/a.js'),
    )
  })

  it('routes other files to editor', () => {
    expect(explorerFileOpenSpec('/home/notes.txt')).toEqual(
      editWindowSpecFromPath('/home/notes.txt'),
    )
  })
})

describe('editWindowSpecFromPath', () => {
  it('builds editor spec with path in title', () => {
    const spec: WindowSpec = editWindowSpecFromPath('/home/notes.txt')
    expect(spec.command).toBe('edit')
    expect(spec.editorPath).toBe('/home/notes.txt')
    expect(spec.title).toContain('notes.txt')
  })
})

describe('windowChromeCallbacks', () => {
  it('resolves the window instance lazily (not at callback creation time)', () => {
    const closed: unknown[] = []
    const host = {
      closeWindow: (win: unknown) => {
        closed.push(win)
      },
      minimizeWindow: () => {},
      toggleMaximizeContent: () => {},
      focusWindow: () => {},
    }
    let win!: { command: string }
    win = { command: 'edit' }
    const { onClose } = windowChromeCallbacks(host as never, () => win as never)
    onClose()
    expect(closed).toEqual([win])
  })

  it('wires each chrome button to its host method with the resolved window', () => {
    const calls: Array<[string, unknown]> = []
    const host = {
      closeWindow: (w: unknown) => calls.push(['close', w]),
      minimizeWindow: (w: unknown) => calls.push(['min', w]),
      toggleMaximizeContent: (w: unknown) => calls.push(['max', w]),
      focusWindow: (w: unknown) => calls.push(['focus', w]),
    }
    let win!: { command: string }
    win = { command: 'whoami' }
    const cb = windowChromeCallbacks(host as never, () => win as never)
    cb.onClose()
    cb.onMinimize()
    cb.onMaximize()
    cb.onFocus()
    expect(calls).toEqual([
      ['close', win],
      ['min', win],
      ['max', win],
      ['focus', win],
    ])
  })
})

// ── dispatchOpenWindow routing (lazy-loaded window modules are faked) ──────────
//
// dispatchOpenWindow takes a host implementing OpenWindowHost, so we can drive
// every launcher branch with a hand-built spy host instead of mounting Desktop.
// Each lazily-imported window chunk is replaced with a tiny fake constructor so
// the dynamic import() resolves synchronously to DOM-safe stand-ins (no xterm,
// cubing.js, p5, canvas, etc.).

const pushToastMock = vi.fn()
vi.mock('./os-systray', () => ({ pushToast: (...a: unknown[]) => pushToastMock(...a) }))

interface FakeChromeOpts {
  onClose?: () => void
  onMinimize?: () => void
  onMaximize?: () => void
  onFocus?: () => void
}

class FakeEditorWindow {
  readonly command = 'edit'
  readonly initialPath: string
  readonly opts: FakeChromeOpts & { initialPath: string; onRunInP5?: (p: string) => void }
  loadFile = vi.fn<(p: string) => void>()
  pathMatches = vi.fn<(p: string) => boolean>(() => false)
  constructor(opts: FakeChromeOpts & { initialPath: string; onRunInP5?: (p: string) => void }) {
    this.opts = opts
    this.initialPath = opts.initialPath
  }
}
vi.mock('./editor-window', () => ({ EditorWindow: FakeEditorWindow }))

class FakeFileExplorerWindow {
  readonly command = 'explorer'
  readonly opts: FakeChromeOpts & { initialPath: string; onOpenInEditor?: (p: string) => void }
  navigateTo = vi.fn<(p: string) => void>()
  pathMatches = vi.fn<(p: string) => boolean>(() => false)
  constructor(opts: FakeChromeOpts & { initialPath: string; onOpenInEditor?: (p: string) => void }) {
    this.opts = opts
  }
}
vi.mock('./file-explorer-window', () => ({ FileExplorerWindow: FakeFileExplorerWindow }))

class FakeBrowserWindow {
  readonly command = 'browse'
  readonly opts: FakeChromeOpts & { initialUrl: string }
  navigateTo = vi.fn<(u: string) => void>()
  pathMatches = vi.fn<(u: string) => boolean>(() => false)
  constructor(opts: FakeChromeOpts & { initialUrl: string }) {
    this.opts = opts
  }
}
vi.mock('./browser-window', () => ({ BrowserWindow: FakeBrowserWindow }))

class FakeP5Window {
  readonly command = 'p5'
  readonly opts: FakeChromeOpts & { initialVfsPath: string | null; onOpenWindow?: (s: WindowSpec) => void }
  loadFromVfs = vi.fn<(p: string) => Promise<void>>(async () => {})
  constructor(opts: FakeChromeOpts & { initialVfsPath: string | null; onOpenWindow?: (s: WindowSpec) => void }) {
    this.opts = opts
  }
}
vi.mock('./p5-window', () => ({ P5Window: FakeP5Window }))

class FakeTerminalWindow {
  readonly command = 'terminal'
  readonly opts: FakeChromeOpts & { onOpenWindow?: (s: WindowSpec) => void }
  mount = vi.fn<() => Promise<void>>(async () => {})
  fit = vi.fn<() => void>()
  constructor(opts: FakeChromeOpts & { onOpenWindow?: (s: WindowSpec) => void }) {
    this.opts = opts
  }
}
vi.mock('./terminal', () => ({ TerminalWindow: FakeTerminalWindow }))

class FakePaintWindow {
  readonly command = 'paint'
  readonly opts: FakeChromeOpts
  constructor(opts: FakeChromeOpts) {
    this.opts = opts
  }
}
vi.mock('./paint-window', () => ({ PaintWindow: FakePaintWindow }))

class FakeSnakeWindow {
  readonly command = 'snake'
  readonly opts: FakeChromeOpts
  constructor(opts: FakeChromeOpts) {
    this.opts = opts
  }
}
vi.mock('./snake-window', () => ({ SnakeWindow: FakeSnakeWindow }))

class FakePongWindow {
  readonly command = 'pong'
  readonly opts: FakeChromeOpts
  constructor(opts: FakeChromeOpts) {
    this.opts = opts
  }
}
vi.mock('./pong-window', () => ({ PongWindow: FakePongWindow }))

// Imported after the mocks are registered (vi.mock is hoisted, but keep the
// dynamic-import target explicit for clarity).
const { dispatchOpenWindow } = await import('./desktop-open-window')
type Host = Parameters<typeof dispatchOpenWindow>[1]
type Win = Host['windows'][number]

// Spy host: same shape as OpenWindowHost but with vi.fn() collaborators we can
// assert against. Kept structurally separate from Host (rather than `extends
// Host`) so the loosely-typed mock fns don't trip the exact method signatures;
// `dispatch()` casts it back to Host at the single call boundary.
interface SpyHost {
  windows: Win[]
  minimized: { win: Win }[]
  closeLauncherOverlay: ReturnType<typeof vi.fn>
  closeWindow: ReturnType<typeof vi.fn>
  focusWindow: ReturnType<typeof vi.fn>
  restoreMinimized: ReturnType<typeof vi.fn>
  minimizeWindow: ReturnType<typeof vi.fn>
  toggleMaximizeContent: ReturnType<typeof vi.fn>
  enforceTileLimit: ReturnType<typeof vi.fn>
  appendToRightPane: ReturnType<typeof vi.fn>
  attachVerticalSplitters: ReturnType<typeof vi.fn>
  openWindow: ReturnType<typeof vi.fn>
}

/** Drive the real dispatcher against a spy host (single cast boundary). */
function dispatch(s: WindowSpec, host: SpyHost): Promise<void> {
  return dispatchOpenWindow(s, host as unknown as Host)
}

function makeHost(): SpyHost {
  const windows: Win[] = []
  const minimized: { win: Win }[] = []
  return {
    windows,
    minimized,
    closeLauncherOverlay: vi.fn(),
    closeWindow: vi.fn((w: Win) => {
      const i = windows.indexOf(w)
      if (i !== -1) windows.splice(i, 1)
    }),
    focusWindow: vi.fn(),
    restoreMinimized: vi.fn((entry: { win: Win }) => {
      const i = minimized.indexOf(entry)
      if (i !== -1) minimized.splice(i, 1)
      windows.push(entry.win)
    }),
    minimizeWindow: vi.fn(),
    toggleMaximizeContent: vi.fn(),
    enforceTileLimit: vi.fn(),
    appendToRightPane: vi.fn(),
    attachVerticalSplitters: vi.fn(),
    openWindow: vi.fn(async () => {}),
  }
}

const spec = (command: string, extra: Partial<WindowSpec> = {}): WindowSpec => ({
  command,
  title: command,
  content: [],
  ...extra,
})

describe('dispatchOpenWindow', () => {
  beforeEach(() => {
    pushToastMock.mockClear()
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('always closes the launcher overlay first', async () => {
    const host = makeHost()
    await dispatch(spec('whoami'), host)
    expect(host.closeLauncherOverlay).toHaveBeenCalledOnce()
  })

  // ── generic AppWindow fallthrough (lines 340-360) ──────────────────────────

  it('mounts a fresh AppWindow for an unknown command and focuses it', async () => {
    const host = makeHost()
    await dispatch(spec('about'), host)
    expect(host.windows).toHaveLength(1)
    const win = host.windows[0]!
    expect(win.command).toBe('about')
    expect(host.enforceTileLimit).toHaveBeenCalledOnce()
    expect(host.appendToRightPane).toHaveBeenCalledWith(win)
    expect(host.attachVerticalSplitters).toHaveBeenCalledOnce()
    expect(host.focusWindow).toHaveBeenLastCalledWith(win)
  })

  it('AppWindow chrome callbacks route to the host (close/min/max/focus)', async () => {
    const host = makeHost()
    await dispatch(spec('about'), host)
    const win = host.windows[0]!
    // The traffic-light dots wired in createWindowChrome must reach the host.
    const dot = (cls: string) => win.el.querySelector(cls) as HTMLElement
    dot('.dot-close').click()
    expect(host.closeWindow).toHaveBeenLastCalledWith(win)
    dot('.dot-min').click()
    expect(host.minimizeWindow).toHaveBeenLastCalledWith(win)
    dot('.dot-max').click()
    expect(host.toggleMaximizeContent).toHaveBeenLastCalledWith(win)
    win.el.dispatchEvent(new MouseEvent('mousedown'))
    expect(host.focusWindow).toHaveBeenCalledWith(win)
  })

  it('a repeat unknown command closes the already-open window (toggle off)', async () => {
    const host = makeHost()
    await dispatch(spec('about'), host)
    const win = host.windows[0]!
    host.closeWindow.mockClear()
    await dispatch(spec('about'), host)
    expect(host.closeWindow).toHaveBeenCalledWith(win)
    expect(host.windows).toHaveLength(0)
  })

  it('restores a minimized unknown-command window instead of spawning a new one (lines 342-343)', async () => {
    const host = makeHost()
    // Build a minimized AppWindow-like entry for the same command.
    const minimizedWin = { command: 'about' } as unknown as Win
    host.minimized.push({ win: minimizedWin })
    await dispatch(spec('about'), host)
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
    expect(host.restoreMinimized.mock.calls[0]![0]).toEqual({ win: minimizedWin })
    // No new AppWindow was constructed; the restored window is the only one.
    expect(host.windows).toEqual([minimizedWin])
    expect(host.enforceTileLimit).not.toHaveBeenCalled()
  })

  // ── edit / explorer / browse (path-keyed) ──────────────────────────────────

  it('opens a new editor window via the lazy import and mounts it', async () => {
    const host = makeHost()
    await dispatch(spec('edit', { editorPath: '~/docs/a.md' }), host)
    expect(host.windows).toHaveLength(1)
    const ed = host.windows[0] as unknown as FakeEditorWindow
    expect(ed).toBeInstanceOf(FakeEditorWindow)
    expect(ed.initialPath).toBe('~/docs/a.md')
    expect(host.focusWindow).toHaveBeenLastCalledWith(ed)
  })

  it('editor with the SAME path while open closes it (path-keyed toggle)', async () => {
    const host = makeHost()
    await dispatch(spec('edit', { editorPath: 'notes.txt' }), host)
    const ed = host.windows[0] as unknown as FakeEditorWindow
    ed.pathMatches.mockReturnValue(true)
    host.closeWindow.mockClear()
    await dispatch(spec('edit', { editorPath: 'notes.txt' }), host)
    expect(ed.pathMatches).toHaveBeenCalledWith('notes.txt')
    expect(host.closeWindow).toHaveBeenCalledWith(ed)
  })

  it('editor with a DIFFERENT path while open loads it and refocuses (no new window)', async () => {
    const host = makeHost()
    await dispatch(spec('edit', { editorPath: 'a.txt' }), host)
    const ed = host.windows[0] as unknown as FakeEditorWindow
    ed.pathMatches.mockReturnValue(false)
    host.focusWindow.mockClear()
    await dispatch(spec('edit', { editorPath: 'b.txt' }), host)
    expect(ed.loadFile).toHaveBeenCalledWith('b.txt')
    expect(host.focusWindow).toHaveBeenCalledWith(ed)
    expect(host.windows).toHaveLength(1)
  })

  it('editor onRunInP5 callback asks the host to open a p5 window for the sketch', async () => {
    const host = makeHost()
    await dispatch(spec('edit', { editorPath: 'sketch.js' }), host)
    const ed = host.windows[0] as unknown as FakeEditorWindow
    ed.opts.onRunInP5!('/home/x/sketch.js')
    expect(host.openWindow).toHaveBeenCalledWith(p5WindowSpecFromPath('/home/x/sketch.js'))
  })

  it('editor chrome callbacks resolve to the constructed editor window', async () => {
    const host = makeHost()
    await dispatch(spec('edit', { editorPath: 'sketch.js' }), host)
    const ed = host.windows[0] as unknown as FakeEditorWindow
    ed.opts.onClose!()
    expect(host.closeWindow).toHaveBeenLastCalledWith(ed)
    ed.opts.onMinimize!()
    expect(host.minimizeWindow).toHaveBeenLastCalledWith(ed)
    ed.opts.onMaximize!()
    expect(host.toggleMaximizeContent).toHaveBeenLastCalledWith(ed)
  })

  it('editor with a matching MINIMIZED window restores it without loading', async () => {
    const host = makeHost()
    const ed = new FakeEditorWindow({ initialPath: 'notes.txt' }) as unknown as Win
    ;(ed as unknown as FakeEditorWindow).pathMatches.mockReturnValue(true)
    host.minimized.push({ win: ed })
    await dispatch(spec('edit', { editorPath: 'notes.txt' }), host)
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
    expect((ed as unknown as FakeEditorWindow).loadFile).not.toHaveBeenCalled()
  })

  it('editor with a NON-matching minimized window loads the path then restores', async () => {
    const host = makeHost()
    const ed = new FakeEditorWindow({ initialPath: 'a.txt' }) as unknown as Win
    ;(ed as unknown as FakeEditorWindow).pathMatches.mockReturnValue(false)
    host.minimized.push({ win: ed })
    await dispatch(spec('edit', { editorPath: 'b.txt' }), host)
    expect((ed as unknown as FakeEditorWindow).loadFile).toHaveBeenCalledWith('b.txt')
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
  })

  it('opens an explorer window on the normalized default path', async () => {
    const host = makeHost()
    await dispatch(spec('explorer'), host)
    const ex = host.windows[0] as unknown as FakeFileExplorerWindow
    expect(ex).toBeInstanceOf(FakeFileExplorerWindow)
    expect(ex.opts.initialPath).toBe('/home/namefailed')
  })

  it('explorer with a different path while open navigates and refocuses (no new window)', async () => {
    const host = makeHost()
    await dispatch(spec('explorer', { explorerPath: '/home/namefailed' }), host)
    const ex = host.windows[0] as unknown as FakeFileExplorerWindow
    ex.pathMatches.mockReturnValue(false)
    host.focusWindow.mockClear()
    await dispatch(spec('explorer', { explorerPath: '/etc' }), host)
    expect(ex.navigateTo).toHaveBeenCalledWith('/etc')
    expect(host.focusWindow).toHaveBeenCalledWith(ex)
    expect(host.windows).toHaveLength(1)
  })

  it('explorer with a matching minimized window restores it without navigating', async () => {
    const host = makeHost()
    const ex = new FakeFileExplorerWindow({ initialPath: '/home/namefailed' }) as unknown as Win
    ;(ex as unknown as FakeFileExplorerWindow).pathMatches.mockReturnValue(true)
    host.minimized.push({ win: ex })
    await dispatch(spec('explorer', { explorerPath: '/home/namefailed' }), host)
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
    expect((ex as unknown as FakeFileExplorerWindow).navigateTo).not.toHaveBeenCalled()
  })

  it('explorer onOpenInEditor routes .js to p5 and other files to editor', async () => {
    const host = makeHost()
    await dispatch(spec('explorer'), host)
    const ex = host.windows[0] as unknown as FakeFileExplorerWindow
    ex.opts.onOpenInEditor!('/home/sketch.js')
    expect(host.openWindow).toHaveBeenCalledWith(p5WindowSpecFromPath('/home/sketch.js'))
    ex.opts.onOpenInEditor!('/home/notes.txt')
    expect(host.openWindow).toHaveBeenCalledWith(editWindowSpecFromPath('/home/notes.txt'))
  })

  it('explorer chrome callbacks resolve to the constructed explorer window', async () => {
    const host = makeHost()
    await dispatch(spec('explorer'), host)
    const ex = host.windows[0] as unknown as FakeFileExplorerWindow
    ex.opts.onClose!()
    expect(host.closeWindow).toHaveBeenLastCalledWith(ex)
    ex.opts.onFocus!()
    expect(host.focusWindow).toHaveBeenCalledWith(ex)
  })

  it('opens a browser window on the normalized default URL', async () => {
    const host = makeHost()
    await dispatch(spec('browse'), host)
    const br = host.windows[0] as unknown as FakeBrowserWindow
    expect(br).toBeInstanceOf(FakeBrowserWindow)
    expect(br.opts.initialUrl.startsWith('https://')).toBe(true)
  })

  it('browser chrome callbacks resolve to the constructed browser window', async () => {
    const host = makeHost()
    await dispatch(spec('browse'), host)
    const br = host.windows[0] as unknown as FakeBrowserWindow
    br.opts.onMinimize!()
    expect(host.minimizeWindow).toHaveBeenLastCalledWith(br)
    br.opts.onMaximize!()
    expect(host.toggleMaximizeContent).toHaveBeenLastCalledWith(br)
  })

  it('browser with a different URL while open navigates and refocuses', async () => {
    const host = makeHost()
    await dispatch(spec('browse'), host)
    const br = host.windows[0] as unknown as FakeBrowserWindow
    br.pathMatches.mockReturnValue(false)
    host.focusWindow.mockClear()
    await dispatch(spec('browse', { browserUrl: 'example.com' }), host)
    expect(br.navigateTo).toHaveBeenCalledWith(resolveBrowserUrl(spec('browse', { browserUrl: 'example.com' })))
    expect(host.focusWindow).toHaveBeenCalledWith(br)
  })

  // ── p5 (its own minimized / existing / fresh branches) ─────────────────────

  it('opens a fresh p5 window and passes the sketch path through', async () => {
    const host = makeHost()
    await dispatch(spec('p5', { p5SketchPath: '/home/s.js' }), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    expect(pw).toBeInstanceOf(FakeP5Window)
    expect(pw.opts.initialVfsPath).toBe('/home/s.js')
    expect(host.focusWindow).toHaveBeenLastCalledWith(pw)
  })

  it('p5 with no sketch path passes null as the initial vfs path', async () => {
    const host = makeHost()
    await dispatch(spec('p5'), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    expect(pw.opts.initialVfsPath).toBeNull()
  })

  it('p5 onOpenWindow callback delegates to the host', async () => {
    const host = makeHost()
    await dispatch(spec('p5'), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    const nested = spec('whoami')
    pw.opts.onOpenWindow!(nested)
    expect(host.openWindow).toHaveBeenCalledWith(nested)
  })

  it('p5 chrome callbacks resolve to the constructed p5 window', async () => {
    const host = makeHost()
    await dispatch(spec('p5'), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    pw.opts.onClose!()
    expect(host.closeWindow).toHaveBeenLastCalledWith(pw)
    pw.opts.onMaximize!()
    expect(host.toggleMaximizeContent).toHaveBeenLastCalledWith(pw)
  })

  it('p5 focuses an already-open window and reloads the sketch path (no new window)', async () => {
    const host = makeHost()
    await dispatch(spec('p5', { p5SketchPath: '/a.js' }), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    pw.loadFromVfs.mockClear()
    host.focusWindow.mockClear()
    await dispatch(spec('p5', { p5SketchPath: '/b.js' }), host)
    expect(pw.loadFromVfs).toHaveBeenCalledWith('/b.js')
    expect(host.focusWindow).toHaveBeenCalledWith(pw)
    expect(host.windows).toHaveLength(1)
  })

  it('p5 focuses an already-open window without reloading when no path is given', async () => {
    const host = makeHost()
    await dispatch(spec('p5', { p5SketchPath: '/a.js' }), host)
    const pw = host.windows[0] as unknown as FakeP5Window
    pw.loadFromVfs.mockClear()
    host.focusWindow.mockClear()
    await dispatch(spec('p5'), host)
    expect(pw.loadFromVfs).not.toHaveBeenCalled()
    expect(host.focusWindow).toHaveBeenCalledWith(pw)
    expect(host.windows).toHaveLength(1)
  })

  it('p5 restores a minimized window and reloads its sketch', async () => {
    const host = makeHost()
    const pw = new FakeP5Window({ initialVfsPath: null }) as unknown as Win
    host.minimized.push({ win: pw })
    await dispatch(spec('p5', { p5SketchPath: '/c.js' }), host)
    expect((pw as unknown as FakeP5Window).loadFromVfs).toHaveBeenCalledWith('/c.js')
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
  })

  it('p5 restores a minimized window without reloading when no path is given', async () => {
    const host = makeHost()
    const pw = new FakeP5Window({ initialVfsPath: null }) as unknown as Win
    host.minimized.push({ win: pw })
    await dispatch(spec('p5'), host)
    expect((pw as unknown as FakeP5Window).loadFromVfs).not.toHaveBeenCalled()
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
  })

  // ── terminal (toast + async mount/fit path) ────────────────────────────────

  it('opens a fresh terminal: toasts, mounts, fits and focuses', async () => {
    const host = makeHost()
    await dispatch(spec('terminal'), host)
    expect(pushToastMock).toHaveBeenCalledWith('Loading terminal…', 1400)
    const tw = host.windows[0] as unknown as FakeTerminalWindow
    expect(tw).toBeInstanceOf(FakeTerminalWindow)
    expect(tw.mount).toHaveBeenCalledOnce()
    expect(tw.fit).toHaveBeenCalledOnce()
    expect(host.focusWindow).toHaveBeenLastCalledWith(tw)
  })

  it('terminal already open just refocuses (no second mount/toast)', async () => {
    const host = makeHost()
    await dispatch(spec('terminal'), host)
    const tw = host.windows[0] as unknown as FakeTerminalWindow
    pushToastMock.mockClear()
    host.focusWindow.mockClear()
    await dispatch(spec('terminal'), host)
    expect(pushToastMock).not.toHaveBeenCalled()
    expect(host.focusWindow).toHaveBeenCalledWith(tw)
    expect(host.windows).toHaveLength(1)
  })

  it('terminal restores a minimized window instead of remounting', async () => {
    const host = makeHost()
    const tw = new FakeTerminalWindow({}) as unknown as Win
    host.minimized.push({ win: tw })
    await dispatch(spec('terminal'), host)
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
    expect((tw as unknown as FakeTerminalWindow).mount).not.toHaveBeenCalled()
  })

  it('terminal onOpenWindow callback delegates to the host', async () => {
    const host = makeHost()
    await dispatch(spec('terminal'), host)
    const tw = host.windows[0] as unknown as FakeTerminalWindow
    const nested = spec('resume')
    tw.opts.onOpenWindow!(nested)
    expect(host.openWindow).toHaveBeenCalledWith(nested)
  })

  it('terminal chrome callbacks resolve to the constructed terminal window', async () => {
    const host = makeHost()
    await dispatch(spec('terminal'), host)
    const tw = host.windows[0] as unknown as FakeTerminalWindow
    tw.opts.onClose!()
    expect(host.closeWindow).toHaveBeenLastCalledWith(tw)
    tw.opts.onFocus!()
    expect(host.focusWindow).toHaveBeenCalledWith(tw)
  })

  // ── mini games (paint / snake / pong) ──────────────────────────────────────

  it.each([
    ['paint', FakePaintWindow],
    ['snake', FakeSnakeWindow],
    ['pong', FakePongWindow],
  ])('opens a fresh %s mini-game tile via its loader', async (cmd, Ctor) => {
    const host = makeHost()
    await dispatch(spec(cmd), host)
    expect(host.windows).toHaveLength(1)
    expect(host.windows[0]).toBeInstanceOf(Ctor)
    expect(host.focusWindow).toHaveBeenLastCalledWith(host.windows[0])
  })

  it('a repeat mini-game command closes the open tile (toggle off)', async () => {
    const host = makeHost()
    await dispatch(spec('snake'), host)
    const sw = host.windows[0]!
    host.closeWindow.mockClear()
    await dispatch(spec('snake'), host)
    expect(host.closeWindow).toHaveBeenCalledWith(sw)
    expect(host.windows).toHaveLength(0)
  })

  it('a minimized mini-game tile is restored, not reopened', async () => {
    const host = makeHost()
    const pong = new FakePongWindow({}) as unknown as Win
    host.minimized.push({ win: pong })
    await dispatch(spec('pong'), host)
    expect(host.restoreMinimized).toHaveBeenCalledOnce()
    expect(host.windows).toEqual([pong])
    expect(host.enforceTileLimit).not.toHaveBeenCalled()
  })

  it('mini-game callbacks resolve to the constructed window (self-reference)', async () => {
    const host = makeHost()
    await dispatch(spec('paint'), host)
    const win = host.windows[0]!
    const opts = (win as unknown as FakePaintWindow).opts
    opts.onClose!()
    expect(host.closeWindow).toHaveBeenLastCalledWith(win)
    opts.onFocus!()
    expect(host.focusWindow).toHaveBeenCalledWith(win)
  })

  // ── lazy-import failure path (lazyImportModule catch -> toast + null) ───────
  //
  // Each launcher's chunk loader is forced to throw, then a freshly re-imported
  // copy of the module is driven so the dynamic import() resolves to the throwing
  // mock. The failure must surface a toast, log to console, and mount nothing —
  // and (for the path-keyed launchers) leave `create()` returning null.

  it.each([
    ['edit', './editor-window', 'editor', { editorPath: 'a.txt' }],
    ['explorer', './file-explorer-window', 'file explorer', {}],
    ['browse', './browser-window', 'browser', {}],
    ['p5', './p5-window', 'p5.js', {}],
    ['terminal', './terminal', 'terminal', {}],
    ['paint', './paint-window', 'paint', {}],
    ['snake', './snake-window', 'snake', {}],
    ['pong', './pong-window', 'pong', {}],
  ] as const)(
    'surfaces a toast and opens nothing when the %s chunk fails to load',
    async (cmd, modulePath, label, extra) => {
      const host = makeHost()
      const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.doMock(modulePath, () => {
        throw new Error('network down')
      })
      vi.resetModules()
      try {
        const fresh = await import('./desktop-open-window')
        await fresh.dispatchOpenWindow(spec(cmd, extra), host as never)
        expect(host.windows).toHaveLength(0)
        expect(host.enforceTileLimit).not.toHaveBeenCalled()
        expect(pushToastMock).toHaveBeenCalledWith(
          `Couldn't load ${label} — check your connection and try again.`,
          2800,
        )
        expect(consoleErr).toHaveBeenCalled()
      } finally {
        consoleErr.mockRestore()
        vi.doUnmock(modulePath)
        vi.resetModules()
      }
    },
  )
})
