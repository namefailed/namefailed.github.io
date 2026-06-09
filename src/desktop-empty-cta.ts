/**
 * Non-modal desktop hint when no tiles are open — quick paths for recruiters.
 */

import { resolveStaticPortfolioHref } from './static-portfolio-href'

export function mountDesktopEmptyCta(
  host: HTMLElement,
  onActivate: (cmd: string) => void,
): void {
  if (host.querySelector('.desktop-empty-cta')) return

  const classicHref = resolveStaticPortfolioHref()

  const bar = document.createElement('div')
  bar.className = 'desktop-empty-cta'
  bar.setAttribute('role', 'region')
  bar.setAttribute('aria-label', 'Quick start')

  const lead = document.createElement('p')
  lead.className = 'desktop-empty-cta-lead'
  lead.textContent = 'Open to work — pick a starting point:'

  const actions = document.createElement('div')
  actions.className = 'desktop-empty-cta-actions'

  const mkBtn = (label: string, cmd: string, primary = false): HTMLButtonElement => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = primary ? 'desktop-empty-cta-btn desktop-empty-cta-btn--primary' : 'desktop-empty-cta-btn'
    btn.textContent = label
    btn.addEventListener('click', () => onActivate(cmd))
    return btn
  }

  const classic = document.createElement('a')
  classic.className = 'desktop-empty-cta-link'
  classic.href = classicHref
  classic.textContent = 'Classic résumé view'

  actions.append(
    mkBtn('Portfolio', 'portfolio', true),
    mkBtn('Résumé', 'resume'),
    mkBtn('Projects', 'projects'),
    mkBtn('Contact', 'links'),
    classic,
  )

  bar.append(lead, actions)
  host.appendChild(bar)
}

/** Show when the WM has zero open tiles; hide once anything is tiled. */
export function syncDesktopEmptyCta(host: HTMLElement, openWindowCount: number): void {
  const bar = host.querySelector<HTMLElement>('.desktop-empty-cta')
  if (!bar) return
  const show = openWindowCount === 0
  bar.hidden = !show
  bar.classList.toggle('desktop-empty-cta--visible', show)
}
