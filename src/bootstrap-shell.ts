/**
 * Turns the HTML shell into the live desktop.
 * The terminal is now a lazy-loaded tile opened via the desktop tile or Ctrl+T.
 * Matrix rain defers via idle callback so first paint stays cheap.
 */
import { runBootSplash } from './boot-splash'
import { initThemeFromStorage } from './theme'
import { initRetroFxFromStorage } from './retro-fx'
import { initMatrixBg } from './matrix-bg'
import { initOsSound } from './os-sound'
import { initSystray, syncSettingsSoundToggle } from './os-systray'
import { loadSavedWallpaper } from './wallpaper'
import { Desktop } from './desktop'

export async function bootstrapShellUi(): Promise<void> {
  await runBootSplash()
  initThemeFromStorage()
  loadSavedWallpaper()
  initRetroFxFromStorage()
  initOsSound()
  initSystray()
  syncSettingsSoundToggle()

  const terminalWin = document.getElementById('terminal-window')
  const desktopEl = document.getElementById('desktop')
  const matrixCanvas = document.getElementById('matrix-bg') as HTMLCanvasElement | null

  if (!terminalWin || !desktopEl) {
    console.error('[bootstrap-shell] Missing #terminal-window or #desktop.')
    return
  }

  // Hide the static terminal pane — terminal is now a lazy tile.
  terminalWin.classList.add('terminal-closed')

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

  new Desktop(desktopEl, terminalWin, () => {})
}
