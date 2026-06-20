import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { WindowSpec } from './desktop'
import type { Command } from './commands/types'
import { c } from './theme'

// ── Mocks for side-effecting collaborators ─────────────────────────────────
// Keep the real `c` ANSI helpers (so we can assert exact strings) but stub the
// theme-control re-exports we need to drive deterministically.

const themeState = {
  id: 'mocha',
  label: 'Catppuccin Mocha',
  summaries: [
    { id: 'mocha', label: 'Catppuccin Mocha' },
    { id: 'dracula', label: 'Dracula' },
  ] as { id: string; label: string }[],
  applyResult: true,
}

vi.mock('./theme', async (importActual) => {
  const actual = await importActual<typeof import('./theme')>()
  return {
    c: actual.c,
    getActivePack: () => ({ label: themeState.label }),
    getThemeId: () => themeState.id,
    listThemeSummaries: () => themeState.summaries,
    applyTheme: vi.fn((id: string) => {
      if (themeState.applyResult) themeState.id = id
      return themeState.applyResult
    }),
  }
})

const retroState = { on: false }
const setRetroFx = vi.fn((on: boolean) => { retroState.on = on })
const toggleRetroFx = vi.fn(() => { retroState.on = !retroState.on; return retroState.on })
vi.mock('./retro-fx', () => ({
  getRetroFx: () => retroState.on,
  setRetroFx: (on: boolean) => setRetroFx(on),
  toggleRetroFx: () => toggleRetroFx(),
}))

const matrixState = { handle: null as null | { enabled: boolean }, setEnabled: vi.fn() }
vi.mock('./matrix-bg', () => ({
  getMatrixBgHandle: () => {
    if (!matrixState.handle) return null
    return {
      isEnabled: () => matrixState.handle!.enabled,
      setEnabled: (on: boolean) => {
        matrixState.setEnabled(on)
        matrixState.handle!.enabled = on
      },
    }
  },
}))

const soundState = { enabled: true, volume: 0.5 }
const setSoundEnabled = vi.fn((on: boolean) => { soundState.enabled = on })
const toggleSound = vi.fn(() => { soundState.enabled = !soundState.enabled })
const resumeAudioIfNeeded = vi.fn(async () => {})
vi.mock('./os-sound', () => ({
  playOsSound: vi.fn(),
  resumeAudioIfNeeded: () => resumeAudioIfNeeded(),
  setSoundEnabled: (on: boolean) => setSoundEnabled(on),
  isSoundEnabled: () => soundState.enabled,
  toggleSound: () => toggleSound(),
  getSoundVolume: () => soundState.volume,
}))

const syncSettingsSoundToggle = vi.fn()
vi.mock('./os-systray', () => ({
  syncSettingsSoundToggle: () => syncSettingsSoundToggle(),
}))

// Make randomPick deterministic so status lines are assertable.
vi.mock('./random-pick', () => ({
  randomPick: <T,>(arr: readonly T[]): T => arr[0]!,
}))

import { dispatchTerminalCommand, type TerminalCommandHost } from './terminal-command-router'
import { playOsSound } from './os-sound'

// ── Fake host ──────────────────────────────────────────────────────────────
interface Recorder extends TerminalCommandHost {
  lines: string[]
  windows: WindowSpec[]
  history: string[]
  cleared: number
  motdShown: number
  themeRefreshed: number
}

function makeHost(): Recorder {
  const lines: string[] = []
  return {
    lines,
    windows: [],
    history: [],
    cleared: 0,
    motdShown: 0,
    themeRefreshed: 0,
    writeln(line) { lines.push(line) },
    writeLines(ls) { lines.push(...ls) },
    clearTerminal() { this.cleared++ },
    onOpenWindow(spec) { this.windows.push(spec) },
    async showSpinner() {},
    refreshTerminalTheme() { this.themeRefreshed++ },
    async showMotd() { this.motdShown++ },
    recordHistory(raw) { this.history.push(raw) },
  }
}

const noopCmd: Command = { description: 'noop', run: () => ['CMD_OUTPUT'] }

