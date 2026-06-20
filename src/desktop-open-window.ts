import { pushToast } from './os-systray'

import { AppWindow } from './appwindow'
import type { WindowSpec } from './appwindow'
import type { BrowserWindow } from './browser-window'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'
import type { EditorWindow } from './editor-window'
import type { FileExplorerWindow } from './file-explorer-window'
import { FS_HOME, vfsNormalize } from './os-fs'
import type { PaintWindow } from './paint-window'
import type { P5Window } from './p5-window'
import type { PongWindow } from './pong-window'
import type { RubikWindow } from './rubik-window'
import type { SnakeWindow } from './snake-window'
import type { TerminalWindow } from './terminal'

export type TiledWin =
  | AppWindow
  | EditorWindow
  | FileExplorerWindow
  | BrowserWindow
  | PaintWindow
  | SnakeWindow
  | PongWindow
  | RubikWindow
  | P5Window
  | TerminalWindow

export interface MinimizedEntry {
  win: TiledWin
}

export const MINI_GAME_COMMANDS = new Set(['paint', 'snake', 'pong'])

export function isMiniGameCommand(cmd: string): boolean {
  return MINI_GAME_COMMANDS.has(cmd)
}

export function resolveEditorPath(spec: WindowSpec): string {
  return spec.editorPath ?? 'notes.txt'
}

export function resolveExplorerPath(spec: WindowSpec): string {
  return vfsNormalize(spec.explorerPath ?? FS_HOME)
}

export function resolveBrowserUrl(spec: WindowSpec): string {
  return normalizeBrowserUrl(spec.browserUrl ?? DEFAULT_BROWSER_URL)
}

export function p5WindowSpecFromPath(absPath: string): WindowSpec {
  return {
    command: 'p5',
    title: absPath.split('/').pop() ?? 'p5.js',
    content: [],
    p5SketchPath: absPath,
  }
}

export function editWindowSpecFromPath(absPath: string): WindowSpec {
  return {
    command: 'edit',
    title: `edit — ${absPath}`,
    content: [],
    editorPath: absPath,
  }
}

/** Explorer double-click: .js sketches open in p5 viewer; everything else in editor. */
export function explorerFileOpenSpec(absFilePath: string): WindowSpec {
  if (absFilePath.endsWith('.js')) return p5WindowSpecFromPath(absFilePath)
  return editWindowSpecFromPath(absFilePath)
}

export interface OpenWindowHost {
  readonly windows: TiledWin[]
  readonly minimized: MinimizedEntry[]
  closeLauncherOverlay(): void
  closeWindow(win: TiledWin): void
  focusWindow(win: TiledWin): void
  restoreMinimized(entry: MinimizedEntry): void
  minimizeWindow(win: TiledWin): void
  toggleMaximizeContent(win: TiledWin): void
  enforceTileLimit(): void
  appendToRightPane(win: TiledWin): void
  attachVerticalSplitters(): void
  openWindow(spec: WindowSpec): Promise<void>
}

/**
 * Run a lazy `import()` for a window chunk, surfacing a toast (instead of an
 * unhandled rejection / silent no-op) when the network or chunk load fails.
 * Returns `null` on failure so callers can abort the open cleanly.
 */
async function lazyImportModule<T>(loader: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await loader()
  } catch (err) {
    console.error(`Failed to load ${label} module`, err)
    pushToast(`Couldn't load ${label} — check your connection and try again.`, 2800)
    return null
  }
}

function mountContentWindow(host: OpenWindowHost, win: TiledWin): void {
  host.enforceTileLimit()
  host.appendToRightPane(win)
  host.windows.push(win)
  host.attachVerticalSplitters()
  host.focusWindow(win)
}

export function windowChromeCallbacks(
  host: OpenWindowHost,
  getWin: () => TiledWin,
): {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
} {
  return {
    onClose: () => host.closeWindow(getWin()),
    onMinimize: () => host.minimizeWindow(getWin()),
    onMaximize: () => host.toggleMaximizeContent(getWin()),
    onFocus: () => host.focusWindow(getWin()),
  }
}

type MiniGameCtor = new (cb: ReturnType<typeof windowChromeCallbacks>) => TiledWin

/** Lazy-load each mini-game tile's constructor; all three share the same 4-callback options. */
const MINI_GAME_LOADERS: Record<string, () => Promise<MiniGameCtor | null>> = {
  paint: async () => (await lazyImportModule(() => import('./paint-window'), 'paint'))?.PaintWindow ?? null,
  snake: async () => (await lazyImportModule(() => import('./snake-window'), 'snake'))?.SnakeWindow ?? null,
  pong: async () => (await lazyImportModule(() => import('./pong-window'), 'pong'))?.PongWindow ?? null,
}

/** Construct a mini-game tile with self-referencing WM callbacks, then mount it. */
async function openMiniGameTile(host: OpenWindowHost, load: () => Promise<MiniGameCtor | null>): Promise<void> {
  const Ctor = await load()
  if (!Ctor) return
  let win!: TiledWin
  win = new Ctor(windowChromeCallbacks(host, () => win))
  mountContentWindow(host, win)
}

type PathKeyedWin = TiledWin & { pathMatches(path: string): boolean }

async function openPathKeyedWindow<T extends PathKeyedWin>(
  host: OpenWindowHost,
  command: string,
  pathArg: string,
  applyPath: (win: T, path: string) => void,
  create: () => Promise<T | null>,
): Promise<void> {
  const existingOpen = host.windows.find(w => w.command === command)
  if (existingOpen) {
    const win = existingOpen as T
    if (win.pathMatches(pathArg)) {
      host.closeWindow(existingOpen)
      return
    }
    applyPath(win, pathArg)
    host.focusWindow(existingOpen)
    return
  }

  const minEntry = host.minimized.find(m => m.win.command === command)
  if (minEntry) {
    const win = minEntry.win as T
    if (win.pathMatches(pathArg)) {
      host.restoreMinimized(minEntry)
      return
    }
    applyPath(win, pathArg)
    host.restoreMinimized(minEntry)
    return
  }

  const win = await create()
  if (!win) return
  mountContentWindow(host, win)
}

