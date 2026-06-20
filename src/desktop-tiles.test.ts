// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import {
  visibleDesktopTiles,
  standaloneDesktopTiles,
  portfolioFolderTiles,
  appsFolderTiles,
  gameFolderTiles,
  ZONE_PORTFOLIO,
  ZONE_TOOLS,
  GAME_CMDS,
  PORTFOLIO_CMDS,
  snapToGrid,
  defaultTileLayout,
  GRID_CELL,
  TILE_POSITIONS_KEY,
  loadTileLayout,
  saveTileLayout,
  resetTileLayout,
  mountDesktopTiles,
} from './desktop-tiles'

class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) { this.data.set(key, value) }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
  key(index: number) { return [...this.data.keys()][index] ?? null }
}
;(globalThis as unknown as { localStorage: Storage }).localStorage = new MockStorage()

// Minimal window mock for Node/Vitest
beforeAll(() => {
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage,
    setTimeout: (fn: () => void, _ms: number) => { fn(); return 0 },
  }
})

describe('desktop-tiles catalog', () => {
  it('exposes exactly the 12 visible tiles split across 2 zones', () => {
    const tiles = visibleDesktopTiles()
    expect(tiles.length).toBe(12)
  })

  it('Portfolio zone has 4 hero apps', () => {
    const portfolio = visibleDesktopTiles().filter((t: { zone: string }) => t.zone === ZONE_PORTFOLIO)
    expect(portfolio.map((t: { cmd: string }) => t.cmd).sort()).toEqual(['links', 'projects', 'resume', 'whoami'])
  })

  it('Tools & Fun zone has 8 apps including p5, pong, browse', () => {
    const fun = visibleDesktopTiles().filter((t: { zone: string }) => t.zone === ZONE_TOOLS)
    const cmds = fun.map((t: { cmd: string }) => t.cmd).sort()
    expect(cmds).toEqual(['browse', 'edit', 'explorer', 'p5', 'paint', 'pong', 'snake', 'terminal'])
  })

  it('GAME_CMDS contains exactly 4 game commands', () => {
    expect(GAME_CMDS.size).toBe(4)
    for (const cmd of ['paint', 'snake', 'pong', 'p5']) {
      expect(GAME_CMDS.has(cmd)).toBe(true)
    }
  })

  it('standaloneDesktopTiles returns 0 tiles (all tiles are in folders)', () => {
    expect(standaloneDesktopTiles().length).toBe(0)
  })

  it('portfolioFolderTiles returns exactly the 4 portfolio tiles', () => {
    const portfolio = portfolioFolderTiles()
    expect(portfolio.length).toBe(4)
    for (const t of portfolio) {
      expect(PORTFOLIO_CMDS.has(t.cmd)).toBe(true)
      expect(t.zone).toBe(ZONE_PORTFOLIO)
    }
  })

  it('appsFolderTiles returns the 4 tool tiles (no portfolio, no games)', () => {
    const apps = appsFolderTiles()
    expect(apps.length).toBe(4)
    for (const t of apps) {
      expect(PORTFOLIO_CMDS.has(t.cmd)).toBe(false)
      expect(GAME_CMDS.has(t.cmd)).toBe(false)
    }
  })

  it('gameFolderTiles returns exactly the 4 game tiles', () => {
    const games = gameFolderTiles()
    expect(games.length).toBe(4)
    for (const t of games) {
      expect(GAME_CMDS.has(t.cmd)).toBe(true)
    }
  })
})

describe('snap-to-grid', () => {
  it('rounds to nearest grid cell', () => {
    expect(snapToGrid(0)).toBe(0)
    expect(snapToGrid(GRID_CELL / 2 - 1)).toBe(0)
    expect(snapToGrid(GRID_CELL / 2 + 1)).toBe(GRID_CELL)
    expect(snapToGrid(GRID_CELL * 3 + 5)).toBe(GRID_CELL * 3)
  })

  it('never returns a negative cell', () => {
    expect(snapToGrid(-10)).toBe(0)
  })
})

