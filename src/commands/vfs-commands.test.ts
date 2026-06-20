/**
 * Tests for VFS shell commands.
 * Each test resets the VFS to a clean default tree before running.
 * Tests verify the text output of each command, not the VFS internals
 * (those are covered by os-fs.test.ts).
 */

import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { vfsReset, vfsCd, vfsWrite, vfsMkdir, vfsPwd, FS_HOME } from '../os-fs'
import { vfsCommands } from './vfs-commands'

/**
 * Minimal localStorage mock so os-fs persistence (debounced save → storageSet)
 * has a real backing store in Node instead of silently no-opping. Lets us assert
 * effects survive a reload path and keeps the safe-storage wrappers exercised.
 */
class MockStorage implements Storage {
  private data = new Map<string, string>()
  get length(): number {
    return this.data.size
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  clear(): void {
    this.data.clear()
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null
  }
}

;(globalThis as unknown as { localStorage: Storage }).localStorage =
  new MockStorage()

// ── helpers ──────────────────────────────────────────────────────────────────

/** Run a vfsCommands handler and return the output as a single joined string. */
function run(cmd: string, args: string[] = []): string {
  const handler = vfsCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args).join('\n')
}

/** Run a vfsCommands handler and return the raw line array (ANSI intact). */
function lines(cmd: string, args: string[] = []): string[] {
  const handler = vfsCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args)
}

/** Strip ANSI escape sequences so assertions can match the visible text. */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
  vfsReset()
  // Return to home dir after each reset (reset leaves cwd at home)
  vfsCd('~')
})

