/**
 * Global Ctrl-chord dispatch for the desktop WM.
 */

import { isDesktopWmChordKey } from './desktop-keyboard-chords'
import type { SpatialDirection } from './desktop-spatial-focus'

export interface DesktopKeyboardHost {
  openTerminal(): void
  focusTaskbarIndex(index: number): void
  focusSpatial(dir: SpatialDirection): void
  closeFocusedOrTerminal(): void
  minimizeFocusedOrTerminal(): void
  toggleMaximizeFocused(): void
  toggleShowDesktop(): void
}

export function shouldInterceptDesktopChord(
  ev: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey'>,
): boolean {
  return ev.ctrlKey && !ev.altKey && !ev.metaKey
}

/** Returns true when the key is handled as a WM chord. */
export function dispatchDesktopKeyboard(
  key: string,
  host: DesktopKeyboardHost,
): boolean {
  const normalized = key.toLowerCase()
  if (!isDesktopWmChordKey(normalized)) return false

  if (normalized === 't') {
    host.openTerminal()
    return true
  }

  const n = parseInt(normalized, 10)
  if (n >= 1 && n <= 9) {
    host.focusTaskbarIndex(n - 1)
    return true
  }

  if (normalized === 'h') {
    host.focusSpatial('h')
    return true
  }
  if (normalized === 'l') {
    host.focusSpatial('l')
    return true
  }
  if (normalized === 'k') {
    host.focusSpatial('k')
    return true
  }
  if (normalized === 'j') {
    host.focusSpatial('j')
    return true
  }

  if (normalized === 'q') {
    host.closeFocusedOrTerminal()
    return true
  }

  if (normalized === 'm') {
    host.minimizeFocusedOrTerminal()
    return true
  }

  if (normalized === 'f') {
    host.toggleMaximizeFocused()
    return true
  }

  if (normalized === 'd') {
    host.toggleShowDesktop()
    return true
  }

  return false
}

export function handleDesktopGlobalKey(
  ev: KeyboardEvent,
  host: DesktopKeyboardHost,
): boolean {
  if (!shouldInterceptDesktopChord(ev)) return false
  const key = ev.key.toLowerCase()
  if (!dispatchDesktopKeyboard(key, host)) return false
  ev.preventDefault()
  ev.stopImmediatePropagation()
  return true
}