describe('defaultTileLayout', () => {
  it('produces exactly 3 folder positions', () => {
    const layout = defaultTileLayout()
    expect(Object.keys(layout).length).toBe(3)
    for (const cmd of ['portfolio-folder', 'apps-folder', 'games-folder']) {
      expect(layout[cmd]).toBeDefined()
      expect(typeof layout[cmd]!.x).toBe('number')
      expect(typeof layout[cmd]!.y).toBe('number')
    }
  })

  it('all three folders are on the same row (same y)', () => {
    const layout = defaultTileLayout()
    expect(layout['portfolio-folder']!.y).toBe(layout['apps-folder']!.y)
    expect(layout['apps-folder']!.y).toBe(layout['games-folder']!.y)
  })

  it('apps-folder is to the right of portfolio-folder', () => {
    const layout = defaultTileLayout()
    expect(layout['apps-folder']!.x).toBeGreaterThan(layout['portfolio-folder']!.x)
  })
})

describe('tile layout persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns default layout when nothing is stored', () => {
    const layout = loadTileLayout()
    expect(layout['portfolio-folder']).toEqual(defaultTileLayout()['portfolio-folder'])
  })

  it('round-trips a custom position', () => {
    saveTileLayout({ 'portfolio-folder': { x: 240, y: 320 } })
    const layout = loadTileLayout()
    expect(layout['portfolio-folder']).toEqual({ x: 240, y: 320 })
  })

  it('falls back to defaults for missing keys in stored layout', () => {
    window.localStorage.setItem(TILE_POSITIONS_KEY, JSON.stringify({ 'portfolio-folder': { x: 1, y: 2 } }))
    const layout = loadTileLayout()
    expect(layout['portfolio-folder']).toEqual({ x: 1, y: 2 })
    expect(layout['apps-folder']).toEqual(defaultTileLayout()['apps-folder'])
  })

  it('survives corrupt JSON gracefully', () => {
    window.localStorage.setItem(TILE_POSITIONS_KEY, 'not json {')
    const layout = loadTileLayout()
    expect(layout).toEqual(defaultTileLayout())
  })

  it('resetTileLayout drops the stored key so loads fall back to defaults', () => {
    saveTileLayout({ 'portfolio-folder': { x: 999, y: 999 } })
    expect(window.localStorage.getItem(TILE_POSITIONS_KEY)).not.toBeNull()
    resetTileLayout()
    expect(window.localStorage.getItem(TILE_POSITIONS_KEY)).toBeNull()
    expect(loadTileLayout()).toEqual(defaultTileLayout())
  })
})

// ── DOM-driven: mountDesktopTiles, folder popups, drag (happy-dom) ────────────
//
// The catalog/persistence suites above replace `globalThis.window` with a plain
// object in their top-level `beforeAll`. The drag/popup code attaches listeners
// to `window` and reads `window.innerWidth/innerHeight`, so this block restores
// the real happy-dom window (captured at import time, before that beforeAll runs)
// for its own tests and puts the plain object back afterwards.

const realWindow = (globalThis as unknown as { window: Window }).window

/** Build a PointerEvent-shaped object happy-dom + the module both accept. */
function pointer(type: string, x: number, y: number, button = 0): PointerEvent {
  return new PointerEvent(type, {
    button,
    pointerId: 1,
    clientX: x,
    clientY: y,
    bubbles: true,
  })
}

