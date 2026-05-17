/**
 * Tiling shell: terminal column plus portfolio / editor / browser / games tiles (`openWindow`).
 * Tile commands repeat path/URL or toggle per command rules; plain shell commands stay in `commands/index.ts`.
 * Keys: Ctrl+T terminal; Ctrl+1–9 docks; Ctrl+H/K vs L/J along stack; Ctrl+Q/M/F/D close/min/max/show-desktop; Applications = launcher.
 */

import { AppWindow } from './appwindow'
import type { WindowSpec } from './appwindow'
import type { BrowserWindow } from './browser-window'
import type { EditorWindow } from './editor-window'
import type { FileExplorerWindow } from './file-explorer-window'
import type { PaintWindow } from './paint-window'
import type { PongWindow } from './pong-window'
import type { SnakeWindow } from './snake-window'
import type { P5Window } from './p5-window'
import type { TerminalWindow } from './terminal'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'
import { FS_HOME, vfsNormalize } from './os-fs'
import { Splitter } from './splitter'
import { commands } from './commands/index'
import {
  PORTFOLIO_PROJECTS,
  resumeWindowSplitPayload,
  whoamiAboutLines,
  linksAndContactLines,
} from './content/portfolio'
import {
  attachLazyPrefetchHandlers,
  LAUNCHER_ICON_ROWS,
  PINNED_DOCK_CMDS,
  TERMINAL_TILE_SENTINEL,
  tileTitleForPortfolioCommand,
  TILED_WINDOW_COMMANDS,
} from './launcher-catalog'
import { setDesktopRef } from './os-registry'
import { playOsSound } from './os-sound'
import { mountWelcomeGuide } from './welcome-guide'
import { mountDesktopTiles } from './desktop-tiles'

// ── Launcher icon lookup ───────────────────────────────────────────────────────
//
// `LAUNCHER_ICON_ROWS` is a small constant array (~10 items) that never changes after
// module load. Pre-index it by `cmd` so `syncTaskbar` avoids an O(n²) scan per render.

type AppIconRow = { kind: 'app'; cmd: string; label: string; glyph: string }

/** Fast O(1) lookup of icon metadata by command id. */
const ICON_META_BY_CMD = new Map<string, AppIconRow>(
  LAUNCHER_ICON_ROWS
    .filter((r): r is AppIconRow => r.kind === 'app')
    .map(r => [r.cmd, r]),
)

// ── DOM helpers ────────────────────────────────────────────────────────────────

/** Create a desktop-icon glyph span using textContent (never innerHTML). */
function makeIconGlyph(glyph: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'desktop-icon-glyph'
  span.setAttribute('aria-hidden', 'true')
  span.textContent = glyph
  return span
}

/** Create a desktop-icon label span using textContent (never innerHTML). */
function makeIconLabel(label: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'desktop-icon-label'
  span.textContent = label
  return span
}

export interface PsSnapshotRow {
  pid: number
  tty: string
  stat: string
  time: string
  cmd: string
}

export type { WindowSpec }

type TiledWin =
  | AppWindow
  | EditorWindow
  | FileExplorerWindow
  | BrowserWindow
  | PaintWindow
  | SnakeWindow
  | PongWindow
  | P5Window
  | TerminalWindow

interface MinimizedEntry {
  win: TiledWin
}


export class Desktop {
  /** Mount animation length (matches `wm-window-mount` + slack). */
  private static readonly WM_MOUNT_MS = 640
  /** Close / shrink animation fallback if `animationend` does not fire. */
  private static readonly WM_UNMOUNT_MS = 400
  /**
   * Keys intercepted by the WM before xterm/vim see them.
   * Defined once at class level so it isn't rebuilt on every keydown.
   */
  private static readonly WM_KEYS = new Set([
    't', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'h', 'l', 'j', 'k', 'q', 'm', 'd', 'f',
  ])

  private desktop:    HTMLElement
  private panes:      HTMLElement
  private rightPane:  HTMLElement
  private termWin:    HTMLElement
  private taskbarDock: HTMLElement
  private hSplitter:  HTMLElement
  private fitTerminal: () => void
  /**
   * Cached `prefers-reduced-motion` MediaQueryList — avoids reparsing the query
   * string on every animation decision and lets us attach a change listener once.
   */
  private reducedMotionMQ: MediaQueryList

  private windows: TiledWin[] = [] // open (visible) windows, in tile order
  private minimized:  MinimizedEntry[] = []
  private focusedId:  string | null    = null   // null = terminal focused
  private showingDesktop = false
  /** Opens launcher via status-bar Applications (distinct from Ctrl+D). */
  private launcherOpen = false

  /** `null` | terminal sentinel | content window command id */
  private maximizedId: string | null = null

  constructor(
    desktop:     HTMLElement,
    termWin:     HTMLElement,
    fitTerminal: () => void,
  ) {
    this.desktop          = desktop
    this.termWin          = termWin
    this.fitTerminal      = fitTerminal
    this.panes            = document.getElementById('panes')!
    this.rightPane        = document.getElementById('right-pane')!
    this.taskbarDock      = document.getElementById('wm-taskbar-dock')!
    this.hSplitter        = document.getElementById('h-splitter')!
    this.reducedMotionMQ  = window.matchMedia('(prefers-reduced-motion: reduce)')

    // Terminal window clicks → focus terminal
    termWin.addEventListener('mousedown', () => this.focusTerminal())

    // Terminal title-bar buttons
    const tbar = termWin.querySelector('.win-titlebar')
    tbar?.querySelector('.dot-min')?.addEventListener('click', e => {
      e.stopPropagation()
      this.minimizeTerminal()
    })
    tbar?.querySelector('.dot-max')?.addEventListener('click', e => {
      e.stopPropagation()
      this.toggleMaximizeTerminal()
    })
    tbar?.querySelector('.dot-close')?.addEventListener('click', e => {
      e.stopPropagation()
      this.closeTerminal()
    })

    // Horizontal splitter between terminal and right pane
    new Splitter({
      el:          this.hSplitter,
      orientation: 'h',
      target:      this.termWin,
      container:   this.panes,
      min:         280,
      max:         () => Math.max(280, this.panes.clientWidth - 320),
      onResize:    () => this.fitTerminal(),
    })

    // Global keyboard shortcuts
    document.addEventListener('keydown', ev => this.handleGlobal(ev), true)

    // Window resize → refit terminal
    window.addEventListener('resize', () => this.fitTerminal())

    this.initDesktopIcons()
    this.initLauncherSearch()
    this.initTopBarClock()
    this.initYasbChrome()
    setDesktopRef(this)

    // Mount first-visit welcome guide (non-blocking)
    mountWelcomeGuide()

    // Wire auto-hide hover zone for the dock
    this.setupDockHoverZone()

    // Mount draggable desktop icon grid (behind tiling panes)
    const workspace = document.getElementById('desktop-workspace')
    if (workspace) {
      mountDesktopTiles({
        host: workspace,
        onActivate: cmd => void this.openWindow(this.specForCommand(cmd)),
      })
    }

    this.sync()
  }

