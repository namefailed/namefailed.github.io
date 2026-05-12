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
import type { RubikWindow } from './rubik-window'
import type { SnakeWindow } from './snake-window'
import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'
import { FS_HOME, vfsNormalize } from './os-fs'
import { Splitter } from './splitter'
import { commands } from './commands/index'
import { PORTFOLIO_PROJECTS, resumeWindowSplitPayload } from './content/portfolio'
import {
  attachLazyPrefetchHandlers,
  DOCK_HIDDEN_COMMANDS,
  dockPinnedCommandSet,
  EDITOR_LAUNCH_ALIASES,
  LAUNCHER_ICON_ROWS,
  TERMINAL_TILE_SENTINEL,
  tileTitleForPortfolioCommand,
  TILED_WINDOW_COMMANDS,
} from './launcher-catalog'
import { setDesktopRef } from './os-registry'
import { playOsSound } from './os-sound'
import { pushToast } from './os-systray'

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
  | RubikWindow
  | SnakeWindow
  | PongWindow

interface MinimizedEntry {
  win: TiledWin
}

interface ContentRestore {
  parent: HTMLElement
  next: ChildNode | null
}

export class Desktop {
  /** Mount animation length (matches `wm-window-mount` + slack). */
  private static readonly WM_MOUNT_MS = 640
  /** Close / shrink animation fallback if `animationend` does not fire. */
  private static readonly WM_UNMOUNT_MS = 400

  private desktop:    HTMLElement
  private panes:      HTMLElement
  private rightPane:  HTMLElement
  private termWin:    HTMLElement
  private taskbarDock: HTMLElement
  private hSplitter:  HTMLElement
  private fitTerminal: () => void

  private windows: TiledWin[] = [] // open (visible) windows, in tile order
  private minimized:  MinimizedEntry[] = []
  private focusedId:  string | null    = null   // null = terminal focused
  private showingDesktop = false
  /** Opens launcher via status-bar Applications (distinct from Ctrl+D). */
  private launcherOpen = false

  /** `null` | terminal sentinel | content window command id */
  private maximizedId: string | null = null
  private contentRestore = new WeakMap<TiledWin, ContentRestore>()

