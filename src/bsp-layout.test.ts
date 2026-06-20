// @vitest-environment happy-dom
/**
 * BspLayout column-routing tests.
 *
 * Windows alternate L R L R … and stack vertically within each column
 * (up to three per side, six visible total).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { BspLayout, BSP_MAX_PER_COLUMN } from './bsp-layout'
import type { SplitterOptions } from './splitter'

// ── Splitter mock ──────────────────────────────────────────────────────────────
// BspLayout wires real Splitters (pointer listeners, body-class toggles) we don't
// want to drive here. Replace it with a recorder so we can assert the *options*
// BspLayout passes (orientation/target/container/min) and invoke the lazy
// min/max closures directly — that is the only way to reach the clamp arrows
// without simulating a full pointer drag.
const splitterCalls: SplitterOptions[] = []
vi.mock('./splitter', () => ({
  Splitter: class {
    opts: SplitterOptions
    constructor(opts: SplitterOptions) {
      this.opts = opts
      splitterCalls.push(opts)
    }
  },
}))

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
    splitterCalls.length = 0
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

// ── Spillover routing (preferred column full) ────────────────────────────────────
//
// Column routing prefers the column implied by the open index (even → A, odd → B)
// but spills into the other column when the preferred one already holds three
// windows. These exercise the spill arms of resolveCol() that strict alternation
// never reaches.

/** Mount `count` windows but force a specific open-index (alreadyTiled) on each. */
function mountAt(layout: BspLayout, indices: number[]): FakeEl[] {
  const wins: FakeEl[] = []
  for (const idx of indices) {
    const w = makeWin()
    layout.mount(w as unknown as HTMLElement, idx)
    wins.push(w)
  }
  return wins
}

