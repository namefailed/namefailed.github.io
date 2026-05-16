import { describe, it, expect } from 'vitest'
import { visibleDesktopTiles, ZONE_PORTFOLIO, ZONE_TOOLS } from './desktop-tiles'

describe('desktop-tiles catalog', () => {
  it('exposes exactly the 9 visible tiles split across 2 zones', () => {
    const tiles = visibleDesktopTiles()
    expect(tiles.length).toBe(9)
  })

  it('Portfolio zone has 4 hero apps', () => {
    const portfolio = visibleDesktopTiles().filter(t => t.zone === ZONE_PORTFOLIO)
    expect(portfolio.map(t => t.cmd).sort()).toEqual(['links', 'projects', 'resume', 'whoami'])
  })

  it('Tools & Fun zone has 5 apps; cube + p5 excluded', () => {
    const fun = visibleDesktopTiles().filter(t => t.zone === ZONE_TOOLS)
    const cmds = fun.map(t => t.cmd).sort()
    expect(cmds).toEqual(['edit', 'explorer', 'paint', 'snake', 'terminal'])
    expect(cmds).not.toContain('cube')
    expect(cmds).not.toContain('p5')
  })
})
