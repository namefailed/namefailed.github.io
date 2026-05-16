import { describe, it, expect } from 'vitest'
import {
  tileTitleForPortfolioCommand,
  TILED_WINDOW_COMMANDS,
  EDITOR_LAUNCH_ALIASES,
  TERMINAL_TILE_SENTINEL,
  LAUNCHER_ICON_ROWS,
} from './launcher-catalog'

// ── tileTitleForPortfolioCommand ──────────────────────────────────────────────

describe('tileTitleForPortfolioCommand', () => {
  it('returns the correct title for "links"', () => {
    expect(tileTitleForPortfolioCommand('links')).toBe('contact · outbound')
  })

  it('returns the correct title for "resume"', () => {
    expect(tileTitleForPortfolioCommand('resume')).toBe('résumé · skills')
  })

  it('returns the correct title for "projects"', () => {
    expect(tileTitleForPortfolioCommand('projects')).toBe('work & roadmap')
  })

  it('returns the correct title for "whoami"', () => {
    expect(tileTitleForPortfolioCommand('whoami')).toBe('about me · personal')
  })

  it('returns the command itself for unknown commands', () => {
    expect(tileTitleForPortfolioCommand('edit')).toBe('edit')
    expect(tileTitleForPortfolioCommand('unknown')).toBe('unknown')
    expect(tileTitleForPortfolioCommand('')).toBe('')
  })
})

// ── TILED_WINDOW_COMMANDS ─────────────────────────────────────────────────────

describe('TILED_WINDOW_COMMANDS', () => {
  it('includes core portfolio commands', () => {
    for (const cmd of ['resume', 'links', 'projects', 'whoami']) {
      expect(TILED_WINDOW_COMMANDS.has(cmd)).toBe(true)
    }
  })

  it('includes editor aliases', () => {
    for (const cmd of ['edit', 'editor', 'vim']) {
      expect(TILED_WINDOW_COMMANDS.has(cmd)).toBe(true)
    }
  })

  it('includes game and tool commands', () => {
    for (const cmd of ['paint', 'snake', 'pong', 'p5', 'cube', 'explorer', 'browse']) {
      expect(TILED_WINDOW_COMMANDS.has(cmd)).toBe(true)
    }
  })

  it('does not include "terminal" (terminal is its own window type)', () => {
    expect(TILED_WINDOW_COMMANDS.has('terminal')).toBe(false)
  })
})

// ── EDITOR_LAUNCH_ALIASES ─────────────────────────────────────────────────────

describe('EDITOR_LAUNCH_ALIASES', () => {
  it('includes edit, editor, and vim', () => {
    expect(EDITOR_LAUNCH_ALIASES.has('edit')).toBe(true)
    expect(EDITOR_LAUNCH_ALIASES.has('editor')).toBe(true)
    expect(EDITOR_LAUNCH_ALIASES.has('vim')).toBe(true)
  })

  it('does not include unrelated commands', () => {
    expect(EDITOR_LAUNCH_ALIASES.has('browse')).toBe(false)
    expect(EDITOR_LAUNCH_ALIASES.has('paint')).toBe(false)
  })
})

// ── TERMINAL_TILE_SENTINEL ────────────────────────────────────────────────────

describe('TERMINAL_TILE_SENTINEL', () => {
  it('is a non-empty string', () => {
    expect(typeof TERMINAL_TILE_SENTINEL).toBe('string')
    expect(TERMINAL_TILE_SENTINEL.length).toBeGreaterThan(0)
  })
})

// ── LAUNCHER_ICON_ROWS ────────────────────────────────────────────────────────

describe('LAUNCHER_ICON_ROWS', () => {
  it('is a non-empty array', () => {
    expect(LAUNCHER_ICON_ROWS.length).toBeGreaterThan(0)
  })

  it('has exactly one terminal entry', () => {
    const terminals = LAUNCHER_ICON_ROWS.filter(r => r.kind === 'terminal')
    expect(terminals).toHaveLength(1)
  })

  it('every entry has a non-empty label and glyph', () => {
    for (const row of LAUNCHER_ICON_ROWS) {
      expect(row.label.length).toBeGreaterThan(0)
      expect(row.glyph.length).toBeGreaterThan(0)
    }
  })

  it('every app entry has a non-empty cmd', () => {
    for (const row of LAUNCHER_ICON_ROWS) {
      if (row.kind === 'app') {
        expect(row.cmd.length).toBeGreaterThan(0)
      }
    }
  })

  it('app entry commands are all in TILED_WINDOW_COMMANDS', () => {
    for (const row of LAUNCHER_ICON_ROWS) {
      if (row.kind === 'app') {
        expect(TILED_WINDOW_COMMANDS.has(row.cmd)).toBe(true)
      }
    }
  })
})
