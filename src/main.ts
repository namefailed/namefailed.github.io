/**
 * Entry point: I apply theme/retro, init sounds + the clock menu, then spin up
 * `Desktop` and `TerminalApp`. Order matters when I debug first paint (theme before
 * xterm colors; construct desktop before terminal so `fit` closes over `app`).
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

const terminalEl = document.getElementById('terminal')!
const terminalWin = document.getElementById('terminal-window')!
const vimModeLine = document.getElementById('vim-mode-line') as HTMLElement | null
const desktopEl = document.getElementById('desktop')!
const matrixCanvas = document.getElementById('matrix-bg') as HTMLCanvasElement | null
if (matrixCanvas) {
  initMatrixBg(matrixCanvas, desktopEl)
  syncSettingsSoundToggle()
}

let app!: TerminalApp
const desktop = new Desktop(desktopEl, terminalWin, () => app.fit())
app = new TerminalApp(terminalEl, vimModeLine, spec => desktop.openWindow(spec))

app.mount()
