/**
 * Right-pane content window maximize state.
 */

import type { TiledWin } from './desktop-open-window'

export interface WmMaximizeContext {
  getMaximizedId(): string | null
  setMaximizedId(id: string | null): void
  panes: HTMLElement
  desktop: HTMLElement
  findOpenWindow(command: string): TiledWin | undefined
  unmaximizeContent(win: TiledWin): void
  syncDockVisibility(): void
  onAfterMaximizeLayout(): void
  attachVerticalSplitters(): void
  sync(): void
}

export function toggleMaximizeContent(ctx: WmMaximizeContext, win: TiledWin): void {
  if (win.isMaximized()) {
    unmaximizeContent(ctx, win)
    return
  }
  const contentId = ctx.getMaximizedId()
  if (contentId) {
    const other = ctx.findOpenWindow(contentId)
    if (other) ctx.unmaximizeContent(other)
  }

  win.el.classList.add('maximized')
  ctx.panes.classList.add('max-content')
  ctx.setMaximizedId(win.command)
  ctx.desktop.dataset.maximized = '1'
  ctx.syncDockVisibility()
  requestAnimationFrame(() => ctx.onAfterMaximizeLayout())
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
  if (!focusedId) return
  const w = ctx.findOpenWindow(focusedId)
  if (w) toggleMaximizeContent(ctx, w)
}
