/**
 * Per-tile focus subtargets after WM focus state is updated.
 */

import type { BrowserWindow } from './browser-window'
import type { EditorWindow } from './editor-window'
import type { FileExplorerWindow } from './file-explorer-window'
import type { TiledWin } from './desktop-open-window'
import type { PaintWindow } from './paint-window'
import type { PongWindow } from './pong-window'
import type { SnakeWindow } from './snake-window'
import type { TerminalWindow } from './terminal'

/** Focus terminal if open, else the topmost remaining tile, else clear WM focus. */
export function focusTerminalTileIfVisible(
  windows: readonly TiledWin[],
  host: {
    focusWindow(win: TiledWin): void
    clearUnfocused(): void
  },
): void {
  const termTile = windows.find(w => w.command === 'terminal')
  if (termTile) {
    host.focusWindow(termTile)
    return
  }
  const fallback = windows[windows.length - 1]
  if (fallback) {
    host.focusWindow(fallback)
    return
  }
  host.clearUnfocused()
}

/** Route focus into the active tile's primary input surface. */
export function focusSubtarget(win: TiledWin): void {
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
