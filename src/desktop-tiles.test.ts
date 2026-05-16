import { describe, it, expect } from 'vitest'
import { visibleDesktopTiles, ZONE_PORTFOLIO, ZONE_TOOLS, snapToGrid, defaultTileLayout, GRID_CELL } from './desktop-tiles'

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
