/**
 * Tests for the keyword → Command map that backs the xterm shell.
 *
 * Runs in the default Node env: the map and its index-owned runs (help,
 * keybinds, clear) are pure text producers. The spread sub-commands (vfs /
 * system / app) own their own deep tests — here we only confirm they are
 * present and callable, and exercise the three commands `index.ts` defines.
 */

import { describe, it, expect } from 'vitest'
import { commands } from './index'

/** Strip ANSI escape sequences so assertions can match plain text. */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

function runPlain(cmd: string, args: string[] = []): string {
  const handler = commands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args).map(plain).join('\n')
}

// ── map shape ──────────────────────────────────────────────────────────────

describe('commands map shape', () => {
  it('exposes the three index-owned meta keys', () => {
    for (const key of ['help', 'keybinds', 'clear']) {
      expect(commands[key], `missing meta command: ${key}`).toBeDefined()
    }
  })

  it('includes representative keys from each spread sub-module', () => {
    // vfs spread
    for (const key of ['pwd', 'ls', 'cd', 'cat']) {
      expect(commands[key], `missing vfs command: ${key}`).toBeDefined()
    }
    // system spread
    for (const key of ['echo', 'date', 'ps', 'apt', 'cowsay']) {
      expect(commands[key], `missing system command: ${key}`).toBeDefined()
    }
    // app spread
    for (const key of ['links', 'projects', 'snake', 'theme', 'reboot']) {
      expect(commands[key], `missing app command: ${key}`).toBeDefined()
    }
  })

  it('gives every entry a non-empty description string and a run function', () => {
    for (const [name, cmd] of Object.entries(commands)) {
      expect(typeof cmd.description, `${name}.description`).toBe('string')
      expect(cmd.description.length, `${name}.description`).toBeGreaterThan(0)
      expect(typeof cmd.run, `${name}.run`).toBe('function')
    }
  })
})

// ── help (index-owned, forwards the live registry) ──────────────────────────

describe('help command', () => {
  it('renders the compact roster with grouped names when run bare', () => {
    const out = runPlain('help')
    expect(out).toContain('Portfolio OS')
    // Compact roster shows section labels with grouped command ribbons.
    expect(out).toContain('Filesystem:')
    expect(out).toContain('Shell & misc:')
    // It lists keys that live in the spread sub-modules, proving the live
    // registry (not a stale copy) is threaded through.
    expect(out).toContain('cowsay')
    expect(out).toContain('snake')
    // Bare roster is not the verbose per-keyword glossary.
    expect(out).not.toContain('Every keyword')
  })

  it('renders the verbose per-keyword glossary for -v', () => {
    const out = runPlain('help', ['-v'])
    expect(out).toContain('Every keyword')
    // Verbose roster pairs each name with a shortened description sentence.
    expect(out).toContain('keybinds')
    expect(out).toContain('Tip:')
  })

  it('expands a single keyword when given a topic arg', () => {
    const out = runPlain('help', ['resume'])
    // Topic detail echoes the resolved key and its full description.
    expect(out).toContain('resume')
    expect(out).toContain(commands['resume']!.description)
    // Points the reader at the full glossary.
    expect(out).toContain('help -v')
  })

  it('resolves a topic alias to its canonical key (contact → links)', () => {
    const out = runPlain('help', ['contact'])
    expect(out).toContain('links')
    expect(out).toContain(commands['links']!.description)
  })

  it('flags an unknown keyword', () => {
    const out = runPlain('help', ['definitelynotacommand'])
    expect(out).toContain('Unknown keyword:')
    expect(out).toContain('definitelynotacommand')
  })

  it('still emits raw ANSI colour codes (not just plain text)', () => {
    const raw = commands['help']!.run([]).join('\n')
    expect(raw).toContain('\x1b[') // colour escapes are present in the wire output
  })
})

// ── keybinds (index-owned) ──────────────────────────────────────────────────

describe('keybinds command', () => {
  it('renders the full shortcut legend with all sections', () => {
    const out = runPlain('keybinds')
    expect(out).toContain('keybinds')
    expect(out).toContain('Window manager')
    expect(out).toContain('Terminal')
    expect(out).toContain('Editor')
    expect(out).toContain('File explorer')
    expect(out).toContain('Games')
    // A representative binding from the WM section.
    expect(out).toContain('Ctrl+T')
    expect(out).toContain('focus terminal')
  })

  it('ignores any args it is handed', () => {
    expect(runPlain('keybinds', ['--anything'])).toBe(runPlain('keybinds'))
  })
})

// ── clear (index-owned stub) ────────────────────────────────────────────────

describe('clear command', () => {
  it('returns no output (scrollback wipe is handled by the terminal layer)', () => {
    expect(commands['clear']!.run([])).toEqual([])
  })

  it('returns no output for --help and --cow despite advertising them', () => {
    // The run() ignores args entirely; --help / --cow are intercepted upstream
    // by the terminal, so the map handler is a pure empty-array stub.
    expect(commands['clear']!.run(['--help'])).toEqual([])
    expect(commands['clear']!.run(['--cow'])).toEqual([])
  })

  it('advertises its flags in the description', () => {
    const desc = commands['clear']!.description
    expect(desc).toContain('--help')
    expect(desc).toContain('--cow')
  })
})

// ── spread sub-commands: present and callable (not re-tested in depth) ───────

describe('spread sub-commands', () => {
  it('runs a representative vfs command (pwd) without throwing', () => {
    const out = runPlain('pwd')
    expect(out.length).toBeGreaterThan(0)
  })

  it('runs a representative system command (echo) without throwing', () => {
    expect(runPlain('echo', ['hi'])).toContain('hi')
  })

  it('runs a representative app command (links) without throwing', () => {
    // App tile launchers print content lines (links) — here just confirm it is
    // callable and yields an array; the tile/launch behaviour is tested elsewhere.
    const out = commands['links']!.run([])
    expect(Array.isArray(out)).toBe(true)
  })

  it('runs a UI-toggle stub (snake) that returns [] (desktop intercepts it)', () => {
    expect(commands['snake']!.run([])).toEqual([])
  })
})
