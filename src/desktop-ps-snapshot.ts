/**
 * Simulated `ps` output for the terminal MOTD / wm status commands.
 */

import type { MinimizedEntry, TiledWin } from './desktop-open-window'

export interface PsSnapshotRow {
  pid: number
  tty: string
  stat: string
  time: string
  cmd: string
}

export function buildPsSnapshot(
  windows: readonly TiledWin[],
  minimized: readonly MinimizedEntry[],
  focusedId: string | null,
): PsSnapshotRow[] {
  const rows: PsSnapshotRow[] = []
  let pid = 400
  rows.push({ pid: pid++, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' })
  for (const w of windows) {
    rows.push({
      pid: pid++,
      tty: 'wm-pty',
      stat: focusedId === w.command ? 'Sl+' : 'Sl',
      time: '0:00',
      cmd: w.command,
    })
  }
  for (const { win } of minimized) {
    rows.push({
      pid: pid++,
      tty: 'wm-pty',
      stat: 'T',
      time: '0:00',
      cmd: `${win.command} (minimized)`,
    })
  }
  return rows
}
