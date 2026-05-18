import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createWindowChrome, escapeHtml } from './window-chrome'

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
