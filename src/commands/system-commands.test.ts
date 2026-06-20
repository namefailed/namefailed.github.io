/**
 * Tests for system-level shell commands.
 * Only the pure/text commands are tested here (echo, date, cowsay, uptime, cal).
 * Commands that require DOM (notify, desktop) are excluded.
 */

import { describe, it, expect } from 'vitest'
import { systemCommands } from './system-commands'

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[] = []): string {
  const handler = systemCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args).join('\n')
}

// ── echo ─────────────────────────────────────────────────────────────────────

describe('echo command', () => {
  it('echoes its arguments back', () => {
    const out = run('echo', ['hello', 'world'])
    expect(out).toContain('hello world')
  })

  it('echoes an empty string when no args given', () => {
    const out = run('echo')
    // Should not throw; some flavour output is fine
    expect(out).toBeDefined()
  })
})

// ── date ─────────────────────────────────────────────────────────────────────

describe('date command', () => {
  it('returns a non-empty string', () => {
    const out = run('date')
    expect(out.trim().length).toBeGreaterThan(0)
  })

  it('output looks like a date (contains digits)', () => {
    const out = run('date')
    expect(out).toMatch(/\d/)
  })
})

// ── uptime ────────────────────────────────────────────────────────────────────

describe('uptime command', () => {
  it('returns a non-empty string', () => {
    const out = run('uptime')
    expect(out.trim().length).toBeGreaterThan(0)
  })

  it('output contains time or uptime indicator', () => {
    const out = run('uptime').toLowerCase()
    expect(out).toMatch(/up|load|time|\d/)
  })
})

// ── cowsay ───────────────────────────────────────────────────────────────────

describe('cowsay command', () => {
  it('returns output when given a message', () => {
    const out = run('cowsay', ['hello'])
    expect(out.trim().length).toBeGreaterThan(0)
  })

  it('output contains the given message', () => {
    const out = run('cowsay', ['moo'])
    expect(out).toContain('moo')
  })

  it('returns something even with no args', () => {
    const out = run('cowsay')
    expect(out.trim().length).toBeGreaterThan(0)
  })
})

// ── cal ──────────────────────────────────────────────────────────────────────

describe('cal command', () => {
  it('returns a non-empty output', () => {
    const out = run('cal')
    expect(out.trim().length).toBeGreaterThan(0)
  })

  it('output contains digits (calendar days)', () => {
    const out = run('cal')
    expect(out).toMatch(/\d/)
  })
})

// ── systemCommands registry ──────────────────────────────────────────────────

describe('systemCommands registry', () => {
  it('exports all expected system commands', () => {
    const expectedCmds = ['echo', 'date', 'uptime', 'cal', 'cowsay', 'cookies', 'ps']
    for (const cmd of expectedCmds) {
      expect(systemCommands[cmd], `missing command: ${cmd}`).toBeDefined()
    }
  })

  it('every command has a non-empty description', () => {
    for (const [name, cmd] of Object.entries(systemCommands)) {
      expect(typeof cmd.description, `${name}.description`).toBe('string')
      expect(cmd.description.length, `${name}.description`).toBeGreaterThan(0)
    }
  })

  it('every command has a run function', () => {
    for (const [name, cmd] of Object.entries(systemCommands)) {
      expect(typeof cmd.run, `${name}.run`).toBe('function')
    }
  })
})
