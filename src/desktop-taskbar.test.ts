import { describe, it, expect } from 'vitest'
import {
  extraDockCommands,
  focusedTitleLabel,
  orderedDockCommands,
  taskbarIconMeta,
} from './desktop-taskbar'

describe('taskbarIconMeta', () => {
  it('uses terminal sentinel metadata', () => {
    expect(taskbarIconMeta('terminal')).toEqual({ glyph: '~', label: 'Terminal' })
  })

  it('falls back for unknown commands', () => {
    expect(taskbarIconMeta('unknown-cmd')).toEqual({ glyph: '?', label: 'unknown-cmd' })
  })
})

describe('orderedDockCommands', () => {
  it('dedupes open then minimized order', () => {
    expect(orderedDockCommands(['edit', 'resume'], ['edit', 'paint'])).toEqual([
      'edit',
      'resume',
      'paint',
    ])
  })
})

describe('extraDockCommands', () => {
  it('filters pinned dock entries', () => {
    const dock = ['terminal', 'edit', 'paint', 'snake']
    expect(extraDockCommands(dock)).toEqual(['paint', 'snake'])
  })
})

describe('focusedTitleLabel', () => {
  it('shows site name when nothing is focused and no windows', () => {
    expect(focusedTitleLabel(null, 0)).toBe('mrgrey.site')
  })

  it('shows em dash when windows exist but none focused', () => {
    expect(focusedTitleLabel(null, 2)).toBe('—')
  })

  it('shows terminal prompt when terminal tile is focused', () => {
    expect(focusedTitleLabel('terminal', 1)).toBe('namefailed@dev — ~/terminal')
  })
})