afterEach(() => {
  localStorage.clear()
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

// NOTE: these commands do NOT expand a leading `~` — `vfsNormalize` treats `~`
// as a literal path segment (tilde expansion, if any, happens in the shell layer
// above). So tests pass absolute `${FS_HOME}/…` or cwd-relative paths. The
// *output* still renders home as `~` via `vfsFormatPath`, so display assertions
// use the `~` form.
const DOCS = `${FS_HOME}/Documents`

// ── pwd (extra branches) ───────────────────────────────────────────────────────

describe('pwd command — extra branches', () => {
  it('says cwd resolves to fake home when at home', () => {
    expect(plain(run('pwd'))).toContain('cwd resolves to fake home (~)')
  })

  it('says cwd sits under ~/ when not at home', () => {
    vfsCd(DOCS)
    expect(plain(run('pwd'))).toContain('cwd sits under ~/')
  })

  it('prints an OLDPWD line once a cd has happened', () => {
    vfsCd(DOCS) // sets OLDPWD to home
    const out = plain(run('pwd'))
    expect(out).toContain('OLDPWD')
    expect(out).toContain('~') // formatted previous dir
  })

  it('notes a stray non-flag arg and suggests -P / -L', () => {
    const out = plain(run('pwd', ['garbage']))
    expect(out).toContain('ignoring stray')
    expect(out).toContain('garbage')
    expect(out).toContain('-P')
    expect(out).toContain('-L')
  })

  it('always closes with the localStorage persistence note', () => {
    expect(plain(run('pwd'))).toContain('Paths persist via localStorage')
  })

  it('emits raw ANSI escapes (green cwd) in the output', () => {
    // One test asserts the un-stripped escapes are still present.
    expect(run('pwd')).toContain('\x1b[32m') // c.green
  })
})

// ── ls (long / human / error / empty branches) ─────────────────────────────────

describe('ls command — long, human, and edge branches', () => {
  it('-l renders rwx mode bits and the fake owner columns', () => {
    const out = plain(run('ls', ['-l']))
    expect(out).toMatch(/drwxr-xr-x|-rw-r--r--/)
    expect(out).toContain('namefailed namefailed')
  })

  it('-l -h shows human-readable sizes (B/KiB) instead of raw bytes', () => {
    // notes.txt seeds a small file → size renders with a B suffix under -h.
    const out = plain(run('ls', ['-l', '-h']))
    expect(out).toMatch(/\d+ B|KiB|MiB/)
  })

  it('-l on a nonexistent path returns a single indented ls: error', () => {
    const out = lines('ls', ['-l', '/nope/here'])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toContain('ls: cannot access')
  })

  it('-l on a file (not a dir) returns the Not a directory error', () => {
    const out = plain(run('ls', ['-l', `${FS_HOME}/notes.txt`]))
    expect(out).toContain('Not a directory')
  })

  it('renders the (empty directory) placeholder for a freshly made dir', () => {
    vfsMkdir(`${FS_HOME}/emptydir`)
    const out = plain(run('ls', [`${FS_HOME}/emptydir`]))
    expect(out).toContain('(empty directory)')
  })

  it('-a dims the . and .. entries', () => {
    // The dot entries are wrapped in c.dim … c.reset; assert raw ANSI present.
    const raw = run('ls', ['-a', DOCS])
    expect(raw).toContain('\x1b[2m.\x1b[0m')
  })

  it('--human-readable is accepted as an -h alias under -l', () => {
    const out = plain(run('ls', ['-l', '--human-readable']))
    expect(out).toMatch(/B|KiB|MiB/)
  })

  it('joins a space-separated multi-chunk path before resolving', () => {
    vfsMkdir(`${FS_HOME}/two words`)
    vfsWrite(`${FS_HOME}/two words/inside.txt`, 'x')
    const out = plain(run('ls', [`${FS_HOME}/two`, 'words']))
    expect(out).toContain('inside.txt')
  })

  it('-A behaves like -a (shows the dot entries)', () => {
    const out = plain(run('ls', ['-A', DOCS]))
    expect(out.split('\n').map(l => l.trim())).toContain('.')
  })
})

// ── cd (success, dash jump, errors) ────────────────────────────────────────────

describe('cd command', () => {
  it('changes directory and prints the formatted target', () => {
    const out = plain(run('cd', [DOCS]))
    expect(out).toContain('-> ~/Documents')
    expect(vfsPwd()).toBe(DOCS)
  })

  it('cd - jumps back to OLDPWD and shows the dash line', () => {
    vfsCd(DOCS) // now in ~/Documents, OLDPWD = ~
    vfsCd(FS_HOME) // back home, OLDPWD = ~/Documents
    const out = plain(run('cd', ['-']))
    // dash line names the OLDPWD it hopped to, then prints the new pwd.
    expect(out).toContain('- ~/Documents')
    expect(out).toContain('-> ~/Documents')
    expect(vfsPwd()).toBe(DOCS)
  })

  it('reports an error for a nonexistent directory', () => {
    const out = plain(run('cd', ['/no/such/dir']))
    expect(out).toContain('cd:')
    expect(out).toContain('No such file or directory')
  })

  it('errors when cd-ing into a file', () => {
    const out = plain(run('cd', [`${FS_HOME}/notes.txt`]))
    expect(out).toContain('Not a directory')
  })

  it('with no arg returns home', () => {
    vfsCd(DOCS)
    const out = plain(run('cd', []))
    expect(out).toContain('-> ~')
    expect(vfsPwd()).toBe(FS_HOME)
  })
})

// ── cat (numbering / empty / directory / usage) ────────────────────────────────

describe('cat command — extra branches', () => {
  it('-n prefixes padded line numbers with a gutter', () => {
    vfsWrite(`${FS_HOME}/multi.txt`, 'one\ntwo\nthree')
    const out = plain(run('cat', ['-n', `${FS_HOME}/multi.txt`]))
    expect(out).toContain('1 │ one')
    expect(out).toContain('2 │ two')
    expect(out).toContain('3 │ three')
  })

  it('-n may appear after the path and still number', () => {
    vfsWrite(`${FS_HOME}/aft.txt`, 'alpha')
    const out = plain(run('cat', [`${FS_HOME}/aft.txt`, '-n']))
    expect(out).toContain('1 │ alpha')
  })

  it('renders the (empty file) marker for a zero-byte file', () => {
    vfsWrite(`${FS_HOME}/blank.txt`, '')
    const out = plain(run('cat', [`${FS_HOME}/blank.txt`]))
    expect(out).toContain('(empty file)')
  })

  it('reports a directory as a cat: error', () => {
    const out = plain(run('cat', [DOCS]))
    expect(out).toContain('cat:')
    expect(out).toContain('Is a directory')
  })

  it('prints the usage hint when no path is given', () => {
    const out = plain(run('cat', []))
    expect(out).toContain('usage:')
    expect(out).toContain('cat [-n] <path>')
  })

  it('cats only the first positional path argument', () => {
    vfsWrite(`${FS_HOME}/first.txt`, 'FIRST')
    vfsWrite(`${FS_HOME}/second.txt`, 'SECOND')
    const out = plain(run('cat', [`${FS_HOME}/first.txt`, `${FS_HOME}/second.txt`]))
    expect(out).toContain('FIRST')
    expect(out).not.toContain('SECOND')
  })
})

// ── touch (success effect / error) ─────────────────────────────────────────────

describe('touch command — effects and errors', () => {
  it('mints a file and the ok line shows the normalized path', () => {
    const out = plain(run('touch', [`${FS_HOME}/fresh.txt`]))
    expect(out).toContain(`ok ${FS_HOME}/fresh.txt`)
    expect(out).toContain('inode minted')
    // Real effect: the file now exists and cats as empty.
    expect(plain(run('cat', [`${FS_HOME}/fresh.txt`]))).toContain('(empty file)')
  })

  it('returns the os-fs error when the parent directory is missing', () => {
    const out = plain(run('touch', [`${FS_HOME}/nope/deep.txt`]))
    expect(out).toContain('touch: cannot touch')
    expect(out).toContain('No such file or directory')
  })

  it('prints the usage hint when no path is given', () => {
    expect(plain(run('touch', []))).toContain('usage:')
  })
})

// ── mkdir (success effect) ─────────────────────────────────────────────────────

describe('mkdir command — success effect', () => {
  it('creates a directory listable by ls', () => {
    const out = plain(run('mkdir', [`${FS_HOME}/proj`]))
    expect(out).toContain(`ok ${FS_HOME}/proj`)
    expect(out).toContain('tree node')
    expect(plain(run('ls', [FS_HOME]))).toContain('proj')
  })

  it('returns the os-fs error when a parent segment is missing', () => {
    const out = plain(run('mkdir', [`${FS_HOME}/ghost/child`]))
    expect(out).toContain('mkdir: cannot create directory')
  })
})

// ── rm (recursive directory delete) ────────────────────────────────────────────

describe('rm command — recursive and effects', () => {
  it('removes a directory and its contents recursively', () => {
    vfsMkdir(`${FS_HOME}/box`)
    vfsWrite(`${FS_HOME}/box/inner.txt`, 'data')
    const out = plain(run('rm', [`${FS_HOME}/box`]))
    expect(out).toContain('removed')
    expect(out).toContain(`${FS_HOME}/box`)
    expect(out).toContain('trash-cli not installed')
    // Whole subtree is gone.
    expect(plain(run('ls', [FS_HOME]))).not.toContain('box')
    expect(plain(run('cat', [`${FS_HOME}/box/inner.txt`]))).toContain('No such file or directory')
  })
})

// ── wc (counts / empty / error) ────────────────────────────────────────────────

describe('wc command', () => {
  it('reports line / word / byte counts for a file', () => {
    vfsWrite(`${FS_HOME}/counts.txt`, 'one two\nthree')
    const out = plain(run('wc', [`${FS_HOME}/counts.txt`]))
    // 2 lines, 3 words, 13 chars ("one two\nthree").
    expect(out).toMatch(/\b2\b/)
    expect(out).toMatch(/\b3\b/)
    expect(out).toMatch(/\b13\b/)
    expect(out).toContain(`${FS_HOME}/counts.txt`)
    expect(out).toContain('lines · words')
  })

  it('counts an empty file as 0 0 0', () => {
    vfsWrite(`${FS_HOME}/empty.txt`, '')
    const out = plain(run('wc', [`${FS_HOME}/empty.txt`]))
    expect(out).toMatch(/0\s+0\s+0/)
  })

  it('prints usage when no path is given', () => {
    expect(plain(run('wc', []))).toContain('usage:')
  })

  it('returns the cat: error for a missing file', () => {
    const out = plain(run('wc', [`${FS_HOME}/missing.txt`]))
    expect(out).toContain('cat:')
    expect(out).toContain('No such file or directory')
  })

  it('returns the directory error when pointed at a folder', () => {
    expect(plain(run('wc', [DOCS]))).toContain('Is a directory')
  })
})

// ── head / tail (-n, defaults, empty, errors) ──────────────────────────────────

describe('head command', () => {
  beforeEach(() => {
    // 12 numbered lines so the default N=10 truncation is observable.
    const body = Array.from({ length: 12 }, (_, i) => `line${i + 1}`).join('\n')
    vfsWrite(`${FS_HOME}/big.txt`, body)
  })

  it('defaults to the first 10 lines', () => {
    const out = plain(run('head', [`${FS_HOME}/big.txt`]))
    const rows = out.split('\n')
    expect(rows).toHaveLength(10)
    expect(rows[0]).toContain('line1')
    expect(rows[9]).toContain('line10')
    expect(out).not.toContain('line11')
  })

  it('honours -n to take fewer lines', () => {
    const out = plain(run('head', ['-n', '3', `${FS_HOME}/big.txt`]))
    expect(out.split('\n')).toHaveLength(3)
    expect(out).toContain('line1')
    expect(out).toContain('line3')
    expect(out).not.toContain('line4')
  })

  it('--lines is an -n alias', () => {
    const out = plain(run('head', ['--lines', '2', `${FS_HOME}/big.txt`]))
    expect(out.split('\n')).toHaveLength(2)
  })

  it('-n 0 yields the (empty) placeholder', () => {
    expect(plain(run('head', ['-n', '0', `${FS_HOME}/big.txt`]))).toContain('(empty)')
  })

  it('errors (usage) when no path is given', () => {
    expect(plain(run('head', []))).toContain('usage')
  })

  it('returns the cat: error for a missing file', () => {
    expect(plain(run('head', [`${FS_HOME}/missing.txt`]))).toContain('No such file or directory')
  })

  it('prints a single blank line for a zero-byte file', () => {
    // An empty body splits to [''] → one blank, two-space-indented line (not the
    // (empty) placeholder, which only fires when the slice is genuinely empty).
    vfsWrite(`${FS_HOME}/z.txt`, '')
    expect(lines('head', [`${FS_HOME}/z.txt`])).toEqual(['  '])
  })
})

describe('tail command', () => {
  beforeEach(() => {
    const body = Array.from({ length: 12 }, (_, i) => `row${i + 1}`).join('\n')
    vfsWrite(`${FS_HOME}/big.txt`, body)
  })

  it('defaults to the last 10 lines', () => {
    const out = plain(run('tail', [`${FS_HOME}/big.txt`]))
    const rows = out.split('\n')
    expect(rows).toHaveLength(10)
    expect(rows[0]).toContain('row3')
    expect(rows[9]).toContain('row12')
    expect(out).not.toContain('row2')
  })

  it('honours -n to take fewer trailing lines', () => {
    const out = plain(run('tail', ['-n', '2', `${FS_HOME}/big.txt`]))
    expect(out.split('\n')).toHaveLength(2)
    expect(out).toContain('row11')
    expect(out).toContain('row12')
    expect(out).not.toContain('row10')
  })

  it('a large -n returns the whole (short) file without padding', () => {
    vfsWrite(`${FS_HOME}/short.txt`, 'a\nb')
    const out = plain(run('tail', ['-n', '99', `${FS_HOME}/short.txt`]))
    expect(out.split('\n')).toHaveLength(2)
    expect(out).toContain('a')
    expect(out).toContain('b')
  })

  it('errors (usage) when no path is given', () => {
    expect(plain(run('tail', []))).toContain('usage')
  })

  it('returns the cat: error for a missing file', () => {
    expect(plain(run('tail', [`${FS_HOME}/missing.txt`]))).toContain('No such file or directory')
  })

  it('prints a single blank line for a zero-byte file', () => {
    // Empty body → [''] → one blank indented line. tail's (empty) placeholder is
    // unreachable: slice(max(0, len-n)) on a >=1-length array always keeps >=1 item.
    vfsWrite(`${FS_HOME}/z.txt`, '')
    expect(lines('tail', [`${FS_HOME}/z.txt`])).toEqual(['  '])
  })
})

// ── vfsreset (hidden command) ──────────────────────────────────────────────────

describe('vfsreset command', () => {
  it('wipes user files and restores the default tree', () => {
    run('touch', [`${FS_HOME}/scratch.txt`])
    expect(plain(run('ls', [FS_HOME]))).toContain('scratch.txt')
    const out = plain(run('vfsreset'))
    expect(out).toContain('Filesystem reset to default tree')
    // Scratch file is gone; default notes.txt is back.
    const ls = plain(run('ls', [FS_HOME]))
    expect(ls).not.toContain('scratch.txt')
    expect(ls).toContain('notes.txt')
  })

  it('is marked hidden in the registry', () => {
    expect(vfsCommands['vfsreset']!.hidden).toBe(true)
  })
})

// ── path-style coverage: absolute vs relative ──────────────────────────────────

describe('path resolution styles', () => {
  it('resolves an absolute path and a cwd-relative path to the same file', () => {
    vfsWrite(`${FS_HOME}/abs.txt`, 'ABS')
    // Absolute form.
    expect(plain(run('cat', [`${FS_HOME}/abs.txt`]))).toContain('ABS')
    // Relative form, resolved against the home cwd.
    expect(plain(run('cat', ['abs.txt']))).toContain('ABS')
  })

  it('resolves a relative path against the current directory', () => {
    vfsCd(DOCS)
    vfsWrite(`${DOCS}/rel.txt`, 'REL')
    // No leading / → resolved under cwd (~/Documents).
    expect(plain(run('cat', ['rel.txt']))).toContain('REL')
  })

  it('collapses .. segments when resolving', () => {
    vfsCd(DOCS)
    // ../notes.txt from ~/Documents climbs back to ~/notes.txt.
    expect(plain(run('cat', ['../notes.txt']))).toContain('touch notes.txt')
  })
})
