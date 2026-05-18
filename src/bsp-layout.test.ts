/**
 * BspLayout column-routing tests.
 *
 * The key invariant: windows route to columns by the "shorter column first,
 * prefer right (col-b) on tie" rule, producing the sequence L R R L R L …
 *
 * The test environment is Node so we supply a minimal FakeEl that properly
 * tracks parent/child relationships and supports the querySelectorAll selectors
 * used by BspLayout and Splitter.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { BspLayout } from './bsp-layout'

// ── Minimal DOM stub ─────────────────────────────────────────────────────────

class FakeEl {
  tagName:   string
  className  = ''
  style:     Record<string, string> = {}
  dataset:   Record<string, string> = {}
  clientWidth  = 800
  clientHeight = 600

  _parent:   FakeEl | null = null
  _children: FakeEl[]     = []

  constructor(tag = 'div') { this.tagName = tag }

  get parentElement(): FakeEl | null { return this._parent }

  appendChild(child: FakeEl): void {
    if (child._parent) child._parent._removeChild(child)
    child._parent = this
    this._children.push(child)
  }

  prepend(child: FakeEl): void {
    if (child._parent) child._parent._removeChild(child)
    child._parent = this
    this._children.unshift(child)
  }

  insertBefore(node: FakeEl, ref: FakeEl): void {
    if (node._parent) node._parent._removeChild(node)
    const idx = this._children.indexOf(ref)
    node._parent = this
    this._children.splice(idx === -1 ? this._children.length : idx, 0, node)
  }

  /** Supports 'afterend' only (used by BspLayout.rebuild). */
  insertAdjacentElement(position: string, el: FakeEl): void {
    if (position === 'afterend' && this._parent) {
      if (el._parent) el._parent._removeChild(el)
      const idx = this._parent._children.indexOf(this)
      el._parent = this._parent
      this._parent._children.splice(idx + 1, 0, el)
    }
  }

  remove(): void {
    if (this._parent) this._parent._removeChild(this)
  }

  _removeChild(child: FakeEl): void {
    const idx = this._children.indexOf(child)
    if (idx !== -1) this._children.splice(idx, 1)
    child._parent = null
  }

  /**
   * Supports the two selectors BspLayout actually uses:
   *   ':scope > .content-window'  — direct children with that class
   *   '.splitter-bsp-h'           — direct children with that class
   */
  querySelectorAll(selector: string): FakeEl[] {
    const classMatch = (el: FakeEl, cls: string) =>
      el.className.split(/\s+/).includes(cls)

    if (selector === ':scope > .content-window')
      return this._children.filter(c => classMatch(c, 'content-window'))

    if (selector === '.splitter-bsp-h')
      return this._children.filter(c => classMatch(c, 'splitter-bsp-h'))

    return []
  }

  /** No-op — satisfies Splitter's addEventListener call */
  addEventListener(_type: string, _handler: unknown): void {}

  classList = {
    add:    (..._classes: string[]) => {},
    remove: (..._classes: string[]) => {},
    toggle: (_cls: string, _force?: boolean) => {},
  }
}

// ── Global stubs ─────────────────────────────────────────────────────────────

beforeAll(() => {
  ;(globalThis as unknown as { document: unknown }).document = {
    createElement: (_tag: string) => new FakeEl(),
    body: {
      classList: { add: () => {}, remove: () => {} },
    },
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a fake window element (BspLayout queries for .content-window). */
function makeWin(): FakeEl {
  const el = new FakeEl()
  el.className = 'content-window'
  return el
}

/** Mount `count` windows in sequence; returns the array of mounted elements. */
function mountN(layout: BspLayout, count: number): FakeEl[] {
  const wins: FakeEl[] = []
  for (let i = 0; i < count; i++) {
    const w = makeWin()
    layout.mount(w as unknown as HTMLElement, i)
    wins.push(w)
  }
  return wins
}

/** Returns 'A' or 'B' depending on which bsp-col the element landed in. */
function side(el: FakeEl): 'A' | 'B' | 'unknown' {
  let cur: FakeEl | null = el
  while (cur) {
    if (cur.className.includes('bsp-col')) {
      const parent: FakeEl | null = cur._parent
      if (!parent) return 'unknown'
      const colEls: FakeEl[] = parent._children.filter((c: FakeEl) => c.className.includes('bsp-col'))
      if (colEls[0] === cur) return 'A'
      if (colEls[1] === cur) return 'B'
    }
    cur = cur._parent
  }
  return 'unknown'
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BspLayout column routing', () => {
  let rightPane: FakeEl
  let layout: BspLayout

  beforeEach(() => {
    rightPane = new FakeEl()
    layout = new BspLayout(rightPane as unknown as HTMLElement)
  })

  it('window 1 goes to the left column (col-A)', () => {
    const [w1] = mountN(layout, 1)
    expect(side(w1!)).toBe('A')
  })

  it('window 2 goes to the right column (col-B)', () => {
    const [, w2] = mountN(layout, 2)
    expect(side(w2!)).toBe('B')
  })

  it('window 3 goes to the right column (tie → prefer right)', () => {
    const [,, w3] = mountN(layout, 3)
    expect(side(w3!)).toBe('B')
  })

  it('window 4 goes to the left column (right is longer)', () => {
    const [,,, w4] = mountN(layout, 4)
    expect(side(w4!)).toBe('A')
  })

  it('first 4 windows follow L R R L routing', () => {
    const wins = mountN(layout, 4)
    expect(wins.map(w => side(w))).toEqual(['A', 'B', 'B', 'A'])
  })

  it('inserts a vertical splitter between col-A and col-B', () => {
    mountN(layout, 2)
    const splitters = rightPane._children.filter((c: FakeEl) => c.className.includes('splitter-v'))
    expect(splitters.length).toBe(1)
  })

  it('inserts a horizontal splitter within a column when a second window is added', () => {
    mountN(layout, 3)
    // col-B now has W2 and W3 — should have 1 horizontal splitter
    const colBChildren: FakeEl[] = rightPane._children
      .filter((c: FakeEl) => c.className.includes('bsp-col'))[1]!._children
    const hSplitters = colBChildren.filter((c: FakeEl) => c.className.includes('splitter-bsp-h'))
    expect(hSplitters.length).toBe(1)
  })
})

describe('BspLayout.destroy', () => {
  it('removes all layout-owned elements from rightPane', () => {
    const rightPane = new FakeEl()
    const layout = new BspLayout(rightPane as unknown as HTMLElement)
    mountN(layout, 4)
    expect(rightPane._children.length).toBeGreaterThan(0)
    layout.destroy()
    // All columns and splitter should be gone
    const remaining = rightPane._children.filter(
      (c: FakeEl) => c.className.includes('bsp-col') || c.className.includes('splitter-v'),
    )
    expect(remaining.length).toBe(0)
  })

  it('is safe to call on a fresh layout (no mount calls)', () => {
    const rightPane = new FakeEl()
    const layout = new BspLayout(rightPane as unknown as HTMLElement)
    expect(() => layout.destroy()).not.toThrow()
  })
})

describe('BspLayout.maxVisible', () => {
  it('caps visible windows at 4', () => {
    const layout = new BspLayout(new FakeEl() as unknown as HTMLElement)
    expect(layout.maxVisible).toBe(4)
  })
})
