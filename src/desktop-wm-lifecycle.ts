/**
 * Tiled window close, minimize, and restore-from-dock lifecycle.
 */

import type { MinimizedEntry, TiledWin } from './desktop-open-window'
import { animateWmThenRemove } from './desktop-wm-animations'

export interface WmLifecycleContext {
  readonly windows: TiledWin[]
  readonly minimized: MinimizedEntry[]
  getFocusedId(): string | null
  prefersReducedMotion(): boolean
  unmaximizeContent(win: TiledWin): void
  focusTerminalIfAlreadyVisible(): void
  attachVerticalSplitters(): void
  sync(): void
  appendToRightPane(win: TiledWin): void
  focusWindow(win: TiledWin): void
  closeLauncherOverlay(): void
}

export function closeTiledWindow(ctx: WmLifecycleContext, win: TiledWin): void {
  if (ctx.windows.indexOf(win) === -1) return
  if (win.el.classList.contains('wm-animate-close')) return
  if (win.isMaximized()) ctx.unmaximizeContent(win)

  const el = win.el
  const command = win.command
  const finalizeClose = (): void => {
    const i = ctx.windows.indexOf(win)
    if (i === -1) return
    ;(win as { dispose?: () => void }).dispose?.()
    el.remove()
    ctx.windows.splice(i, 1)
    if (ctx.getFocusedId() === command) ctx.focusTerminalIfAlreadyVisible()
    ctx.attachVerticalSplitters()
    ctx.sync()
  }

  animateWmThenRemove(el, finalizeClose, { reducedMotion: ctx.prefersReducedMotion() })
}

export function minimizeTiledWindow(ctx: WmLifecycleContext, win: TiledWin): void {
  if (ctx.windows.indexOf(win) === -1) return
  if (win.el.classList.contains('wm-animate-close')) return
  if (win.isMaximized()) ctx.unmaximizeContent(win)

  const el = win.el
  const command = win.command
  const finalize = (): void => {
    const idx = ctx.windows.indexOf(win)
    if (idx === -1) return
    win.setMinimized(true)
    el.remove()
    ctx.windows.splice(idx, 1)
    ctx.minimized.push({ win })
    if (ctx.getFocusedId() === command) ctx.focusTerminalIfAlreadyVisible()
    ctx.attachVerticalSplitters()
    ctx.sync()
  }

  animateWmThenRemove(el, finalize, { reducedMotion: ctx.prefersReducedMotion() })
}

export function restoreMinimizedWindow(
  ctx: WmLifecycleContext,
  entry: MinimizedEntry,
): void {
  const i = ctx.minimized.indexOf(entry)
  if (i === -1) return
  ctx.minimized.splice(i, 1)

  ctx.closeLauncherOverlay()

  entry.win.setMinimized(false)
  ctx.appendToRightPane(entry.win)
  ctx.windows.push(entry.win)
  ctx.attachVerticalSplitters()
  ctx.focusWindow(entry.win)
}
