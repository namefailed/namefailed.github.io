/**
 * Tests for system-level shell commands.
 *
 * Runs in the default Node env (no DOM). Commands fall into three groups:
 *  - Pure/text: echo, date, uptime, cowsay, cal — exercised directly.
 *  - Storage-backed: cookies, apt, ps — localStorage is absent, so the safe
 *    storage wrappers no-op; we assert the deterministic structure/text instead.
 *  - DOM-touching: notify — `pushToast` reads `document`/`window`, so those are
 *    stubbed per-test and torn down in afterEach so nothing leaks into the suite.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { systemCommands } from './system-commands'
import { setDesktopRef } from '../os-registry'
import { vfsReset } from '../os-fs'
import type { Desktop } from '../desktop'
import type { PsSnapshotRow } from '../desktop-ps-snapshot'

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd: string, args: string[] = []): string {
  const handler = systemCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args).join('\n')
}

function lines(cmd: string, args: string[] = []): string[] {
  const handler = systemCommands[cmd]
  if (!handler) throw new Error(`Unknown command: ${cmd}`)
  return handler.run(args)
}

/** Strip ANSI escape sequences so assertions can match plain text. */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

/** Install a fake desktop whose ps snapshot is fully controlled by the test. */
function setFakePsSnapshot(rows: PsSnapshotRow[]): void {
  setDesktopRef({ getPsSnapshot: () => rows } as unknown as Desktop)
}

function clearDesktopRef(): void {
  setDesktopRef(null as unknown as Desktop)
}

// ── echo ─────────────────────────────────────────────────────────────────────

describe('echo command', () => {
  it('echoes its arguments back', () => {
    const out = run('echo', ['hello', 'world'])
    expect(out).toContain('hello world')
  })

  it('joins multiple args with single spaces', () => {
    const out = lines('echo', ['a', 'b', 'c'])
    // Single line, two-space indent, args space-joined.
    expect(out).toEqual(['  a b c'])
  })

  it('reports an empty line when no args given', () => {
    const out = lines('echo', [])
    expect(out).toHaveLength(1)
    expect(plain(out[0]!)).toBe('  (empty line)')
  })

  it('prints help for --help and -h', () => {
    const help = plain(run('echo', ['--help']))
    expect(help).toContain('echo [text]')
    expect(help).toContain('echo --fortune')
    expect(help).toContain('echo --cow')
    // -h takes the same branch.
    expect(plain(run('echo', ['-h']))).toContain('echo [text]')
  })

  it('rolls a d20 in 1..20 for --d20 and --roll', () => {
    for (const flag of ['--d20', '--roll']) {
      const out = plain(run('echo', [flag]))
      const m = out.match(/d20 ⇒\s+(\d+)/)
      expect(m, `no roll in: ${out}`).not.toBeNull()
      const roll = Number(m![1])
      expect(roll).toBeGreaterThanOrEqual(1)
      expect(roll).toBeLessThanOrEqual(20)
    }
  })

  it('d20 honours a stubbed Math.random for the boundary values', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(plain(run('echo', ['--d20']))).toContain('d20 ⇒ 1')
    spy.mockReturnValue(0.999999)
    expect(plain(run('echo', ['--d20']))).toContain('d20 ⇒ 20')
    spy.mockRestore()
  })

  it('returns a quoted fortune line for --fortune and -f', () => {
    const out = plain(run('echo', ['--fortune']))
    expect(out).toMatch(/".+"/)
    expect(out).toContain('echo --fortune again for reroll')
    expect(plain(run('echo', ['-f']))).toMatch(/".+"/)
  })

  it('renders a cow bubble for --cow with the given message', () => {
    const out = plain(run('echo', ['--cow', 'moo', 'there']))
    expect(out).toContain('moo there')
    expect(out).toContain('^__^') // cow ASCII present
  })

  it('uses the abyss filler when --cow has no message', () => {
    const out = plain(run('echo', ['--cow']))
    expect(out).toContain('the cow stared into the abyss')
  })

  it('reacts to the literal 42', () => {
    const out = plain(run('echo', ['42']))
    expect(out).toContain('base thirteen')
  })

  it('refuses sudo with a kiosk quip (case-insensitive)', () => {
    expect(plain(run('echo', ['sudo', 'rm', '-rf']))).toContain('lacks god mode')
    expect(plain(run('echo', ['SUDO', 'su']))).toContain('lacks god mode')
  })

  it('intercepts :wq with a shell reminder', () => {
    const out = plain(run('echo', [':wq']))
    expect(out).toContain('this is still the shell')
  })

  it('grants an achievement for hello world variants', () => {
    for (const variant of ['hello world', 'Hello, World!', 'hello, world']) {
      const out = plain(run('echo', variant.split(' ')))
      expect(out, variant).toContain('achievement:')
      expect(out, variant).toContain('hello world')
    }
  })

  it('does not trigger the hello-world easter egg on near-misses', () => {
    const out = plain(run('echo', ['hello', 'there', 'world']))
    expect(out).not.toContain('achievement:')
    expect(out).toBe('  hello there world')
  })
})

