/**
 * Cap on simultaneously visible tiled windows — bump oldest non-focused to dock.
 */

import type { MinimizedEntry, TiledWin } from './desktop-open-window'

export interface TileLimitHost {
  readonly windows: TiledWin[]
  readonly minimized: MinimizedEntry[]
  readonly maxVisible: number
  getFocusedId(): string | null
  setFocusedId(id: string | null): void
  unmaximizeContent(win: TiledWin): void
  onWindowBumped?: (win: TiledWin) => void
}

/** Pick the window to minimize when at the tile cap (oldest open window first). */
export function pickTileLimitBump(windows: readonly TiledWin[]): TiledWin | null {
  return windows[0] ?? null
}

export function enforceTileLimit(host: TileLimitHost): void {
  if (host.windows.length < host.maxVisible) return
  const bump = pickTileLimitBump(host.windows)
  if (!bump) return
  if (bump.isMaximized()) host.unmaximizeContent(bump)
  bump.setMinimized(true)
  bump.el.remove()
  const idx = host.windows.indexOf(bump)
  if (idx !== -1) host.windows.splice(idx, 1)
  host.minimized.push({ win: bump })
  if (host.getFocusedId() === bump.command) host.setFocusedId(null)
  host.onWindowBumped?.(bump)
}
