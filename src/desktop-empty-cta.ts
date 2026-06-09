/**
 * One-time desktop hint when no tiles are open — under the folder row, no modal chrome.
 */

import { GRID_CELL } from './desktop-tiles'
import { resolveStaticPortfolioHref } from './static-portfolio-href'
import { GUIDE_KEY } from './welcome-guide'
import { storageGet, storageSet } from './storage'

export const EMPTY_HINT_KEY = 'mrgrey-empty-hint-seen'

/** Permanently dismiss the empty-desktop hint for this browser profile. */
export function dismissDesktopEmptyHint(): void {
  storageSet(EMPTY_HINT_KEY, '1')
  document.querySelector('.desktop-empty-hint')?.remove()
}

export function mountDesktopEmptyCta(
  host: HTMLElement,
  onActivate: (cmd: string) => void,
): void {
  if (storageGet(EMPTY_HINT_KEY) === '1') return
  if (host.querySelector('.desktop-empty-hint')) return

  const hint = document.createElement('p')
  hint.className = 'desktop-empty-hint'
  hint.setAttribute('role', 'status')
  hint.style.left = `${GRID_CELL}px`
  hint.style.top = `${GRID_CELL * 2 + 8}px`

  const openBtn = document.createElement('button')
  openBtn.type = 'button'
  openBtn.className = 'desktop-empty-hint-action'
  openBtn.textContent = 'Résumé'
  openBtn.addEventListener('click', () => {
    dismissDesktopEmptyHint()
    onActivate('resume')
  })

  const classic = document.createElement('a')
  classic.className = 'desktop-empty-hint-action desktop-empty-hint-action--link'
  classic.href = resolveStaticPortfolioHref()
  classic.textContent = 'Classic view'
  classic.addEventListener('click', () => dismissDesktopEmptyHint())

  hint.append('Open ', openBtn, ' or use the Portfolio folder · ', classic)
  host.appendChild(hint)
}

/** Show once after the welcome guide is dismissed; never again after dismiss or first window open. */
export function syncDesktopEmptyCta(host: HTMLElement, openWindowCount: number): void {
  if (storageGet(EMPTY_HINT_KEY) === '1') {
    host.querySelector('.desktop-empty-hint')?.remove()
    return
  }

  const hint = host.querySelector<HTMLElement>('.desktop-empty-hint')
  if (!hint) return

  if (openWindowCount > 0) {
    dismissDesktopEmptyHint()
    return
  }

  const guideOpen = storageGet(GUIDE_KEY) !== '1'
  hint.hidden = guideOpen
}
