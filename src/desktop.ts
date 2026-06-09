/**
 * Tiling shell: terminal column plus portfolio / editor / browser / games tiles (`openWindow`).
 * Tile commands repeat path/URL or toggle per command rules; plain shell commands stay in `commands/index.ts`.
 * Keys: Ctrl+T terminal; Ctrl+1–9 docks; Ctrl+H/K vs L/J along stack; Ctrl+Q/M/F/D close/min/max/show-desktop; Applications = launcher.
 */

import type { WindowSpec } from './appwindow'
import type { BrowserWindow } from './browser-window'
import type { EditorWindow } from './editor-window'
import type { FileExplorerWindow } from './file-explorer-window'
import {
  dispatchOpenWindow,
  type MinimizedEntry,
  type OpenWindowHost,
  type TiledWin,
} from './desktop-open-window'
import type { PaintWindow } from './paint-window'
import type { PongWindow } from './pong-window'
import type { SnakeWindow } from './snake-window'
import type { TerminalWindow } from './terminal'
import { Splitter } from './splitter'
import {
  attachLazyPrefetchHandlers,
  LAUNCHER_ICON_ROWS,
  TERMINAL_TILE_SENTINEL,
} from './launcher-catalog'
import { isDesktopWmChordKey } from './desktop-keyboard-chords'
import {
  closeLauncherOverlayFlags,
  initLauncherSearchFilter,
  launcherOverlayVisible,
  openLauncherFromButtonFlags,
  syncLauncherOverlayDom,
  toggleShowDesktopFlags,
  type LauncherOverlayFlags,
} from './desktop-launcher-overlay'
import { pickSpatialFocusAction } from './desktop-spatial-focus'
import {
  extraDockCommands,
  orderedDockCommands,
  renderTaskbarDock,
  syncDockAutoHide,
  syncYasbFocusedTitle,
  wireDockHoverZone,
} from './desktop-taskbar'
import { launcherIconWindowSpec, windowSpecForCommand } from './desktop-window-spec'
import { animateWmThenRemove, playWmMountAnim } from './desktop-wm-animations'
import { initYasbClock } from './yasb-clock'
import { setDesktopRef } from './os-registry'
import { playOsSound } from './os-sound'
import { mountWelcomeGuide } from './welcome-guide'
import { mountDesktopTiles } from './desktop-tiles'
import type { WindowLayout } from './window-layout'
import { BspLayout } from './bsp-layout'

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

export class Desktop {
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
  private readonly launcherOverlay: LauncherOverlayFlags = {
    showingDesktop: false,
    launcherOpen: false,
  }

  /** Active tiling layout — swap via `Desktop.createLayout()` (future). */
  private layout: WindowLayout

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
    this.layout           = new BspLayout(this.rightPane)

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
    initLauncherSearchFilter()
    initYasbClock()
    this.initYasbChrome()
    setDesktopRef(this)

    // Mount first-visit welcome guide (non-blocking)
    mountWelcomeGuide()

    // Wire auto-hide hover zone for the dock
    wireDockHoverZone(this.taskbarDock)

