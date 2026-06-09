/**
 * Vite entry: CSS/fonts + bootstrap the interactive shell (`bootstrap-shell`).
 */
import '@xterm/xterm/css/xterm.css'
import './style.css'

import { bootstrapShellUi } from './bootstrap-shell'

void bootstrapShellUi().catch((err: unknown) => {
  console.error('[main] bootstrap failed:', err)
  const msg = err instanceof Error ? err.message : String(err)
  const alert = document.createElement('div')
  alert.setAttribute('role', 'alert')
  alert.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'padding:2rem;background:rgba(17,17,27,0.92);color:#f38ba8;font-family:monospace;' +
    'font-size:0.95rem;text-align:center;z-index:99999'
  alert.textContent = `Failed to start desktop: ${msg}`
  document.body.appendChild(alert)
})
