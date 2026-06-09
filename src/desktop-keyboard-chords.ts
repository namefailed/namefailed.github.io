/** Ctrl-chords reserved by the desktop WM (intercepted before xterm/vim). */

export const DESKTOP_WM_CHORD_KEYS = new Set([
  't', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'h', 'l', 'j', 'k', 'q', 'm', 'd', 'f',
])

export function isDesktopWmChordKey(key: string): boolean {
  return DESKTOP_WM_CHORD_KEYS.has(key)
}
