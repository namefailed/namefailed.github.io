import { describe, it, expect } from 'vitest'
import { buildPsSnapshot } from './desktop-ps-snapshot'

describe('buildPsSnapshot', () => {
  it('marks focused window with Sl+', () => {
    const rows = buildPsSnapshot(
      [{ command: 'whoami' }, { command: 'links' }] as never,
      [],
      'links',
    )
    expect(rows.find(r => r.cmd === 'links')?.stat).toBe('Sl+')
    expect(rows.find(r => r.cmd === 'whoami')?.stat).toBe('Sl')
  })

  it('lists minimized windows as stopped', () => {
    const rows = buildPsSnapshot([], [{ win: { command: 'paint' } }] as never, null)
    expect(rows.some(r => r.stat === 'T' && r.cmd.includes('paint'))).toBe(true)
  })
})