beforeEach(() => {
  retroState.on = false
  matrixState.handle = null
  soundState.enabled = true
  soundState.volume = 0.5
  themeState.id = 'mocha'
  themeState.label = 'Catppuccin Mocha'
  themeState.applyResult = true
  vi.clearAllMocks()
  ;(globalThis as unknown as { window: unknown }).window = {
    location: { protocol: 'https:', origin: 'https://example.com', href: 'https://example.com/', assign: vi.fn() },
  }
})

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('static portfolio redirect', () => {
  for (const name of ['static', 'plain', 'x']) {
    it(`'${name}' records history, prints target, navigates, and returns exit`, async () => {
      const host = makeHost()
      const assign = (window.location as unknown as { assign: ReturnType<typeof vi.fn> }).assign
      const result = await dispatchTerminalCommand(host, name, [], name, noopCmd)
      expect(result).toBe('exit')
      expect(host.history).toEqual([name])
      expect(assign).toHaveBeenCalledWith('https://example.com/static/')
      expect(host.lines).toContain(`  ${c.dim}Opening the static portfolio…${c.reset}`)
      expect(host.lines).toContain(`  ${c.green}→${c.reset} ${c.blue}https://example.com/static/${c.reset}`)
    })
  }
})

describe('clear', () => {
  it('clears the terminal and prints nothing extra for a bare clear', async () => {
    const host = makeHost()
    const r = await dispatchTerminalCommand(host, 'clear', [], 'clear', noopCmd)
    expect(r).toBe('continue')
    expect(host.cleared).toBe(1)
    expect(host.lines).toEqual([])
  })

  it('--help prints usage without clearing', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'clear', ['--help'], 'clear --help', noopCmd)
    expect(host.cleared).toBe(0)
    expect(host.lines.some(l => l.includes('blank scrollback'))).toBe(true)
    expect(host.lines.some(l => l.includes('microscopic cow haiku'))).toBe(true)
  })

  it('-h is treated as help (case-insensitive)', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'clear', ['-H'], 'clear -H', noopCmd)
    expect(host.cleared).toBe(0)
    expect(host.lines.some(l => l.includes('blank scrollback'))).toBe(true)
  })

  it('--cow clears and prints the cow haiku', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'clear', ['--cow'], 'clear --cow', noopCmd)
    expect(host.cleared).toBe(1)
    expect(host.lines.some(l => l.includes('< moo.'))).toBe(true)
    expect(host.lines.some(l => l.includes('now you see nothing'))).toBe(true)
  })
})

describe('retro', () => {
  it('status reports flat modern cowardice when off', async () => {
    const host = makeHost()
    retroState.on = false
    await dispatchTerminalCommand(host, 'retro', ['status'], 'retro status', noopCmd)
    expect(host.lines[0]).toBe(`  ${c.green}crt profile:${c.reset} flat modern cowardice`)
    expect(host.lines[1]).toBe(`  ${c.dim}vignette strength: bureaucracy × 3${c.reset}`)
    expect(setRetroFx).not.toHaveBeenCalled()
    expect(toggleRetroFx).not.toHaveBeenCalled()
  })

  it('status reports warped phosphor nostalgia when on', async () => {
    const host = makeHost()
    retroState.on = true
    await dispatchTerminalCommand(host, 'retro', ['STATUS'], 'retro STATUS', noopCmd)
    expect(host.lines[0]).toBe(`  ${c.green}crt profile:${c.reset} warped phosphor nostalgia`)
  })

  it('--help prints usage and toggles nothing', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'retro', ['--help'], 'retro --help', noopCmd)
    expect(host.lines.some(l => l.includes('bare word toggles'))).toBe(true)
    expect(setRetroFx).not.toHaveBeenCalled()
    expect(toggleRetroFx).not.toHaveBeenCalled()
  })

  it('on enables and prints the on banner', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'retro', ['on'], 'retro on', noopCmd)
    expect(setRetroFx).toHaveBeenCalledWith(true)
    expect(host.lines.some(l => l.includes('retro on'))).toBe(true)
  })

  it('off disables and prints the off banner', async () => {
    const host = makeHost()
    retroState.on = true
    await dispatchTerminalCommand(host, 'retro', ['off'], 'retro off', noopCmd)
    expect(setRetroFx).toHaveBeenCalledWith(false)
    expect(host.lines.some(l => l.includes('pixels unpunished'))).toBe(true)
  })

  it('a bare/unknown arg toggles', async () => {
    const host = makeHost()
    retroState.on = false
    await dispatchTerminalCommand(host, 'retro', [], 'retro', noopCmd)
    expect(toggleRetroFx).toHaveBeenCalledTimes(1)
    expect(retroState.on).toBe(true)
    expect(host.lines.some(l => l.includes('retro on'))).toBe(true)
  })
})

