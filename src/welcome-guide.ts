/**
 * First-visit welcome guide — a persistent "clippy-style" card that
 * explains the site and dismisses once you interact with it.
 *
 * Listens for two custom events dispatched by the desktop / terminal:
 *   - 'mrgrey-first-window'  → user opened their first app tile
 *   - 'mrgrey-terminal-cmd'  → user executed a terminal command
 *
 * Either action checks off the relevant tip, then the card fades out.
 * Replay via the "Reset experience" button in the system menu.
 */

import { storageGet, storageSet } from './storage'

export const GUIDE_KEY = 'mrgrey-guide-seen'

const TIPS: Array<{ id: string; glyph: string; html: string }> = [
  {
    id: 'open',
    glyph: '◐',
    html: 'Click <strong>Portfolio</strong>, <strong>Apps</strong>, or <strong>Games</strong> to open a tile',
  },
  {
    id: 'terminal',
    glyph: '~',
    html: 'Try the terminal — type <code>help</code> or <code>resume</code>',
  },
  {
    id: 'drag',
    glyph: '⠿',
    html: 'Drag the folder icons to rearrange the desktop',
  },
  {
    id: 'keys',
    glyph: '⌨',
    html: '<kbd>Ctrl+T</kbd> focuses terminal &nbsp;·&nbsp; <kbd>Ctrl+D</kbd> opens launcher',
  },
]

export function mountWelcomeGuide(): void {
  if (typeof window === 'undefined') return
  if (storageGet(GUIDE_KEY) === '1') return

  // ── Build card ────────────────────────────────────────────────────────────

  const card = document.createElement('div')
  card.className = 'welcome-guide'
  card.setAttribute('role', 'complementary')
  card.setAttribute('aria-label', 'Welcome guide')

  // Header
  const header = document.createElement('div')
  header.className = 'welcome-guide-header'

  const title = document.createElement('span')
  title.className = 'welcome-guide-title'
  title.innerHTML = `<span aria-hidden="true" class="welcome-guide-glyph">◆</span> Hey — I'm Matt`

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'welcome-guide-close'
  closeBtn.setAttribute('aria-label', 'Dismiss guide')
  closeBtn.textContent = '✕'

  header.appendChild(title)
  header.appendChild(closeBtn)
  card.appendChild(header)

  // Body
  const body = document.createElement('div')
  body.className = 'welcome-guide-body'

  const intro = document.createElement('p')
  intro.className = 'welcome-guide-intro'
  intro.textContent = 'This portfolio is a tiling window manager. Here\'s how it works:'
  body.appendChild(intro)

  const list = document.createElement('ul')
  list.className = 'welcome-guide-tips'

  for (const tip of TIPS) {
    const li = document.createElement('li')
    li.className = 'welcome-guide-tip'
    li.dataset.tip = tip.id

    const check = document.createElement('span')
    check.className = 'wg-bullet'
    check.setAttribute('aria-hidden', 'true')
    check.textContent = tip.glyph

    const text = document.createElement('span')
    text.innerHTML = tip.html

    li.appendChild(check)
    li.appendChild(text)
    list.appendChild(li)
  }

  body.appendChild(list)
  card.appendChild(body)

  document.body.appendChild(card)

  // ── Dismiss logic ─────────────────────────────────────────────────────────

  let dismissed = false

  const dismiss = (delay = 0): void => {
    if (dismissed) return
    dismissed = true
    storageSet(GUIDE_KEY, '1')
    const go = (): void => {
      card.classList.add('welcome-guide--out')
      window.setTimeout(() => card.remove(), 380)
    }
    if (delay > 0) window.setTimeout(go, delay)
    else go()
  }

  const markDone = (tipId: string, thenDismiss = true): void => {
    const li = card.querySelector<HTMLElement>(`[data-tip="${tipId}"]`)
    if (!li) return
    li.classList.add('wg-tip--done')
    const bullet = li.querySelector('.wg-bullet')
    if (bullet) bullet.textContent = '✓'
    if (thenDismiss) dismiss(1200)
  }

  closeBtn.addEventListener('click', () => dismiss())

  // Auto-dismiss on first window open
  const onFirstWindow = (): void => {
    markDone('open')
    window.removeEventListener('mrgrey-terminal-cmd', onTermCmd)
  }
  window.addEventListener('mrgrey-first-window', onFirstWindow, { once: true })

  // Auto-dismiss on first terminal command
  const onTermCmd = (): void => {
    markDone('terminal')
    window.removeEventListener('mrgrey-first-window', onFirstWindow)
  }
  window.addEventListener('mrgrey-terminal-cmd', onTermCmd, { once: true })
}
