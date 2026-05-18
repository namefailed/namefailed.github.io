/**
 * Single source of truth for first-visit experience flags stored in localStorage.
 *
 * Both `cookies clear` (terminal) and the "Full Reset" systray button use
 * `clearFirstVisitFlags()` so they always wipe the same keys and stay in sync.
 * Storage errors (private browsing, quota) are silently swallowed via storageRemove.
 */

import { storageRemove } from './storage'
import { BOOT_SPLASH_KEY } from './boot-splash'
import { GUIDE_KEY } from './welcome-guide'
import { INTRO_TOASTS_KEY } from './intro-toasts'
import { HINTS, hintKey } from './hint-bubbles'

/** Wipe all first-visit flags so the full intro flow replays on next load.
 *  Does NOT touch theme, CRT, matrix, sound, apt, or wallpaper preferences. */
export function clearFirstVisitFlags(): void {
  storageRemove(BOOT_SPLASH_KEY)
  storageRemove(GUIDE_KEY)
  storageRemove(INTRO_TOASTS_KEY)
  for (const hint of HINTS) {
    storageRemove(hintKey(hint.targetCmd))
  }
}