describe('matrix', () => {
  it('prints a not-wired notice when no backdrop handle exists', async () => {
    const host = makeHost()
    matrixState.handle = null
    await dispatchTerminalCommand(host, 'matrix', ['on'], 'matrix on', noopCmd)
    expect(host.lines).toEqual([`  ${c.dim}matrix backdrop not wired in this route${c.reset}`])
  })

  it('status reports idle when off', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: false }
    await dispatchTerminalCommand(host, 'matrix', ['status'], 'matrix status', noopCmd)
    expect(host.lines[0]).toContain('Idle — Wallpaper drinks tea.')
    expect(host.lines.length).toBe(1)
  })

  it('status reports falling glyphs plus throughput line when on', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: true }
    await dispatchTerminalCommand(host, 'matrix', ['status'], 'matrix status', noopCmd)
    expect(host.lines[0]).toContain('Glyphs falling')
    expect(host.lines[1]).toContain('~9021 green chars')
  })

  it('--help prints usage', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: false }
    await dispatchTerminalCommand(host, 'matrix', ['-h'], 'matrix -h', noopCmd)
    expect(host.lines.some(l => l.includes('on') && l.includes('off') && l.includes('status'))).toBe(true)
  })

  it('on arms the rain and flips the handle', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: false }
    await dispatchTerminalCommand(host, 'matrix', ['on'], 'matrix on', noopCmd)
    expect(matrixState.setEnabled).toHaveBeenCalledWith(true)
    expect(matrixState.handle.enabled).toBe(true)
    expect(host.lines).toEqual([`  ${c.green}matrix rain armed${c.reset}`])
  })

  it('off cancels the drizzle', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: true }
    await dispatchTerminalCommand(host, 'matrix', ['off'], 'matrix off', noopCmd)
    expect(matrixState.setEnabled).toHaveBeenCalledWith(false)
    expect(host.lines.some(l => l.includes('matrix drizzle cancelled'))).toBe(true)
  })

  it('bare arg while idle prints the wake hint', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: false }
    await dispatchTerminalCommand(host, 'matrix', [], 'matrix', noopCmd)
    expect(host.lines.some(l => l.includes('matrix idle — wake with'))).toBe(true)
  })

  it('bare arg while running prints the usage line', async () => {
    const host = makeHost()
    matrixState.handle = { enabled: true }
    await dispatchTerminalCommand(host, 'matrix', ['wat'], 'matrix wat', noopCmd)
    expect(host.lines[0]).toContain('usage:')
  })
})

describe('theme', () => {
  it('no arg prints the current theme', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'theme', [], 'theme', noopCmd)
    expect(host.lines[0]).toBe(`  ${c.green}theme:${c.reset} Catppuccin Mocha ${c.dim}(mocha)${c.reset}`)
  })

  it('"current" prints the current theme', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'theme', ['current'], 'theme current', noopCmd)
    expect(host.lines[0]).toContain('theme:')
  })

  it('list shows each theme with an arrow on the active one', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'theme', ['list'], 'theme list', noopCmd)
    const mochaLine = host.lines.find(l => l.includes('mocha') && l.includes('Catppuccin Mocha'))
    const draculaLine = host.lines.find(l => l.includes('dracula'))
    expect(mochaLine).toContain('←')
    expect(draculaLine).not.toContain('←')
    expect(host.lines.some(l => l.includes('usage:'))).toBe(true)
  })

  it('random applies a theme not currently active and refreshes', async () => {
    const host = makeHost()
    themeState.id = 'mocha'
    await dispatchTerminalCommand(host, 'theme', ['random'], 'theme random', noopCmd)
    // pool excludes mocha → only dracula remains
    expect(themeState.id).toBe('dracula')
    expect(host.themeRefreshed).toBe(1)
    expect(host.lines.some(l => l.includes('theme roulette →'))).toBe(true)
  })

  it('applying a known id refreshes and confirms', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'theme', ['dracula'], 'theme dracula', noopCmd)
    expect(themeState.id).toBe('dracula')
    expect(host.themeRefreshed).toBe(1)
    expect(host.lines.some(l => l.includes('theme applied:'))).toBe(true)
  })

  it('normalizes underscores to hyphens before applying', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'theme', ['tokyo_night'], 'theme tokyo_night', noopCmd)
    expect(themeState.id).toBe('tokyo-night')
  })

  it('unknown theme prints an error and does not refresh', async () => {
    const host = makeHost()
    themeState.applyResult = false
    await dispatchTerminalCommand(host, 'theme', ['nope'], 'theme nope', noopCmd)
    expect(host.themeRefreshed).toBe(0)
    expect(host.lines.some(l => l.includes('unknown theme:') && l.includes('nope'))).toBe(true)
  })
})

