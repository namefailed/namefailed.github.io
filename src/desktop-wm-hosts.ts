/**
 * Host/context bindings from Desktop state into extracted WM modules.
 */

import type { WindowSpec } from './appwindow'
import type { DesktopKeyboardHost } from './desktop-keyboard-handler'
import type { LauncherOverlayFlags } from './desktop-launcher-overlay'
import type { OpenWindowHost, MinimizedEntry, TiledWin } from './desktop-open-window'
import type { SpatialDirection } from './desktop-spatial-focus'
import { toggleMaximizeFocused as applyToggleMaximizeFocused } from './desktop-wm-maximize'
import type { WmLifecycleContext } from './desktop-wm-lifecycle'
import type { WmMaximizeContext } from './desktop-wm-maximize'
import type { TerminalColumnHost } from './desktop-wm-terminal'
import type { TileLimitHost } from './desktop-wm-tile-limit'

/** Minimal surface Desktop exposes to WM host factories. */
export interface DesktopWmSelf {
  readonly windows: TiledWin[]
  readonly minimized: MinimizedEntry[]
  readonly launcherOverlay: LauncherOverlayFlags
  readonly desktop: HTMLElement
  readonly panes: HTMLElement
  readonly termWin: HTMLElement
  get layoutMaxVisible(): number
  getFocusedId(): string | null
  setFocusedId(value: string | null): void
  getMaximizedId(): string | null
  setMaximizedId(value: string | null): void
  prefersReducedMotion(): boolean
  fitTerminal(): void
  closeLauncherOverlay(): void
  closeWindow(win: TiledWin): void
  focusWindow(win: TiledWin): void
  restoreMinimized(entry: MinimizedEntry): void
  minimizeWindow(win: TiledWin): void
  toggleMaximizeContent(win: TiledWin): void
  unmaximizeContent(win: TiledWin): void
  unmaximizeTerminal(): void
  enforceTileLimit(): void
  appendToRightPane(win: TiledWin): void
  attachVerticalSplitters(): void
  sync(): void
  syncDockVisibility(): void
  openWindow(spec: WindowSpec): Promise<void>
  focusTaskbarIndex(index: number): void
  focusSpatial(dir: SpatialDirection): void
  closeTerminal(): void
  minimizeTerminal(): void
  toggleShowDesktop(): void
  focusTerminalIfAlreadyVisible(): void
}

export function openWindowHost(self: DesktopWmSelf): OpenWindowHost {
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

export function lifecycleContext(self: DesktopWmSelf): WmLifecycleContext {
  return {
    get windows() { return self.windows },
    get minimized() { return self.minimized },
    getFocusedId: () => self.getFocusedId(),
    prefersReducedMotion: () => self.prefersReducedMotion(),
    unmaximizeContent: win => self.unmaximizeContent(win),
    focusTerminalIfAlreadyVisible: () => self.focusTerminalIfAlreadyVisible(),
    attachVerticalSplitters: () => self.attachVerticalSplitters(),
    sync: () => self.sync(),
    appendToRightPane: win => self.appendToRightPane(win),
    focusWindow: win => self.focusWindow(win),
    closeLauncherOverlay: () => self.closeLauncherOverlay(),
  }
}

export function maximizeContext(self: DesktopWmSelf): WmMaximizeContext {
  return {
    getMaximizedId: () => self.getMaximizedId(),
    setMaximizedId: id => { self.setMaximizedId(id) },
    termWin: self.termWin,
    panes: self.panes,
    desktop: self.desktop,
    findOpenWindow: cmd => self.windows.find(w => w.command === cmd),
    unmaximizeContent: win => self.unmaximizeContent(win),
    syncDockVisibility: () => self.syncDockVisibility(),
    fitTerminal: () => self.fitTerminal(),
    attachVerticalSplitters: () => self.attachVerticalSplitters(),
    sync: () => self.sync(),
  }
}

export function terminalColumnHost(self: DesktopWmSelf): TerminalColumnHost {
  return {
    termWin: self.termWin,
    launcherOverlay: self.launcherOverlay,
    prefersReducedMotion: () => self.prefersReducedMotion(),
    getMaximizedId: () => self.getMaximizedId(),
    unmaximizeTerminal: () => self.unmaximizeTerminal(),
    hasOpenWindows: () => self.windows.length > 0,
    focusFirstWindow: () => self.focusWindow(self.windows[0]!),
    clearFocusAndSync: () => {
      self.setFocusedId(null)
      self.sync()
    },
    sync: () => self.sync(),
  }
}

export function tileLimitHost(self: DesktopWmSelf): TileLimitHost {
  return {
    get windows() { return self.windows },
    get minimized() { return self.minimized },
    get maxVisible() { return self.layoutMaxVisible },
    getFocusedId: () => self.getFocusedId(),
    setFocusedId: id => { self.setFocusedId(id) },
    unmaximizeContent: win => self.unmaximizeContent(win),
  }
}

export function keyboardHost(self: DesktopWmSelf): DesktopKeyboardHost {
  return {
    openTerminal: () => {
      void self.openWindow({ command: 'terminal', title: 'terminal', content: [] })
    },
    focusTaskbarIndex: index => self.focusTaskbarIndex(index),
    focusSpatial: dir => self.focusSpatial(dir),
    closeFocusedOrTerminal: () => {
      if (self.getFocusedId()) {
        const w = self.windows.find(x => x.command === self.getFocusedId())
        if (w) self.closeWindow(w)
      } else if (!self.termWin.classList.contains('terminal-closed')) {
        self.closeTerminal()
      }
    },
    minimizeFocusedOrTerminal: () => {
      if (self.getFocusedId()) {
        const w = self.windows.find(x => x.command === self.getFocusedId())
        if (w) self.minimizeWindow(w)
      } else {
        self.minimizeTerminal()
      }
    },
    toggleMaximizeFocused: () => applyToggleMaximizeFocused(maximizeContext(self), self.getFocusedId()),
    toggleShowDesktop: () => self.toggleShowDesktop(),
  }
}
