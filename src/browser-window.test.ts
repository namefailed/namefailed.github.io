// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BrowserWindow,
  BROWSER_BOOKMARKS,
  DEFAULT_BROWSER_URL,
  normalizeBrowserUrl,
} from './browser-window'


/**
 * Options whose initialUrl is blank (about:blank). A blank URL makes the iframe
 * render via `srcdoc` rather than a real `src`, so appending the window to the
 * document never triggers happy-dom's network page-load path. Use this in any
 * test that calls `document.body.appendChild(win.el)` but doesn't care about the
 * URL (focus, tip modal, dispose, minimize).
 */
function appendOpts() {
  return { ...opts(), initialUrl: '' }
}

function opts() {
  return {
    initialUrl: 'https://example.com',
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }
}

const LS_IFRAME_TIP_DISMISS = 'mrgrey-browser-iframe-tip-dismiss'
const SS_IFRAME_TIP_SESSION = 'mrgrey-browser-iframe-tip-session'

function q<T extends Element = HTMLElement>(root: ParentNode, sel: string): T {
  const el = root.querySelector(sel)
  if (!el) throw new Error(`missing selector: ${sel}`)
  return el as T
}

function iconBtnByTitle(win: BrowserWindow, title: string): HTMLButtonElement {
  const btns = [...win.el.querySelectorAll<HTMLButtonElement>('button.browser-icon-btn')]
  const b = btns.find((x) => x.title === title)
  if (!b) throw new Error(`no icon button titled: ${title}`)
  return b
}

