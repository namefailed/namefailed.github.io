import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  EMPTY_HINT_KEY,
  dismissDesktopEmptyHint,
  mountDesktopEmptyCta,
  syncDesktopEmptyCta,
} from './desktop-empty-cta'
import { GUIDE_KEY } from './welcome-guide'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}

class FakeEl {
  className = ''
  hidden = false
  style: Record<string, string> = {}
  private children: FakeEl[] = []
  append(...nodes: FakeEl[]): void { this.children.push(...nodes) }
  appendChild(node: FakeEl): void { this.children.push(node) }
  querySelector(sel: string): FakeEl | null {
    if (sel === '.desktop-empty-hint') {
      return this.children.find(c => c.className.includes('desktop-empty-hint')) ?? null
    }
    return null
  }
  remove(): void {
    const parent = (this as FakeEl & { _parent?: FakeEl })._parent
    if (parent) parent.children = parent.children.filter(c => c !== this)
  }
  setAttribute(): void {}
  addEventListener(): void {}
}

let body: FakeEl
let docQueryResults: FakeEl[] = []

beforeAll(() => {
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()
  body = new FakeEl()
  ;(globalThis as unknown as { document: unknown }).document = {
    body,
    createElement: () => {
      const el = new FakeEl()
      ;(el as FakeEl & { _parent?: FakeEl })._parent = body
      return el
    },
    querySelector: (sel: string) => {
      if (sel === '.desktop-empty-hint') {
        return docQueryResults[0] ?? body.querySelector(sel)
      }
      return null
    },
  }
})

beforeEach(() => {
  localStorage.clear()
  body = new FakeEl()
  ;(document as unknown as { body: FakeEl }).body = body
  docQueryResults = []
})

describe('desktop empty hint', () => {
  it('does not mount when already dismissed', () => {
    localStorage.setItem(EMPTY_HINT_KEY, '1')
    mountDesktopEmptyCta(body as unknown as HTMLElement, () => {})
    expect(body.querySelector('.desktop-empty-hint')).toBeNull()
  })

  it('permanently dismisses on dismissDesktopEmptyHint', () => {
    mountDesktopEmptyCta(body as unknown as HTMLElement, () => {})
    const hint = body.querySelector('.desktop-empty-hint')
    expect(hint).not.toBeNull()
    if (hint) docQueryResults = [hint]
    dismissDesktopEmptyHint()
    expect(localStorage.getItem(EMPTY_HINT_KEY)).toBe('1')
    expect(body.querySelector('.desktop-empty-hint')).toBeNull()
  })

  it('dismisses when the user opens their first window', () => {
    localStorage.setItem(GUIDE_KEY, '1')
    mountDesktopEmptyCta(body as unknown as HTMLElement, () => {})
    syncDesktopEmptyCta(body as unknown as HTMLElement, 1)
    expect(localStorage.getItem(EMPTY_HINT_KEY)).toBe('1')
    expect(body.querySelector('.desktop-empty-hint')).toBeNull()
  })

  it('stays hidden while the welcome guide is open', () => {
    mountDesktopEmptyCta(body as unknown as HTMLElement, () => {})
    syncDesktopEmptyCta(body as unknown as HTMLElement, 0)
    const hint = body.querySelector('.desktop-empty-hint') as FakeEl | null
    expect(hint?.hidden).toBe(true)
  })

  it('shows once after the welcome guide is dismissed', () => {
    localStorage.setItem(GUIDE_KEY, '1')
    mountDesktopEmptyCta(body as unknown as HTMLElement, () => {})
    syncDesktopEmptyCta(body as unknown as HTMLElement, 0)
    const hint = body.querySelector('.desktop-empty-hint') as FakeEl | null
    expect(hint?.hidden).toBe(false)
  })
})
