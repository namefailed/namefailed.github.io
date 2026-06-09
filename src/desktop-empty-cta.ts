/**
 * Subtle desktop hint when no tiles are open — sits under the folder row, no modal chrome.
 */

import { GRID_CELL } from './desktop-tiles'
import { resolveStaticPortfolioHref } from './static-portfolio-href'
import { GUIDE_KEY } from './welcome-guide'
import { storageGet } from './storage'

export function mountDesktopEmptyCta(
  host: HTMLElement,
  onActivate: (cmd: string) => void,
): void {
  if (host.querySelector('.desktop-empty-hint')) return

  const hint = document.createElement('p')
  hint.className = 'desktop-empty-hint'
  hint.setAttribute('role', 'status')
  hint.style.left = `${GRID_CELL}px`
  hint.style.top = `${GRID_CELL * 2 + 8}px`

  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.className = 'desktop-empty-hint-action'
  openBtn.textContent = 'Portfolio'
  openBtn.addEventListener('click', () => onActivate('portfolio'))

  const classic = document.createElement('a')
  classic.className = 'desktop-empty-hint-action desktop-empty-hint-action--link'
  classic.href = resolveStaticPortfolioHref()
  classic.textContent = 'Classic view'

  hint.append('Open ', openBtn, ' for résumé & work · ', classic)
  host.appendChild(hint)
}

/** Show when the WM has zero open tiles and the welcome guide is dismissed. */
export function syncDesktopEmptyCta(host: HTMLElement, openWindowCount: number): void {
  const hint = host.querySelector<HTMLElement>('.desktop-empty-hint')
  if (!hint) return
  const guideOpen = storageGet(GUIDE_KEY) !== '1'
  const show = openWindowCount === 0 && !guideOpen
  hint.hidden = !show
}
