import { describe, it, expect } from 'vitest'
import {
  buildTaskbarDockSnapshot,
  extraDockCommands,
  focusedTitleLabel,
  orderedDockCommands,
  taskbarIconMeta,
  taskbarPinnedAction,
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

describe('taskbarPinnedAction', () => {
  it('minimizes focused terminal tile', () => {
    expect(taskbarPinnedAction('terminal', true, true)).toEqual({
      type: 'minimize-terminal-tile',
    })
  })

  it('opens terminal when tile missing or unfocused', () => {
    expect(taskbarPinnedAction('terminal', false, false)).toEqual({
      type: 'open-terminal-tile',
    })
    expect(taskbarPinnedAction('terminal', true, false)).toEqual({
      type: 'open-terminal-tile',
    })
  })
})

describe('buildTaskbarDockSnapshot', () => {
  it('includes extras outside pinned dock cmds', () => {
    const snap = buildTaskbarDockSnapshot('edit', ['edit'], ['paint'])
    expect(snap.extraCommands).toEqual(['paint'])
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