describe('sound', () => {
  it('status reports on with rounded volume', async () => {
    const host = makeHost()
    soundState.enabled = true
    soundState.volume = 0.5
    await dispatchTerminalCommand(host, 'sound', ['status'], 'sound status', noopCmd)
    expect(host.lines[0]).toBe(
      `  ${c.green}sound:${c.reset} on (blessed)  ${c.dim}· panel volume ≈ 50%${c.reset}`,
    )
  })

  it('? alias reports status (off case)', async () => {
    const host = makeHost()
    soundState.enabled = false
    await dispatchTerminalCommand(host, 'sound', ['?'], 'sound ?', noopCmd)
    expect(host.lines[0]).toContain('off (silent film mode)')
  })

  it('--help prints usage without changing state', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'sound', ['--help'], 'sound --help', noopCmd)
    expect(setSoundEnabled).not.toHaveBeenCalled()
    expect(toggleSound).not.toHaveBeenCalled()
    expect(host.lines.some(l => l.includes('bare ⇒ toggle'))).toBe(true)
  })

  it('on enables, resumes audio, syncs systray, and confirms audible', async () => {
    const host = makeHost()
    soundState.enabled = false
    await dispatchTerminalCommand(host, 'sound', ['on'], 'sound on', noopCmd)
    expect(setSoundEnabled).toHaveBeenCalledWith(true)
    expect(resumeAudioIfNeeded).toHaveBeenCalledTimes(1)
    expect(syncSettingsSoundToggle).toHaveBeenCalledTimes(1)
    expect(host.lines[0]).toContain('UI sounds:')
    expect(host.lines[0]).toContain('master 50%')
  })

  it('off mutes and prints the muted line', async () => {
    const host = makeHost()
    soundState.enabled = true
    await dispatchTerminalCommand(host, 'sound', ['off'], 'sound off', noopCmd)
    expect(setSoundEnabled).toHaveBeenCalledWith(false)
    expect(host.lines.some(l => l.includes('UI sounds muted'))).toBe(true)
  })

  it('bare arg toggles', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'sound', [], 'sound', noopCmd)
    expect(toggleSound).toHaveBeenCalledTimes(1)
  })
})

describe('reboot', () => {
  it('records history, clears, shows motd, and returns exit', async () => {
    const host = makeHost()
    const r = await dispatchTerminalCommand(host, 'reboot', [], 'reboot', noopCmd)
    expect(r).toBe('exit')
    expect(host.history).toEqual(['reboot'])
    expect(host.cleared).toBe(1)
    expect(host.motdShown).toBe(1)
  })
})

describe('legacy window aliases', () => {
  it('skills opens the resume split tile and plays a click', async () => {
    const host = makeHost()
    const r = await dispatchTerminalCommand(host, 'skills', [], 'skills', noopCmd)
    expect(r).toBe('continue')
    expect(host.windows.length).toBe(1)
    expect(host.windows[0]!.command).toBe('resume')
    expect(host.windows[0]!.title).toBe('résumé · skills')
    expect(host.lines.length).toBeGreaterThan(0)
    expect(playOsSound).toHaveBeenCalledWith('click')
  })

  it('contact opens the links tile with rendered content', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'contact', [], 'contact', noopCmd)
    expect(host.windows.length).toBe(1)
    expect(host.windows[0]!.command).toBe('links')
    expect(host.windows[0]!.title).toBe('contact · outbound')
    expect(Array.isArray(host.windows[0]!.content)).toBe(true)
    expect(playOsSound).toHaveBeenCalledWith('click')
  })
})

