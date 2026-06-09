/**
 * BspLayout column-routing tests.
 *
 * Windows alternate L R L R … and stack vertically within each column
 * (up to three per side, six visible total).
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { BspLayout, BSP_MAX_PER_COLUMN } from './bsp-layout'

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

  querySelectorAll(selector: string): FakeEl[] {
    const classMatch = (el: FakeEl, cls: string) =>
      el.className.split(/\s+/).includes(cls)

    if (selector === ':scope > .content-window')
      return this._children.filter(c => classMatch(c, 'content-window'))

    if (selector === '.splitter-bsp-h')
      return this._children.filter(c => classMatch(c, 'splitter-bsp-h'))

    return []
  }

  addEventListener(_type: string, _handler: unknown): void {}

  classList = {
    add:    (..._classes: string[]) => {},
    remove: (..._classes: string[]) => {},
    toggle: (_cls: string, _force?: boolean) => {},
  }
}

beforeAll(() => {
  ;(globalThis as unknown as { document: unknown }).document = {
    createElement: (_tag: string) => new FakeEl(),
    body: {
      classList: { add: () => {}, remove: () => {} },
    },
  }
})

function makeWin(): FakeEl {
  const el = new FakeEl()
  el.className = 'content-window'
  return el
}

function mountN(layout: BspLayout, count: number): FakeEl[] {
  const wins: FakeEl[] = []
  for (let i = 0; i < count; i++) {
    const w = makeWin()
    layout.mount(w as unknown as HTMLElement, i)
    wins.push(w)
  }
  return wins
}

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

function colChildren(sideLetter: 'A' | 'B', rightPane: FakeEl): FakeEl[] {
  const cols = rightPane._children.filter((c: FakeEl) => c.className.includes('bsp-col'))
  const col = sideLetter === 'A' ? cols[0] : cols[1]
  return col?._children ?? []
}

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

  it('window 3 goes to the left column (under W1)', () => {
    const [,, w3] = mountN(layout, 3)
    expect(side(w3!)).toBe('A')
  })

  it('window 4 goes to the right column (under W2)', () => {
    const [,,, w4] = mountN(layout, 4)
    expect(side(w4!)).toBe('B')
  })

  it('first 6 windows follow L R L R L R routing', () => {
    const wins = mountN(layout, 6)
    expect(wins.map(w => side(w))).toEqual(['A', 'B', 'A', 'B', 'A', 'B'])
  })

  it('inserts a vertical splitter between col-A and col-B', () => {
    mountN(layout, 2)
    const splitters = rightPane._children.filter((c: FakeEl) => c.className.includes('splitter-v'))
    expect(splitters.length).toBe(1)
  })

  it('inserts horizontal splitters when a column stacks three windows', () => {
    mountN(layout, 5)
    const colAChildren = colChildren('A', rightPane)
    const hSplitters = colAChildren.filter((c: FakeEl) => c.className.includes('splitter-bsp-h'))
    expect(hSplitters.length).toBe(2)
  })
})

describe('BspLayout.destroy', () => {
  it('removes all layout-owned elements from rightPane', () => {
    const rightPane = new FakeEl()
    const layout = new BspLayout(rightPane as unknown as HTMLElement)
    mountN(layout, 4)
    expect(rightPane._children.length).toBeGreaterThan(0)
    layout.destroy()
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
  it('caps visible windows at 6 (3 per column)', () => {
    const layout = new BspLayout(new FakeEl() as unknown as HTMLElement)
    expect(layout.maxVisible).toBe(BSP_MAX_PER_COLUMN * 2)
    expect(layout.maxVisible).toBe(6)
  })
})
