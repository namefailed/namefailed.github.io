/**
 * YASB Applications button + launcher overlay dismiss wiring.
 */

import {
  launcherOverlayVisible,
  type LauncherOverlayFlags,
} from './desktop-launcher-overlay'

export interface YasbLauncherChromeHost {
  launcherOverlay: LauncherOverlayFlags
  onApplicationsClick(): void
  onCloseLauncher(): void
}

/** Applications button, backdrop dismiss, and Escape-to-close for launcher overlay. */
export function initYasbLauncherChrome(
  host: YasbLauncherChromeHost,
  doc: Document = document,
): void {
  doc.getElementById('btn-applications')?.addEventListener('click', e => {
    e.stopPropagation()
    host.onApplicationsClick()
  })
  doc.getElementById('launcher-backdrop')?.addEventListener('click', () => {
    host.onCloseLauncher()
  })
  doc.addEventListener(
    'keydown',
    ev => {
      if (ev.key !== 'Escape') return
      if (!launcherOverlayVisible(host.launcherOverlay)) return
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return
      ev.preventDefault()
      host.onCloseLauncher()
    },
    true,
  )
}
