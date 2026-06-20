// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createWindowChrome, escapeHtml } from './window-chrome'

// Capture the real happy-dom document before the legacy hand-rolled mock below
// overwrites globalThis.document. The DOM-driven suite at the bottom restores
// this real document so it can exercise actual event listeners and the DOM.
const realDocument = globalThis.document

// Mock DOM for Node test environment
globalThis.document = {
  createElement: (tag: string) => ({
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    textContent: '',
    dataset: {},
    style: {},
    children: [],
    appendChild(child: unknown) {
      ;(this.children as unknown[]).push(child)
      return child
    },
    querySelector(_selector: string) {
      // Simple mock: return a mock element for any selector
      return {
        tagName: 'SPAN',
        textContent: '',
        addEventListener: vi.fn(),
      }
    },
    querySelectorAll(_selector: string) {
      return []
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
  }),
} as unknown as Document

describe('escapeHtml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('escapes < to &lt;', () => {
    expect(escapeHtml('foo < bar')).toBe('foo &lt; bar')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('foo > bar')).toBe('foo &gt; bar')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('foo "bar"')).toBe('foo &quot;bar&quot;')
  })

  it('escapes multiple characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    )
  })

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('createWindowChrome', () => {
  const mockCallbacks = {
    onClose: vi.fn(),
    onMinimize: vi.fn(),
    onMaximize: vi.fn(),
    onFocus: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates elements with correct structure', () => {
    const chrome = createWindowChrome({
      title: 'Test Window',
      ...mockCallbacks,
    })

    expect(chrome.el).toBeDefined()
    expect(chrome.titlebar).toBeDefined()
    expect(chrome.titleEl).toBeDefined()
    expect(chrome.btnClose).toBeDefined()
    expect(chrome.btnMin).toBeDefined()
    expect(chrome.btnMax).toBeDefined()
  })

  it('escapes HTML in title', () => {
    const chrome = createWindowChrome({
      title: '<script>alert(1)</script>',
      ...mockCallbacks,
    })

    expect(chrome.titleEl.textContent).not.toContain('<script>')
  })
})

// --- createWindowChrome (real DOM via happy-dom) -----------------------------
// The legacy hand-rolled `document` mock above stubs out event listeners, so it
// can't exercise the click/keyboard/focus branches. This suite swaps the real
// happy-dom document back in to drive actual events through real DOM nodes.

