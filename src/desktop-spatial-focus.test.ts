import { describe, it, expect } from 'vitest'
import { pickSpatialFocusAction } from './desktop-spatial-focus'

const win = (id: string, left: number, top: number) => ({
  id,
  rect: { left, top, width: 100, height: 80 },
})

describe('pickSpatialFocusAction', () => {
  const layout = [
    win('terminal', 0, 0),
    win('resume', 200, 0),
    win('projects', 200, 120),
  ]

  it('opens terminal when nothing focused and moving left', () => {
    expect(pickSpatialFocusAction([], null, 'h')).toEqual({ type: 'open-terminal' })
  })

  it('focuses first window when nothing focused and moving right', () => {
    expect(pickSpatialFocusAction(layout, null, 'l')).toEqual({ type: 'focus', id: 'terminal' })
  })

  it('picks the window below when pressing j', () => {
    expect(pickSpatialFocusAction(layout, 'resume', 'j')).toEqual({ type: 'focus', id: 'projects' })
  })

  it('focuses terminal tile to the left when present', () => {
    expect(pickSpatialFocusAction(layout, 'projects', 'h')).toEqual({ type: 'focus', id: 'terminal' })
  })

  it('opens terminal when moving left with no tile to the left', () => {
    const noTerminal = [win('resume', 200, 0), win('projects', 200, 120)]
    expect(pickSpatialFocusAction(noTerminal, 'projects', 'h')).toEqual({ type: 'open-terminal' })
  })

  it('no-ops k when nothing is focused', () => {
    expect(pickSpatialFocusAction(layout, null, 'k')).toEqual({ type: 'noop' })
  })
})
