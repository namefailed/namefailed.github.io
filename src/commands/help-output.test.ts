/**
 * Tests for the pure help/keybinds formatters.
 * These functions take a command registry (no import cycle on index.ts) and
 * return plain string arrays, so they are straightforward to assert on once the
 * ANSI colour codes are stripped.
 */

import { describe, it, expect } from 'vitest'
import {
  parseHelpArgv,
  shortenDescriptionForColumns,
  renderHelpTopicDetails,
  renderHelpCompactRoster,
  renderHelpVerboseRoster,
  renderKeybindsLegend,
  runShellHelp,
  type CommandRegistry,
} from './help-output'

/** Strip ANSI SGR escape sequences so assertions can match plain text. */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function joinPlain(lines: string[]): string {
  return plain(lines.join('\n'))
}

const registry: CommandRegistry = {
  resume: { description: 'Show résumé — skills, history, and contact details', run: () => [] },
  links: { description: 'Contact links and outbound profiles', run: () => [] },
  ls: { description: 'List directory contents', run: () => [] },
  secret: { description: 'Hidden command', hidden: true, run: () => [] },
  orphan: { description: 'Not in any help group', run: () => [] },
}

describe('parseHelpArgv', () => {
  it('detects the -v verbose flag (case-insensitive) and collects topics', () => {
    expect(parseHelpArgv(['-v'])).toEqual({ rosterVerbose: true, topics: [] })
    expect(parseHelpArgv(['-V'])).toEqual({ rosterVerbose: true, topics: [] })
    expect(parseHelpArgv(['resume'])).toEqual({ rosterVerbose: false, topics: ['resume'] })
    expect(parseHelpArgv(['-v', 'resume', 'links'])).toEqual({
      rosterVerbose: true,
      topics: ['resume', 'links'],
    })
  })
})

describe('shortenDescriptionForColumns', () => {
  it('keeps short descriptions untouched', () => {
    expect(shortenDescriptionForColumns('List files', 40)).toBe('List files')
  })

  it('truncates with an ellipsis when longer than maxLen', () => {
    const out = shortenDescriptionForColumns('a'.repeat(60), 20)
    expect(out.length).toBeLessThanOrEqual(20)
    expect(out.endsWith('…')).toBe(true)
  })

  it('keeps the lead clause when an em-dash separator is present', () => {
    const out = shortenDescriptionForColumns(
      'Show résumé details — skills, history, and contact info',
      40,
    )
    expect(out).toBe('Show résumé details')
  })
})

describe('renderHelpTopicDetails', () => {
  it('renders details for a known keyword', () => {
    const out = joinPlain(renderHelpTopicDetails(registry, ['resume']))
    expect(out).toContain('resume')
    expect(out).toContain('Show résumé')
  })

  it('resolves topic aliases (contact → links)', () => {
    const out = joinPlain(renderHelpTopicDetails(registry, ['contact']))
    expect(out).toContain('links')
    expect(out).toContain('Contact links')
  })

  it('flags unknown keywords', () => {
    const out = joinPlain(renderHelpTopicDetails(registry, ['nope']))
    expect(out).toContain('Unknown keyword')
    expect(out).toContain('nope')
  })

  it('does not surface hidden commands', () => {
    const out = joinPlain(renderHelpTopicDetails(registry, ['secret']))
    expect(out).toContain('Unknown keyword')
  })
})

describe('roster rendering', () => {
  it('compact roster lists visible commands but hides hidden ones', () => {
    const out = joinPlain(renderHelpCompactRoster(registry))
    expect(out).toContain('resume')
    expect(out).toContain('ls')
    expect(out).not.toContain('Hidden command')
  })

  it('verbose roster includes descriptions and the orphan section', () => {
    const out = joinPlain(renderHelpVerboseRoster(registry))
    expect(out).toContain('Show résumé')
    expect(out).toContain('orphan')
  })
})

describe('runShellHelp routing', () => {
  it('routes topic args to topic details', () => {
    const out = joinPlain(runShellHelp(registry, ['resume']))
    expect(out).toContain('Show résumé')
  })

  it('routes -v to the verbose roster', () => {
    const out = joinPlain(runShellHelp(registry, ['-v']))
    expect(out).toContain('orphan')
  })

  it('defaults to the compact roster', () => {
    const out = joinPlain(runShellHelp(registry, []))
    expect(out).toContain('Portfolio OS')
  })
})

describe('renderKeybindsLegend', () => {
  it('lists window-manager and editor sections', () => {
    const out = joinPlain(renderKeybindsLegend())
    expect(out).toContain('Window manager')
    expect(out).toContain('Editor')
    expect(out).toContain('Ctrl+T')
  })
})