describe('tiled window commands', () => {
  it('vim opens an editor tile with the given path', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'vim', ['todo.md'], 'vim todo.md', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('edit')
    expect(w.title).toBe('vim — todo.md')
    expect(w.editorPath).toBe('todo.md')
    expect(playOsSound).toHaveBeenCalledWith('click')
  })

  it('edit defaults the path to notes.txt', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'edit', [], 'edit', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('edit')
    expect(w.title).toBe('edit — notes.txt')
    expect(w.editorPath).toBe('notes.txt')
  })

  it('editor uses the editor heading', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'editor', ['a.txt'], 'editor a.txt', noopCmd)
    expect(host.windows[0]!.title).toBe('editor — a.txt')
  })

  it('explorer with no arg uses pwd', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'explorer', [], 'explorer', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('explorer')
    expect(w.title).toBe('Files')
    expect(typeof w.explorerPath).toBe('string')
    expect(w.explorerPath!.startsWith('/')).toBe(true)
  })

  it('explorer normalizes a provided path', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'explorer', ['/home/../etc'], 'explorer /home/../etc', noopCmd)
    expect(host.windows[0]!.explorerPath).toBe('/etc')
  })

  it('browse with no arg uses the default URL', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'browse', [], 'browse', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('browse')
    expect(w.browserUrl).toBe('https://en.wikipedia.org/wiki/Linux')
  })

  it('browse normalizes a host-like arg to https', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'browse', ['example.com'], 'browse example.com', noopCmd)
    expect(host.windows[0]!.browserUrl).toBe('https://example.com/')
  })

  it('p5 with a path uses the basename as the title', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'p5', ['sketches/flow.js'], 'p5 sketches/flow.js', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('p5')
    expect(w.title).toBe('flow.js')
    expect(w.p5SketchPath).toBe('sketches/flow.js')
  })

  it('p5 with no path titles itself p5.js', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'p5', [], 'p5', noopCmd)
    const w = host.windows[0]!
    expect(w.title).toBe('p5.js')
    expect(w.p5SketchPath).toBeUndefined()
  })

  it('resume opens a split tile', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'resume', [], 'resume', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('resume')
    expect(w.title).toBe('résumé · skills')
  })

  it('projects opens with the portfolio project cards', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'projects', [], 'projects', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('projects')
    expect(w.title).toBe('work & roadmap')
    expect(Array.isArray(w.projectCards)).toBe(true)
    expect((w.projectCards ?? []).length).toBeGreaterThan(0)
  })

  it('whoami opens with cmd-rendered content and its title', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'whoami', [], 'whoami', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('whoami')
    expect(w.title).toBe('about me · personal')
    expect(w.content).toEqual(['CMD_OUTPUT'])
  })

  it('links opens with cmd-rendered content and its title', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'links', [], 'links', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('links')
    expect(w.title).toBe('contact · outbound')
    expect(w.content).toEqual(['CMD_OUTPUT'])
  })

  it('a generic tiled command (paint) falls through to its own title', async () => {
    const host = makeHost()
    await dispatchTerminalCommand(host, 'paint', [], 'paint', noopCmd)
    const w = host.windows[0]!
    expect(w.command).toBe('paint')
    expect(w.title).toBe('paint')
    expect(w.content).toEqual(['CMD_OUTPUT'])
  })
})

describe('fallthrough to plain command', () => {
  it('an unrecognized command writes cmd.run output and continues', async () => {
    const host = makeHost()
    const r = await dispatchTerminalCommand(host, 'help', [], 'help', noopCmd)
    expect(r).toBe('continue')
    expect(host.lines).toEqual(['CMD_OUTPUT'])
    expect(host.windows).toEqual([])
  })
})