  // ── public API ─────────────────────────────────────────────────────────────

  /** Simulated `ps` output: shell plus tiled / minimized windows */
  getPsSnapshot(): PsSnapshotRow[] {
    const rows: PsSnapshotRow[] = []
    let pid = 400
    rows.push({ pid: pid++, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' })
    for (const w of this.windows) {
      rows.push({
        pid: pid++,
        tty: 'wm-pty',
        stat: this.focusedId === w.command ? 'Sl+' : 'Sl',
        time: '0:00',
        cmd: w.command,
      })
    }
    for (const { win } of this.minimized) {
      rows.push({
        pid: pid++,
        tty: 'wm-pty',
        stat: 'T',
        time: '0:00',
        cmd: `${win.command} (minimized)`,
      })
    }
    return rows
  }

  /**
   * Open, focus, or toggle a tiled window.
   *
   * Behaviour per command:
   * - **`edit` / `explorer` / `browse`**: if the window is open and already showing the same
   *   path/URL, close it (toggle). If it shows a different path, navigate to the new one.
   *   If minimized, restore it (and navigate if needed).
   * - **`paint` / `snake` / `pong`**: restore minimized copy, or close if already open.
   * - **All other commands**: restore minimized, or toggle (close if open, open if closed).
   *
   * All heavy tile modules are loaded via dynamic `import()` on first open, keeping the initial
   * bundle lean.
   */
  async openWindow(spec: WindowSpec): Promise<void> {
    this.closeLauncherOverlay()

    if (spec.command === 'edit') {
      const pathArg = spec.editorPath ?? 'notes.txt'

      const existingOpen = this.windows.find(w => w.command === 'edit')
      if (existingOpen) {
        const ed = existingOpen as EditorWindow
        if (ed.pathMatches(pathArg)) {
          this.closeWindow(existingOpen)
          return
        }
        ed.loadFile(pathArg)
        this.focusWindow(existingOpen)
        return
      }

      const minEd = this.minimized.find(m => m.win.command === 'edit')
      if (minEd) {
        const ed = minEd.win as EditorWindow
        if (ed.pathMatches(pathArg)) {
          this.restoreMinimized(minEd)
          return
        }
        ed.loadFile(pathArg)
        this.restoreMinimized(minEd)
        return
      }

      const { EditorWindow: EditorWindowCtor } = await import('./editor-window')
      let ed!: EditorWindow
      ed = new EditorWindowCtor({
        initialPath: pathArg,
        onClose: () => this.closeWindow(ed),
        onMinimize: () => this.minimizeWindow(ed),
        onMaximize: () => this.toggleMaximizeContent(ed),
        onFocus: () => this.focusWindow(ed),
        onRunInP5: absPath =>
          void this.openWindow({
            command: 'p5',
            title: absPath.split('/').pop() ?? 'p5.js',
            content: [],
            p5SketchPath: absPath,
          }),
      })
      this.enforceTileLimit()
      this.appendToRightPane(ed.el)
      this.windows.push(ed)
      this.attachVerticalSplitters()
      this.focusWindow(ed)
      return
    }

    if (spec.command === 'explorer') {
      const pathArg = vfsNormalize(spec.explorerPath ?? FS_HOME)

      const existingOpen = this.windows.find(w => w.command === 'explorer')
      if (existingOpen) {
        const ex = existingOpen as FileExplorerWindow
        if (ex.pathMatches(pathArg)) {
          this.closeWindow(existingOpen)
          return
        }
        ex.navigateTo(pathArg)
        this.focusWindow(existingOpen)
        return
      }

      const minEx = this.minimized.find(m => m.win.command === 'explorer')
      if (minEx) {
        const ex = minEx.win as FileExplorerWindow
        if (ex.pathMatches(pathArg)) {
          this.restoreMinimized(minEx)
          return
        }
        ex.navigateTo(pathArg)
        this.restoreMinimized(minEx)
        return
      }

      const { FileExplorerWindow: FileExplorerWindowCtor } = await import('./file-explorer-window')
      let ex!: FileExplorerWindow
      ex = new FileExplorerWindowCtor({
        initialPath: pathArg,
        onClose: () => this.closeWindow(ex),
        onMinimize: () => this.minimizeWindow(ex),
        onMaximize: () => this.toggleMaximizeContent(ex),
        onFocus: () => this.focusWindow(ex),
        onOpenInEditor: absFilePath => {
          // .js files route to the p5 viewer so double-clicking a sketch in
          // ~/sketches plays it directly. The viewer's Edit button still
          // bounces the file into the mini-vim if the user wants to modify.
          if (absFilePath.endsWith('.js')) {
            void this.openWindow({
              command: 'p5',
              title: absFilePath.split('/').pop() ?? 'p5.js',
              content: [],
              p5SketchPath: absFilePath,
            })
            return
          }
          void this.openWindow({
            command: 'edit',
            title: `edit — ${absFilePath}`,
            content: [],
            editorPath: absFilePath,
          })
        },
      })
      this.enforceTileLimit()
      this.appendToRightPane(ex.el)
      this.windows.push(ex)
      this.attachVerticalSplitters()
      this.focusWindow(ex)
      return
    }

    if (spec.command === 'browse') {
      const urlArg = normalizeBrowserUrl(spec.browserUrl ?? DEFAULT_BROWSER_URL)

      const existingOpen = this.windows.find(w => w.command === 'browse')
      if (existingOpen) {
        const br = existingOpen as BrowserWindow
        if (br.pathMatches(urlArg)) {
          this.closeWindow(existingOpen)
          return
        }
        br.navigateTo(urlArg)
        this.focusWindow(existingOpen)
        return
      }

      const minBr = this.minimized.find(m => m.win.command === 'browse')
      if (minBr) {
        const br = minBr.win as BrowserWindow
        if (br.pathMatches(urlArg)) {
          this.restoreMinimized(minBr)
          return
        }
        br.navigateTo(urlArg)
        this.restoreMinimized(minBr)
        return
      }

      const { BrowserWindow: BrowserWindowCtor } = await import('./browser-window')
      let br!: BrowserWindow
      br = new BrowserWindowCtor({
        initialUrl: urlArg,
        onClose: () => this.closeWindow(br),
        onMinimize: () => this.minimizeWindow(br),
        onMaximize: () => this.toggleMaximizeContent(br),
        onFocus: () => this.focusWindow(br),
      })
      this.enforceTileLimit()
      this.appendToRightPane(br.el)
      this.windows.push(br)
      this.attachVerticalSplitters()
      this.focusWindow(br)
      return
    }

    if (spec.command === 'p5') {
      const pathArg = spec.p5SketchPath ?? null

      // Restore minimized — load the new path into it if one was supplied.
      const min = this.minimized.find(m => m.win.command === 'p5')
      if (min) {
        if (pathArg) void (min.win as P5Window).loadFromVfs(pathArg)
        this.restoreMinimized(min)
        return
      }

      // Already open — focus it and load the new path if any.
      const existing = this.windows.find(w => w.command === 'p5')
      if (existing) {
        if (pathArg) void (existing as P5Window).loadFromVfs(pathArg)
        this.focusWindow(existing)
        return
      }

      const { P5Window: P5WindowCtor } = await import('./p5-window')
      let pw!: P5Window
      pw = new P5WindowCtor({
        initialVfsPath: pathArg,
        onOpenWindow: s => void this.openWindow(s),
        onClose:    () => this.closeWindow(pw),
        onMinimize: () => this.minimizeWindow(pw),
        onMaximize: () => this.toggleMaximizeContent(pw),
        onFocus:    () => this.focusWindow(pw),
      })
      this.enforceTileLimit()
      this.appendToRightPane(pw.el)
      this.windows.push(pw)
      this.attachVerticalSplitters()
      this.focusWindow(pw)
      return
    }

    if (spec.command === 'terminal') {
      const min = this.minimized.find(m => m.win.command === 'terminal')
      if (min) { this.restoreMinimized(min); return }

      const existing = this.windows.find(w => w.command === 'terminal')
      if (existing) { this.focusWindow(existing); return }

      const { TerminalWindow: TerminalWindowCtor } = await import('./terminal')
      let tw!: TerminalWindow
      tw = new TerminalWindowCtor({
        onClose:       () => this.closeWindow(tw),
        onMinimize:    () => this.minimizeWindow(tw),
        onMaximize:    () => this.toggleMaximizeContent(tw),
        onFocus:       () => this.focusWindow(tw),
        onOpenWindow:  s  => void this.openWindow(s),
      })
      this.enforceTileLimit()
      this.appendToRightPane(tw.el)
      this.windows.push(tw)
      this.attachVerticalSplitters()
      await tw.mount()
      tw.fit()
      this.focusWindow(tw)
      return
    }

    const miniGameOpen = (
      spec.command === 'paint' ||
      spec.command === 'snake' ||
      spec.command === 'pong'
    )
    if (miniGameOpen) {
      const cmd = spec.command
      const min = this.minimized.find(m => m.win.command === cmd)
      if (min) {
        this.restoreMinimized(min)
        return
      }
      const existing = this.windows.find(w => w.command === cmd)
      if (existing) {
        this.closeWindow(existing)
        return
      }

      this.enforceTileLimit()

      if (cmd === 'paint') {
        const { PaintWindow: PaintWindowCtor } = await import('./paint-window')
        let pw!: PaintWindow
        pw = new PaintWindowCtor({
          onClose: () => this.closeWindow(pw),
          onMinimize: () => this.minimizeWindow(pw),
          onMaximize: () => this.toggleMaximizeContent(pw),
          onFocus: () => this.focusWindow(pw),
        })
        this.appendToRightPane(pw.el)
        this.windows.push(pw)
        this.attachVerticalSplitters()
        this.focusWindow(pw)
        return
      }
      if (cmd === 'snake') {
        const { SnakeWindow: SnakeWindowCtor } = await import('./snake-window')
        let sw!: SnakeWindow
        sw = new SnakeWindowCtor({
          onClose: () => this.closeWindow(sw),
          onMinimize: () => this.minimizeWindow(sw),
          onMaximize: () => this.toggleMaximizeContent(sw),
          onFocus: () => this.focusWindow(sw),
        })
        this.appendToRightPane(sw.el)
        this.windows.push(sw)
        this.attachVerticalSplitters()
        this.focusWindow(sw)
        return
      }
      const { PongWindow: PongWindowCtor } = await import('./pong-window')
      let pong!: PongWindow
      pong = new PongWindowCtor({
        onClose: () => this.closeWindow(pong),
        onMinimize: () => this.minimizeWindow(pong),
        onMaximize: () => this.toggleMaximizeContent(pong),
        onFocus: () => this.focusWindow(pong),
      })
      this.appendToRightPane(pong.el)
      this.windows.push(pong)
      this.attachVerticalSplitters()
      this.focusWindow(pong)
      return
    }

    // If there's a minimized version, just restore it
    const min = this.minimized.find(m => m.win.command === spec.command)
    if (min) {
      this.restoreMinimized(min)
      return
    }

    // Toggle: re-running the command closes the open window
    const existing = this.windows.find(w => w.command === spec.command)
    if (existing) {
      this.closeWindow(existing)
      return
    }

    const win = new AppWindow({
      ...spec,
      onClose:    () => this.closeWindow(win),
      onMinimize: () => this.minimizeWindow(win),
      onMaximize: () => this.toggleMaximizeContent(win),
      onFocus:    () => this.focusWindow(win),
    })

    this.enforceTileLimit()
    this.appendToRightPane(win.el)
    this.windows.push(win)
    this.attachVerticalSplitters()
    this.focusWindow(win)
  }

  /**
   * Build a fully-populated WindowSpec for a desktop-tile command.
   * Portfolio commands (resume/projects/whoami/links) need their content
   * pre-populated; tool/game commands only need the command key.
   */
  private specForCommand(cmd: string): WindowSpec {
    switch (cmd) {
      case 'resume':
        return {
          command: 'resume',
          title: tileTitleForPortfolioCommand('resume'),
          ...resumeWindowSplitPayload(),
        }
      case 'projects':
        return {
          command: 'projects',
          title: tileTitleForPortfolioCommand('projects'),
          content: [],
          projectCards: PORTFOLIO_PROJECTS,
        }
      case 'whoami':
        return {
          command: 'whoami',
          title: tileTitleForPortfolioCommand('whoami'),
          content: whoamiAboutLines(),
        }
      case 'links':
        return {
          command: 'links',
          title: tileTitleForPortfolioCommand('links'),
          content: linksAndContactLines(),
        }
      default:
        // Tool/game windows build their own content — only command key is needed.
        return { command: cmd } as WindowSpec
    }
  }

  /** Open or focus the terminal tile (lazy — lives in the right pane like any other window). */
  focusTerminal(): void {
    void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
  }

  /**
   * Transfer focus to the terminal tile only if it is already visible (not minimized).
   * Used after closing/minimizing another window so focus does not go nowhere.
   */
  private focusTerminalIfAlreadyVisible(): void {
    this.closeLauncherOverlay()
    // Find the visible (non-minimized) terminal tile
    const termTile = this.windows.find(w => w.command === 'terminal')
    if (termTile) {
      this.focusWindow(termTile)
      return
    }
    // No visible terminal — clear active state and let sync redraw
    this.focusedId = null
    this.termWin.classList.remove('active')
    this.windows.forEach(w => w.setActive(false))
    this.sync()
  }

  // ── private: window lifecycle ─────────────────────────────────────────────

  /** Mount a tile on the right stack with a one-shot entrance animation. */
  private appendToRightPane(el: HTMLElement): void {
    this.rightPane.appendChild(el)
    this.playMountAnim(el)
    // Notify welcome guide on first window open
    window.dispatchEvent(new CustomEvent('mrgrey-first-window'))
  }

  /** One-shot entrance (tiling pane or terminal restored from minimized). */
  private playMountAnim(el: HTMLElement): void {
    el.classList.remove('wm-animate-close')
    el.classList.add('wm-animate-mount')
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      el.classList.remove('wm-animate-mount')
      el.removeEventListener('animationend', onEnd)
    }
    const onEnd = (e: AnimationEvent): void => {
      if (e.target === el) finish()
    }
    el.addEventListener('animationend', onEnd)
    window.setTimeout(finish, Desktop.WM_MOUNT_MS)
  }

  private prefersReducedMotion(): boolean {
    return this.reducedMotionMQ.matches
  }

  /** Fade/shrink tile, then invoke `done` — no-op cleanup if `el` disconnected. */
  private animateThenRemove(el: HTMLElement, done: () => void): void {
    if (!el.isConnected || this.prefersReducedMotion()) {
      done()
      return
    }
    el.classList.add('wm-animate-close')
    let finished = false
    const finalize = (): void => {
      if (finished) return
      finished = true
      el.removeEventListener('animationend', onEnd)
      el.classList.remove('wm-animate-close')
      done()
    }
    const onEnd = (e: AnimationEvent): void => {
      if (e.target === el) finalize()
    }
    el.addEventListener('animationend', onEnd)
    window.setTimeout(finalize, Desktop.WM_UNMOUNT_MS)
  }

  private closeWindow(win: TiledWin): void {
    if (this.windows.indexOf(win) === -1) return
    if (win.el.classList.contains('wm-animate-close')) return
    if (win.isMaximized()) this.unmaximizeContent(win)

    const el = win.el
    const command = win.command
    const finalizeClose = (): void => {
      const i = this.windows.indexOf(win)
      if (i === -1) return
      ;(win as { dispose?: () => void }).dispose?.()
      el.remove()
      this.windows.splice(i, 1)
      if (this.focusedId === command) this.focusTerminalIfAlreadyVisible()
      this.attachVerticalSplitters()
      this.sync()
    }

    this.animateThenRemove(el, finalizeClose)
  }

  private focusWindow(win: TiledWin): void {
    if (this.focusedId !== win.command) playOsSound('focus')
    this.closeLauncherOverlay()
    this.focusedId = win.command
    this.termWin.classList.remove('active')
    this.windows.forEach(w => w.setActive(w === win))
    this.sync()
    switch (win.command) {
      case 'terminal':
        ;(win as TerminalWindow).focusShell()
        break
      case 'edit':
        ;(win as EditorWindow).focusEditor()
        break
      case 'explorer':
        ;(win as FileExplorerWindow).focusPanel()
        break
      case 'browse':
        ;(win as BrowserWindow).focusAddressBar()
        break
      case 'paint':
      case 'snake':
      case 'pong':
        ;(win as PaintWindow | SnakeWindow | PongWindow).focusCanvas()
        break
      default:
        break
    }
  }

  // ── private: maximize / restore ─────────────────────────────────────────────

  private toggleMaximizeTerminal(): void {
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) {
      this.unmaximizeTerminal()
      return
    }
    // Clear content maximize first
    if (this.maximizedId && this.maximizedId !== TERMINAL_TILE_SENTINEL) {
      const w = this.windows.find(x => x.command === this.maximizedId)
      if (w) this.unmaximizeContent(w)
    }
    this.termWin.classList.add('maximized')
    this.panes.classList.add('max-terminal')
    this.maximizedId = TERMINAL_TILE_SENTINEL
    this.desktop.dataset.maximized = '1'
    this.syncDockVisibility()
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeTerminal(): void {
    this.termWin.classList.remove('maximized')
    this.panes.classList.remove('max-terminal')
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) this.maximizedId = null
    this.desktop.dataset.maximized = this.maximizedId !== null ? '1' : '0'
    this.syncDockVisibility()
    requestAnimationFrame(() => this.fitTerminal())
  }

