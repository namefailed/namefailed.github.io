// ── browser-window.ts ─────────────────────────────────────────────────────────
// Sandboxed iframe + URL chrome. Sandbox includes `allow-same-origin` so framed pages keep
// real origins (without it many SPAs render as opaque-origin blanks). Many sites still send
// X-Frame-Options / CSP that block embedding entirely.

import { DEFAULT_BROWSER_URL, normalizeBrowserUrl } from './browser-url'

export { DEFAULT_BROWSER_URL, normalizeBrowserUrl }

/** Sites that commonly allow iframe embedding (many major sites forbid it). */
export const BROWSER_BOOKMARKS: ReadonlyArray<{ label: string; url: string }> = [
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
  { label: 'Linux article', url: 'https://en.wikipedia.org/wiki/Linux' },
  { label: 'Example.com', url: 'https://example.com' },
  { label: 'Internet Archive', url: 'https://archive.org' },
  { label: 'Rust Book', url: 'https://doc.rust-lang.org/book/' },
  { label: 'This site', url: typeof window !== 'undefined' ? window.location.origin + '/' : '/' },
]

const LS_IFRAME_TIP_DISMISS = 'mrgrey-browser-iframe-tip-dismiss'
const SS_IFRAME_TIP_SESSION = 'mrgrey-browser-iframe-tip-session'