    // Mount draggable desktop icon grid (behind tiling panes)
    const workspace = document.getElementById('desktop-workspace')
    if (workspace) {
      mountDesktopTiles({
        host: workspace,
        onActivate: cmd => void this.openWindow(windowSpecForCommand(cmd)),
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
  private openWindowHost(): OpenWindowHost {
    const self = this
    return {
      get windows() { return self.windows },
      get minimized() { return self.minimized },
      closeLauncherOverlay: () => self.closeLauncherOverlay(),
      closeWindow: win => self.closeWindow(win),
      focusWindow: win => self.focusWindow(win),
      restoreMinimized: entry => self.restoreMinimized(entry),
      minimizeWindow: win => self.minimizeWindow(win),
      toggleMaximizeContent: win => self.toggleMaximizeContent(win),
      enforceTileLimit: () => self.enforceTileLimit(),
      appendToRightPane: win => self.appendToRightPane(win),
      attachVerticalSplitters: () => self.attachVerticalSplitters(),
      openWindow: spec => self.openWindow(spec),
    }
  }

  async openWindow(spec: WindowSpec): Promise<void> {
    await dispatchOpenWindow(spec, this.openWindowHost())
  }

  /**
   * Build a fully-populated WindowSpec for a desktop-tile command.
   * Portfolio commands (resume/projects/whoami/links) need their content
   * pre-populated; tool/game commands only need the command key.
   */
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

  /**
   * Place `win` in the active layout, play its mount animation, and signal
   * the first-window event.  Windows are never moved after placement so
   * iframe-backed windows (p5, browse) never reload.
   */
  private appendToRightPane(win: TiledWin): void {
    this.layout.mount(win.el, this.windows.length)
    playWmMountAnim(win.el)
    window.dispatchEvent(new CustomEvent('mrgrey-first-window'))
  }

  private prefersReducedMotion(): boolean {
    return this.reducedMotionMQ.matches
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

    animateWmThenRemove(el, finalizeClose, { reducedMotion: this.prefersReducedMotion() })
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

    animateWmThenRemove(el, finalize, { reducedMotion: this.prefersReducedMotion() })
  }

  private restoreMinimized(entry: MinimizedEntry): void {
    const i = this.minimized.indexOf(entry)
    if (i === -1) return
    this.minimized.splice(i, 1)

    closeLauncherOverlayFlags(this.launcherOverlay)

    entry.win.setMinimized(false)
    this.appendToRightPane(entry.win)
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

    animateWmThenRemove(this.termWin, applyMin, { reducedMotion: this.prefersReducedMotion() })
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
      closeLauncherOverlayFlags(this.launcherOverlay)
      this.termWin.classList.remove('active')
      if (this.windows.length > 0) {
        this.focusWindow(this.windows[0])
      } else {
        this.focusedId = null
      }
      this.sync()
    }

    if (this.prefersReducedMotion() || !this.termWin.isConnected || this.termWin.classList.contains('minimized')) {
      applyClose()
    } else {
      animateWmThenRemove(this.termWin, applyClose, { reducedMotion: false })
    }
  }

  // ── private: show desktop ───────────────────────────────────────────────────

  private toggleShowDesktop(): void {
    toggleShowDesktopFlags(this.launcherOverlay)
    this.sync()
  }

  private syncLauncherVisibility(): void {
    syncLauncherOverlayDom(launcherOverlayVisible(this.launcherOverlay), this.desktop)
  }

  /** Close launcher overlay from any source (bar, Ctrl+D, Escape, backdrop). */
  private closeLauncherOverlay(): void {
    if (!closeLauncherOverlayFlags(this.launcherOverlay)) return
    this.sync()
  }

  private toggleLauncherFromButton(): void {
    if (!openLauncherFromButtonFlags(this.launcherOverlay)) {
      this.closeLauncherOverlay()
      return
    }
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
        if (!launcherOverlayVisible(this.launcherOverlay)) return
        if (ev.ctrlKey || ev.altKey || ev.metaKey) return
        ev.preventDefault()
        this.closeLauncherOverlay()
      },
      true,
    )
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
        const spec = launcherIconWindowSpec(item.cmd)
        if (!spec) continue
        btn.appendChild(makeIconGlyph(item.glyph))
        btn.appendChild(makeIconLabel(item.label))
        attachLazyPrefetchHandlers(btn, item.cmd)
        btn.addEventListener('click', () => {
          void this.openWindow(spec)
        })
      }
      root.appendChild(btn)
    }
  }

  // ── private: vertical splitters between stacked content windows ───────────

  /**
   * Enforce the layout's maximum number of simultaneously visible tiled windows.
   * Instantly (no animation) bumps the oldest non-focused window to the minimized dock.
   * Call this before appending a new window to #right-pane.
   */
  private enforceTileLimit(): void {
    if (this.windows.length < this.layout.maxVisible) return
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

  /** Rebuild layout splitters after any window close, minimize, or restore. */
  private attachVerticalSplitters(): void {
    this.layout.rebuild(this.windows.map(w => w.el))
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
    const order = orderedDockCommands(
      this.windows.map(w => w.command),
      this.minimized.map(m => m.win.command),
    )
    const byCmd = new Map<string, TiledWin>()
    for (const w of this.windows) byCmd.set(w.command, w)
    for (const { win } of this.minimized) {
      if (!byCmd.has(win.command)) byCmd.set(win.command, win)
    }
    return order.map(cmd => byCmd.get(cmd)!).filter(Boolean)
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
    syncYasbFocusedTitle(this.focusedId, this.windows.length)
  }

  private syncDockVisibility(): void {
    syncDockAutoHide(this.taskbarDock, this.maximizedId !== null)
  }

  private syncTaskbar(): void {
    const openCommands = this.windows.map(w => w.command)
    const minimizedCommands = this.minimized.map(m => m.win.command)
    const dockOrder = orderedDockCommands(openCommands, minimizedCommands)

    renderTaskbarDock(
      this.taskbarDock,
      {
        focusedId: this.focusedId,
        openCommands,
        minimizedCommands,
        extraCommands: extraDockCommands(dockOrder),
      },
      {
        onPinnedClick: cmd => {
          if (cmd === 'terminal') {
            const termTile = this.windows.find(w => w.command === 'terminal')
            const focused = this.focusedId === 'terminal'
            if (termTile && focused) {
              this.minimizeWindow(termTile)
            } else {
              void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
            }
            return
          }
          void this.openWindow(windowSpecForCommand(cmd))
        },
        onExtraClick: cmd => {
          const win = this.dockWindows().find(w => w.command === cmd)
          if (!win) return
          const minimized = this.minimized.find(m => m.win === win)
          if (minimized) {
            this.restoreMinimized(minimized)
            return
          }
          this.focusWindow(win)
        },
      },
    )
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
    if (!isDesktopWmChordKey(key)) return

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

    // Ctrl+H/J/K/L — vim-style spatial focus (h=left, j=down, k=up, l=right)
    if (key === 'h') { this.focusSpatial('h'); return }
    if (key === 'l') { this.focusSpatial('l'); return }
    if (key === 'k') { this.focusSpatial('k'); return }
    if (key === 'j') { this.focusSpatial('j'); return }

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

  /**
   * Spatial focus navigation: move focus to the nearest window in the given
   * vim direction (h=left, j=down, k=up, l=right) using bounding-rect geometry.
   * Pressing H with no window to the left of the current one falls back to
   * opening / restoring the terminal (the permanent left anchor).
   */
  private focusSpatial(dir: 'h' | 'j' | 'k' | 'l'): void {
    const action = pickSpatialFocusAction(
      this.windows.map(w => ({ id: w.command, rect: w.el.getBoundingClientRect() })),
      this.focusedId,
      dir,
    )
    if (action.type === 'focus') {
      const win = this.windows.find(w => w.command === action.id)
      if (win) this.focusWindow(win)
    } else if (action.type === 'open-terminal') {
      void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
    }
  }
}
