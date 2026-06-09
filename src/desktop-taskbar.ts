/**
 * Taskbar dock rendering, YASB focused title, and auto-hide hover zone.
 */

import type { MinimizedEntry, TiledWin } from './desktop-open-window'
import {
  attachLazyPrefetchHandlers,
  LAUNCHER_ICON_ROWS,
  PINNED_DOCK_CMDS,
} from './launcher-catalog'

type AppIconRow = { kind: 'app'; cmd: string; label: string; glyph: string }

const ICON_META_BY_CMD = new Map<string, AppIconRow>(
  LAUNCHER_ICON_ROWS
    .filter((r): r is AppIconRow => r.kind === 'app')
    .map(r => [r.cmd, r]),
)

/** Fast O(1) lookup of dock button glyph + label by command id. */
export function taskbarIconMeta(cmd: string): { glyph: string; label: string } {
  if (cmd === 'terminal') return { glyph: '~', label: 'Terminal' }
  return ICON_META_BY_CMD.get(cmd) ?? { glyph: '?', label: cmd }
}

/** Open windows first (tile order), then minimized — deduped by command id. */
export function orderedDockCommands(
  openCommands: readonly string[],
  minimizedCommands: readonly string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const cmd of openCommands) {
    if (!seen.has(cmd)) {
      seen.add(cmd)
      out.push(cmd)
    }
  }
  for (const cmd of minimizedCommands) {
    if (!seen.has(cmd)) {
      seen.add(cmd)
      out.push(cmd)
    }
  }
  return out
}

/** Running/minimized commands that are not pinned in the dock. */
export function extraDockCommands(
  dockOrder: readonly string[],
  pinned: readonly string[] = PINNED_DOCK_CMDS,
): string[] {
  const pinnedSet = new Set(pinned)
  return dockOrder.filter(cmd => !pinnedSet.has(cmd))
}

/** Open windows first (tile order), then minimized — as live window refs. */
export function resolveDockWindows(
  windows: readonly TiledWin[],
  minimized: readonly MinimizedEntry[],
): TiledWin[] {
  const order = orderedDockCommands(
    windows.map(w => w.command),
    minimized.map(m => m.win.command),
  )
  const byCmd = new Map<string, TiledWin>()
  for (const w of windows) byCmd.set(w.command, w)
  for (const { win } of minimized) {
    if (!byCmd.has(win.command)) byCmd.set(win.command, win)
  }
  return order.map(cmd => byCmd.get(cmd)!).filter(Boolean)
}

export function buildTaskbarDockSnapshot(
  focusedId: string | null,
  openCommands: readonly string[],
  minimizedCommands: readonly string[],
): TaskbarDockSnapshot {
  const dockOrder = orderedDockCommands(openCommands, minimizedCommands)
  return {
    focusedId,
    openCommands,
    minimizedCommands,
    extraCommands: extraDockCommands(dockOrder),
  }
}

export type TaskbarPinnedAction =
  | { type: 'minimize-terminal-tile' }
  | { type: 'open-terminal-tile' }
  | { type: 'open-command'; cmd: string }

export function taskbarPinnedAction(
  cmd: string,
  hasTerminalTile: boolean,
  terminalFocused: boolean,
): TaskbarPinnedAction {
  if (cmd !== 'terminal') return { type: 'open-command', cmd }
  if (hasTerminalTile && terminalFocused) return { type: 'minimize-terminal-tile' }
  return { type: 'open-terminal-tile' }
}

export function focusedTitleLabel(
  focusedId: string | null,
  openWindowCount: number,
): string {
  if (focusedId !== null) {
    if (focusedId === 'terminal') return 'namefailed@dev — ~/terminal'
    return taskbarIconMeta(focusedId).label
  }
  return openWindowCount === 0 ? 'mrgrey.site' : '—'
}

export function syncYasbFocusedTitle(
  focusedId: string | null,
  openWindowCount: number,
  doc: Document = document,
): void {
  const el = doc.getElementById('yasb-focused')
  if (!el) return
  el.textContent = focusedTitleLabel(focusedId, openWindowCount)
}

/** Sync dock auto-hide state: normal = always-visible; maximized = auto-hide. */
export function syncDockAutoHide(taskbarDock: HTMLElement, maximized: boolean): void {
  const taskbar = taskbarDock.closest<HTMLElement>('#wm-taskbar')
  if (!taskbar) return
  taskbar.classList.toggle('dock--auto-hide', maximized)
  if (!maximized) {
    taskbar.classList.remove('dock--visible')
  }
}

