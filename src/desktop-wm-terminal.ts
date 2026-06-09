/**
 * Legacy left-column terminal chrome: minimize, close, title-bar wiring.
 */

import { TERMINAL_TILE_SENTINEL } from './launcher-catalog'
import { animateWmThenRemove } from './desktop-wm-animations'
import {
  closeLauncherOverlayFlags,
  launcherOverlayVisible,
  type LauncherOverlayFlags,
} from './desktop-launcher-overlay'

/** True when the static left-column shell is shown (not `terminal-closed`). */
export function isLegacyTerminalColumnActive(termWin: HTMLElement): boolean {
  return !termWin.classList.contains('terminal-closed')
}

export interface TerminalColumnHost {
  termWin: HTMLElement
  launcherOverlay: LauncherOverlayFlags
  prefersReducedMotion(): boolean
  getMaximizedId(): string | null
  unmaximizeTerminal(): void
  hasOpenWindows(): boolean
  focusFirstWindow(): void
  clearFocusAndSync(): void
  sync(): void
}

export interface TerminalTitlebarActions {
  onMinimize(): void
  onMaximize(): void
  onClose(): void
}

export function wireTerminalTitlebar(
  termWin: HTMLElement,
  actions: TerminalTitlebarActions,
): void {
  const tbar = termWin.querySelector('.win-titlebar')
  tbar?.querySelector('.dot-min')?.addEventListener('click', e => {
    e.stopPropagation()
    actions.onMinimize()
  })
  tbar?.querySelector('.dot-max')?.addEventListener('click', e => {
    e.stopPropagation()
    actions.onMaximize()
  })
  tbar?.querySelector('.dot-close')?.addEventListener('click', e => {
    e.stopPropagation()
    actions.onClose()
  })
}

export function minimizeTerminalColumn(host: TerminalColumnHost): void {
  const { termWin } = host
  if (termWin.classList.contains('terminal-closed')) return
  if (termWin.classList.contains('wm-animate-close')) return
  if (host.getMaximizedId() === TERMINAL_TILE_SENTINEL) host.unmaximizeTerminal()

  const applyMin = (): void => {
    termWin.classList.remove('wm-animate-close')
    termWin.classList.add('minimized')
    termWin.classList.remove('active')
    if (host.hasOpenWindows()) host.focusFirstWindow()
    else host.clearFocusAndSync()
  }

  animateWmThenRemove(termWin, applyMin, { reducedMotion: host.prefersReducedMotion() })
}

export function closeTerminalColumn(host: TerminalColumnHost): void {
  const { termWin } = host
  if (termWin.classList.contains('terminal-closed')) return
  if (termWin.classList.contains('wm-animate-close')) return
  if (host.getMaximizedId() === TERMINAL_TILE_SENTINEL) host.unmaximizeTerminal()

  const applyClose = (): void => {
    termWin.classList.remove('wm-animate-close')
    termWin.classList.remove('minimized')
    termWin.classList.add('terminal-closed')
    closeLauncherOverlayFlags(host.launcherOverlay)
    termWin.classList.remove('active')
    if (host.hasOpenWindows()) host.focusFirstWindow()
    else host.clearFocusAndSync()
    host.sync()
  }

  if (
    host.prefersReducedMotion() ||
    !termWin.isConnected ||
    termWin.classList.contains('minimized')
  ) {
    applyClose()
  } else {
    animateWmThenRemove(termWin, applyClose, { reducedMotion: false })
  }
}

export interface YasbLauncherChromeHost {
  launcherOverlay: LauncherOverlayFlags
  onApplicationsClick(): void
  onCloseLauncher(): void
}

/** Applications button, backdrop dismiss, and Escape-to-close for launcher overlay. */
export function initYasbLauncherChrome(
  host: YasbLauncherChromeHost,
  doc: Document = document,
): void {
  doc.getElementById('btn-applications')?.addEventListener('click', e => {
    e.stopPropagation()
    host.onApplicationsClick()
  })
  doc.getElementById('launcher-backdrop')?.addEventListener('click', () => {
    host.onCloseLauncher()
  })
  doc.addEventListener(
    'keydown',
    ev => {
      if (ev.key !== 'Escape') return
      if (!launcherOverlayVisible(host.launcherOverlay)) return
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return
      ev.preventDefault()
      host.onCloseLauncher()
    },
    true,
  )
}