  private toggleMaximizeContent(win: TiledWin): void {
    if (win.isMaximized()) {
      this.unmaximizeContent(win)
      return
    }
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) this.unmaximizeTerminal()
    if (this.maximizedId && this.maximizedId !== TERMINAL_TILE_SENTINEL) {
      const other = this.windows.find(w => w.command === this.maximizedId)
      if (other) this.unmaximizeContent(other)
    }

    // Leave win.el in #right-pane — moving it in the DOM reloads iframes (p5).
    // CSS hides non-maximized siblings and stretches #right-pane to fill #panes.
    win.el.classList.add('maximized')
    this.panes.classList.add('max-content')
    this.maximizedId = win.command
    this.desktop.dataset.maximized = '1'
    this.syncDockVisibility()
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeContent(win: TiledWin): void {
    if (!win.isMaximized()) return
    win.el.classList.remove('maximized')
    this.panes.classList.remove('max-content')
    if (this.maximizedId === win.command) this.maximizedId = null
    this.attachVerticalSplitters()
    this.sync()
  }

  private toggleMaximizeFocused(): void {
    if (this.focusedId === null) {
      this.toggleMaximizeTerminal()
      return
    }
    const w = this.windows.find(x => x.command === this.focusedId)
    if (w) this.toggleMaximizeContent(w)
  }

