/** I stash the live `Desktop` here so `ps` et al. don’t import `desktop.ts` and create cycles. */
import type { Desktop } from './desktop'

let desktopRef: Desktop | null = null

export function setDesktopRef(d: Desktop): void {
  desktopRef = d
}

export function getDesktopRef(): Desktop | null {
  return desktopRef
}