describe('createWindowChrome (real DOM)', () => {
  const fakeDocument = globalThis.document

  function callbacks() {
    return {
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onMaximize: vi.fn(),
      onFocus: vi.fn(),
    }
  }

  beforeEach(() => {
    globalThis.document = realDocument
  })

  afterEach(() => {
    // Restore the legacy mock so any later module-level use stays consistent,
    // then clear any mock call state.
    globalThis.document = fakeDocument
    vi.restoreAllMocks()
  })

  it('renders the titlebar structure with traffic-light dots and the title', () => {
    const cb = callbacks()
    const { el, titlebar, titleEl, btnClose, btnMin, btnMax } = createWindowChrome({
      title: 'Hello',
      ...cb,
    })

    expect(el.className).toBe('app-window content-window')
    expect(titlebar.className).toBe('win-titlebar')
    expect(el.contains(titlebar)).toBe(true) // titlebar is appended to el
    expect(titleEl.textContent).toBe('Hello')
    expect(btnClose.classList.contains('dot-close')).toBe(true)
    expect(btnMin.classList.contains('dot-min')).toBe(true)
    expect(btnMax.classList.contains('dot-max')).toBe(true)
    // Accessibility attributes survive the innerHTML template.
    expect(btnMin.getAttribute('role')).toBe('button')
    expect(btnMin.getAttribute('aria-label')).toBe('Minimize window')
    expect(btnMax.getAttribute('aria-label')).toBe('Maximize window')
    expect(btnClose.getAttribute('aria-label')).toBe('Close window')
  })

  it('escapes HTML in the title into visible text (no live markup injected)', () => {
    const cb = callbacks()
    const { titleEl } = createWindowChrome({ title: '<b>x</b> & "y"', ...cb })
    // textContent is the decoded, escaped text — querying for a real <b> finds nothing.
    expect(titleEl.querySelector('b')).toBeNull()
    expect(titleEl.textContent).toBe('<b>x</b> & "y"')
  })

  it('close button click forwards onClose and stops propagation to the titlebar', () => {
    const cb = callbacks()
    const { titlebar, btnClose } = createWindowChrome({ title: 'T', ...cb })
    const titlebarClick = vi.fn()
    titlebar.addEventListener('click', titlebarClick)

    btnClose.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(cb.onClose).toHaveBeenCalledOnce()
    // stopPropagation: the bubbling click never reaches the titlebar handler.
    expect(titlebarClick).not.toHaveBeenCalled()
  })

  it('minimize and maximize buttons forward their callbacks on click', () => {
    const cb = callbacks()
    const { btnMin, btnMax } = createWindowChrome({ title: 'T', ...cb })

    btnMin.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    btnMax.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(cb.onMinimize).toHaveBeenCalledOnce()
    expect(cb.onMaximize).toHaveBeenCalledOnce()
    expect(cb.onClose).not.toHaveBeenCalled()
  })

  it('Enter key on a button activates it and prevents default', () => {
    const cb = callbacks()
    const { btnClose } = createWindowChrome({ title: 'T', ...cb })
    const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })

    btnClose.dispatchEvent(ev)

    expect(cb.onClose).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('Space key on a button activates it and prevents default', () => {
    const cb = callbacks()
    const { btnMin } = createWindowChrome({ title: 'T', ...cb })
    const ev = new KeyboardEvent('keydown', { key: ' ', cancelable: true })

    btnMin.dispatchEvent(ev)

    expect(cb.onMinimize).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ignores other keys (no activation, no preventDefault)', () => {
    const cb = callbacks()
    const { btnMax } = createWindowChrome({ title: 'T', ...cb })
    const ev = new KeyboardEvent('keydown', { key: 'a', cancelable: true })

    btnMax.dispatchEvent(ev)

    expect(cb.onMaximize).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('by default focuses on both titlebar and element mousedown', () => {
    const cb = callbacks()
    const { el, titlebar } = createWindowChrome({ title: 'T', ...cb })

    titlebar.dispatchEvent(new MouseEvent('mousedown'))
    expect(cb.onFocus).toHaveBeenCalledTimes(1)

    el.dispatchEvent(new MouseEvent('mousedown'))
    expect(cb.onFocus).toHaveBeenCalledTimes(2)
  })

  it('with focusOnTitlebar:false, titlebar mousedown does NOT focus but element mousedown does', () => {
    const cb = callbacks()
    const { el, titlebar } = createWindowChrome({
      title: 'T',
      focusOnTitlebar: false,
      ...cb,
    })

    titlebar.dispatchEvent(new MouseEvent('mousedown'))
    expect(cb.onFocus).not.toHaveBeenCalled() // titlebar handler not attached

    el.dispatchEvent(new MouseEvent('mousedown'))
    expect(cb.onFocus).toHaveBeenCalledOnce() // element handler still attached
  })

  it('attaches no focus listeners when onFocus is omitted', () => {
    const cb = {
      onClose: vi.fn(),
      onMinimize: vi.fn(),
      onMaximize: vi.fn(),
    }
    const { el, titlebar } = createWindowChrome({ title: 'T', ...cb })

    // Neither mousedown does anything observable; chiefly this must not throw
    // (no opts.onFocus!() call against undefined).
    expect(() => titlebar.dispatchEvent(new MouseEvent('mousedown'))).not.toThrow()
    expect(() => el.dispatchEvent(new MouseEvent('mousedown'))).not.toThrow()
  })

  it('does not invoke any callback when only the chrome is built (no interaction)', () => {
    const cb = callbacks()
    createWindowChrome({ title: 'T', ...cb })

    expect(cb.onClose).not.toHaveBeenCalled()
    expect(cb.onMinimize).not.toHaveBeenCalled()
    expect(cb.onMaximize).not.toHaveBeenCalled()
    expect(cb.onFocus).not.toHaveBeenCalled()
  })
})
