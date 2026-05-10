/**
 * Bootstrap: theme, CRT flag, audio, clock menu, tiling shell, terminal.
 * Theme before xterm (palette); construct `Desktop` before `TerminalApp` so `fit`
 * closes over the mounted app instance.
 */
import '@xterm/xterm/css/xterm.css'
import './style.css'
import { initThemeFromStorage } from './theme'
import { initRetroFxFromStorage } from './retro-fx'
import { initMatrixBg } from './matrix-bg'
import { initOsSound } from './os-sound'
import { initSystray, syncSettingsSoundToggle } from './os-systray'
import { TerminalApp } from './terminal'
import { Desktop } from './desktop'

initThemeFromStorage()
initRetroFxFromStorage()
initOsSound()
initSystray()
syncSettingsSoundToggle()

const terminalEl = document.getElementById('terminal')!
const terminalWin = document.getElementById('terminal-window')!
const vimModeLine = document.getElementById('vim-mode-line') as HTMLElement | null
const desktopEl = document.getElementById('desktop')!
const matrixCanvas = document.getElementById('matrix-bg') as HTMLCanvasElement | null
function scheduleMatrixInit(): void {
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

void app.mount().then(() => {
  document.querySelector<HTMLAnchorElement>('a.skip-link')?.addEventListener('click', e => {
    e.preventDefault()
    app.focusShell()
  })
})
