import { describe, it, expect } from 'vitest'
import { computeFolderPopupPosition } from './folder-popup-layout'

function anchor(top: number, height = 76, left = 96, width = 76) {
  return { left, top, right: left + width, bottom: top + height, width, height }
}

describe('computeFolderPopupPosition', () => {
  const popup = { width: 220, height: 160 }
  const viewport = { width: 1024, height: 768 }

  it('opens above when anchor is low on screen and both sides fit', () => {
    const pos = computeFolderPopupPosition(anchor(520), popup, viewport)
    expect(pos.placement).toBe('above')
    expect(pos.top).toBe(520 - 160 - 10)
  })

  it('opens below when anchor is near the top (default folder row)', () => {
    const pos = computeFolderPopupPosition(anchor(96), popup, viewport)
    expect(pos.placement).toBe('below')
    expect(pos.top).toBe(96 + 76 + 10)
  })

  it('opens above when anchor is near the bottom', () => {
    const pos = computeFolderPopupPosition(anchor(640), popup, viewport)
    expect(pos.placement).toBe('above')
    expect(pos.top).toBeLessThan(640)
  })

  it('clamps horizontal position at left edge', () => {
    const pos = computeFolderPopupPosition(anchor(96, 76, 4), popup, viewport)
    expect(pos.left).toBe(8)
  })

  it('clamps horizontal position at right edge', () => {
    const pos = computeFolderPopupPosition(anchor(96, 76, 900), popup, viewport)
    expect(pos.left).toBe(1024 - 220 - 8)
  })

  it('tall popup below top-row folder still flips below', () => {
    const tall = { width: 280, height: 220 }
    const pos = computeFolderPopupPosition(anchor(96), tall, viewport)
    expect(pos.placement).toBe('below')
  })
})
