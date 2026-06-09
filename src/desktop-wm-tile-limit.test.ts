import { describe, it, expect } from 'vitest'
import { pickTileLimitBump } from './desktop-wm-tile-limit'

describe('pickTileLimitBump', () => {
  it('prefers a non-focused window', () => {
    const windows = [
      { command: 'whoami' },
      { command: 'links' },
    ] as Array<{ command: string }>
    expect(pickTileLimitBump(windows as never, 'links')?.command).toBe('whoami')
  })

  it('falls back to first window when all match focus', () => {
    const windows = [{ command: 'whoami' }] as Array<{ command: string }>
    expect(pickTileLimitBump(windows as never, 'whoami')?.command).toBe('whoami')
  })
})
