/**
 * Static launcher icon grid in the Applications overlay (#desktop-icons).
 */

import type { WindowSpec } from './appwindow'
import { attachLazyPrefetchHandlers, LAUNCHER_ICON_ROWS } from './launcher-catalog'
import { launcherIconWindowSpec } from './desktop-window-spec'

function makeIconGlyph(glyph: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'desktop-icon-glyph'
  span.setAttribute('aria-hidden', 'true')
  span.textContent = glyph
  return span
}

function makeIconLabel(label: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.className = 'desktop-icon-label'
  span.textContent = label
  return span
}

export interface LauncherGridHost {
  openWindow(spec: WindowSpec): void
}

/** Populate #desktop-icons from `LAUNCHER_ICON_ROWS`. */
export function mountLauncherIconGrid(
  host: LauncherGridHost,
  doc: Document = document,
): void {
  const root = doc.getElementById('desktop-icons')
  if (!root) return

  for (const item of LAUNCHER_ICON_ROWS) {
    const btn = doc.createElement('button')
    btn.type = 'button'
    btn.className = 'desktop-icon'
    if (item.kind === 'terminal') {
      btn.appendChild(makeIconGlyph(item.glyph))
      btn.appendChild(makeIconLabel(item.label))
      btn.addEventListener('click', () => {
        host.openWindow({ command: 'terminal', title: 'terminal', content: [] })
      })
    } else {
      const spec = launcherIconWindowSpec(item.cmd)
      if (!spec) continue
      btn.appendChild(makeIconGlyph(item.glyph))
      btn.appendChild(makeIconLabel(item.label))
      attachLazyPrefetchHandlers(btn, item.cmd)
      btn.addEventListener('click', () => {
        host.openWindow(spec)
      })
    }
    root.appendChild(btn)
  }
}