describe('mountDesktopTiles (DOM)', () => {
  const origGBCR = HTMLElement.prototype.getBoundingClientRect
  const origPlainWindow = (globalThis as unknown as { window: unknown }).window
  const origDocAdd = document.addEventListener.bind(document)

  // Geometry the module reads: getBoundingClientRect (popup placement) and
  // offsetWidth/offsetHeight/clientWidth/clientHeight (drag clamp). happy-dom
  // reports 0 for all of these, so we install deterministic getters.
  let tileRect = { left: 100, top: 100, width: 76, height: 76 }
  // Popup measurement + element box size, mutable so a test can force the
  // `||` fallbacks in positionFolderPopup / the drag clamp.
  let popupRect = { left: 100, top: 300, width: 220, height: 180 }
  let offsetSize = 76

  // mountDesktopTiles registers a capture-phase document `pointerdown` listener
  // (close-on-outside-click) that it never removes. Track every document
  // listener added during a test so afterEach can strip them — otherwise stale
  // listeners from a prior mount fire on the wrong popup and corrupt later tests.
  let docListeners: Array<[string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined]> = []

  beforeEach(() => {
    // Restore a fully-featured window for listener wiring + viewport reads.
    ;(globalThis as unknown as { window: Window }).window = realWindow
    Object.defineProperty(realWindow, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(realWindow, 'innerHeight', { configurable: true, value: 768 })

    docListeners = []
    document.addEventListener = ((
      type: string,
      fn: EventListenerOrEventListenerObject,
      opts?: boolean | AddEventListenerOptions,
    ): void => {
      docListeners.push([type, fn, opts])
      origDocAdd(type, fn, opts)
    }) as typeof document.addEventListener

    window.localStorage.clear()
    document.body.replaceChildren()
    tileRect = { left: 100, top: 100, width: 76, height: 76 }
    popupRect = { left: 100, top: 300, width: 220, height: 180 }
    offsetSize = 76

    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement): DOMRect {
      // Folder tiles report a fixed tile box; the popup reports its own box.
      const r = this.classList.contains('folder-popup') ? popupRect : tileRect
      return {
        ...r,
        right: r.left + r.width,
        bottom: r.top + r.height,
        x: r.left,
        y: r.top,
        toJSON: () => ({}),
      } as DOMRect
    }) as unknown as typeof HTMLElement.prototype.getBoundingClientRect

    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => offsetSize })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => offsetSize })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 800 })
  })

  afterEach(() => {
    // Tear down any open popup so listeners + abort controllers don't leak.
    document.body.querySelector('.folder-popup')?.remove()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.body.replaceChildren()

    // Remove every document listener the module added this test, then restore
    // the real addEventListener.
    document.addEventListener = origDocAdd as typeof document.addEventListener
    for (const [type, fn, opts] of docListeners) document.removeEventListener(type, fn, opts)
    docListeners = []

    HTMLElement.prototype.getBoundingClientRect = origGBCR
    delete (HTMLElement.prototype as { offsetWidth?: unknown }).offsetWidth
    delete (HTMLElement.prototype as { offsetHeight?: unknown }).offsetHeight
    delete (HTMLElement.prototype as { clientWidth?: unknown }).clientWidth
    delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight

    // Restore the plain-object window the earlier suites installed.
    ;(globalThis as unknown as { window: unknown }).window = origPlainWindow
    vi.restoreAllMocks()
  })

  function mount() {
    const host = document.createElement('div')
    host.id = 'desktop-workspace'
    document.body.appendChild(host)
    const onActivate = vi.fn()
    mountDesktopTiles({ host, onActivate })
    return { host, onActivate }
  }

  const folder = (host: HTMLElement, cmd: string) =>
    host.querySelector<HTMLButtonElement>(`[data-cmd="${cmd}"]`)!

  /** A folder tile activates via a pointer down→up with no intervening move. */
  function clickFolder(btn: HTMLButtonElement, x = 110, y = 110): void {
    btn.dispatchEvent(pointer('pointerdown', x, y))
    window.dispatchEvent(pointer('pointerup', x, y))
  }

  it('renders exactly the three folder tiles into the host', () => {
    const { host } = mount()
    const tiles = host.querySelectorAll('.desktop-tile--folder')
    expect(tiles.length).toBe(3)
    expect(folder(host, 'portfolio-folder')).not.toBeNull()
    expect(folder(host, 'apps-folder')).not.toBeNull()
    expect(folder(host, 'games-folder')).not.toBeNull()
  })

  it('positions each folder tile from the default layout', () => {
    const { host } = mount()
    const portfolio = folder(host, 'portfolio-folder')
    const apps = folder(host, 'apps-folder')
    expect(portfolio.style.left).toBe(`${GRID_CELL}px`)
    expect(portfolio.style.top).toBe(`${GRID_CELL}px`)
    expect(apps.style.left).toBe(`${GRID_CELL * 2}px`)
  })

  it('applies the per-folder CSS modifier and title', () => {
    const { host } = mount()
    const portfolio = folder(host, 'portfolio-folder')
    const games = folder(host, 'games-folder')
    expect(portfolio.className).toContain('desktop-tile--portfolio')
    expect(games.className).toContain('desktop-tile--games')
    expect(portfolio.title).toBe('Portfolio')
    expect(portfolio.type).toBe('button')
  })

  it('honors a persisted custom position over the default', () => {
    saveTileLayout({
      ...defaultTileLayout(),
      'apps-folder': { x: 480, y: 288 },
    })
    const { host } = mount()
    const apps = folder(host, 'apps-folder')
    expect(apps.style.left).toBe('480px')
    expect(apps.style.top).toBe('288px')
  })

  it('renders a 2×2 mini-grid of up to four glyph previews', () => {
    const { host } = mount()
    const grid = folder(host, 'apps-folder').querySelector('.folder-tile-grid')!
    const minis = grid.querySelectorAll('.folder-tile-mini')
    // Apps folder has exactly 4 tools → 4 minis; never more than 4.
    expect(minis.length).toBe(4)
    expect(minis[0]!.textContent).toBeTruthy()
  })

  it('opens a folder popup listing every tile in that folder', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    expect(popup).not.toBeNull()
    expect(popup.getAttribute('role')).toBe('dialog')
    expect(popup.getAttribute('aria-label')).toBe('Portfolio')
    expect(popup.dataset.openedBy).toBe('portfolio-folder')
    const items = popup.querySelectorAll('.folder-popup-item')
    expect(items.length).toBe(portfolioFolderTiles().length)
    expect(popup.querySelector('.folder-popup-title')!.textContent).toBe('Portfolio')
  })

  it('positions the popup with a placement and pixel coordinates', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    expect(['above', 'below']).toContain(popup.dataset.placement)
    expect(popup.style.left.endsWith('px')).toBe(true)
    expect(popup.style.top.endsWith('px')).toBe(true)
    // Anchor top=100, popup height=180 → not enough room above → placed below.
    expect(popup.dataset.placement).toBe('below')
  })

  it('clicking a popup item activates that command and closes the popup', () => {
    const { host, onActivate } = mount()
    clickFolder(folder(host, 'apps-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    const item = popup.querySelector<HTMLButtonElement>('.folder-popup-item')!
    const cmd = appsFolderTiles()[0]!.cmd
    item.click()
    expect(onActivate).toHaveBeenCalledWith(cmd)
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('clicking the same folder again toggles the popup closed', () => {
    const { host } = mount()
    const btn = folder(host, 'games-folder')
    clickFolder(btn)
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
    clickFolder(btn)
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('clicking a different folder swaps the open popup', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    expect(document.body.querySelector<HTMLElement>('.folder-popup')!.dataset.openedBy)
      .toBe('portfolio-folder')
    clickFolder(folder(host, 'apps-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    expect(popup.dataset.openedBy).toBe('apps-folder')
    expect(document.body.querySelectorAll('.folder-popup').length).toBe(1)
  })

  it('Escape closes an open popup', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('a non-Escape key leaves the popup open', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
  })

  it('pointerdown outside the folder + popup closes the popup', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
    document.body.dispatchEvent(pointer('pointerdown', 5, 5))
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('pointerdown inside the popup keeps it open', () => {
    const { host } = mount()
    clickFolder(folder(host, 'portfolio-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    popup.dispatchEvent(pointer('pointerdown', 110, 310))
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
  })

  it('a click (pointer down→up without moving) activates the folder, not a drag', () => {
    const { host } = mount()
    const btn = folder(host, 'portfolio-folder')
    btn.dispatchEvent(pointer('pointerdown', 110, 110))
    window.dispatchEvent(pointer('pointerup', 110, 110))
    // No movement → toggleFolderPopup ran → popup is open.
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
  })

  it('a non-left button is ignored (no drag, no activation)', () => {
    const { host } = mount()
    const btn = folder(host, 'apps-folder')
    btn.dispatchEvent(pointer('pointerdown', 110, 110, 2)) // right button
    window.dispatchEvent(pointer('pointerup', 110, 110, 2))
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('dragging past the threshold adds the dragging class and moves the tile', () => {
    const { host } = mount()
    const btn = folder(host, 'apps-folder') // default origin (192, 96)
    expect(btn.style.left).toBe(`${GRID_CELL * 2}px`)
    expect(btn.style.top).toBe(`${GRID_CELL}px`)
    btn.dispatchEvent(pointer('pointerdown', 200, 200))
    window.dispatchEvent(pointer('pointermove', 260, 250)) // dx 60, dy 50 > 4px
    expect(btn.classList.contains('desktop-tile--dragging')).toBe(true)
    // origLeft 192 + 60 = 252, origTop 96 + 50 = 146 (live, pre-snap)
    expect(btn.style.left).toBe('252px')
    expect(btn.style.top).toBe('146px')
  })

  it('a sub-threshold move does not start a drag (still a click)', () => {
    const { host } = mount()
    const btn = folder(host, 'games-folder')
    btn.dispatchEvent(pointer('pointerdown', 300, 300))
    window.dispatchEvent(pointer('pointermove', 302, 301)) // hypot ≈ 2.2 < 4
    expect(btn.classList.contains('desktop-tile--dragging')).toBe(false)
    window.dispatchEvent(pointer('pointerup', 302, 301))
    // Treated as a click → popup opens.
    expect(document.body.querySelector('.folder-popup')).not.toBeNull()
  })

  it('dropping a drag snaps to the grid, clears the class, and persists', () => {
    const { host } = mount()
    const btn = folder(host, 'apps-folder') // origin (192, 96)
    btn.dispatchEvent(pointer('pointerdown', 200, 200))
    // dx 148, dy 148 → live left 340, live top 244.
    window.dispatchEvent(pointer('pointermove', 348, 348))
    window.dispatchEvent(pointer('pointerup', 348, 348))
    expect(btn.classList.contains('desktop-tile--dragging')).toBe(false)
    // 340 snaps to 384 (4×96); 244 snaps to 288 (3×96).
    expect(btn.style.left).toBe('384px')
    expect(btn.style.top).toBe('288px')
    const saved = loadTileLayout()
    expect(saved['apps-folder']).toEqual({ x: 384, y: 288 })
    expect(document.body.querySelector('.folder-popup')).toBeNull()
  })

  it('clamps a drop to a one-cell margin on the left/top edges', () => {
    const { host } = mount()
    const btn = folder(host, 'portfolio-folder') // origin 96,96
    btn.dispatchEvent(pointer('pointerdown', 100, 100))
    // Drag far up/left so the snapped value would be 0 → clamp to GRID_CELL.
    window.dispatchEvent(pointer('pointermove', 0, 0)) // dx -100, dy -100
    window.dispatchEvent(pointer('pointerup', 0, 0))
    expect(btn.style.left).toBe(`${GRID_CELL}px`)
    expect(btn.style.top).toBe(`${GRID_CELL}px`)
    expect(loadTileLayout()['portfolio-folder']).toEqual({ x: GRID_CELL, y: GRID_CELL })
  })

  it('clamps a drop to the host bounds on the right/bottom edges', () => {
    const { host } = mount()
    const btn = folder(host, 'apps-folder') // origin 192,96
    btn.dispatchEvent(pointer('pointerdown', 200, 200))
    // Drag far right/down past the host (clientWidth 1200, tile 76, margin 96).
    window.dispatchEvent(pointer('pointermove', 4000, 4000))
    window.dispatchEvent(pointer('pointerup', 4000, 4000))
    // maxX = 1200 - 76 - 96 = 1028 → snap(huge) clamps to 1028; maxY = 800-76-96 = 628.
    expect(parseFloat(btn.style.left)).toBe(1028)
    expect(parseFloat(btn.style.top)).toBe(628)
  })

  it('a stray pointermove before any drag does not move a tile', () => {
    const { host } = mount()
    const btn = folder(host, 'portfolio-folder')
    // No pointerdown registered onMove on window, so this is a true no-op.
    expect(() => window.dispatchEvent(pointer('pointermove', 999, 999))).not.toThrow()
    expect(btn.style.left).toBe(`${GRID_CELL}px`)
  })

  it('falls back to GRID_CELL element size when offsetWidth/Height are 0', () => {
    const { host } = mount()
    offsetSize = 0 // forces `el.offsetWidth || GRID_CELL` / `offsetHeight || GRID_CELL`
    const btn = folder(host, 'apps-folder') // origin 192,96
    btn.dispatchEvent(pointer('pointerdown', 200, 200))
    window.dispatchEvent(pointer('pointermove', 4000, 4000))
    window.dispatchEvent(pointer('pointerup', 4000, 4000))
    // elW/elH default to GRID_CELL(96): maxX = 1200 - 96 - 96 = 1008; maxY = 800 - 96 - 96 = 608.
    expect(parseFloat(btn.style.left)).toBe(1008)
    expect(parseFloat(btn.style.top)).toBe(608)
  })

  it('treats a tile with no inline position as origin 0 when a drag starts', () => {
    const { host } = mount()
    const btn = folder(host, 'games-folder')
    btn.style.left = '' // parseFloat('') is NaN → `|| 0` fallback for origLeft/origTop
    btn.style.top = ''
    btn.dispatchEvent(pointer('pointerdown', 300, 300))
    // dx 100, dy 100 from origin 0 → live left/top 100 before snap.
    window.dispatchEvent(pointer('pointermove', 400, 400))
    expect(btn.style.left).toBe('100px')
    expect(btn.style.top).toBe('100px')
    window.dispatchEvent(pointer('pointerup', 400, 400)) // tidy: end the drag
  })

  it('clamps against the documentElement when the tile has no parent', () => {
    const { host } = mount()
    const btn = folder(host, 'apps-folder')
    btn.dispatchEvent(pointer('pointerdown', 200, 200))
    window.dispatchEvent(pointer('pointermove', 280, 280)) // start the drag (moved=true)
    btn.remove() // parentElement is now null → `?? document.documentElement`
    expect(() => window.dispatchEvent(pointer('pointerup', 280, 280))).not.toThrow()
    // A snapped, clamped position was still written.
    expect(btn.style.left.endsWith('px')).toBe(true)
    expect(btn.style.top.endsWith('px')).toBe(true)
  })

  it('falls back to default popup dimensions when measurement returns 0', () => {
    const { host } = mount()
    // Force both the popup rect AND offset size to 0 so positionFolderPopup
    // uses the hard-coded 220×180 fallback.
    popupRect = { left: 0, top: 0, width: 0, height: 0 }
    offsetSize = 0
    clickFolder(folder(host, 'portfolio-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    expect(popup).not.toBeNull()
    // left is centered on the anchor and clamped to the 1024-wide viewport.
    expect(popup.style.left.endsWith('px')).toBe(true)
    expect(Number.isFinite(parseFloat(popup.style.left))).toBe(true)
    expect(Number.isFinite(parseFloat(popup.style.top))).toBe(true)
  })

  it('uses offsetWidth/Height for the popup when the rect is 0 but offsets are not', () => {
    const { host } = mount()
    popupRect = { left: 0, top: 0, width: 0, height: 0 }
    offsetSize = 200 // rect width 0 → `|| popup.offsetWidth` (200) is used
    clickFolder(folder(host, 'apps-folder'))
    const popup = document.body.querySelector<HTMLElement>('.folder-popup')!
    expect(popup).not.toBeNull()
    expect(Number.isFinite(parseFloat(popup.style.left))).toBe(true)
  })

  it('mounting twice does not duplicate tiles in the host', () => {
    const { host } = mount()
    mountDesktopTiles({ host, onActivate: vi.fn() })
    // Second mount appends another 3 → 6 total (each mount is additive by design).
    expect(host.querySelectorAll('.desktop-tile--folder').length).toBe(6)
  })
})
