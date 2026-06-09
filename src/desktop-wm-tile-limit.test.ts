import { describe, it, expect, vi } from 'vitest'
import { pickTileLimitBump, enforceTileLimit } from './desktop-wm-tile-limit'
describe('pickTileLimitBump', () => {
  it('returns the oldest (first) window in the list', () => {
    const windows = [
      { command: 'whoami' },
      { command: 'links' },
      { command: 'projects' },
    ] as Array<{ command: string }>
    expect(pickTileLimitBump(windows as never)?.command).toBe('whoami')
  })

  it('returns null when no windows are open', () => {
    expect(pickTileLimitBump([])).toBeNull()
  })
})

describe('enforceTileLimit', () => {
  it('calls onWindowBumped when a window is minimized at cap', () => {
    const bumpWin = {
      command: 'whoami',
      isMaximized: () => false,
      setMinimized: vi.fn(),
      el: { remove: vi.fn() },
    }
    const host = {
      windows: [bumpWin, { command: 'links' }],
      minimized: [] as Array<{ win: typeof bumpWin }>,
      maxVisible: 2,
      getFocusedId: () => 'links',
      setFocusedId: vi.fn(),
      unmaximizeContent: vi.fn(),
      onWindowBumped: vi.fn(),
    }
    enforceTileLimit(host as never)
    expect(host.onWindowBumped).toHaveBeenCalledWith(bumpWin)
    expect(host.minimized).toHaveLength(1)
  })
})