  // ── private: minimize / restore ────────────────────────────────────────────

  private minimizeWindow(win: TiledWin): void {
    playOsSound('click')
    if (this.windows.indexOf(win) === -1) return
    if (win.el.classList.contains('wm-animate-close')) return
    if (win.isMaximized()) this.unmaximizeContent(win)

    const el = win.el
    const finalize = (): void => {
      const idx = this.windows.indexOf(win)
      if (idx === -1) return
      win.setMinimized(true)
      el.remove()
      this.windows.splice(idx, 1)
      this.minimized.push({ win })
      if (this.focusedId === win.command) this.focusTerminalIfAlreadyVisible()
      this.attachVerticalSplitters()
      this.sync()
    }

    this.animateThenRemove(el, finalize)
  }

  private restoreMinimized(entry: MinimizedEntry): void {
    const i = this.minimized.indexOf(entry)
    if (i === -1) return
    this.minimized.splice(i, 1)

    this.showingDesktop = false
    this.launcherOpen = false

    entry.win.setMinimized(false)
    this.appendToRightPane(entry.win.el)
    this.windows.push(entry.win)
    this.attachVerticalSplitters()
    this.focusWindow(entry.win)
  }

  private minimizeTerminal(): void {
    playOsSound('click')
    if (this.termWin.classList.contains('terminal-closed')) return
    if (this.termWin.classList.contains('wm-animate-close')) return
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) this.unmaximizeTerminal()

