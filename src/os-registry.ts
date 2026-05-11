/** Holds the active `Desktop` for commands like `ps` without importing desktop.ts (avoids circular deps). */
import type { Desktop } from './desktop'

let desktopRef: Desktop | null = null

export function setDesktopRef(desktop: Desktop): void {
  desktopRef = desktop
}

export function getDesktopRef(): Desktop | null {
  return desktopRef
}