describe('BspLayout spillover routing', () => {
  let rightPane: FakeEl
  let layout: BspLayout

  beforeEach(() => {
    splitterCalls.length = 0
    rightPane = new FakeEl()
    layout = new BspLayout(rightPane as unknown as HTMLElement)
  })

  it('preferA but A is full and B has room → spills the window into col-B', () => {
    // Three even indices fill col-A before col-B even exists.
    mountAt(layout, [0, 2, 4])
    expect(colChildren('A', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(BSP_MAX_PER_COLUMN)
    // A fourth even index still prefers A, but A is full → spills to a fresh col-B.
    const [spill] = mountAt(layout, [6])
    expect(side(spill!)).toBe('B')
  })

  it('creating col-A after col-B inserts it before the existing inter-column splitter', () => {
    // An odd index lands first → col-B and the inter-column splitter exist,
    // but col-A does not yet.
    mountAt(layout, [1])
    const splitterIdxBefore = rightPane._children.findIndex(c => c.className.includes('splitter-v'))
    expect(splitterIdxBefore).toBeGreaterThanOrEqual(0)
    // An even index now creates col-A, which must slot *before* that splitter
    // so left-column / handle / right-column order is preserved.
    const [late] = mountAt(layout, [0])
    expect(side(late!)).toBe('A')
    const colAIdx = rightPane._children.findIndex(c => c.className.includes('bsp-col'))
    const splitterIdx = rightPane._children.findIndex(c => c.className.includes('splitter-v'))
    expect(colAIdx).toBeLessThan(splitterIdx) // col-A precedes the splitter
  })

  it('preferA, A full, B already exists with room → reuses col-B without recreating it', () => {
    // L R L R L fills col-A (0,2,4) and partly fills col-B (1,3) so col-B exists.
    mountN(layout, 5)
    expect(colChildren('A', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(BSP_MAX_PER_COLUMN)
    const splittersBefore = rightPane._children.filter(c => c.className.includes('splitter-v')).length
    // Even index prefers A (full) → spills into the EXISTING col-B (no new splitter).
    const [spill] = mountAt(layout, [6])
    expect(side(spill!)).toBe('B')
    expect(rightPane._children.filter(c => c.className.includes('splitter-v')).length)
      .toBe(splittersBefore) // col-B was reused, not recreated
  })

  it('preferA but BOTH columns are full → falls back into col-A (overflow stack)', () => {
    // L R L R L R fills both columns to three each.
    mountN(layout, 6)
    // A seventh window at an even index prefers A; A and B are both full → back to A.
    const [overflow] = mountAt(layout, [6])
    expect(side(overflow!)).toBe('A')
    // col-A now over-stacks to four windows (no hard cap inside resolveCol itself).
    expect(colChildren('A', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(BSP_MAX_PER_COLUMN + 1)
  })

  it('preferB but B is full while A has room → spills the window into col-A', () => {
    // Seed col-A with one window so it exists as the physical first column,
    // then fill col-B to capacity with odd indices.
    mountAt(layout, [0]) // W → A (A=1)
    mountAt(layout, [1, 3, 5]) // odd indices fill col-B (B=3)
    expect(colChildren('B', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(BSP_MAX_PER_COLUMN)
    expect(colChildren('A', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(1)
    // Another odd index prefers B, but B is full and A still has room → spills to A.
    const [spill] = mountAt(layout, [7])
    expect(side(spill!)).toBe('A')
    expect(colChildren('A', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(2)
  })

  it('preferB but BOTH columns are full → falls back into col-B (overflow stack)', () => {
    mountN(layout, 6)
    // An odd index prefers B; both full → over-stack col-B.
    const [overflow] = mountAt(layout, [7])
    expect(side(overflow!)).toBe('B')
    expect(colChildren('B', rightPane).filter(c => c.className.includes('content-window')).length)
      .toBe(BSP_MAX_PER_COLUMN + 1)
  })
})

// ── Splitter wiring (mount + createColB option closures) ─────────────────────────

describe('BspLayout splitter wiring', () => {
  let rightPane: FakeEl
  let layout: BspLayout

  beforeEach(() => {
    splitterCalls.length = 0
    rightPane = new FakeEl()
    layout = new BspLayout(rightPane as unknown as HTMLElement)
  })

  it('within-column splitter is vertical and clamps to a 60px floor on a small column', () => {
    // Two windows in col-A → one horizontal drag handle between them.
    mountN(layout, 1) // W1 → A
    mountAt(layout, [2]) // W3 → A (stacks under W1, inserts a 'v' splitter)
    const vCall = splitterCalls.find(c => c.orientation === 'v')
    expect(vCall).toBeDefined()
    // colEl.clientHeight defaults to 600 → 15% = 90, floored min stays 90 (> 60).
    expect(vCall!.min).toBe(90)
    // max() = clientHeight(600) − min(90) = 510.
    expect(vCall!.max!()).toBe(510)
  })

  it('within-column min floors at 60px when the column is short', () => {
    const win1 = makeWin()
    layout.mount(win1 as unknown as HTMLElement, 0)
    // Shrink col-A so 15% < 60 → floor wins.
    const colA = rightPane._children.find(c => c.className.includes('bsp-col'))!
    colA.clientHeight = 100 // 15% = 15 → floored to 60
    const win2 = makeWin()
    layout.mount(win2 as unknown as HTMLElement, 2)
    const vCall = splitterCalls.at(-1)!
    expect(vCall.orientation).toBe('v')
    expect(vCall.min).toBe(60)
    // max() = max(60, 100 − 60) = 60 (clamps up to min, never below).
    expect(vCall.max!()).toBe(60)
  })

  it('inter-column splitter is horizontal, targets col-A, and clamps to 20% / 160px', () => {
    mountN(layout, 2) // W1 → A, W2 → B → createColB() wires the 'h' splitter
    const hCall = splitterCalls.find(c => c.orientation === 'h')
    expect(hCall).toBeDefined()
    expect(hCall!.container).toBe(rightPane as unknown as HTMLElement)
    // rightPane.clientWidth defaults to 800 → 20% = 160, floor 160 → min 160.
    expect(hCall!.min).toBe(160)
    // max() = clientWidth(800) − min(160) = 640.
    expect(hCall!.max!()).toBe(640)
    // The inter-column handle resizes col-A (the left column).
    const colA = rightPane._children.find(c => c.className.includes('bsp-col'))
    expect(hCall!.target).toBe(colA as unknown as HTMLElement)
  })

  it('inter-column min floors at 160px on a narrow pane and max() never drops below min', () => {
    rightPane.clientWidth = 200 // 20% = 40 → floored to 160
    mountN(layout, 2)
    const hCall = splitterCalls.find(c => c.orientation === 'h')!
    expect(hCall.min).toBe(160)
    // max() = max(160, 200 − 160) = 160.
    expect(hCall.max!()).toBe(160)
  })
})

// ── rebuild() — splitter resync, sibling collapse, column pruning ─────────────────

describe('BspLayout.rebuild', () => {
  let rightPane: FakeEl
  let layout: BspLayout

  beforeEach(() => {
    splitterCalls.length = 0
    rightPane = new FakeEl()
    layout = new BspLayout(rightPane as unknown as HTMLElement)
  })

  const colChildClasses = (sideLetter: 'A' | 'B') =>
    colChildren(sideLetter, rightPane).map(c => c.className)

  it('is a no-op on a fresh layout (no columns to rebuild)', () => {
    expect(() => layout.rebuild([])).not.toThrow()
    expect(rightPane._children.length).toBe(0)
  })

  it('clears inline sizing and removes stale handles when a column drops to one window', () => {
    // Two windows in col-A (one handle between them).
    mountN(layout, 1)
    mountAt(layout, [2])
    const colA = rightPane._children.find(c => c.className.includes('bsp-col'))!
    expect(colA._children.some(c => c.className.includes('splitter-bsp-h'))).toBe(true)

    // Simulate the second window being closed, then leave a stray inline size on W1.
    const wins = colA._children.filter(c => c.className.includes('content-window'))
    wins[1]!.remove()
    wins[0]!.style.height = '300px'
    wins[0]!.style.flex = '0 0 300px'

    layout.rebuild([])

    // The single survivor's inline sizing is cleared and no handles remain.
    expect(wins[0]!.style.height).toBe('')
    expect(wins[0]!.style.flex).toBe('')
    expect(colA._children.some(c => c.className.includes('splitter-bsp-h'))).toBe(false)
  })

  it('rewires one handle for every consecutive pair in a three-window column', () => {
    mountN(layout, 1) // W1 → A
    mountAt(layout, [2]) // W3 → A
    mountAt(layout, [4]) // W5 → A  (col-A now holds three)
    splitterCalls.length = 0

    layout.rebuild([])

    // Three windows → two fresh 'v' handles, interleaved win/handle/win/handle/win.
    const vCalls = splitterCalls.filter(c => c.orientation === 'v')
    expect(vCalls.length).toBe(2)
    // Each rebuilt handle clamps to the same derived row bounds as mount().
    expect(vCalls[0]!.min).toBe(90) // 15% of the default 600px column height
    expect(vCalls[0]!.max!()).toBe(510) // 600 − 90
    const classes = colChildClasses('A')
    expect(classes[0]).toContain('content-window')
    expect(classes[1]).toContain('splitter-bsp-h')
    expect(classes[2]).toContain('content-window')
    expect(classes[3]).toContain('splitter-bsp-h')
    expect(classes[4]).toContain('content-window')
  })

  it('prunes an emptied column and removes the inter-column splitter', () => {
    mountN(layout, 2) // W1 → A, W2 → B, plus the inter-column 'splitter-v'
    expect(rightPane._children.some(c => c.className.includes('splitter-v'))).toBe(true)

    // Empty col-A entirely (window closed), then rebuild.
    const colA = rightPane._children.find(c => c.className.includes('bsp-col'))!
    colA._children.filter(c => c.className.includes('content-window')).forEach(w => w.remove())

    layout.rebuild([])

    // The empty column is gone AND the inter-column splitter is torn out.
    expect(rightPane._children.some(c => c.className.includes('splitter-v'))).toBe(false)
    const colsLeft = rightPane._children.filter(c => c.className.includes('bsp-col'))
    expect(colsLeft.length).toBe(1) // only the (non-empty) col-B survives
  })

  it('survives rebuild when both columns are emptied', () => {
    mountN(layout, 2)
    rightPane._children
      .filter(c => c.className.includes('bsp-col'))
      .forEach(col => col._children
        .filter(c => c.className.includes('content-window'))
        .forEach(w => w.remove()))

    expect(() => layout.rebuild([])).not.toThrow()
    expect(rightPane._children.filter(c => c.className.includes('bsp-col')).length).toBe(0)
    expect(rightPane._children.some(c => c.className.includes('splitter-v'))).toBe(false)
  })
})

afterEach(() => {
  splitterCalls.length = 0
  vi.restoreAllMocks()
})
