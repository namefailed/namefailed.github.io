/**
 * Tiling shell: terminal column plus portfolio / editor / browser / games tiles (`openWindow`).
 * Tile commands repeat path/URL or toggle per command rules; plain shell commands stay in `commands/index.ts`.
 * Keys: Ctrl+T terminal; Ctrl+1–9 docks; Ctrl+H/K vs L/J along stack; Ctrl+Q/M/F/D close/min/max/show-desktop; Applications = launcher.
 */

import type { WindowSpec } from './appwindow'
import { dispatchOpenWindow, type MinimizedEntry, type TiledWin } from './desktop-open-window'
import { handleDesktopGlobalKey } from './desktop-keyboard-handler'
import { mountLauncherIconGrid } from './desktop-launcher-grid'
import { buildPsSnapshot, type PsSnapshotRow } from './desktop-ps-snapshot'
import { focusSubtarget, focusTerminalTileIfVisible } from './desktop-wm-focus'
import {
  keyboardHost,
  lifecycleContext,
  maximizeContext,
  openWindowHost,
  terminalColumnHost,
  tileLimitHost,
  type DesktopWmSelf,
} from './desktop-wm-hosts'
import {
  closeTiledWindow,
  minimizeTiledWindow,
  mountTiledWindow,
  restoreMinimizedWindow,
} from './desktop-wm-lifecycle'
import {
  maximizeTerminal as applyMaximizeTerminal,
  toggleMaximizeContent as applyToggleMaximizeContent,
  unmaximizeContent as applyUnmaximizeContent,
  unmaximizeTerminal as applyUnmaximizeTerminal,
} from './desktop-wm-maximize'
import { enforceTileLimit as applyTileLimit } from './desktop-wm-tile-limit'
import type { TerminalWindow } from './terminal'
import {
  closeTerminalColumn,
  initYasbLauncherChrome,
  isLegacyTerminalColumnActive,
  minimizeTerminalColumn,
  wireTerminalTitlebar,
} from './desktop-wm-terminal'
import { Splitter } from './splitter'
import {
  closeLauncherOverlayFlags,
  initLauncherSearchFilter,
  launcherOverlayVisible,
  openLauncherFromButtonFlags,
  syncLauncherOverlayDom,
  toggleShowDesktopFlags,
  type LauncherOverlayFlags,
} from './desktop-launcher-overlay'
import { applySpatialFocusAction, pickSpatialFocusAction } from './desktop-spatial-focus'
import {
  buildTaskbarDockSnapshot,
  renderTaskbarDock,
  resolveDockWindows,
  syncDockAutoHide,
  syncYasbFocusedTitle,
  taskbarPinnedAction,
  wireDockHoverZone,
} from './desktop-taskbar'
import { syncShellDataset } from './desktop-wm-sync'
import { windowSpecForCommand } from './desktop-window-spec'
import { initYasbClock } from './yasb-clock'
import { setDesktopRef } from './os-registry'
import { playOsSound } from './os-sound'
import { mountWelcomeGuide } from './welcome-guide'
import { mountDesktopTiles } from './desktop-tiles'
import type { WindowLayout } from './window-layout'
import { BspLayout } from './bsp-layout'