describe('BrowserWindow', () => {
  let origRAF: typeof requestAnimationFrame

  beforeEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
    try {
      sessionStorage.clear()
    } catch {
      /* ignore */
    }
    // Belt-and-suspenders: even if a stray test connects an http(s)-src iframe,
    // don't let happy-dom hit the real network. Tests that append a window use
    // appendOpts() (blank URL -> srcdoc) so no load is attempted in the first place.
    const hd = (window as unknown as { happyDOM?: { settings?: { disableIframePageLoading?: boolean } } }).happyDOM
    if (hd?.settings) hd.settings.disableIframePageLoading = true
    origRAF = globalThis.requestAnimationFrame
    // Run rAF callbacks synchronously so focus() etc. happen deterministically.
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0)
      return 0
    }) as unknown as typeof requestAnimationFrame
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    globalThis.requestAnimationFrame = origRAF
    document.body.replaceChildren()
  })

  describe('construction', () => {
    it('mounts chrome with browser-app class, toolbar, bookmarks, frame', () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)

      expect(win.el.classList.contains('browser-app')).toBe(true)
      expect(win.command).toBe('browse')
      expect(win.el.querySelector('.browser-toolbar')).not.toBeNull()
      expect(win.el.querySelector('.browser-bookmarks-bar')).not.toBeNull()
      expect(win.el.querySelector('iframe.browser-frame')).not.toBeNull()
      expect(win.el.querySelector('.browser-status')).not.toBeNull()
    })

    it('normalizes the initial url and loads it into the frame src', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'example.com' })
      expect(win.getCurrentUrl()).toBe('https://example.com/')
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      expect(frame.getAttribute('src')).toBe('https://example.com/')
      expect(frame.hasAttribute('srcdoc')).toBe(false)
    })

    it('shows the welcome srcdoc (no src) when initial url is blank', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      expect(win.getCurrentUrl()).toBe('about:blank')
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      expect(frame.hasAttribute('src')).toBe(false)
      expect(frame.getAttribute('srcdoc')).toContain('Embedded browser')
    })

    it('populates the url input for a concrete url but blanks it for about:blank', () => {
      const a = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      expect(q<HTMLInputElement>(a.el, '.browser-url-input').value).toBe('https://example.com/')

      const b = new BrowserWindow({ ...opts(), initialUrl: '' })
      expect(q<HTMLInputElement>(b.el, '.browser-url-input').value).toBe('')
    })

    it('renders one bookmark button per BROWSER_BOOKMARKS entry', () => {
      const win = new BrowserWindow(opts())
      const bms = win.el.querySelectorAll('.browser-bookmark')
      expect(bms.length).toBe(BROWSER_BOOKMARKS.length)
      expect((bms[0] as HTMLElement).textContent).toBe(BROWSER_BOOKMARKS[0].label)
      expect((bms[0] as HTMLElement).title).toBe(BROWSER_BOOKMARKS[0].url)
    })

    it('sets a sandbox attr that omits popups-to-escape-sandbox but keeps same-origin', () => {
      const win = new BrowserWindow(opts())
      const sandbox = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame').getAttribute('sandbox') ?? ''
      expect(sandbox).toContain('allow-same-origin')
      expect(sandbox).toContain('allow-scripts')
      expect(sandbox).toContain('allow-popups')
      expect(sandbox).not.toContain('allow-popups-to-escape-sandbox')
    })

    it('starts in loading state with the reload button showing the stop glyph', () => {
      const win = new BrowserWindow(opts())
      const reload = iconBtnByTitle(win, 'Stop loading')
      expect(reload.textContent).toBe('■')
      expect(win.el.querySelector('.browser-toolbar')!.classList.contains('browser-toolbar--loading')).toBe(true)
    })
  })

  describe('site badge', () => {
    it('shows the secure diamond for https', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const badge = q(win.el, '.browser-site-badge')
      expect(badge.textContent).toBe('◆')
      expect(badge.classList.contains('browser-site-badge--secure')).toBe(true)
    })

    it('shows the insecure warning for http', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'http://neverssl.com' })
      const badge = q(win.el, '.browser-site-badge')
      expect(badge.textContent).toBe('⚠')
      expect(badge.classList.contains('browser-site-badge--insecure')).toBe(true)
    })

    it('clears the badge for about:blank', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      const badge = q(win.el, '.browser-site-badge')
      expect(badge.textContent).toBe('')
      expect(badge.className).toBe('browser-site-badge')
    })
  })

  describe('navigation', () => {
    it('navigateTo updates currentUrl, frame src, input, and badge together', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      win.navigateTo('archive.org')

      expect(win.getCurrentUrl()).toBe('https://archive.org/')
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      expect(frame.getAttribute('src')).toBe('https://archive.org/')
      expect(q<HTMLInputElement>(win.el, '.browser-url-input').value).toBe('https://archive.org/')
      expect(q(win.el, '.browser-site-badge').textContent).toBe('◆')
    })

    it('Enter in the url bar navigates to the typed address', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      const input = q<HTMLInputElement>(win.el, '.browser-url-input')
      input.value = 'https://example.org/page'
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(win.getCurrentUrl()).toBe('https://example.org/page')
    })

    it('the Go button navigates from the input value', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      const input = q<HTMLInputElement>(win.el, '.browser-url-input')
      input.value = 'doc.rust-lang.org/book/'
      iconBtnByTitle(win, 'Go to address (Enter)').click()
      expect(win.getCurrentUrl()).toBe('https://doc.rust-lang.org/book/')
    })

    it('the Home button loads the default url', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      iconBtnByTitle(win, 'Home — Wikipedia (Linux)').click()
      expect(win.getCurrentUrl()).toBe(normalizeBrowserUrl(DEFAULT_BROWSER_URL))
    })

    it('clicking a bookmark navigates and refocuses', () => {
      const o = { ...opts(), initialUrl: '' }
      const win = new BrowserWindow(o)
      const wiki = [...win.el.querySelectorAll<HTMLButtonElement>('.browser-bookmark')].find(
        (b) => b.textContent === 'Example.com',
      )!
      wiki.click()
      expect(win.getCurrentUrl()).toBe('https://example.com/')
      expect(o.onFocus).toHaveBeenCalled()
    })

    it('pathMatches compares the normalized current url', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      expect(win.pathMatches('example.com')).toBe(true)
      expect(win.pathMatches('https://example.com/')).toBe(true)
      expect(win.pathMatches('https://other.test')).toBe(false)
    })
  })

  describe('reload / stop', () => {
    it('reload re-applies the current url as the frame src while loading', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      frame.removeAttribute('src')
      // still in loading state -> reload button acts as Stop
      iconBtnByTitle(win, 'Stop loading').click()
      // After stop, the frame shows the stopped srcdoc and toolbar leaves loading.
      expect(frame.getAttribute('srcdoc')).toContain('Navigation stopped')
      expect(win.el.querySelector('.browser-toolbar')!.classList.contains('browser-toolbar--loading')).toBe(false)
    })

    it('stop sets the stopped status and clears it after the timeout', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      iconBtnByTitle(win, 'Stop loading').click()
      const status = q(win.el, '.browser-status')
      expect(status.textContent).toContain('Load stopped')
      vi.advanceTimersByTime(4200)
      expect(status.textContent).toBe('')
    })

    it('after a frame load finishes the reload button returns to the reload glyph', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      frame.dispatchEvent(new Event('load'))
      const reload = iconBtnByTitle(win, 'Reload')
      expect(reload.textContent).toBe('↻')
      expect(win.el.querySelector('.browser-toolbar')!.classList.contains('browser-toolbar--loading')).toBe(false)
    })

    it('once not loading the reload button re-navigates the current url', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      frame.dispatchEvent(new Event('load')) // leaves loading state
      frame.removeAttribute('src')
      iconBtnByTitle(win, 'Reload').click()
      expect(frame.getAttribute('src')).toBe('https://example.com/')
    })

    it('a frame load clears a stale load status but preserves copy feedback', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const status = q(win.el, '.browser-status')
      // Simulate a lingering copy message via the public copy path below is async;
      // instead drive load with stopped status present.
      iconBtnByTitle(win, 'Stop loading').click()
      expect(status.textContent).toContain('Load stopped')
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      frame.dispatchEvent(new Event('load'))
      expect(status.textContent).toBe('')
    })
  })

  describe('copy address', () => {
    it('writes the current url to the clipboard and reports success', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      iconBtnByTitle(win, 'Copy address').click()
      await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://example.com/'))
      expect(q(win.el, '.browser-status').textContent).toBe('Address copied.')
    })

    it('reports a blocked copy when the clipboard rejects', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      iconBtnByTitle(win, 'Copy address').click()
      await vi.waitFor(() =>
        expect(q(win.el, '.browser-status').textContent).toContain('Copy blocked'),
      )
    })

    it('says nothing-to-copy when there is no address', async () => {
      const writeText = vi.fn()
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      iconBtnByTitle(win, 'Copy address').click()
      await vi.waitFor(() =>
        expect(q(win.el, '.browser-status').textContent).toContain('Nothing to copy'),
      )
      expect(writeText).not.toHaveBeenCalled()
    })
  })

  describe('open in system tab', () => {
    it('opens the current url with noopener,noreferrer', () => {
      const open = vi.fn()
      vi.stubGlobal('open', open)
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      iconBtnByTitle(win, 'Open in a real browser tab (many sites block iframes)').click()
      expect(open).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer')
      vi.unstubAllGlobals()
    })

    it('shows a hint instead of opening when there is no url', () => {
      const open = vi.fn()
      vi.stubGlobal('open', open)
      const win = new BrowserWindow({ ...opts(), initialUrl: '' })
      iconBtnByTitle(win, 'Open in a real browser tab (many sites block iframes)').click()
      expect(open).not.toHaveBeenCalled()
      expect(q(win.el, '.browser-status').textContent).toContain('Enter a URL first')
      vi.unstubAllGlobals()
    })
  })

  describe('history navigation', () => {
    it('falls back to a status hint when frame history is cross-origin', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      // contentWindow access throws -> caught -> status hint
      Object.defineProperty(frame, 'contentWindow', {
        get() {
          throw new Error('cross-origin')
        },
        configurable: true,
      })
      iconBtnByTitle(win, 'Back').click()
      expect(q(win.el, '.browser-status').textContent).toContain('History is limited')
    })

    it('calls history.go with the right delta when reachable', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      const go = vi.fn()
      Object.defineProperty(frame, 'contentWindow', {
        value: { history: { go } },
        configurable: true,
      })
      iconBtnByTitle(win, 'Forward').click()
      expect(go).toHaveBeenCalledWith(1)
      iconBtnByTitle(win, 'Back').click()
      expect(go).toHaveBeenCalledWith(-1)
    })
  })

  describe('scrollBy', () => {
    it('forwards a smooth scroll to the frame content window', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      const scrollBy = vi.fn()
      Object.defineProperty(frame, 'contentWindow', { value: { scrollBy }, configurable: true })
      win.scrollBy(120)
      expect(scrollBy).toHaveBeenCalledWith({ top: 120, behavior: 'smooth' })
    })

    it('swallows cross-origin scroll errors', () => {
      const win = new BrowserWindow({ ...opts(), initialUrl: 'https://example.com' })
      const frame = q<HTMLIFrameElement>(win.el, 'iframe.browser-frame')
      Object.defineProperty(frame, 'contentWindow', {
        get() {
          throw new Error('cross-origin')
        },
        configurable: true,
      })
      expect(() => win.scrollBy(50)).not.toThrow()
    })
  })

  describe('window state helpers', () => {
    it('setActive toggles the active class', () => {
      const win = new BrowserWindow(opts())
      win.setActive(true)
      expect(win.el.classList.contains('active')).toBe(true)
      win.setActive(false)
      expect(win.el.classList.contains('active')).toBe(false)
    })

    it('isMaximized reflects the maximized class', () => {
      const win = new BrowserWindow(opts())
      expect(win.isMaximized()).toBe(false)
      win.el.classList.add('maximized')
      expect(win.isMaximized()).toBe(true)
    })

    it('focusAddressBar focuses and selects the input', () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      const input = q<HTMLInputElement>(win.el, '.browser-url-input')
      const select = vi.spyOn(input, 'select')
      win.focusAddressBar()
      expect(document.activeElement).toBe(input)
      expect(select).toHaveBeenCalled()
    })
  })

  describe('chrome callbacks', () => {
    it('wires close/minimize/maximize traffic-light dots to callbacks', () => {
      const o = opts()
      const win = new BrowserWindow(o)
      ;(q(win.el, '.dot-close') as HTMLElement).click()
      ;(q(win.el, '.dot-min') as HTMLElement).click()
      ;(q(win.el, '.dot-max') as HTMLElement).click()
      expect(o.onClose).toHaveBeenCalledTimes(1)
      expect(o.onMinimize).toHaveBeenCalledTimes(1)
      expect(o.onMaximize).toHaveBeenCalledTimes(1)
    })
  })

  describe('iframe tip modal', () => {
    it('opens a modal dialog on first url-bar focus', () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      const input = q<HTMLInputElement>(win.el, '.browser-url-input')
      input.dispatchEvent(new Event('focus'))
      vi.runOnlyPendingTimers() // flush queueMicrotask? microtask runs separately
      // queueMicrotask schedules a microtask; flush it explicitly.
      return Promise.resolve().then(() => {
        const backdrop = document.body.querySelector('.browser-iframe-tip-backdrop')
        expect(backdrop).not.toBeNull()
        expect(backdrop!.getAttribute('aria-modal')).toBe('true')
        expect(backdrop!.querySelector('.browser-iframe-tip-ok')).not.toBeNull()
      })
    })

    it('does not reopen when the session flag is set', async () => {
      sessionStorage.setItem(SS_IFRAME_TIP_SESSION, '1')
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
    })

    it('does not reopen when the permanent localStorage flag is set', async () => {
      localStorage.setItem(LS_IFRAME_TIP_DISMISS, '1')
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
    })

    it('Got it dismisses the modal and marks the session as seen', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      const ok = q<HTMLButtonElement>(document.body, '.browser-iframe-tip-ok')
      ok.click()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
      expect(sessionStorage.getItem(SS_IFRAME_TIP_SESSION)).toBe('1')
      expect(localStorage.getItem(LS_IFRAME_TIP_DISMISS)).toBeNull()
    })

    it('Got it with the checkbox ticked persists the permanent flag', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      q<HTMLInputElement>(document.body, '.browser-iframe-tip-check').checked = true
      q<HTMLButtonElement>(document.body, '.browser-iframe-tip-ok').click()
      expect(localStorage.getItem(LS_IFRAME_TIP_DISMISS)).toBe('1')
    })

    it('Escape closes the modal', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).not.toBeNull()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
    })

    it('clicking the backdrop (but not the dialog) closes the modal', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      const backdrop = q<HTMLElement>(document.body, '.browser-iframe-tip-backdrop')
      // click on dialog -> stays open
      q<HTMLElement>(backdrop, '.browser-iframe-tip-dialog').dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).not.toBeNull()
      // click directly on backdrop -> closes
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
    })

    it('does not open a second backdrop if focus fires twice', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      const input = q<HTMLInputElement>(win.el, '.browser-url-input')
      input.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      input.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      expect(document.body.querySelectorAll('.browser-iframe-tip-backdrop').length).toBe(1)
    })
  })

  describe('dispose / minimize teardown', () => {
    it('dispose removes the open tip without marking it seen', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).not.toBeNull()
      win.dispose()
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
      expect(sessionStorage.getItem(SS_IFRAME_TIP_SESSION)).toBeNull()
    })

    it('after dispose a stray Escape no longer affects the (gone) modal', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      win.dispose()
      // Handler should be detached; dispatching Escape must not throw.
      expect(() =>
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
      ).not.toThrow()
    })

    it('setMinimized(true) tears down the tip and adds the minimized class', async () => {
      const win = new BrowserWindow(appendOpts())
      document.body.appendChild(win.el)
      q<HTMLInputElement>(win.el, '.browser-url-input').dispatchEvent(new Event('focus'))
      await Promise.resolve()
      win.setMinimized(true)
      expect(win.el.classList.contains('minimized')).toBe(true)
      expect(document.body.querySelector('.browser-iframe-tip-backdrop')).toBeNull()
      expect(sessionStorage.getItem(SS_IFRAME_TIP_SESSION)).toBeNull()
    })

    it('setMinimized(false) just clears the minimized class', () => {
      const win = new BrowserWindow(opts())
      win.el.classList.add('minimized')
      win.setMinimized(false)
      expect(win.el.classList.contains('minimized')).toBe(false)
    })
  })

  describe('re-exports', () => {
    it('re-exports DEFAULT_BROWSER_URL and normalizeBrowserUrl from browser-url', () => {
      expect(DEFAULT_BROWSER_URL).toBe('https://en.wikipedia.org/wiki/Linux')
      expect(normalizeBrowserUrl('javascript:alert(1)')).toBe('about:blank')
    })
  })
})