// ── date ─────────────────────────────────────────────────────────────────────

describe('date command', () => {
  it('returns a non-empty string with digits', () => {
    const out = run('date')
    expect(out.trim().length).toBeGreaterThan(0)
    expect(out).toMatch(/\d/)
  })

  it('includes the epoch-ms line and UTC offset', () => {
    const out = plain(run('date'))
    expect(out).toMatch(/epoch ms \d+/)
    expect(out).toMatch(/UTC offset -?\d+ min/)
  })
})

// ── uptime ────────────────────────────────────────────────────────────────────

describe('uptime command', () => {
  it('formats a d/h/m uptime line', () => {
    const out = plain(run('uptime'))
    expect(out).toMatch(/up \d+d \d+h \d+m/)
  })

  it('notes it is SPA session lore, not machine uptime', () => {
    expect(plain(run('uptime'))).toContain('SPA session lore')
  })
})

// ── cowsay ───────────────────────────────────────────────────────────────────

describe('cowsay command', () => {
  it('wraps the message in a speech bubble', () => {
    const out = plain(run('cowsay', ['moo']))
    expect(out).toContain('< moo')
    expect(out).toContain('^__^')
    expect(out).toContain('(oo)')
  })

  it('falls back to "moo" when no message is given', () => {
    // cowsayFormat trims a blank message to its default "moo".
    const out = plain(run('cowsay'))
    expect(out).toContain('< moo')
  })

  it('indents every bubble line by two spaces and brackets with blanks', () => {
    const out = lines('cowsay', ['hi'])
    expect(out[0]).toBe('') // leading blank
    expect(out[out.length - 1]).toBe('') // trailing blank
    for (const l of out.slice(1, -1)) expect(l.startsWith('  ')).toBe(true)
  })
})

// ── cal ──────────────────────────────────────────────────────────────────────

describe('cal command', () => {
  it('renders the weekday header row and digits', () => {
    const out = plain(run('cal'))
    expect(out).toContain('Su Mo Tu We Th Fr Sa')
    expect(out).toMatch(/\d/)
  })

  it('honours an explicit month + year argument', () => {
    // February 2024 is a leap year — must contain the 29th and the label.
    const out = plain(run('cal', ['2', '2024']))
    expect(out).toContain('February 2024')
    expect(out).toContain('29')
  })

  it('ignores out-of-range month/year and stays on a valid grid', () => {
    const out = plain(run('cal', ['99', '3000']))
    // Bad inputs fall through to "now"; still a valid calendar with a header.
    expect(out).toContain('Su Mo Tu We Th Fr Sa')
  })
})

// ── notify (DOM-backed via pushToast) ──────────────────────────────────────────

