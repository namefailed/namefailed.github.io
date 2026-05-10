/** Holds the active `Desktop` for commands like `ps` without importing desktop.ts (avoids circular deps). */
import type { Desktop } from './desktop'

let desktopRef: Desktop | null = null

export function setDesktopRef(d: Desktop): void {
  desktopRef = d
}

export function getDesktopRef(): Desktop | null {
  return desktopRef
}
