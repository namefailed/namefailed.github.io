/**
 * Shared window chrome factory for all tile windows.
 * Eliminates the repeated titlebar HTML structure across browser-window.ts,
 * editor-window.ts, paint-window.ts, pong-window.ts, snake-window.ts,
 * file-explorer-window.ts, and appwindow.ts.
 */

export interface WindowChromeCallbacks {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus?: () => void
}

export interface WindowChromeOptions extends WindowChromeCallbacks {
  title: string
  /** When true, focus callback is also attached to the titlebar mousedown. Default true. */
  focusOnTitlebar?: boolean
}

export interface WindowChromeElements {
  el: HTMLElement
  titlebar: HTMLElement
  titleEl: HTMLElement
  btnClose: HTMLElement
  btnMin: HTMLElement
  btnMax: HTMLElement
}

/**
 * Create standard window chrome with titlebar and traffic light buttons.
 * Returns the container element and references to interactive parts.
 */
export function createWindowChrome(opts: WindowChromeOptions): WindowChromeElements {
  const el = document.createElement('div')
  el.className = 'app-window content-window'

  const titlebar = document.createElement('div')
  titlebar.className = 'win-titlebar'
  titlebar.innerHTML = `
    <div class="win-title-left">
      <span class="win-title">${escapeHtml(opts.title)}</span>
    </div>
    <div class="win-traffic">
      <span class="dot dot-min" role="button" tabindex="0" title="minimize (ctrl+m)" aria-label="Minimize window"></span>
      <span class="dot dot-max" role="button" tabindex="0" title="maximize / restore (ctrl+f)" aria-label="Maximize window"></span>
      <span class="dot dot-close" role="button" tabindex="0" title="close (ctrl+q)" aria-label="Close window"></span>
    </div>
  `

  const titleEl = titlebar.querySelector('.win-title') as HTMLElement
  const btnClose = titlebar.querySelector('.dot-close') as HTMLElement
  const btnMin = titlebar.querySelector('.dot-min') as HTMLElement
  const btnMax = titlebar.querySelector('.dot-max') as HTMLElement

  // Wire up button clicks + keyboard activation for accessibility
  function activateOnKeydown(fn: () => void): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
    }
  }

  btnClose.addEventListener('click', (e) => { e.stopPropagation(); opts.onClose() })
  btnClose.addEventListener('keydown', activateOnKeydown(opts.onClose))

  btnMin.addEventListener('click', (e) => { e.stopPropagation(); opts.onMinimize() })
  btnMin.addEventListener('keydown', activateOnKeydown(opts.onMinimize))

  btnMax.addEventListener('click', (e) => { e.stopPropagation(); opts.onMaximize() })
  btnMax.addEventListener('keydown', activateOnKeydown(opts.onMaximize))

  // Focus on titlebar click (optional, but usually wanted)
  const focusOnTitlebar = opts.focusOnTitlebar !== false
  if (focusOnTitlebar && opts.onFocus) {
    titlebar.addEventListener('mousedown', () => opts.onFocus!())
    el.addEventListener('mousedown', () => opts.onFocus!())
  } else if (opts.onFocus) {
    el.addEventListener('mousedown', () => opts.onFocus!())
  }

  el.appendChild(titlebar)

  return { el, titlebar, titleEl, btnClose, btnMin, btnMax }
}

/** Escape HTML special characters to prevent XSS. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape HTML special characters (shared utility). */
export function escapeHtmlShared(s: string): string {
  return escapeHtml(s)
}
