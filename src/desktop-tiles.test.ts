import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  visibleDesktopTiles,
  ZONE_PORTFOLIO,
  ZONE_TOOLS,
  snapToGrid,
  defaultTileLayout,
  GRID_CELL,
  TILE_POSITIONS_KEY,
  loadTileLayout,
  saveTileLayout,
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
  it('exposes exactly the 9 visible tiles split across 2 zones', () => {
    const tiles = visibleDesktopTiles()
    expect(tiles.length).toBe(9)
  })

  it('Portfolio zone has 4 hero apps', () => {
    const portfolio = visibleDesktopTiles().filter((t: { zone: string }) => t.zone === ZONE_PORTFOLIO)
    expect(portfolio.map((t: { cmd: string }) => t.cmd).sort()).toEqual(['links', 'projects', 'resume', 'whoami'])
  })

  it('Tools & Fun zone has 5 apps; cube + p5 excluded', () => {
    const fun = visibleDesktopTiles().filter((t: { zone: string }) => t.zone === ZONE_TOOLS)
    const cmds = fun.map((t: { cmd: string }) => t.cmd).sort()
    expect(cmds).toEqual(['edit', 'explorer', 'paint', 'snake', 'terminal'])
    expect(cmds).not.toContain('cube')
    expect(cmds).not.toContain('p5')
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
  it('produces a position for each visible tile', () => {
    const layout = defaultTileLayout()
    expect(Object.keys(layout).length).toBe(9)
    for (const cmd of ['resume', 'projects', 'whoami', 'links', 'terminal', 'explorer', 'edit', 'paint', 'snake']) {
      expect(layout[cmd]).toBeDefined()
      expect(typeof layout[cmd].x).toBe('number')
      expect(typeof layout[cmd].y).toBe('number')
    }
  })

  it('positions portfolio tiles above tools tiles', () => {
    const layout = defaultTileLayout()
    const portfolioY = Math.max(layout.resume.y, layout.projects.y, layout.whoami.y, layout.links.y)
    const toolsY = Math.min(layout.terminal.y, layout.explorer.y, layout.edit.y, layout.paint.y, layout.snake.y)
    expect(portfolioY).toBeLessThan(toolsY)
  })
})

describe('tile layout persistence', () => {
  beforeEach(() => window.localStorage.clear())

  it('returns default layout when nothing is stored', () => {
    const layout = loadTileLayout()
    expect(layout.resume).toEqual(defaultTileLayout().resume)
  })

  it('round-trips a custom position', () => {
    saveTileLayout({ resume: { x: 240, y: 320 } })
    const layout = loadTileLayout()
    expect(layout.resume).toEqual({ x: 240, y: 320 })
  })

  it('falls back to defaults for missing tiles in stored layout', () => {
    window.localStorage.setItem(TILE_POSITIONS_KEY, JSON.stringify({ resume: { x: 1, y: 2 } }))
    const layout = loadTileLayout()
    expect(layout.resume).toEqual({ x: 1, y: 2 })
    expect(layout.projects).toEqual(defaultTileLayout().projects)
  })

  it('survives corrupt JSON gracefully', () => {
    window.localStorage.setItem(TILE_POSITIONS_KEY, 'not json {')
    const layout = loadTileLayout()
    expect(layout).toEqual(defaultTileLayout())
  })
})