export async function dispatchOpenWindow(
  spec: WindowSpec,
  host: OpenWindowHost,
): Promise<void> {
  host.closeLauncherOverlay()

  if (spec.command === 'edit') {
    const pathArg = resolveEditorPath(spec)
    await openPathKeyedWindow<EditorWindow>(
      host,
      'edit',
      pathArg,
      (ed, path) => ed.loadFile(path),
      async () => {
        const mod = await lazyImportModule(() => import('./editor-window'), 'editor')
        if (!mod) return null
        const { EditorWindow: EditorWindowCtor } = mod
        let ed!: EditorWindow
        ed = new EditorWindowCtor({
          initialPath: pathArg,
          ...windowChromeCallbacks(host, () => ed),
          onRunInP5: absPath => void host.openWindow(p5WindowSpecFromPath(absPath)),
        })
        return ed
      },
    )
    return
  }

  if (spec.command === 'explorer') {
    const pathArg = resolveExplorerPath(spec)
    await openPathKeyedWindow<FileExplorerWindow>(
      host,
      'explorer',
      pathArg,
      (ex, path) => ex.navigateTo(path),
      async () => {
        const mod = await lazyImportModule(() => import('./file-explorer-window'), 'file explorer')
        if (!mod) return null
        const { FileExplorerWindow: FileExplorerWindowCtor } = mod
        let ex!: FileExplorerWindow
        ex = new FileExplorerWindowCtor({
          initialPath: pathArg,
          ...windowChromeCallbacks(host, () => ex),
          onOpenInEditor: absFilePath => void host.openWindow(explorerFileOpenSpec(absFilePath)),
        })
        return ex
      },
    )
    return
  }

  if (spec.command === 'browse') {
    const urlArg = resolveBrowserUrl(spec)
    await openPathKeyedWindow<BrowserWindow>(
      host,
      'browse',
      urlArg,
      (br, url) => br.navigateTo(url),
      async () => {
        const mod = await lazyImportModule(() => import('./browser-window'), 'browser')
        if (!mod) return null
        const { BrowserWindow: BrowserWindowCtor } = mod
        let br!: BrowserWindow
        br = new BrowserWindowCtor({
          initialUrl: urlArg,
          ...windowChromeCallbacks(host, () => br),
        })
        return br
      },
    )
    return
  }

  if (spec.command === 'p5') {
    const pathArg = spec.p5SketchPath ?? null

    const min = host.minimized.find(m => m.win.command === 'p5')
    if (min) {
      if (pathArg) void (min.win as P5Window).loadFromVfs(pathArg)
      host.restoreMinimized(min)
      return
    }

    const existing = host.windows.find(w => w.command === 'p5')
    if (existing) {
      if (pathArg) void (existing as P5Window).loadFromVfs(pathArg)
      host.focusWindow(existing)
      return
    }

    const p5mod = await lazyImportModule(() => import('./p5-window'), 'p5.js')
    if (!p5mod) return
    const { P5Window: P5WindowCtor } = p5mod
    let pw!: P5Window
    pw = new P5WindowCtor({
      initialVfsPath: pathArg,
      onOpenWindow: s => void host.openWindow(s),
      ...windowChromeCallbacks(host, () => pw),
    })
    mountContentWindow(host, pw)
    return
  }

  if (spec.command === 'terminal') {
    const min = host.minimized.find(m => m.win.command === 'terminal')
    if (min) {
      host.restoreMinimized(min)
      return
    }

    const existing = host.windows.find(w => w.command === 'terminal')
    if (existing) {
      host.focusWindow(existing)
      return
    }

    pushToast('Loading terminal…', 1400)
    const termMod = await lazyImportModule(() => import('./terminal'), 'terminal')
    if (!termMod) return
    const { TerminalWindow: TerminalWindowCtor } = termMod
    let tw!: TerminalWindow
    tw = new TerminalWindowCtor({
      ...windowChromeCallbacks(host, () => tw),
      onOpenWindow: s => void host.openWindow(s),
    })
    host.enforceTileLimit()
    host.appendToRightPane(tw)
    host.windows.push(tw)
    host.attachVerticalSplitters()
    await tw.mount()
    tw.fit()
    host.focusWindow(tw)
    return
  }

  if (isMiniGameCommand(spec.command)) {
    const cmd = spec.command
    const min = host.minimized.find(m => m.win.command === cmd)
    if (min) {
      host.restoreMinimized(min)
      return
    }
    const existing = host.windows.find(w => w.command === cmd)
    if (existing) {
      host.closeWindow(existing)
      return
    }

    const load = MINI_GAME_LOADERS[cmd]
    if (load) await openMiniGameTile(host, load)
    return
  }

  const min = host.minimized.find(m => m.win.command === spec.command)
  if (min) {
    host.restoreMinimized(min)
    return
  }

  const existing = host.windows.find(w => w.command === spec.command)
  if (existing) {
    host.closeWindow(existing)
    return
  }

  const win = new AppWindow({
    ...spec,
    onClose: () => host.closeWindow(win),
    onMinimize: () => host.minimizeWindow(win),
    onMaximize: () => host.toggleMaximizeContent(win),
    onFocus: () => host.focusWindow(win),
  })

  mountContentWindow(host, win)
}
