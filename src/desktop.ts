/**
 * Tiling shell: portfolio / editor / browser / games tiles (`openWindow`).
 * Terminal is a lazy-loaded tile (Ctrl+T or dock). Keys: Ctrl+1–9 docks;
 * Ctrl+H/K vs L/J along stack; Ctrl+Q/M/F/D close/min/max/show-desktop; Applications = launcher.
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
  toggleMaximizeContent as applyToggleMaximizeContent,
  unmaximizeContent as applyUnmaximizeContent,
} from './desktop-wm-maximize'
import { enforceTileLimit as applyTileLimit } from './desktop-wm-tile-limit'
import { initYasbLauncherChrome } from './desktop-wm-terminal'
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
import { mountDesktopTiles } from './desktop-tiles'
import { initDesktopPersonalize } from './desktop-personalize'
import { mountWelcomeGuide } from './welcome-guide'
import { mountDesktopEmptyCta, syncDesktopEmptyCta } from './desktop-empty-cta'
import { pushToast } from './os-systray'
import { taskbarIconMeta } from './desktop-taskbar'
import type { TerminalWindow } from './terminal'
import type { WindowLayout } from './window-layout'
import { BspLayout } from './bsp-layout'

export type { WindowSpec, PsSnapshotRow }

export class Desktop {
  private desktop: HTMLElement
  private panes: HTMLElement
  private rightPane: HTMLElement
  private taskbarDock: HTMLElement
  private reducedMotionMQ: MediaQueryList

  private windows: TiledWin[] = []
  private minimized: MinimizedEntry[] = []
  /** `null` when no right-pane tile holds focus */
  private focusedId: string | null = null
  private readonly launcherOverlay: LauncherOverlayFlags = {
    showingDesktop: false,
    launcherOpen: false,
  }

  private layout: WindowLayout
  private maximizedId: string | null = null
  /** Memoized WM host facade — built once so hot paths (per-keydown) don't reallocate it. */
  private wmSelf: DesktopWmSelf | null = null

  constructor(desktop: HTMLElement) {
    this.desktop = desktop
    this.panes = document.getElementById('panes')!
    this.rightPane = document.getElementById('right-pane')!
    this.taskbarDock = document.getElementById('wm-taskbar-dock')!
    this.reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.layout = new BspLayout(this.rightPane)

    document.addEventListener('keydown', ev => this.handleGlobal(ev), true)
    window.addEventListener('resize', () => this.fitOpenTerminal())

    mountLauncherIconGrid({ openWindow: spec => void this.openWindow(spec) })
    initLauncherSearchFilter()
    initYasbClock()
    initYasbLauncherChrome({
      launcherOverlay: this.launcherOverlay,
      onApplicationsClick: () => this.toggleLauncherFromButton(),
      onCloseLauncher: () => this.closeLauncherOverlay(),
    })
    setDesktopRef(this)
    initDesktopPersonalize(this.desktop)
    mountWelcomeGuide()
    wireDockHoverZone(this.taskbarDock)

    const workspace = document.getElementById('desktop-workspace')
    if (workspace) {
      mountDesktopEmptyCta(workspace, cmd => void this.openWindow(windowSpecForCommand(cmd)))
      mountDesktopTiles({
        host: workspace,
        onActivate: cmd => void this.openWindow(windowSpecForCommand(cmd)),
      })
      window.addEventListener('mrgrey-guide-dismissed', () => {
        syncDesktopEmptyCta(workspace, this.windows.length)
      })
    }

    this.sync()
  }

  getPsSnapshot(): PsSnapshotRow[] {
    return buildPsSnapshot(this.windows, this.minimized, this.focusedId)
  }

  private wm(): DesktopWmSelf {
    if (this.wmSelf) return this.wmSelf
    const s = this
    this.wmSelf = {
      get windows() { return s.windows },
      get minimized() { return s.minimized },
      get launcherOverlay() { return s.launcherOverlay },
      get desktop() { return s.desktop },
      get panes() { return s.panes },
      get layoutMaxVisible() { return s.layout.maxVisible },
      getFocusedId: () => s.focusedId,
      setFocusedId: id => { s.focusedId = id },
      getMaximizedId: () => s.maximizedId,
      setMaximizedId: id => { s.maximizedId = id },
      prefersReducedMotion: () => s.prefersReducedMotion(),
      fitOpenTerminal: () => s.fitOpenTerminal(),
      closeLauncherOverlay: () => s.closeLauncherOverlay(),
      closeWindow: win => s.closeWindow(win),
      focusWindow: win => s.focusWindow(win),
      restoreMinimized: entry => s.restoreMinimized(entry),
      minimizeWindow: win => s.minimizeWindow(win),
      toggleMaximizeContent: win => s.toggleMaximizeContent(win),
      unmaximizeContent: win => s.unmaximizeContent(win),
      enforceTileLimit: () => s.enforceTileLimit(),
      appendToRightPane: win => s.appendToRightPane(win),
      attachVerticalSplitters: () => s.attachVerticalSplitters(),
      sync: () => s.sync(),
      syncDockVisibility: () => s.syncDockVisibility(),
      openWindow: spec => s.openWindow(spec),
      focusTaskbarIndex: index => s.focusTaskbarIndex(index),
      focusSpatial: dir => s.focusSpatial(dir),
      toggleShowDesktop: () => s.toggleShowDesktop(),
      focusTerminalIfAlreadyVisible: () => s.focusTerminalIfAlreadyVisible(),
    }
    return this.wmSelf
  }

  async openWindow(spec: WindowSpec): Promise<void> {
    await dispatchOpenWindow(spec, openWindowHost(this.wm()))
  }

  focusTerminal(): void {
    void this.openWindow({ command: 'terminal', title: 'terminal', content: [] })
  }

  private focusTerminalIfAlreadyVisible(): void {
    this.closeLauncherOverlay()
    focusTerminalTileIfVisible(this.windows, {
      focusWindow: win => this.focusWindow(win),
      clearUnfocused: () => {
        this.focusedId = null
        this.windows.forEach(w => w.setActive(false))
        this.sync()
      },
    })
  }

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
    this.windows.forEach(w => w.setActive(w === win))
    this.sync()
    focusSubtarget(win)
  }

  private toggleMaximizeContent(win: TiledWin): void {
    applyToggleMaximizeContent(maximizeContext(this.wm()), win)
  }

  private unmaximizeContent(win: TiledWin): void {
    applyUnmaximizeContent(maximizeContext(this.wm()), win)
  }

  private minimizeWindow(win: TiledWin): void {
    playOsSound('click')
    minimizeTiledWindow(lifecycleContext(this.wm()), win)
  }

  private restoreMinimized(entry: MinimizedEntry): void {
    restoreMinimizedWindow(lifecycleContext(this.wm()), entry)
  }

  private toggleShowDesktop(): void {
    toggleShowDesktopFlags(this.launcherOverlay)
    this.sync()
  }

  private syncLauncherVisibility(): void {
    syncLauncherOverlayDom(launcherOverlayVisible(this.launcherOverlay), this.desktop)
  }

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

  private enforceTileLimit(): void {
    applyTileLimit({
      ...tileLimitHost(this.wm()),
      onWindowBumped: win => {
        const { label } = taskbarIconMeta(win.command)
        pushToast(`Window limit (6) — minimized “${label}”`, 4800, 'toast--warn')
      },
    })
  }

  private attachVerticalSplitters(): void {
    this.layout.rebuild(this.windows.map(w => w.el))
  }

  private sync(): void {
    syncShellDataset(this.desktop, this.windows.length, this.maximizedId !== null)
    const workspace = document.getElementById('desktop-workspace')
    if (workspace) syncDesktopEmptyCta(workspace, this.windows.length)
    this.syncLauncherVisibility()
    this.syncTaskbar()
    this.syncDockVisibility()
    this.syncFocusedTitle()
    requestAnimationFrame(() => this.fitOpenTerminal())
  }

  private fitOpenTerminal(): void {
    const termTile = this.windows.find(w => w.command === 'terminal')
    if (termTile) (termTile as TerminalWindow).fit()
  }

  private dockWindows(): TiledWin[] {
    return resolveDockWindows(this.windows, this.minimized)
  }

  private focusTaskbarIndex(index: number): void {
    const win = this.dockWindows()[index]
    if (!win) return
    const minimized = this.minimized.find(m => m.win === win)
    if (minimized) {
      this.restoreMinimized(minimized)
      return
    }
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

  private handleGlobal(ev: KeyboardEvent): void {
    handleDesktopGlobalKey(ev, keyboardHost(this.wm()))
  }

  private focusSpatial(dir: 'h' | 'j' | 'k' | 'l'): void {
    const action = pickSpatialFocusAction(
      this.windows.map(w => ({ id: w.command, rect: w.el.getBoundingClientRect() })),
      this.focusedId,
      dir,
    )
    applySpatialFocusAction(action, this.windows.map(w => w.command), {
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
