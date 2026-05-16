/**
 * Speech-bubble hints anchored to portfolio tiles on first visit.
 * Persistent until clicked or until "Show hints again" is invoked.
 */

export interface Hint {
  targetCmd: string
  text: string
}

export const HINTS: Hint[] = [
  { targetCmd: 'resume',   text: '← start here · full resume' },
  { targetCmd: 'projects', text: "← things I've built" },
  { targetCmd: 'whoami',   text: '← whoami, in detail' },
  { targetCmd: 'links',    text: '← reach out' },
]

const KEY_PREFIX = 'mrgrey-hint-'

export function hintKey(targetCmd: string): string {
  return `${KEY_PREFIX}${targetCmd}`
}

export function isHintDismissed(targetCmd: string): boolean {
  return window.localStorage.getItem(hintKey(targetCmd)) === '1'
}

export function dismissHint(targetCmd: string): void {
  window.localStorage.setItem(hintKey(targetCmd), '1')
}

export function resetAllHints(): void {
  for (const hint of HINTS) {
    window.localStorage.removeItem(hintKey(hint.targetCmd))
  }
}

export interface MountHintsOptions {
  host: HTMLElement
  /** Resolver: cmd → tile DOM rect (relative to host). */
  resolveAnchor: (cmd: string) => DOMRect | null
}

/** Render all undismissed bubbles. No-op if all are dismissed. */
export function mountHintBubbles(opts: MountHintsOptions): void {
  const active: HTMLElement[] = []
  for (const hint of HINTS) {
    if (isHintDismissed(hint.targetCmd)) continue
    const el = createBubble(hint)
    opts.host.appendChild(el)
    active.push(el)
    positionBubble(el, hint.targetCmd, opts)
  }
  if (active.length === 0) return

  const reposition = (): void => {
    for (const el of active) {
      const cmd = el.dataset.target!
      positionBubble(el, cmd, opts)
    }
  }
  window.addEventListener('resize', reposition)
  // Reposition after tile drag-end (a small delay covers the snap-to-grid)
  window.addEventListener('pointerup', () => window.setTimeout(reposition, 100))
}

function createBubble(hint: Hint): HTMLElement {
  const el = document.createElement('div')
  el.className = 'hint-bubble'
  el.dataset.target = hint.targetCmd
  el.innerHTML = `<span>${escapeHtml(hint.text)}</span><button type="button" class="hint-bubble-close" aria-label="Dismiss">×</button>`
  el.querySelector('.hint-bubble-close')!.addEventListener('click', () => {
    dismissHint(hint.targetCmd)
    el.remove()
  })
  return el
}

function positionBubble(
  el: HTMLElement,
  cmd: string,
  opts: MountHintsOptions,
): void {
  const rect = opts.resolveAnchor(cmd)
  if (!rect) {
    el.style.display = 'none'
    return
  }
  el.style.display = ''
  // Place bubble immediately to the right of the tile, vertically centered.
  el.style.left = `${rect.right + 8}px`
  el.style.top = `${rect.top + rect.height / 2 - el.offsetHeight / 2}px`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