const WELCOME_SRCDOC = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:1.25rem 1.5rem;line-height:1.55;background:#181825;color:#cdd6f4}
code{font-family:ui-monospace,monospace;background:rgba(0,0,0,.28);padding:.12em .4em;border-radius:4px;font-size:.92em}
p{margin:.7em 0}
h1{font-weight:600;font-size:1.05rem;margin:0 0 .85rem;color:#cba6f7;letter-spacing:.02em}
.note{opacity:.75;font-size:.88rem;margin-top:1.1rem}
</style></head><body>
<h1>Embedded browser</h1>
<p>Home (⌂) reloads the Linux article on Wikipedia. Try <code>browse https://example.com</code> if you want a simple framing smoke test.</p>
<p class="note">Google, GitHub, etc. send headers that <strong>forbid embedding</strong> — the iframe stays empty; use <strong>Open tab</strong> in the toolbar. Same-origin pages (this site) always work.</p>
</body></html>`

/** Shown after Stop — currentUrl in the chrome is untouched; Reload/Go resumes. */
const STOPPED_SRCDOC = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="dark"><style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#13131a;color:#6c7086;font-size:.8rem}
p{margin:0;max-width:18rem;line-height:1.5;text-align:center}
kbd{font-family:inherit;opacity:.72}
</style></head><body><p>Navigation stopped.<br>Use <kbd>↻ Reload</kbd> or <kbd>↵ Go</kbd> to try again.</p></body></html>`

export interface BrowserWindowOptions {
  initialUrl: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

export class BrowserWindow {
  readonly el: HTMLElement
  readonly command = 'browse' as const
  readonly onFocus: () => void

  private currentUrl: string
  private frame: HTMLIFrameElement
  private urlInput: HTMLInputElement
  private statusEl: HTMLElement
  private toolbarRoot: HTMLElement
  private reloadBtn: HTMLButtonElement
  private siteBadge: HTMLElement
  private toolbarLoading = false

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  private iframeTipBackdrop: HTMLElement | null = null
  private tipEscHandler: ((e: KeyboardEvent) => void) | null = null

  constructor(opts: BrowserWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    this.currentUrl = normalizeBrowserUrl(opts.initialUrl)

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window browser-app'
    this.el.addEventListener('mousedown', () => opts.onFocus())

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">Browse</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onClose()
    })
    bar.querySelector('.dot-min')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMinimize()
    })
    bar.querySelector('.dot-max')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMaximize()
    })
    bar.addEventListener('mousedown', () => opts.onFocus())

    const toolbar = document.createElement('div')
    toolbar.className = 'browser-toolbar'
    this.toolbarRoot = toolbar

    const mkIconBtn = (label: string, title: string, fn: () => void, extraClass = ''): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `browser-icon-btn${extraClass ? ` ${extraClass}` : ''}`
      b.textContent = label
      b.title = title
      b.addEventListener('click', fn)
      return b
    }

    const btnBack = mkIconBtn('‹', 'Back', () => this.tryHistory(-1))
    const btnFwd = mkIconBtn('›', 'Forward', () => this.tryHistory(1))
    const btnReload = mkIconBtn('↻', 'Reload', () => this.onReloadOrStop())
    this.reloadBtn = btnReload
    this.reloadBtn.setAttribute('aria-label', 'Reload')

    const btnHome = mkIconBtn('⌂', 'Home — Wikipedia (Linux)', () => this.navigateTo(DEFAULT_BROWSER_URL))

    const toolbarNav = document.createElement('div')
    toolbarNav.className = 'browser-toolbar-nav'
    toolbarNav.append(btnBack, btnFwd, btnReload, btnHome)

    this.siteBadge = document.createElement('span')
    this.siteBadge.className = 'browser-site-badge'
    this.siteBadge.setAttribute('aria-hidden', 'true')

    this.urlInput = document.createElement('input')
    this.urlInput.type = 'text'
    this.urlInput.className = 'browser-url-input'
    this.urlInput.spellcheck = false
    this.urlInput.autocomplete = 'off'
    this.urlInput.placeholder = 'Search or enter address'
    this.urlInput.setAttribute('aria-label', 'Address')

    const omni = document.createElement('div')
    omni.className = 'browser-omni'
    omni.append(this.siteBadge, this.urlInput)

    const btnGo = mkIconBtn('↵', 'Go to address (Enter)', () => this.goFromInput(), 'browser-icon-btn--primary')
    btnGo.setAttribute('aria-label', 'Go to address')

    const btnCopy = mkIconBtn('⎘', 'Copy address', () => void this.copyAddress())
    const btnOpenTab = mkIconBtn(
      '↗',
      'Open in a real browser tab (many sites block iframes)',
      () => this.openInSystemTab(),
    )

    const urlActions = document.createElement('div')
    urlActions.className = 'browser-url-actions'
    urlActions.append(btnGo, btnCopy, btnOpenTab)

    const urlRow = document.createElement('div')
    urlRow.className = 'browser-url-row'
    urlRow.append(omni, urlActions)

    const bookmarksBar = document.createElement('div')
    bookmarksBar.className = 'browser-bookmarks-bar'
    bookmarksBar.setAttribute('role', 'toolbar')
    bookmarksBar.setAttribute('aria-label', 'Bookmarks')
    for (const bm of BROWSER_BOOKMARKS) {
      const bk = document.createElement('button')
      bk.type = 'button'
      bk.className = 'browser-bookmark'
      bk.textContent = bm.label
      bk.title = bm.url
      bk.addEventListener('click', () => {
        this.navigateTo(bm.url)
        opts.onFocus()
      })
      bookmarksBar.appendChild(bk)
    }

    this.urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.goFromInput()
      }
    })

    this.urlInput.addEventListener('focus', () => {
      if (this.skipIframeTip()) return
      queueMicrotask(() => this.openIframeTip())
    })

    toolbar.append(toolbarNav, urlRow)
    this.syncSiteBadge()

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'browser-status'
    this.statusEl.setAttribute('aria-live', 'polite')

    this.frame = document.createElement('iframe')
    this.frame.className = 'browser-frame'
    this.frame.title = 'Browser content'
    // `allow-same-origin` lets the framed document use its real origin (cookies, APIs).
    // Without it, the iframe is an opaque origin — most SPAs show a blank screen.
    this.frame.setAttribute(
      'sandbox',
      [
        'allow-downloads',
        'allow-forms',
        'allow-modals',
        'allow-orientation-lock',
        'allow-pointer-lock',
        'allow-popups',
        'allow-popups-to-escape-sandbox',
        'allow-presentation',
        'allow-same-origin',
        'allow-scripts',
      ].join(' '),
    )

    this.frame.addEventListener('load', () => {
      this.setToolbarLoading(false)
      const s = this.statusEl.textContent
      if (
        !s?.startsWith('Address copied') &&
        !s?.startsWith('Copy blocked') &&
        !s?.startsWith('Nothing to copy')
      ) {
        this.statusEl.textContent = ''
      }
    })

    const stack = document.createElement('div')
    stack.className = 'browser-stack'
    stack.appendChild(toolbar)
    stack.appendChild(bookmarksBar)
    stack.appendChild(this.statusEl)
    stack.appendChild(this.frame)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.applyFrameUrl(this.currentUrl)
    this.syncUrlField()
  }

  private onReloadOrStop(): void {
    if (this.toolbarLoading) {
      this.stopFrameNavigation()
      return
    }
    this.reload()
  }

  private setToolbarLoading(loading: boolean): void {
    this.toolbarLoading = loading
    this.toolbarRoot.classList.toggle('browser-toolbar--loading', loading)
    if (loading) {
      this.reloadBtn.textContent = '■'
      this.reloadBtn.title = 'Stop loading'
      this.reloadBtn.setAttribute('aria-label', 'Stop loading')
    } else {
      this.reloadBtn.textContent = '↻'
      this.reloadBtn.title = 'Reload'
      this.reloadBtn.setAttribute('aria-label', 'Reload')
    }
  }

  /** Best-effort abort of in-flight navigation (iframes + cross-origin are messy). */
  private stopFrameNavigation(): void {
    this.setToolbarLoading(false)
    try {
      this.frame.contentWindow?.stop?.()
    } catch {
      /* ignore */
    }
    this.frame.removeAttribute('src')
    this.frame.removeAttribute('srcdoc')
    this.frame.srcdoc = STOPPED_SRCDOC
    this.statusEl.textContent = 'Load stopped — address unchanged; press Reload or Go.'
    window.setTimeout(() => {
      if (this.statusEl.textContent?.startsWith('Load stopped')) this.statusEl.textContent = ''
    }, 4200)
  }

  private async copyAddress(): Promise<void> {
    const u = this.currentUrl === 'about:blank' ? this.urlInput.value.trim() : this.currentUrl
    if (!u || u === 'about:blank') {
      this.statusEl.textContent = 'Nothing to copy — enter a URL first.'
      window.setTimeout(() => {
        if (this.statusEl.textContent?.startsWith('Nothing')) this.statusEl.textContent = ''
      }, 2200)
      return
    }
    const text = u.startsWith('http') ? u : normalizeBrowserUrl(u)
    try {
      await navigator.clipboard.writeText(text)
      this.statusEl.textContent = 'Address copied.'
    } catch {
      this.statusEl.textContent = 'Copy blocked — select the address bar manually.'
    }
    window.setTimeout(() => {
      if (
        this.statusEl.textContent === 'Address copied.' ||
        this.statusEl.textContent?.startsWith('Copy blocked')
      ) {
        this.statusEl.textContent = ''
      }
    }, 2000)
  }

  private syncSiteBadge(): void {
    const u = this.currentUrl
    if (u === 'about:blank' || !u) {
      this.siteBadge.textContent = ''
      this.siteBadge.className = 'browser-site-badge'
      this.siteBadge.removeAttribute('title')
      return
    }
    if (u.startsWith('https:')) {
      this.siteBadge.textContent = '◆'
      this.siteBadge.className = 'browser-site-badge browser-site-badge--secure'
      this.siteBadge.title = 'Connection is encrypted (HTTPS)'
      return
    }
    if (u.startsWith('http:')) {
      this.siteBadge.textContent = '⚠'
      this.siteBadge.className = 'browser-site-badge browser-site-badge--insecure'
      this.siteBadge.title = 'Not secure — HTTP (no transport encryption)'
      return
    }
    this.siteBadge.textContent = '◇'
    this.siteBadge.className = 'browser-site-badge browser-site-badge--neutral'
    this.siteBadge.title = 'Local or special URL'
  }

  /** Same normalized URL as `userArg` (after normalizeBrowserUrl). */
  pathMatches(userArg: string): boolean {
    return this.currentUrl === normalizeBrowserUrl(userArg)
  }

  getCurrentUrl(): string {
    return this.currentUrl
  }

  navigateTo(rawOrNormalized: string): void {
    const next = normalizeBrowserUrl(rawOrNormalized)
    this.currentUrl = next
    this.applyFrameUrl(next)
    this.syncUrlField()
    this.syncSiteBadge()
  }

  private goFromInput(): void {
    const raw = this.urlInput.value
    this.navigateTo(raw)
  }

  private reload(): void {
    this.applyFrameUrl(this.currentUrl)
  }

  private openInSystemTab(): void {
    const u = this.currentUrl === 'about:blank' ? normalizeBrowserUrl(this.urlInput.value) : this.currentUrl
    if (u === 'about:blank') {
      this.statusEl.textContent = 'Enter a URL first, or use Go.'
      window.setTimeout(() => {
        if (this.statusEl.textContent?.startsWith('Enter')) this.statusEl.textContent = ''
      }, 2400)
      return
    }
    window.open(u, '_blank', 'noopener,noreferrer')
  }

  private applyFrameUrl(normalized: string): void {
    if (normalized === 'about:blank') {
      this.setToolbarLoading(false)
      this.frame.removeAttribute('src')
      this.frame.srcdoc = WELCOME_SRCDOC
    } else {
      this.setToolbarLoading(true)
      this.frame.removeAttribute('srcdoc')
      this.frame.src = normalized
    }
  }

  private syncUrlField(): void {
    this.urlInput.value =
      this.currentUrl === 'about:blank' ? '' : this.currentUrl
  }

  private skipIframeTip(): boolean {
    try {
      if (localStorage.getItem(LS_IFRAME_TIP_DISMISS) === '1') return true
      if (sessionStorage.getItem(SS_IFRAME_TIP_SESSION) === '1') return true
    } catch {
      /* private mode */
    }
    return false
  }

  /**
   * Drop the tip overlay without counting as dismissed — e.g. window closed while open.
   * @param recordDismissal When true, user chose Got it (session / optional permanent flag).
   */
  private dismissIframeTip(permanent: boolean, recordDismissal = true): void {
    if (this.tipEscHandler) {
      document.removeEventListener('keydown', this.tipEscHandler, true)
      this.tipEscHandler = null
    }
    if (recordDismissal) {
      try {
        sessionStorage.setItem(SS_IFRAME_TIP_SESSION, '1')
        if (permanent) localStorage.setItem(LS_IFRAME_TIP_DISMISS, '1')
      } catch {
        /* ignore */
      }
    }
    this.iframeTipBackdrop?.remove()
    this.iframeTipBackdrop = null
    if (recordDismissal) this.urlInput.focus()
  }

  /** WM closed the tile — tear down modal without marking the tip as seen. */
  dispose(): void {
    this.dismissIframeTip(false, false)
  }

  private openIframeTip(): void {
    if (this.iframeTipBackdrop) return

    const backdrop = document.createElement('div')
    backdrop.className = 'browser-iframe-tip-backdrop'
    backdrop.setAttribute('role', 'dialog')
    backdrop.setAttribute('aria-modal', 'true')
    backdrop.setAttribute('aria-labelledby', 'browser-iframe-tip-title')

    const dialog = document.createElement('div')
    dialog.className = 'browser-iframe-tip-dialog'
    dialog.innerHTML = `
      <h2 id="browser-iframe-tip-title" class="browser-iframe-tip-title">Embedded browsing</h2>
      <p class="browser-iframe-tip-body">
        Lots of sites <strong>don’t load inside iframes</strong> on purpose — they send
        <code>X-Frame-Options</code> or CSP headers so they can’t be embedded (banks, Google, GitHub, …).
        That usually shows up as a <strong>blank tile</strong>, not a bug here.
      </p>
      <p class="browser-iframe-tip-body browser-iframe-tip-body--muted">
        While a page is loading, the <strong>↻</strong> button becomes <strong>■ Stop</strong>. Use <strong>↗</strong> to open the URL in a normal tab — same-origin pages (this site) work in-frame.
      </p>
      <label class="browser-iframe-tip-label">
        <input type="checkbox" class="browser-iframe-tip-check" />
        Don’t show this again
      </label>
      <button type="button" class="browser-iframe-tip-ok">Got it</button>
    `

    const check = dialog.querySelector('.browser-iframe-tip-check') as HTMLInputElement
    const ok = dialog.querySelector('.browser-iframe-tip-ok') as HTMLButtonElement

    ok.addEventListener('click', () => this.dismissIframeTip(check.checked))
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) this.dismissIframeTip(check.checked)
    })

    this.tipEscHandler = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      ev.preventDefault()
      ev.stopPropagation()
      this.dismissIframeTip(check.checked)
    }
    document.addEventListener('keydown', this.tipEscHandler, true)

    backdrop.appendChild(dialog)
    document.body.appendChild(backdrop)
    this.iframeTipBackdrop = backdrop

    requestAnimationFrame(() => ok.focus())
  }

  private tryHistory(delta: -1 | 1): void {
    try {
      this.frame.contentWindow?.history.go(delta)
    } catch {
      this.statusEl.textContent =
        'History is limited for cross-origin pages — use the address bar.'
      window.setTimeout(() => {
        if (this.statusEl.textContent?.startsWith('History')) this.statusEl.textContent = ''
      }, 3200)
    }
  }

  focusAddressBar(): void {
    this.urlInput.focus()
    this.urlInput.select()
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  scrollBy(delta: number): void {
    try {
      this.frame.contentWindow?.scrollBy({ top: delta, behavior: 'smooth' })
    } catch {
      /* cross-origin */
    }
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }
}
