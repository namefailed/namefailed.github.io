/**
 * Turns the HTML shell into the live desktop + terminal app.
 *
 * Ordering is annoying but deliberate: palettes and systray state land before xterm,
 * Desktop is constructed before TerminalApp passes `openWindow` so `fit()` always
 * closes over real tiles, Matrix rain defers via idle callback so first paint stays cheap.
 */
import { runBootSplash } from './boot-splash'
import { initThemeFromStorage } from './theme'
import { initRetroFxFromStorage } from './retro-fx'
import { initMatrixBg } from './matrix-bg'
import { initOsSound } from './os-sound'
import { initSystray, syncSettingsSoundToggle } from './os-systray'
import { TerminalApp } from './terminal'
import { Desktop } from './desktop'

export async function bootstrapShellUi(): Promise<void> {
  await runBootSplash()
  initThemeFromStorage()
  initRetroFxFromStorage()
  initOsSound()
  initSystray()
  syncSettingsSoundToggle()

  const terminalEl = document.getElementById('terminal')
  const terminalWin = document.getElementById('terminal-window')
  const vimModeLine = document.getElementById('vim-mode-line') as HTMLElement | null
  const desktopEl = document.getElementById('desktop')
  const matrixCanvas = document.getElementById('matrix-bg') as HTMLCanvasElement | null

  if (!terminalEl || !terminalWin || !desktopEl) {
    console.error('[bootstrap-shell] Missing #terminal, #terminal-window, or #desktop.')
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

  let app!: TerminalApp
  const desktop = new Desktop(desktopEl, terminalWin, () => app.fit())
  app = new TerminalApp(terminalEl, vimModeLine, spec => void desktop.openWindow(spec))

  window.addEventListener('mrgrey-theme-change', () => app.syncXtermTheme())

  await app.mount()
  document.querySelector<HTMLAnchorElement>('a.skip-link')?.addEventListener('click', e => {
    e.preventDefault()
    app.focusShell()
  })
}