export type { WindowSpec, PsSnapshotRow }

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

    if (isLegacyTerminalColumnActive(termWin)) {
      termWin.addEventListener('mousedown', () => this.focusTerminal())
      wireTerminalTitlebar(termWin, {
        onMinimize: () => this.minimizeTerminal(),
        onMaximize: () => this.toggleMaximizeTerminal(),
        onClose: () => this.closeTerminal(),
      })
      new Splitter({
        el:          this.hSplitter,
        orientation: 'h',
        target:      this.termWin,
        container:   this.panes,
        min:         280,
        max:         () => Math.max(280, this.panes.clientWidth - 320),
        onResize:    () => this.fitTerminal(),
      })
    }

    // Global keyboard shortcuts
    document.addEventListener('keydown', ev => this.handleGlobal(ev), true)

    // Window resize → refit terminal
    window.addEventListener('resize', () => this.fitTerminal())

    mountLauncherIconGrid({ openWindow: spec => void this.openWindow(spec) })
    initLauncherSearchFilter()
    initYasbClock()
    initYasbLauncherChrome({
      launcherOverlay: this.launcherOverlay,
      onApplicationsClick: () => this.toggleLauncherFromButton(),
      onCloseLauncher: () => this.closeLauncherOverlay(),
    })
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
    return buildPsSnapshot(this.windows, this.minimized, this.focusedId)
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
  private wm(): DesktopWmSelf {
    const s = this
    return {
      get windows() { return s.windows },
      get minimized() { return s.minimized },
      get launcherOverlay() { return s.launcherOverlay },
      get desktop() { return s.desktop },
      get panes() { return s.panes },
      get termWin() { return s.termWin },
      get layoutMaxVisible() { return s.layout.maxVisible },
      getFocusedId: () => s.focusedId,
      setFocusedId: id => { s.focusedId = id },
      getMaximizedId: () => s.maximizedId,
      setMaximizedId: id => { s.maximizedId = id },
      prefersReducedMotion: () => s.prefersReducedMotion(),
      fitTerminal: () => s.fitTerminal(),
      closeLauncherOverlay: () => s.closeLauncherOverlay(),
      closeWindow: win => s.closeWindow(win),
      focusWindow: win => s.focusWindow(win),
      restoreMinimized: entry => s.restoreMinimized(entry),
      minimizeWindow: win => s.minimizeWindow(win),
      toggleMaximizeContent: win => s.toggleMaximizeContent(win),
      unmaximizeContent: win => s.unmaximizeContent(win),
      unmaximizeTerminal: () => s.unmaximizeTerminal(),
      enforceTileLimit: () => s.enforceTileLimit(),
      appendToRightPane: win => s.appendToRightPane(win),
      attachVerticalSplitters: () => s.attachVerticalSplitters(),
      sync: () => s.sync(),
      syncDockVisibility: () => s.syncDockVisibility(),
      openWindow: spec => s.openWindow(spec),
      focusTaskbarIndex: index => s.focusTaskbarIndex(index),
      focusSpatial: dir => s.focusSpatial(dir),
      closeTerminal: () => s.closeTerminal(),
      minimizeTerminal: () => s.minimizeTerminal(),
      toggleShowDesktop: () => s.toggleShowDesktop(),
      focusTerminalIfAlreadyVisible: () => s.focusTerminalIfAlreadyVisible(),
    }
  }

  async openWindow(spec: WindowSpec): Promise<void> {
    await dispatchOpenWindow(spec, openWindowHost(this.wm()))
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
    focusTerminalTileIfVisible(this.windows, {
      focusWindow: win => this.focusWindow(win),
      clearUnfocused: () => {
        this.focusedId = null
        this.termWin.classList.remove('active')
        this.windows.forEach(w => w.setActive(false))
        this.sync()
      },
    })
  }

  // ── private: window lifecycle ─────────────────────────────────────────────

  /**
   * Place `win` in the active layout, play its mount animation, and signal
   * the first-window event.  Windows are never moved after placement so
   * iframe-backed windows (p5, browse) never reload.
   */
  private appendToRightPane(win: TiledWin): void {
    mountTiledWindow(this.layout, win, this.windows.length)
  }

  private prefersReducedMotion(): boolean {
    return this.reducedMotionMQ.matches
  }

  private closeWindow(win: TiledWin): void {
    closeTiledWindow(lifecycleContext(this.wm()), win)
  }

  private focusWindow(win: TiledWin): void {
    if (this.focusedId !== win.command) playOsSound('focus')
    this.closeLauncherOverlay()
    this.focusedId = win.command
    this.termWin.classList.remove('active')
    this.windows.forEach(w => w.setActive(w === win))
    this.sync()
    focusSubtarget(win)
  }

  // ── private: maximize / restore ─────────────────────────────────────────────

  private toggleMaximizeTerminal(): void {
    applyMaximizeTerminal(maximizeContext(this.wm()))
  }

  private unmaximizeTerminal(): void {
    applyUnmaximizeTerminal(maximizeContext(this.wm()))
  }

  private toggleMaximizeContent(win: TiledWin): void {
    applyToggleMaximizeContent(maximizeContext(this.wm()), win)
  }

  private unmaximizeContent(win: TiledWin): void {
    applyUnmaximizeContent(maximizeContext(this.wm()), win)
  }

  // ── private: minimize / restore ────────────────────────────────────────────

  private minimizeWindow(win: TiledWin): void {
    playOsSound('click')
    minimizeTiledWindow(lifecycleContext(this.wm()), win)
  }

  private restoreMinimized(entry: MinimizedEntry): void {
    restoreMinimizedWindow(lifecycleContext(this.wm()), entry)
  }

  private minimizeTerminal(): void {
    playOsSound('click')
    minimizeTerminalColumn(terminalColumnHost(this.wm()))
  }

  /** Dismiss terminal (hidden tile). Unlike minimize, does not auto-open app launchers. */
  private closeTerminal(): void {
    closeTerminalColumn(terminalColumnHost(this.wm()))
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

  // ── private: vertical splitters between stacked content windows ───────────

  /**
   * Enforce the layout's maximum number of simultaneously visible tiled windows.
   * Instantly (no animation) bumps the oldest non-focused window to the minimized dock.
   * Call this before appending a new window to #right-pane.
   */
  private enforceTileLimit(): void {
    applyTileLimit(tileLimitHost(this.wm()))
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
    syncShellDataset(
      this.desktop,
      this.termWin,
      this.windows.length,
      this.maximizedId !== null,
    )
    this.syncLauncherVisibility()
    this.syncTaskbar()
    this.syncDockVisibility()
    this.syncFocusedTitle()
    requestAnimationFrame(() => this.fitOpenTerminal())
  }

  /** Refit xterm in the open terminal tile (legacy column uses `fitTerminal` callback). */
  private fitOpenTerminal(): void {
    const termTile = this.windows.find(w => w.command === 'terminal')
    if (termTile) (termTile as TerminalWindow).fit()
    this.fitTerminal()
  }

  /** All windows accessible from the dock: open (by tile order) then minimized. */
  private dockWindows(): TiledWin[] {
    return resolveDockWindows(this.windows, this.minimized)
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

    renderTaskbarDock(
      this.taskbarDock,
      buildTaskbarDockSnapshot(this.focusedId, openCommands, minimizedCommands),
      {
        onPinnedClick: cmd => {
          const action = taskbarPinnedAction(
            cmd,
            this.windows.some(w => w.command === 'terminal'),
            this.focusedId === 'terminal',
          )
          if (action.type === 'minimize-terminal-tile') {
            const termTile = this.windows.find(w => w.command === 'terminal')
            if (termTile) this.minimizeWindow(termTile)
            return
          }
          if (action.type === 'open-terminal-tile') {
            void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
            return
          }
          void this.openWindow(windowSpecForCommand(action.cmd))
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
    handleDesktopGlobalKey(ev, keyboardHost(this.wm()))
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
    const openCommands = this.windows.map(w => w.command)
    applySpatialFocusAction(action, openCommands, {
      focusWindow: cmd => {
        const win = this.windows.find(w => w.command === cmd)
        if (win) this.focusWindow(win)
      },
      openTerminal: () => {
        void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
      },
    })
  }
}
