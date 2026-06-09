/**
 * Turns the HTML shell into the live desktop.
 * Terminal is a lazy-loaded tile (Ctrl+T or dock). Matrix rain defers via idle callback.
 */
import { initThemeFromStorage } from './theme'
import { initRetroFxFromStorage } from './retro-fx'
import { initMatrixBg } from './matrix-bg'
import { initOsSound } from './os-sound'
import { initSystray, syncSettingsSoundToggle } from './os-systray'
import { loadSavedWallpaper } from './wallpaper'
import { dismissLegacyOnboardingUi } from './first-visit-flags'
import { Desktop } from './desktop'

export async function bootstrapShellUi(): Promise<void> {
  dismissLegacyOnboardingUi()
  initThemeFromStorage()
  loadSavedWallpaper()
  initRetroFxFromStorage()
  initOsSound()
  initSystray()
  syncSettingsSoundToggle()

  const desktopEl = document.getElementById('desktop')
  const matrixCanvas = document.getElementById('matrix-bg') as HTMLCanvasElement | null

  if (!desktopEl) {
    console.error('[bootstrap-shell] Missing #desktop.')
    return
  }

  const scheduleMatrixInit = (): void => {
    const canvas = matrixCanvas
    if (!canvas) return
    const run = (): void => {
      initMatrixBg(canvas, desktopEl)
      syncSettingsSoundToggle()
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2400 })
    } else {
      window.setTimeout(run, 16)
    }
  }
  scheduleMatrixInit()

  new Desktop(desktopEl)
}
