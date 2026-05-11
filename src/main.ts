/**
 * Vite entry: CSS/fonts + bootstrap the interactive shell (`bootstrap-shell`).
 */
import '@xterm/xterm/css/xterm.css'
import './style.css'

import { bootstrapShellUi } from './bootstrap-shell'

void bootstrapShellUi()
