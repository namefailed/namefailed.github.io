import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
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
})
