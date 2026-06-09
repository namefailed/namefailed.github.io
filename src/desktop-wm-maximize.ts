/**
 * Terminal column vs right-pane content maximize state.
 */

import { TERMINAL_TILE_SENTINEL } from './launcher-catalog'
import type { TiledWin } from './desktop-open-window'

export interface WmMaximizeContext {
  getMaximizedId(): string | null
  setMaximizedId(id: string | null): void
  termWin: HTMLElement
  panes: HTMLElement
  desktop: HTMLElement
  findOpenWindow(command: string): TiledWin | undefined
  unmaximizeContent(win: TiledWin): void
  syncDockVisibility(): void
  fitTerminal(): void
  attachVerticalSplitters(): void
  sync(): void
}

export function maximizeTargetKind(
  focusedId: string | null,
): 'terminal' | 'content' | 'none' {
  if (focusedId === null) return 'terminal'
  return 'content'
}

export function maximizeTerminal(ctx: WmMaximizeContext): void {
  if (ctx.getMaximizedId() === TERMINAL_TILE_SENTINEL) {
    unmaximizeTerminal(ctx)
    return
  }
  const contentId = ctx.getMaximizedId()
  if (contentId && contentId !== TERMINAL_TILE_SENTINEL) {
    const w = ctx.findOpenWindow(contentId)
    if (w) ctx.unmaximizeContent(w)
  }
  ctx.termWin.classList.add('maximized')
  ctx.panes.classList.add('max-terminal')
  ctx.setMaximizedId(TERMINAL_TILE_SENTINEL)
  ctx.desktop.dataset.maximized = '1'
  ctx.syncDockVisibility()
  requestAnimationFrame(() => ctx.fitTerminal())
}

export function unmaximizeTerminal(ctx: WmMaximizeContext): void {
  ctx.termWin.classList.remove('maximized')
  ctx.panes.classList.remove('max-terminal')
  if (ctx.getMaximizedId() === TERMINAL_TILE_SENTINEL) ctx.setMaximizedId(null)
  ctx.desktop.dataset.maximized = ctx.getMaximizedId() !== null ? '1' : '0'
  ctx.syncDockVisibility()
  requestAnimationFrame(() => ctx.fitTerminal())
}

export function toggleMaximizeContent(ctx: WmMaximizeContext, win: TiledWin): void {
  if (win.isMaximized()) {
    unmaximizeContent(ctx, win)
    return
  }
  if (ctx.getMaximizedId() === TERMINAL_TILE_SENTINEL) unmaximizeTerminal(ctx)
  const contentId = ctx.getMaximizedId()
  if (contentId && contentId !== TERMINAL_TILE_SENTINEL) {
    const other = ctx.findOpenWindow(contentId)
    if (other) ctx.unmaximizeContent(other)
  }

  win.el.classList.add('maximized')
  ctx.panes.classList.add('max-content')
  ctx.setMaximizedId(win.command)
  ctx.desktop.dataset.maximized = '1'
  ctx.syncDockVisibility()
  requestAnimationFrame(() => ctx.fitTerminal())
}

export function unmaximizeContent(ctx: WmMaximizeContext, win: TiledWin): void {
  if (!win.isMaximized()) return
  win.el.classList.remove('maximized')
  ctx.panes.classList.remove('max-content')
  if (ctx.getMaximizedId() === win.command) ctx.setMaximizedId(null)
  ctx.attachVerticalSplitters()
  ctx.sync()
}

export function toggleMaximizeFocused(
  ctx: WmMaximizeContext,
  focusedId: string | null,
): void {
  const kind = maximizeTargetKind(focusedId)
  if (kind === 'terminal') {
    maximizeTerminal(ctx)
    return
  }
  if (kind === 'content' && focusedId) {
    const w = ctx.findOpenWindow(focusedId)
    if (w) toggleMaximizeContent(ctx, w)
  }
}
