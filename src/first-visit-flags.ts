/**
 * First-visit experience flags in localStorage.
 *
 * Folder hint bubbles and other removed layers are silenced on boot.
 * The welcome guide (`welcome-guide.ts`) replays when `mrgrey-guide-seen` is cleared.
 */

import { storageRemove, storageSet } from './storage'
import { BOOT_SPLASH_KEY } from './boot-splash'
import { GUIDE_KEY } from './welcome-guide'

/** Legacy — old bundles auto-opened terminal once when unset. */
export const FIRST_RUN_KEY = 'mrgrey-first-run-done'

/** Removed onboarding layers — silenced on boot, cleared on reset. */
export const SUPPRESSED_LEGACY_KEYS = [
  FIRST_RUN_KEY,
  'mrgrey-toasts-seen',
  'mrgrey-hint-portfolio-folder',
  'mrgrey-hint-apps-folder',
  'mrgrey-hint-games-folder',
  'mrgrey-p5-tip-seen',
] as const

const PURGE_LEGACY_SELECTORS = '.hint-bubble, .intro-toast'

let legacyOnboardingObserver: MutationObserver | null = null

function purgeSuppressedOnboardingDom(root: ParentNode = document): void {
  root.querySelectorAll(PURGE_LEGACY_SELECTORS).forEach(el => el.remove())
}

function ensureLegacyOnboardingObserver(): void {
  if (legacyOnboardingObserver || typeof document === 'undefined') return

  const obs = new MutationObserver(() => purgeSuppressedOnboardingDom())
  const start = (): void => {
    if (!document.body || legacyOnboardingObserver) return
    legacyOnboardingObserver = obs
    obs.observe(document.body, { childList: true, subtree: true })
    purgeSuppressedOnboardingDom()
  }

  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}

/** Wipe first-visit flags (e.g. `cookies clear`, Full reset). */
export function clearFirstVisitFlags(): void {
  storageRemove(BOOT_SPLASH_KEY)
  storageRemove(GUIDE_KEY)
  for (const key of SUPPRESSED_LEGACY_KEYS) {
    storageRemove(key)
  }
}

/** Block removed hint/toast layers even if an old bundle is cached. */
export function dismissLegacyOnboardingUi(): void {
  for (const key of SUPPRESSED_LEGACY_KEYS) {
    storageSet(key, '1')
  }
  if (typeof document === 'undefined') return
  purgeSuppressedOnboardingDom()
  ensureLegacyOnboardingObserver()
}