  constructor(
    desktop:     HTMLElement,
    termWin:     HTMLElement,
    fitTerminal: () => void,
  ) {
    this.desktop     = desktop
    this.termWin     = termWin
    this.fitTerminal = fitTerminal
    this.panes       = document.getElementById('panes')!
    this.rightPane   = document.getElementById('right-pane')!
    this.taskbarDock = document.getElementById('wm-taskbar-dock')!
    this.hSplitter   = document.getElementById('h-splitter')!

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

  async openWindow(spec: WindowSpec): Promise<void> {
    this.closeLauncherOverlay()

    if (spec.command === 'edit') {
      const pathArg = spec.editorPath ?? 'welcome.txt'

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
      })
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
        onOpenInEditor: absFilePath =>
          void this.openWindow({
            command: 'edit',
            title: `edit — ${absFilePath}`,
            content: [],
            editorPath: absFilePath,
          }),
      })
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
      this.appendToRightPane(br.el)
      this.windows.push(br)
      this.attachVerticalSplitters()
      this.focusWindow(br)
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
      if (cmd === 'cube') {
        // Temporarily disabled — sticker rotation math needs revisiting.
        pushToast('Cube is temporarily unavailable while we fix the rotation math.', 4800, 'toast--warn')
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

    this.appendToRightPane(win.el)
    this.windows.push(win)
    this.attachVerticalSplitters()
    this.focusWindow(win)
  }

  focusTerminal(): void {
    if (this.focusedId !== null) playOsSound('focus')
    this.closeLauncherOverlay()
    this.termWin.classList.remove('terminal-closed')
    const restoring = this.termWin.classList.contains('minimized')
    if (restoring) {
      this.termWin.classList.remove('minimized')
    }
    if (restoring && !this.prefersReducedMotion()) {
      requestAnimationFrame(() => this.playMountAnim(this.termWin))
    }

    this.focusedId = null
    this.termWin.classList.add('active')
    this.windows.forEach(w => w.setActive(false))
    this.sync()
    requestAnimationFrame(() => this.fitTerminal())
  }

  /**
   * Focus the terminal tile only if it is already visible. Does not restore a
   * minimized or closed terminal (used after closing/minimizing another window).
   */
  private focusTerminalIfAlreadyVisible(): void {
    this.closeLauncherOverlay()
    if (
      this.termWin.classList.contains('minimized') ||
      this.termWin.classList.contains('terminal-closed')
    ) {
      this.focusedId = null
      this.termWin.classList.remove('active')
      this.windows.forEach(w => w.setActive(false))
      this.sync()
      return
    }
    this.focusedId = null
    this.termWin.classList.add('active')
    this.windows.forEach(w => w.setActive(false))
    this.sync()
    requestAnimationFrame(() => this.fitTerminal())
  }

  // ── private: window lifecycle ─────────────────────────────────────────────

  /** Mount a tile on the right stack with a one-shot entrance animation. */
  private appendToRightPane(el: HTMLElement): void {
    this.rightPane.appendChild(el)
    this.playMountAnim(el)
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
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      case 'cube':
        ;(win as PaintWindow | SnakeWindow | PongWindow | RubikWindow).focusCanvas()
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
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeTerminal(): void {
    this.termWin.classList.remove('maximized')
    this.panes.classList.remove('max-terminal')
    if (this.maximizedId === TERMINAL_TILE_SENTINEL) this.maximizedId = null
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

    this.contentRestore.set(win, {
      parent: win.el.parentElement!,
      next:   win.el.nextSibling,
    })
    this.panes.appendChild(win.el)
    win.el.classList.add('maximized')
    this.panes.classList.add('max-content')
    this.maximizedId = win.command
    requestAnimationFrame(() => this.fitTerminal())
  }

  private unmaximizeContent(win: TiledWin): void {
    if (!win.isMaximized()) return
    const slot = this.contentRestore.get(win)
    win.el.classList.remove('maximized')
    this.panes.classList.remove('max-content')
    if (slot) {
      slot.parent.insertBefore(win.el, slot.next)
      this.contentRestore.delete(win)
    }
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
    window.setInterval(tick, 30000)
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
        btn.innerHTML = `<span class="desktop-icon-glyph">${item.glyph}</span><span class="desktop-icon-label">${item.label}</span>`
        btn.addEventListener('click', () => {
          this.focusTerminal()
        })
      } else {
        const cmd = commands[item.cmd]
        if (!cmd || !TILED_WINDOW_COMMANDS.has(item.cmd)) continue
        btn.innerHTML = `<span class="desktop-icon-glyph">${item.glyph}</span><span class="desktop-icon-label">${item.label}</span>`
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
            editorPath: item.cmd === 'edit' ? 'welcome.txt' : undefined,
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

  private attachVerticalSplitters(): void {
    // Remove any existing v-splitters and rebuild — keep windows in order
    this.rightPane.querySelectorAll('.splitter-v').forEach(el => el.remove())

    // While maximized, the active window lives under #panes — only tile splits in #right-pane
    const tiled = this.windows.filter(w => w.el.parentElement === this.rightPane)

    for (let i = 0; i < tiled.length - 1; i++) {
      const splitter = document.createElement('div')
      splitter.className = 'splitter splitter-v'
      this.rightPane.insertBefore(splitter, tiled[i + 1].el)

      new Splitter({
        el:          splitter,
        orientation: 'v',
        target:      tiled[i].el,
        container:   this.rightPane,
        min:         100,
      })
    }
  }

  // ── private: layout sync ───────────────────────────────────────────────────

  private sync(): void {
    const count = this.windows.length
    this.desktop.dataset.contentCount = String(count)
    this.desktop.dataset.terminalClosed = this.termWin.classList.contains('terminal-closed')
      ? '1'
      : '0'
    this.syncLauncherVisibility()
    this.syncTaskbar()
    this.syncFocusedTitle()
    requestAnimationFrame(() => this.fitTerminal())
  }

  /** Pinned dock — subset of {@link LAUNCHER_ICON_ROWS} (excludes `DOCK_HIDDEN_COMMANDS`). */
  private pinnedDockSlots(): Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> {
    const slots: Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> = []
    for (const item of LAUNCHER_ICON_ROWS) {
      if (item.kind === 'app' && DOCK_HIDDEN_COMMANDS.has(item.cmd)) continue
      if (item.kind === 'terminal') slots.push({ kind: 'terminal' })
      else slots.push({ kind: 'app', cmd: item.cmd })
    }
    return slots
  }

  /** Open / minimized apps not in the pinned strip — shown after a divider like macOS. */
  private runningDockExtraSlots(): Array<{ kind: 'app'; cmd: string }> {
    const pinned = dockPinnedCommandSet()
    const out: Array<{ kind: 'app'; cmd: string }> = []
    const seen = new Set<string>()

    const add = (cmd: string): void => {
      if (pinned.has(cmd) || seen.has(cmd)) return
      seen.add(cmd)
      out.push({ kind: 'app', cmd })
    }

    for (const w of this.windows) add(w.command)
    for (const { win } of this.minimized) add(win.command)
    return out
  }

  /** Pinned row + running unpinned windows (each command once). */
  private allDockSlots(): Array<{ kind: 'terminal' } | { kind: 'app'; cmd: string }> {
    return [...this.pinnedDockSlots(), ...this.runningDockExtraSlots()]
  }

  /** Dock / Ctrl+n: launch · restore · focus — or minimize when already focused. */
  private dockActivateTerminal(): void {
    const terminalFocused =
      this.focusedId === null &&
      !this.termWin.classList.contains('terminal-closed') &&
      !this.termWin.classList.contains('minimized')
    if (terminalFocused) {
      this.minimizeTerminal()
      return
    }
    this.focusTerminal()
  }

  private dockActivateApp(cmd: string): void {
    const wmCmd = EDITOR_LAUNCH_ALIASES.has(cmd) ? 'edit' : cmd
    const open = this.windows.find(w => w.command === wmCmd)
    if (open) {
      if (this.focusedId === wmCmd) {
        this.minimizeWindow(open)
        return
      }
      this.focusWindow(open)
      return
    }
    const entry = this.minimized.find(m => m.win.command === wmCmd)
    if (entry) {
      this.restoreMinimized(entry)
      return
    }
    const def = commands[cmd]
    if (!def || !TILED_WINDOW_COMMANDS.has(cmd)) return
    if (EDITOR_LAUNCH_ALIASES.has(cmd)) {
      const heading = cmd === 'vim' ? 'vim' : cmd === 'editor' ? 'editor' : 'edit'
      void this.openWindow({
        command: 'edit',
        title: `${heading} — welcome.txt`,
        content: [],
        editorPath: 'welcome.txt',
      })
      return
    }
    if (cmd === 'explorer') {
      void this.openWindow({
        command: 'explorer',
        title: 'Files',
        content: def.run([]),
        explorerPath: FS_HOME,
      })
      return
    }
    if (cmd === 'browse') {
      void this.openWindow({
        command: 'browse',
        title: 'Browse',
        content: def.run([]),
        browserUrl: DEFAULT_BROWSER_URL,
      })
      return
    }
    if (cmd === 'paint' || cmd === 'snake' || cmd === 'pong') {
      void this.openWindow({ command: cmd, title: cmd, content: [] })
      return
    }
    if (cmd === 'cube') {
      pushToast('Cube is temporarily unavailable while we fix the rotation math.', 4800, 'toast--warn')
      return
    }
    if (cmd === 'resume') {
      void this.openWindow({
        command: 'resume',
        title: tileTitleForPortfolioCommand('resume'),
        ...resumeWindowSplitPayload(),
      })
      return
    }
    if (cmd === 'projects') {
      void this.openWindow({
        command: 'projects',
        title: tileTitleForPortfolioCommand('projects'),
        content: [],
        projectCards: PORTFOLIO_PROJECTS,
      })
      return
    }
    void this.openWindow({
      command: cmd,
      title: tileTitleForPortfolioCommand(cmd),
      content: def.run([]),
    })
  }

  private focusTaskbarIndex(index: number): void {
    const slots = this.allDockSlots()
    const slot = slots[index]
    if (!slot) return
    if (slot.kind === 'terminal') {
      this.dockActivateTerminal()
      return
    }
    this.dockActivateApp(slot.cmd)
  }

  private syncFocusedTitle(): void {
    const el = document.getElementById('yasb-focused')
    if (!el) return

    if (this.focusedId !== null) {
      const icon = LAUNCHER_ICON_ROWS.find(
        (i): i is { kind: 'app'; cmd: string; label: string; glyph: string } =>
          i.kind === 'app' && i.cmd === this.focusedId,
      )
      el.textContent = icon?.label ?? this.focusedId
      return
    }

    if (this.termWin.classList.contains('terminal-closed')) {
      el.textContent = this.windows.length === 0 ? 'mrgrey.dev' : '\u2014'
      return
    }
    // Minimized vs visible: same prompt line — dock shows wm-task-btn--minimized
    el.textContent = 'namefailed@dev — ~/terminal'
  }

  private syncTaskbar(): void {
    this.taskbarDock.replaceChildren()
    const pinned = this.pinnedDockSlots()
    const extras = this.runningDockExtraSlots()
    const slots = this.allDockSlots()
    const pinLen = pinned.length

    slots.forEach((slot, idx) => {
      if (idx === pinLen && extras.length > 0) {
        const sep = document.createElement('span')
        sep.className = 'wm-dock-sep'
        sep.setAttribute('role', 'separator')
        sep.setAttribute('aria-hidden', 'true')
        sep.title = 'Running apps'
        this.taskbarDock.appendChild(sep)
      }

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'wm-task-btn'
      if (idx >= pinLen && extras.length > 0) btn.classList.add('wm-task-btn--running')

      const meta =
        slot.kind === 'terminal'
          ? LAUNCHER_ICON_ROWS.find(i => i.kind === 'terminal')!
          : LAUNCHER_ICON_ROWS.find(
              (i): i is { kind: 'app'; cmd: string; label: string; glyph: string } =>
                i.kind === 'app' && i.cmd === slot.cmd,
            ) ?? {
              kind: 'app' as const,
              cmd: slot.cmd,
              label: slot.cmd,
              glyph: '◇',
            }

      let isMinimized = false
      let isActive = false
      let isIdle = false

      if (slot.kind === 'terminal') {
        isMinimized = this.termWin.classList.contains('minimized')
        isActive =
          this.focusedId === null &&
          !this.termWin.classList.contains('terminal-closed') &&
          !this.termWin.classList.contains('minimized')
        if (this.termWin.classList.contains('terminal-closed')) {
          btn.classList.add('wm-task-btn--closed')
        }
      } else {
        const open = this.windows.find(w => w.command === slot.cmd)
        isMinimized =
          !open && this.minimized.some(m => m.win.command === slot.cmd)
        isActive = this.focusedId === slot.cmd
        isIdle = !open && !isMinimized
      }

      if (isMinimized) btn.classList.add('wm-task-btn--minimized')
      if (isActive) btn.classList.add('wm-task-btn--active')
      if (isIdle) btn.classList.add('wm-task-btn--idle')

      btn.title = meta.label

      const gl = document.createElement('span')
      gl.className = 'wm-task-glyph'
      gl.setAttribute('aria-hidden', 'true')
      gl.textContent = meta.glyph
      btn.appendChild(gl)

      const lab = document.createElement('span')
      lab.className = 'wm-task-label'
      lab.textContent = meta.label
      btn.appendChild(lab)

      if (slot.kind !== 'terminal') attachLazyPrefetchHandlers(btn, slot.cmd)

      btn.addEventListener('click', () => this.focusTaskbarIndex(idx))
      this.taskbarDock.appendChild(btn)
    })
  }

  // ── private: keyboard ──────────────────────────────────────────────────────

  private handleGlobal(ev: KeyboardEvent): void {
    if (!ev.ctrlKey || ev.altKey || ev.metaKey) return

    const key = ev.key.toLowerCase()

    // Reserved keys for the WM — intercept before xterm/vim see them
    const wmKeys = new Set([
      't', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      'h','l','j','k','q','m','d','f',
    ])
    if (!wmKeys.has(key)) return

    ev.preventDefault()
    ev.stopImmediatePropagation()

    // Ctrl+T → terminal (restore if minimized)
    if (key === 't') { this.focusTerminal(); return }

    // Ctrl+1..9 → taskbar slot (launcher order, left → right)
    const n = parseInt(key, 10)
    if (n >= 1 && n <= 9) {
      this.focusTaskbarIndex(n - 1)
      return
    }

    // Ctrl+H / Ctrl+L and Ctrl+K / Ctrl+J → same pane-cycle (HJ/KL pairs)
    if (key === 'h' || key === 'k') { this.focusLeft(); return }
    if (key === 'l' || key === 'j') { this.focusRight(); return }

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
    if (this.focusedId === null) return                      // already at terminal
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx <= 0) { this.focusTerminal(); return }
    this.focusWindow(this.windows[idx - 1])
  }

  private focusRight(): void {
    if (this.focusedId === null) {                           // terminal → first window
      if (this.windows[0]) this.focusWindow(this.windows[0])
      return
    }
    const idx = this.windows.findIndex(w => w.command === this.focusedId)
    if (idx >= 0 && idx < this.windows.length - 1) {
      this.focusWindow(this.windows[idx + 1])
    }
  }
}
