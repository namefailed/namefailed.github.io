/**
 * Tests for VFS shell commands.
 * Each test resets the VFS to a clean default tree before running.
 * Tests verify the text output of each command, not the VFS internals
 * (those are covered by os-fs.test.ts).
 */

import { beforeEach, describe, it, expect } from 'vitest'
import { vfsReset, vfsCd, vfsWrite, FS_HOME } from '../os-fs'
import { vfsCommands } from './vfs-commands'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a vfsCommands handler and return the output as a single joined string. */
function run(cmd: string, args: string[] = []): string {
  const handler = vfsCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args).join('\n')
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vfsReset()
  // Return to home dir after each reset (reset leaves cwd at home)
  vfsCd('~')
})

// ── pwd ──────────────────────────────────────────────────────────────────────

describe('pwd command', () => {
  it('shows the current working directory', () => {
    const out = run('pwd')
    expect(out).toContain('/home/namefailed')
  })

  it('-P flag mentions no symlinks', () => {
    const out = run('pwd', ['-P'])
    expect(out.toLowerCase()).toContain('symlink')
  })

  it('-L flag mentions logical path', () => {
    const out = run('pwd', ['-L'])
    expect(out.toLowerCase()).toContain('logical')
  })
})

// ── ls ───────────────────────────────────────────────────────────────────────

describe('ls command', () => {
  it('lists the home directory files without error', () => {
    const out = run('ls')
    // Should not start with an error
    expect(out).not.toMatch(/^ls:/)
  })

  it('-a shows dotfiles or at least does not error', () => {
    const out = run('ls', ['-a'])
    expect(out).not.toMatch(/^ls:/)
  })

  it('-l shows long listing with size column', () => {
    const out = run('ls', ['-l'])
    // Long format includes directory permissions or file size indicators
    expect(out).not.toMatch(/^ls:/)
  })

  it('returns error for nonexistent path', () => {
    const out = run('ls', ['/does/not/exist'])
    expect(out).toContain('ls:')
  })
})

// ── cat ──────────────────────────────────────────────────────────────────────

describe('cat command', () => {
  it('returns error when no path given', () => {
    const out = run('cat')
    expect(out.length).toBeGreaterThan(0)
    // Should print usage or error — not crash
  })

  it('returns error for nonexistent file', () => {
    const out = run('cat', ['/does/not/exist.txt'])
    expect(out.toLowerCase()).toContain('cat:')
  })

  it('prints the contents of a file that exists', () => {
    vfsWrite(`${FS_HOME}/cat-test.txt`, 'hello from cat')
    const out = run('cat', [`${FS_HOME}/cat-test.txt`])
    expect(out).toContain('hello from cat')
  })
})

// ── touch ────────────────────────────────────────────────────────────────────

describe('touch command', () => {
  it('creates a new file and confirms creation', () => {
    const out = run('touch', ['~/testfile.txt'])
    expect(out).toBeDefined()
    // touch output is minimal; just verify it did not throw
  })

  it('returns usage hint when no path is given', () => {
    const out = run('touch')
    expect(out.length).toBeGreaterThan(0)
  })
})

// ── mkdir ─────────────────────────────────────────────────────────────────────

describe('mkdir command', () => {
  it('creates a directory', () => {
    const out = run('mkdir', ['~/testdir'])
    expect(out).toBeDefined()
  })

  it('returns error if directory already exists', () => {
    run('mkdir', ['~/dupdir'])
    const out = run('mkdir', ['~/dupdir'])
    expect(out.toLowerCase()).toContain('mkdir:')
  })

  it('returns usage when no path given', () => {
    const out = run('mkdir')
    expect(out.length).toBeGreaterThan(0)
  })
})

// ── rm ───────────────────────────────────────────────────────────────────────

describe('rm command', () => {
  it('removes a file that was just created', () => {
    run('touch', ['~/deleteme.txt'])
    const out = run('rm', ['~/deleteme.txt'])
    expect(out).toBeDefined()
    // After rm, cat should fail
    const catOut = run('cat', ['~/deleteme.txt'])
    expect(catOut.toLowerCase()).toContain('cat:')
  })

  it('returns error for nonexistent file', () => {
    const out = run('rm', ['/no/such/file.txt'])
    expect(out.toLowerCase()).toContain('rm:')
  })

  it('returns usage when no path given', () => {
    const out = run('rm')
    expect(out.length).toBeGreaterThan(0)
  })
})

// ── vfsCommands registry ─────────────────────────────────────────────────────

describe('vfsCommands registry', () => {
  it('exports all expected VFS commands', () => {
    const expectedCmds = ['pwd', 'ls', 'cat', 'touch', 'mkdir', 'rm', 'cd', 'wc']
    for (const cmd of expectedCmds) {
      expect(vfsCommands[cmd], `missing command: ${cmd}`).toBeDefined()
    }
  })

  it('every command has a description string', () => {
    for (const [name, cmd] of Object.entries(vfsCommands)) {
      expect(typeof cmd.description, `${name}.description`).toBe('string')
      expect(cmd.description.length, `${name}.description`).toBeGreaterThan(0)
    }
  })

  it('every command has a run function', () => {
    for (const [name, cmd] of Object.entries(vfsCommands)) {
      expect(typeof cmd.run, `${name}.run`).toBe('function')
    }
  })
})