    const applyMin = (): void => {
      this.termWin.classList.remove('wm-animate-close')
      this.termWin.classList.add('minimized')
      this.termWin.classList.remove('active')
      if (this.windows.length > 0) {
        this.focusWindow(this.windows[0])
      } else {
        this.focusedId = null
        this.sync()
      }
    }

    const el = this.termWin
    if (!this.prefersReducedMotion()) {
      el.classList.add('wm-animate-close')
      let settled = false
      const finalize = (): void => {
        if (settled) return
        settled = true
        el.removeEventListener('animationend', onEnd)
        applyMin()
      }
      const onEnd = (e: AnimationEvent): void => {
        if (e.target === el) finalize()
      }
      el.addEventListener('animationend', onEnd)
      window.setTimeout(finalize, Desktop.WM_UNMOUNT_MS)
    } else {
      applyMin()
    }
  }

  /** Dismiss terminal (hidden tile). Unlike minimize, does not auto-open app launchers. */
  private closeTerminal(): void {
    if (this.termWin.classList.contains('terminal-closed')) return
    if (this.termWin.classList.contains('wm-animate-close')) return
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) this.unmaximizeTerminal()

    const applyClose = (): void => {
      this.termWin.classList.remove('wm-animate-close')
      this.termWin.classList.remove('minimized')
      this.termWin.classList.add('terminal-closed')
      this.showingDesktop = false
      this.launcherOpen = false
      this.termWin.classList.remove('active')
      if (this.windows.length > 0) {
        this.focusWindow(this.windows[0])
      } else {
        this.focusedId = null
      }
      this.sync()
    }

    const el = this.termWin
    if (
      !this.prefersReducedMotion() &&
      el.isConnected &&
      !this.termWin.classList.contains('minimized')
    ) {
      el.classList.add('wm-animate-close')
      let settled = false
      const finalize = (): void => {
        if (settled) return
        settled = true
        el.removeEventListener('animationend', onEnd)
        applyClose()
      }
      const onEnd = (e: AnimationEvent): void => {
        if (e.target === el) finalize()
      }
      el.addEventListener('animationend', onEnd)
      window.setTimeout(finalize, Desktop.WM_UNMOUNT_MS)
    } else {
      applyClose()
    }
  }

  // ── private: show desktop ───────────────────────────────────────────────────

  private toggleShowDesktop(): void {
    this.showingDesktop = !this.showingDesktop
    if (!this.showingDesktop) this.launcherOpen = false
    this.sync()
  }

  /**
   * Launcher overlay: Ctrl+D (show-desktop), Applications button, or both.
   * Minimizing all windows does not auto-open the launcher.
   */
  /**
   * Show or hide the launcher overlay and update ARIA attributes.
   *
   * The overlay is shown when either `showingDesktop` (Ctrl+D) or `launcherOpen` (Applications
   * button) is true. Both flags are checked together so a single sync call always leaves the
   * DOM in a consistent state regardless of which path triggered it.
   */
  private syncLauncherVisibility(): void {
    const show = this.showingDesktop || this.launcherOpen
    this.desktop.classList.toggle('launchers-visible', show)

    const shell = document.getElementById('launcher-shell')
    /*
     * Hiding `#launcher-shell` with aria-hidden while focus stays on a `.desktop-icon`
     * trips the browser a11y warning (focused node under aria-hidden ancestor). Blur first.
     */
    if (shell && !show) {
      const ae = document.activeElement
      if (ae instanceof HTMLElement && shell.contains(ae)) ae.blur()
    }

    if (shell) shell.setAttribute('aria-hidden', show ? 'false' : 'true')

    document.getElementById('btn-applications')?.setAttribute(
      'aria-expanded',
      show ? 'true' : 'false',
    )

    if (!show) {
      const input = document.getElementById('launcher-search') as HTMLInputElement | null
      if (input?.value) {
        input.value = ''
        document.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
          (btn as HTMLElement).style.display = ''
        })
      }
    }
  }

  /** Close launcher overlay from any source (bar, Ctrl+D, Escape, backdrop). */
  private closeLauncherOverlay(): void {
    if (!this.showingDesktop && !this.launcherOpen) return
    this.showingDesktop = false
    this.launcherOpen = false
    this.sync()
  }

  private toggleLauncherFromButton(): void {
    const visible = this.showingDesktop || this.launcherOpen
    if (visible) {
      this.closeLauncherOverlay()
      return
    }
    this.launcherOpen = true
    this.sync()
    requestAnimationFrame(() => document.getElementById('launcher-search')?.focus())
  }

  private initYasbChrome(): void {
    document.getElementById('btn-applications')?.addEventListener('click', e => {
      e.stopPropagation()
      this.toggleLauncherFromButton()
    })
    document.getElementById('launcher-backdrop')?.addEventListener('click', () => {
      this.closeLauncherOverlay()
    })
    document.addEventListener(
      'keydown',
      ev => {
        if (ev.key !== 'Escape') return
        if (!this.showingDesktop && !this.launcherOpen) return
        if (ev.ctrlKey || ev.altKey || ev.metaKey) return
        ev.preventDefault()
        this.closeLauncherOverlay()
      },
      true,
    )
  }

  private initLauncherSearch(): void {
    const input = document.getElementById('launcher-search') as HTMLInputElement | null
    if (!input) return
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase()
      document.querySelectorAll('#desktop-icons .desktop-icon').forEach(btn => {
        const label =
          btn.querySelector('.desktop-icon-label')?.textContent?.toLowerCase() ?? ''
        ;(btn as HTMLElement).style.display =
          !q || label.includes(q) ? '' : 'none'
      })
    })
  }

  private initTopBarClock(): void {
    const el = document.getElementById('yasb-clock-text')
    if (!el) return
    const tick = (): void => {
      el.textContent = new Date().toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    tick()
    // Clock shows HH:MM only — 60 s is sufficient resolution
    window.setInterval(tick, 60_000)
  }

  // ── desktop icons (wallpaper layer launchers) ───────────────────────────────

  private initDesktopIcons(): void {
    const root = document.getElementById('desktop-icons')
    if (!root) return

    for (const item of LAUNCHER_ICON_ROWS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'desktop-icon'
      if (item.kind === 'terminal') {
        btn.appendChild(makeIconGlyph(item.glyph))
        btn.appendChild(makeIconLabel(item.label))
        btn.addEventListener('click', () => {
          void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
        })
      } else {
        const cmd = commands[item.cmd]
        if (!cmd || !TILED_WINDOW_COMMANDS.has(item.cmd)) continue
        btn.appendChild(makeIconGlyph(item.glyph))
        btn.appendChild(makeIconLabel(item.label))
        attachLazyPrefetchHandlers(btn, item.cmd)
        btn.addEventListener('click', () => {
          if (item.cmd === 'resume') {
            void this.openWindow({
              command: 'resume',
              title: tileTitleForPortfolioCommand('resume'),
              ...resumeWindowSplitPayload(),
            })
            return
          }
          if (item.cmd === 'projects') {
            void this.openWindow({
              command: 'projects',
              title: tileTitleForPortfolioCommand('projects'),
              content: [],
              projectCards: PORTFOLIO_PROJECTS,
            })
            return
          }
          void this.openWindow({
            command: item.cmd,
            title: tileTitleForPortfolioCommand(item.cmd),
            content: cmd.run([]),
            editorPath: item.cmd === 'edit' ? 'notes.txt' : undefined,
            explorerPath: item.cmd === 'explorer' ? FS_HOME : undefined,
            browserUrl:
              item.cmd === 'browse' ? DEFAULT_BROWSER_URL : undefined,
          })
        })
      }
      root.appendChild(btn)
    }
  }

  // ── private: vertical splitters between stacked content windows ───────────

  /**
   * Enforce a maximum of 2 simultaneously visible tiled windows.
   * Instantly (no animation) bumps the oldest non-focused window to the minimized dock.
   * Call this before appending a new window to #right-pane.
   */
  private enforceTileLimit(): void {
    if (this.windows.length < 2) return
    // Prefer to bump the window that isn't currently focused
    const bump = this.windows.find(w => w.command !== this.focusedId) ?? this.windows[0]
    if (!bump) return
    if (bump.isMaximized()) this.unmaximizeContent(bump)
    bump.setMinimized(true)
    bump.el.remove()
    const idx = this.windows.indexOf(bump)
    if (idx !== -1) this.windows.splice(idx, 1)
    this.minimized.push({ win: bump })
    if (this.focusedId === bump.command) this.focusedId = null
  }

  /**
   * Rebuild the drag-to-resize handle between the two side-by-side content windows.
   *
   * #right-pane is flex-direction:row so windows sit side by side. We only ever
   * need one splitter (between window 0 and window 1). Called after any change
   * that modifies the set or order of tiled windows.
   */
  private attachVerticalSplitters(): void {
    // Remove any existing v-splitters and rebuild
    this.rightPane.querySelectorAll('.splitter-v').forEach(el => el.remove())

    // Only the first two windows in #right-pane get a splitter between them
    const tiled = this.windows.filter(w => w.el.parentElement === this.rightPane)
    if (tiled.length < 2) return

    const splitter = document.createElement('div')
    splitter.className = 'splitter splitter-v'
    this.rightPane.insertBefore(splitter, tiled[1].el)

    new Splitter({
      el:          splitter,
      orientation: 'h',   // resizes width of the left window in the row
      target:      tiled[0].el,
      container:   this.rightPane,
      min:         200,
      max:         () => Math.max(200, this.rightPane.clientWidth - 200),
    })
  }

  // ── private: layout sync ───────────────────────────────────────────────────

  /**
   * Flush all derived UI state after any change to windows, focus, or launcher visibility.
   *
   * Order matters: `syncLauncherVisibility` and `syncTaskbar` both read `this.windows` and
   * `this.focusedId`, so they must run after those values are updated. `fitTerminal` is deferred
   * to the next animation frame so the DOM has settled before xterm measures the container.
   */
  private sync(): void {
    const count = this.windows.length
    this.desktop.dataset.contentCount = String(count)
    this.desktop.dataset.terminalClosed = this.termWin.classList.contains('terminal-closed')
      ? '1'
      : '0'
    this.desktop.dataset.maximized = this.maximizedId !== null ? '1' : '0'
    this.syncLauncherVisibility()
    this.syncTaskbar()
    this.syncDockVisibility()
    this.syncFocusedTitle()
    requestAnimationFrame(() => this.fitTerminal())
  }

  /** All windows accessible from the dock: open (by tile order) then minimized. */
  private dockWindows(): TiledWin[] {
    const seen = new Set<string>()
    const out: TiledWin[] = []
    for (const w of this.windows) {
      if (!seen.has(w.command)) { seen.add(w.command); out.push(w) }
    }
    for (const { win } of this.minimized) {
      if (!seen.has(win.command)) { seen.add(win.command); out.push(win) }
    }
    return out
  }

  /** Hover-zone strip: reveals the dock on cursor reaching the bottom edge.
   *  Only hides the dock again when in auto-hide mode (a window is maximized).
   *  In normal mode the dock is always-visible via CSS; reveal() is a no-op.
   */
  private setupDockHoverZone(): void {
    const taskbar = this.taskbarDock.closest<HTMLElement>('#wm-taskbar')!
    const zone = document.createElement('div')
    zone.className = 'dock-hover-zone'
    document.body.appendChild(zone)

    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const reveal = (): void => {
      if (hideTimer !== null) { clearTimeout(hideTimer); hideTimer = null }
      taskbar.classList.add('dock--visible')
    }
    /** Retract after a short grace period so brief pointer exits don't flicker the dock. */
    const scheduleHide = (): void => {
      if (hideTimer !== null) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        hideTimer = null
        if (taskbar.classList.contains('dock--auto-hide')) {
          taskbar.classList.remove('dock--visible')
        }
      }, 420)
    }

    zone.addEventListener('pointerenter', reveal)
    taskbar.addEventListener('pointerenter', reveal)
    taskbar.addEventListener('pointerleave', e => {
      if (!(e.relatedTarget instanceof Node) || !taskbar.contains(e.relatedTarget as Node)) scheduleHide()
    })
  }

  /** Sync dock auto-hide state: normal = always-visible; maximized = auto-hide. */
  private syncDockVisibility(): void {
    const taskbar = this.taskbarDock.closest<HTMLElement>('#wm-taskbar')!
    const isMaximized = this.maximizedId !== null
    taskbar.classList.toggle('dock--auto-hide', isMaximized)
    if (!isMaximized) {
      // Remove any stale dock--visible; base CSS keeps it visible without it.
      taskbar.classList.remove('dock--visible')
    }
  }

  /** Ctrl+1–9: focus the Nth open/minimized window (left to right in dock order). */
  private focusTaskbarIndex(index: number): void {
    const wins = this.dockWindows()
    const win = wins[index]
    if (!win) return
    const minimized = this.minimized.find(m => m.win === win)
    if (minimized) { this.restoreMinimized(minimized); return }
    this.focusWindow(win)
  }

  private syncFocusedTitle(): void {
    const el = document.getElementById('yasb-focused')
    if (!el) return

    if (this.focusedId !== null) {
      const label = this.focusedId === 'terminal'
        ? 'namefailed@dev — ~/terminal'
        : (ICON_META_BY_CMD.get(this.focusedId)?.label ?? this.focusedId)
      el.textContent = label
      return
    }

    el.textContent = this.windows.length === 0 ? 'mrgrey.site' : '—'
  }

  private syncTaskbar(): void {
    this.taskbarDock.replaceChildren()

    // ── Pinned apps (always visible even when not running) ────────────────────
    for (const cmd of PINNED_DOCK_CMDS) {
      const isTerminal = cmd === 'terminal'

      const isRunning = this.windows.some(w => w.command === cmd) ||
        this.minimized.some(m => m.win.command === cmd)

      const isActive = this.focusedId === cmd

      const isMinimized = this.minimized.some(m => m.win.command === cmd)

      const meta = isTerminal
        ? { glyph: '~', label: 'Terminal' }
        : (ICON_META_BY_CMD.get(cmd) ?? { glyph: '?', label: cmd })

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wm-task-btn'
      btn.dataset.cmd = cmd
      if (isActive)    btn.classList.add('wm-task-btn--active')
      if (isMinimized) btn.classList.add('wm-task-btn--minimized')
      if (!isRunning)  btn.classList.add('wm-task-btn--idle')
      btn.title = meta.label
      btn.setAttribute('aria-label', meta.label)

      const gl = document.createElement('span')
      gl.className = 'wm-task-glyph'
      gl.setAttribute('aria-hidden', 'true')
      gl.textContent = meta.glyph
      btn.appendChild(gl)

      const lab = document.createElement('span')
      lab.className = 'wm-task-label'
      lab.textContent = meta.label
      btn.appendChild(lab)

      if (isTerminal) {
        btn.addEventListener('click', () => {
          // focusedId === null means the terminal pane is the active focus.
          // 'active' is never set on termWin, so we must use focusedId.
          const closed    = this.termWin.classList.contains('terminal-closed')
          const minimized = this.termWin.classList.contains('minimized')
          const visible   = !closed && !minimized
          const focused   = this.focusedId === null
          if (visible && focused) this.minimizeTerminal()
          else this.focusTerminal()
        })
      } else {
        attachLazyPrefetchHandlers(btn, cmd)
        btn.addEventListener('click', () => void this.openWindow(this.specForCommand(cmd)))
      }

      this.taskbarDock.appendChild(btn)
    }

    // ── Separator + extra running/minimized windows not in pinned list ────────
    const pinnedSet = new Set<string>(PINNED_DOCK_CMDS)
    const extras = this.dockWindows().filter(w => !pinnedSet.has(w.command))

    if (extras.length > 0) {
      const sep = document.createElement('div')
      sep.className = 'wm-dock-sep'
      sep.setAttribute('role', 'separator')
      sep.setAttribute('aria-hidden', 'true')
      this.taskbarDock.appendChild(sep)

      for (const win of extras) {
        const isMinimized = this.minimized.some(m => m.win === win)
        const isActive    = this.focusedId === win.command
        const meta = ICON_META_BY_CMD.get(win.command) ?? {
          kind: 'app' as const, cmd: win.command, label: win.command, glyph: '◇',
        }

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'wm-task-btn'
        btn.dataset.cmd = win.command
        if (isActive)    btn.classList.add('wm-task-btn--active')
        if (isMinimized) btn.classList.add('wm-task-btn--minimized')
        btn.title = meta.label
        btn.setAttribute('aria-label', meta.label)

        const gl = document.createElement('span')
        gl.className = 'wm-task-glyph'
        gl.setAttribute('aria-hidden', 'true')
        gl.textContent = meta.glyph
        btn.appendChild(gl)

        const lab = document.createElement('span')
        lab.className = 'wm-task-label'
        lab.textContent = meta.label
        btn.appendChild(lab)

        btn.addEventListener('click', () => {
          const minimized = this.minimized.find(m => m.win === win)
          if (minimized) { this.restoreMinimized(minimized); return }
          this.focusWindow(win)
        })
        attachLazyPrefetchHandlers(btn, win.command)
        this.taskbarDock.appendChild(btn)
      }
    }
  }

  // ── private: keyboard ──────────────────────────────────────────────────────

  /**
   * Global keyboard handler (registered on `document` in capture phase so WM shortcuts
   * intercept before xterm.js or the vim input layer consume the event).
   *
   * All WM shortcuts require `Ctrl` and must not combine with `Alt` or `Meta` (avoids
   * clobbering browser and OS accelerators). Intercepted keys are listed in `WM_KEYS`.
   *
   * vim-direction mapping (matches right-pane flex-column layout):
   *   - `h` → left → focus terminal
   *   - `l` → right → enter right pane (first window)
   *   - `k` → up → previous window in column
   *   - `j` → down → next window in column
   */
  private handleGlobal(ev: KeyboardEvent): void {
    if (!ev.ctrlKey || ev.altKey || ev.metaKey) return

    const key = ev.key.toLowerCase()

    // Reserved keys for the WM — intercept before xterm/vim see them
    if (!Desktop.WM_KEYS.has(key)) return

    ev.preventDefault()
    ev.stopImmediatePropagation()

    // Ctrl+T → open terminal app window (or focus if already open)
    if (key === 't') { void this.openWindow({ command: 'terminal', title: 'terminal', content: [] }); return }

    // Ctrl+1..9 → taskbar slot (launcher order, left → right)
    const n = parseInt(key, 10)
    if (n >= 1 && n <= 9) {
      this.focusTaskbarIndex(n - 1)
      return
    }

    // Ctrl+H → terminal (vim h = left), Ctrl+L → enter pane (vim l = right),
    // Ctrl+K → previous window up in column (vim k = up), Ctrl+J → next window down (vim j = down)
    if (key === 'h') { void this.openWindow({ command: 'terminal', title: 'terminal', content: [] }); return }
    if (key === 'l') {
      if (!this.focusedId && this.windows[0]) this.focusWindow(this.windows[0])
      return
    }
    if (key === 'k') { this.focusLeft(); return }
    if (key === 'j') { this.focusRight(); return }

    // Ctrl+Q → close focused content window, or terminal when it holds focus
    if (key === 'q') {
      if (this.focusedId) {
        const w = this.windows.find(x => x.command === this.focusedId)
        if (w) this.closeWindow(w)
      } else if (!this.termWin.classList.contains('terminal-closed')) {
        this.closeTerminal()
      }
      return
    }

    // Ctrl+M → minimize focused window (terminal if nothing else focused)
    if (key === 'm') {
      if (this.focusedId) {
        const w = this.windows.find(x => x.command === this.focusedId)
        if (w) this.minimizeWindow(w)
      } else {
        this.minimizeTerminal()
      }
      return
    }

    // Ctrl+F → maximize / restore
    if (key === 'f') { this.toggleMaximizeFocused(); return }

    // Ctrl+D → toggle show-desktop
    if (key === 'd') { this.toggleShowDesktop(); return }
  }

  private focusLeft(): void {
    if (this.focusedId === null) return                      // nothing focused
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx <= 0) return                                     // already at first window
    this.focusWindow(this.windows[idx - 1])
  }

  private focusRight(): void {
    if (this.focusedId === null) {                           // nothing focused → first window
      if (this.windows[0]) this.focusWindow(this.windows[0])
      return
    }
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx >= 0 && idx < this.windows.length - 1) {
      this.focusWindow(this.windows[idx + 1])
    }
  }
}