export interface TaskbarDockSnapshot {
  focusedId: string | null
  openCommands: readonly string[]
  minimizedCommands: readonly string[]
  extraCommands: readonly string[]
}

export interface TaskbarDockHandlers {
  onPinnedClick: (cmd: string) => void
  onExtraClick: (cmd: string) => void
}

function appendTaskButton(
  dock: HTMLElement,
  opts: {
    cmd: string
    glyph: string
    label: string
    active: boolean
    minimized: boolean
    idle?: boolean
  },
  onClick: () => void,
  prefetchCmd?: string,
): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'wm-task-btn'
  btn.dataset.cmd = opts.cmd
  if (opts.active) btn.classList.add('wm-task-btn--active')
  if (opts.minimized) btn.classList.add('wm-task-btn--minimized')
  if (opts.idle) btn.classList.add('wm-task-btn--idle')
  btn.title = opts.label
  btn.setAttribute('aria-label', opts.label)

  const gl = document.createElement('span')
  gl.className = 'wm-task-glyph'
  gl.setAttribute('aria-hidden', 'true')
  gl.textContent = opts.glyph
  btn.appendChild(gl)

  const lab = document.createElement('span')
  lab.className = 'wm-task-label'
  lab.textContent = opts.label
  btn.appendChild(lab)

  if (prefetchCmd) attachLazyPrefetchHandlers(btn, prefetchCmd)
  btn.addEventListener('click', onClick)
  dock.appendChild(btn)
}

/** Rebuild pinned + extra dock buttons from WM snapshot state. */
export function renderTaskbarDock(
  dock: HTMLElement,
  snapshot: TaskbarDockSnapshot,
  handlers: TaskbarDockHandlers,
): void {
  dock.replaceChildren()

  const openSet = new Set(snapshot.openCommands)
  const minSet = new Set(snapshot.minimizedCommands)

  for (const cmd of PINNED_DOCK_CMDS) {
    const meta = taskbarIconMeta(cmd)
    const isRunning = openSet.has(cmd) || minSet.has(cmd)
    appendTaskButton(
      dock,
      {
        cmd,
        glyph: meta.glyph,
        label: meta.label,
        active: snapshot.focusedId === cmd,
        minimized: minSet.has(cmd),
        idle: !isRunning,
      },
      () => handlers.onPinnedClick(cmd),
      cmd === 'terminal' ? undefined : cmd,
    )
  }

  if (snapshot.extraCommands.length > 0) {
    const sep = document.createElement('div')
    sep.className = 'wm-dock-sep'
    sep.setAttribute('role', 'separator')
    sep.setAttribute('aria-hidden', 'true')
    dock.appendChild(sep)

    for (const cmd of snapshot.extraCommands) {
      const meta = taskbarIconMeta(cmd)
      appendTaskButton(
        dock,
        {
          cmd,
          glyph: meta.glyph,
          label: meta.label,
          active: snapshot.focusedId === cmd,
          minimized: minSet.has(cmd),
        },
        () => handlers.onExtraClick(cmd),
        cmd,
      )
    }
  }
}

/**
 * Hover-zone strip: reveals the dock on cursor reaching the bottom edge.
 * Only hides again when in auto-hide mode (a window is maximized).
 */
export function wireDockHoverZone(
  taskbarDock: HTMLElement,
  doc: Document = document,
): void {
  const taskbar = taskbarDock.closest<HTMLElement>('#wm-taskbar')
  if (!taskbar) return

  const zone = doc.createElement('div')
  zone.className = 'dock-hover-zone'
  doc.body.appendChild(zone)

  let hideTimer: ReturnType<typeof setTimeout> | null = null

  const reveal = (): void => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
    taskbar.classList.add('dock--visible')
  }

  const scheduleHide = (): void => {
    if (hideTimer !== null) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      hideTimer = null
      if (taskbar.classList.contains('dock--auto-hide')) {
        taskbar.classList.remove('dock--visible')
      }
    }, 420)
  }

  zone.addEventListener('pointerenter', reveal)
  taskbar.addEventListener('pointerenter', reveal)
  taskbar.addEventListener('pointerleave', e => {
    if (!(e.relatedTarget instanceof Node) || !taskbar.contains(e.relatedTarget as Node)) {
      scheduleHide()
    }
  })
}