describe('notify command', () => {
  let appended: Array<{ className: string; text: string }>

  beforeEach(() => {
    appended = []
    const stack = {
      appendChild(el: { className: string; textContent: string }) {
        appended.push({ className: el.className, text: el.textContent })
      },
    }
    const fakeDoc = {
      getElementById: (id: string) => (id === 'toast-stack' ? stack : null),
      createElement: () => ({
        className: '',
        textContent: '',
        setAttribute() {},
        classList: { add() {}, toggle() {} },
        addEventListener() {},
        appendChild() {},
      }),
    }
    vi.stubGlobal('document', fakeDoc)
    vi.stubGlobal('window', { setTimeout: () => 0 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('queues a toast with the joined message text', () => {
    const out = plain(run('notify', ['build', 'finished']))
    expect(out).toContain('toast: build finished')
    expect(appended).toHaveLength(1)
    expect(appended[0]!.text).toBe('build finished')
  })

  it('defaults to "Notification" text when no message follows the flags', () => {
    const out = plain(run('notify', []))
    expect(out).toContain('toast: Notification')
    expect(appended[0]!.text).toBe('Notification')
  })

  it('applies warn styling for -w / --warn and reports it', () => {
    const out = plain(run('notify', ['-w', 'careful']))
    expect(out).toContain('toast: careful')
    expect(out).toContain('warn styling')
    expect(appended[0]!.className).toContain('toast--warn')
  })

  it('parses -t duration and notes it when non-default', () => {
    const out = plain(run('notify', ['-t', '8000', 'timed']))
    expect(out).toContain('toast: timed')
    expect(out).toContain('-t 8000')
  })

  it('clamps -t to the 900..22000 ms range', () => {
    // Below floor → 900, above ceiling → 22000. Both differ from the 4200 default
    // so both surface a flag note.
    expect(plain(run('notify', ['-t', '10', 'low']))).toContain('-t 900')
    expect(plain(run('notify', ['-t', '999999', 'high']))).toContain('-t 22000')
  })

  it('consumes a non-numeric -t value but keeps the default duration', () => {
    // 'abc' is still consumed as the -t operand (i += 2), but parseInt → NaN so
    // duration stays at the 4200 default → the no-flag hint branch is taken.
    const out = plain(run('notify', ['-t', 'abc', 'plain']))
    expect(out).toContain('toast: plain')
    expect(out).toContain('backdrop click dismisses')
    expect(out).not.toContain('-t ')
  })

  it('combines --time alias and --warn flags', () => {
    const out = plain(run('notify', ['--time', '3000', '--warn', 'both']))
    expect(out).toContain('toast: both')
    expect(out).toContain('-t 3000')
    expect(out).toContain('warn styling')
    expect(appended[0]!.className).toContain('toast--warn')
  })
})

// ── ps (window-manager view) ───────────────────────────────────────────────────

describe('ps command', () => {
  afterEach(() => {
    clearDesktopRef()
  })

  it('renders only the header + framing when no desktop is registered', () => {
    clearDesktopRef()
    const out = lines('ps')
    expect(out[0]).toBe('')
    expect(plain(out[1]!)).toContain('PID')
    expect(plain(out[1]!)).toContain('CMD')
    // No process rows between header and the framing note.
    expect(plain(out[2]!)).toContain('window-manager view')
    expect(out[out.length - 1]).toBe('')
  })

  it('lists each snapshot row in the compact view', () => {
    setFakePsSnapshot([
      { pid: 400, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' },
      { pid: 401, tty: 'wm-pty', stat: 'Sl+', time: '0:00', cmd: 'whoami' },
    ])
    const out = plain(run('ps'))
    expect(out).toContain('-bash')
    expect(out).toContain('whoami')
    expect(out).toContain('400')
    expect(out).toContain('401')
    // Compact header has no USER/PPID columns.
    expect(out).not.toContain('USER')
    expect(out).not.toContain('PPID')
  })

  it('widens to a USER/PPID layout for -f and aux', () => {
    setFakePsSnapshot([
      { pid: 400, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' },
    ])
    for (const flag of ['-f', 'aux', '-ef', '-l']) {
      const out = plain(run('ps', [flag]))
      expect(out, flag).toContain('USER')
      expect(out, flag).toContain('PPID')
      // USER column is the fake "namefailed".
      expect(out, flag).toContain('namefailed')
    }
  })

  it('does not pad columns whose value already meets the width', () => {
    // A 6-digit pid exceeds the 5-wide PID column and a long cmd/tty exercise the
    // already-wide branch of the padStart/padEnd helpers (no leading/trailing pad).
    setFakePsSnapshot([
      { pid: 123456, tty: 'verylongtty', stat: 'Sl+', time: '12:34', cmd: 'a-really-long-command-name' },
    ])
    const out = plain(run('ps', ['-f']))
    expect(out).toContain('123456')
    expect(out).toContain('verylongtty')
    expect(out).toContain('a-really-long-command-name')
  })

  it('keeps the compact layout for unrelated flags', () => {
    setFakePsSnapshot([
      { pid: 400, tty: 'pts/0', stat: 'Ss+', time: '0:00', cmd: '-bash' },
    ])
    const out = plain(run('ps', ['-x']))
    expect(out).not.toContain('USER')
  })
})

// ── apt (toy package manager) ──────────────────────────────────────────────────

describe('apt command', () => {
  it('prints help for no args, help, and --help', () => {
    for (const args of [[], ['help'], ['--help']]) {
      const out = plain(lines('apt', args).join('\n'))
      expect(out, JSON.stringify(args)).toContain('cosmetic installs')
      expect(out, JSON.stringify(args)).toContain('apt install cowsay')
    }
  })

  it('errors when install is given no package name', () => {
    const out = plain(run('apt', ['install']))
    expect(out).toContain('need a package name')
  })

  it('installs cowsay and lists it, then reports already-installed on a repeat', () => {
    const first = plain(run('apt', ['install', 'cowsay']))
    // Either freshly installed this run, or already present from a prior test —
    // both are valid cowsay outcomes (never the unknown-package rejection).
    expect(first).toMatch(/on disk|already at newest/)
    expect(first).not.toContain('no binaries here')

    const list = plain(run('apt', ['list']))
    expect(list).toContain('cowsay')

    const second = plain(run('apt', ['install', 'cowsay']))
    expect(second).toContain('already at newest')
  })

  it('rejects an unknown package with the conveyor-belt quip', () => {
    const out = plain(run('apt', ['install', 'emacs']))
    expect(out).toContain('no binaries here')
    expect(out).toContain('cowsay')
  })

  it('removes an installed package and refuses to remove a missing one', () => {
    run('apt', ['install', 'cowsay']) // ensure present
    expect(plain(run('apt', ['remove', 'cowsay']))).toContain('Removing cowsay')
    // Now gone — remove again reports not installed.
    expect(plain(run('apt', ['remove', 'cowsay']))).toContain("'cowsay' is not installed")
  })

  it('errors when remove is given no package name', () => {
    expect(plain(run('apt', ['remove']))).toContain('need a package name')
  })

  it('reports nothing pending for update/upgrade', () => {
    expect(plain(run('apt', ['update']))).toContain('Nothing pending')
    expect(plain(run('apt', ['upgrade']))).toContain('Nothing pending')
  })

  it('searches the phantom shelf and filters by needle', () => {
    const docker = plain(run('apt', ['search', 'docker']))
    expect(docker).toContain('docker-for-tabs')
    expect(docker).not.toContain('left-pad-memorial')

    const all = plain(run('apt', ['search']))
    // Empty needle lists the whole shelf.
    expect(all).toContain('cowsay')
    expect(all).toContain('left-pad-memorial')
  })

  it('reports no matches for a needle that hits nothing', () => {
    const out = plain(run('apt', ['search', 'zzzznope']))
    expect(out).toContain('no phantom packages match')
  })

  it('rejects an unknown subcommand', () => {
    expect(plain(run('apt', ['frobnicate']))).toContain('Unknown')
  })
})

// ── cookies (virtual FS + flags) ───────────────────────────────────────────────

describe('cookies command', () => {
  beforeEach(() => {
    vfsReset()
  })

  it('shows the default help with the three subcommands', () => {
    const out = plain(run('cookies'))
    expect(out).toContain('cookies stats')
    expect(out).toContain('cookies reload')
    expect(out).toContain('cookies clear')
  })

  it('stats reports file/dir counts, cwd, and an approx byte footprint', () => {
    const out = plain(run('cookies', ['stats']))
    expect(out).toContain('virtual disk')
    expect(out).toContain('cwd')
    expect(out).toMatch(/files \/ dirs\s+\d+ \/ \d+/)
    expect(out).toMatch(/~bytes on wire ~\d+/)
    expect(out).toContain('KiB-ish')
  })

  it('df is an alias for stats', () => {
    const stats = plain(run('cookies', ['stats']))
    const df = plain(run('cookies', ['df']))
    // Same headings; the exact byte count may differ only if state changed,
    // but back-to-back calls on a fresh reset match.
    expect(df).toContain('virtual disk')
    expect(df).toMatch(/files \/ dirs/)
    expect(df.split('\n').length).toBe(stats.split('\n').length)
  })

  it('clear wipes the FS and confirms the factory default', () => {
    const out = plain(run('cookies', ['clear']))
    expect(out).toContain('Virtual home cleared')
    expect(out).toContain('Welcome guide reset')
    expect(out).toContain('Theme, CRT, matrix')
  })

  it('reload re-reads storage and reports success', () => {
    const out = plain(run('cookies', ['reload']))
    expect(out).toContain('Reloaded from browser storage')
  })

  it('is case-insensitive on the subcommand', () => {
    expect(plain(run('cookies', ['STATS']))).toContain('virtual disk')
    expect(plain(run('cookies', ['Clear']))).toContain('Virtual home cleared')
  })
})

// ── systemCommands registry ──────────────────────────────────────────────────

describe('systemCommands registry', () => {
  it('exports all expected system commands', () => {
    const expectedCmds = ['echo', 'date', 'uptime', 'cal', 'cowsay', 'cookies', 'ps', 'apt', 'notify']
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
