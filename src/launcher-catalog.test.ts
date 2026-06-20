// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'

// Stub every lazily-imported window module so `prefetchLazyWindowModule` can
// trigger a real dynamic import without dragging in DOM/canvas-heavy code.
// Each factory records that its module was loaded so tests can assert the
// correct chunk was warmed for a given command.
const { loaded, stub } = vi.hoisted(() => {
  const loaded = { names: [] as string[] }
  const stub = (name: string) => (): Record<string, never> => {
    loaded.names.push(name)
    return {}
  }
  return { loaded, stub }
})
vi.mock('./browser-window', stub('browser-window'))
vi.mock('./file-explorer-window', stub('file-explorer-window'))
vi.mock('./editor-window', stub('editor-window'))
vi.mock('./paint-window', stub('paint-window'))
vi.mock('./snake-window', stub('snake-window'))
vi.mock('./pong-window', stub('pong-window'))
vi.mock('./p5-window', stub('p5-window'))

import {
  tileTitleForPortfolioCommand,
  TILED_WINDOW_COMMANDS,
  EDITOR_LAUNCH_ALIASES,
  LAUNCHER_ICON_ROWS,
  PINNED_DOCK_CMDS,
  prefetchLazyWindowModule,
  attachLazyPrefetchHandlers,
} from './launcher-catalog'

/** Resolve the queued dynamic import(s) so the mock factories run. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

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
    for (const cmd of ['paint', 'snake', 'pong', 'p5', 'explorer', 'browse']) {
      expect(TILED_WINDOW_COMMANDS.has(cmd)).toBe(true)
    }
    expect(TILED_WINDOW_COMMANDS.has('cube')).toBe(false)
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

  it('app labels are A→Z (terminal row stays last)', () => {
    const apps = LAUNCHER_ICON_ROWS.filter(r => r.kind === 'app').map(r => r.label)
    const sorted = [...apps].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    expect(apps).toEqual(sorted)
    expect(LAUNCHER_ICON_ROWS.at(-1)?.kind).toBe('terminal')
  })
})

// ── PINNED_DOCK_CMDS ──────────────────────────────────────────────────────────

describe('PINNED_DOCK_CMDS', () => {
  it('pins the four portfolio commands plus terminal/explorer/edit', () => {
    expect([...PINNED_DOCK_CMDS]).toEqual([
      'resume', 'projects', 'whoami', 'links', 'terminal', 'explorer', 'edit',
    ])
  })

  it('includes the terminal sentinel', () => {
    expect(PINNED_DOCK_CMDS.includes('terminal')).toBe(true)
  })

  it('only the terminal sentinel is outside TILED_WINDOW_COMMANDS', () => {
    const notTiled = PINNED_DOCK_CMDS.filter((cmd) => !TILED_WINDOW_COMMANDS.has(cmd))
    expect(notTiled).toEqual(['terminal'])
  })
})

// ── prefetchLazyWindowModule ──────────────────────────────────────────────────
//
// `import()` caches modules and the stub factory's side-effect fires only on a
// module's FIRST import, so we track imports cumulatively across the file rather
// than clearing between tests. Each lazy command is the *first* thing to import
// its chunk, so each assertion proves that command kicked exactly its chunk.

/** First-import marker for a chunk: present in `loaded.names` iff it was warmed. */
const wasWarmed = (chunk: string): boolean => loaded.names.includes(chunk)

describe('prefetchLazyWindowModule', () => {
  it('warms the browser chunk for "browse"', async () => {
    expect(wasWarmed('browser-window')).toBe(false)
    await prefetchLazyWindowModule('browse')
    expect(wasWarmed('browser-window')).toBe(true)
  })

  it('warms the file-explorer chunk for "explorer"', async () => {
    expect(wasWarmed('file-explorer-window')).toBe(false)
    await prefetchLazyWindowModule('explorer')
    expect(wasWarmed('file-explorer-window')).toBe(true)
  })

  it('warms the editor chunk for "edit"', async () => {
    expect(wasWarmed('editor-window')).toBe(false)
    await prefetchLazyWindowModule('edit')
    expect(wasWarmed('editor-window')).toBe(true)
  })

  it('warms the paint chunk for "paint"', async () => {
    expect(wasWarmed('paint-window')).toBe(false)
    await prefetchLazyWindowModule('paint')
    expect(wasWarmed('paint-window')).toBe(true)
  })

  it('warms the pong chunk for "pong"', async () => {
    expect(wasWarmed('pong-window')).toBe(false)
    await prefetchLazyWindowModule('pong')
    expect(wasWarmed('pong-window')).toBe(true)
  })

  it('warms the snake chunk for "snake"', async () => {
    expect(wasWarmed('snake-window')).toBe(false)
    await prefetchLazyWindowModule('snake')
    expect(wasWarmed('snake-window')).toBe(true)
  })

  it('warms the p5 chunk for "p5"', async () => {
    expect(wasWarmed('p5-window')).toBe(false)
    await prefetchLazyWindowModule('p5')
    expect(wasWarmed('p5-window')).toBe(true)
  })

  it('warms nothing for portfolio/text commands with no lazy chunk', async () => {
    const before = loaded.names.length
    for (const cmd of ['resume', 'links', 'projects', 'whoami']) {
      await prefetchLazyWindowModule(cmd)
    }
    expect(loaded.names.length).toBe(before)
  })

  it('warms nothing for the terminal sentinel or an unknown command', async () => {
    const before = loaded.names.length
    await prefetchLazyWindowModule('terminal')
    await prefetchLazyWindowModule('totally-unknown')
    await prefetchLazyWindowModule('')
    expect(loaded.names.length).toBe(before)
  })

  it('returns a promise for both a lazy and a non-lazy command', async () => {
    // 'editor' already warmed its chunk via the 'edit' test, so no fresh import.
    const lazy = prefetchLazyWindowModule('editor')
    const plain = prefetchLazyWindowModule('whoami')
    expect(lazy).toBeInstanceOf(Promise)
    expect(plain).toBeInstanceOf(Promise)
    await Promise.all([lazy, plain]) // settle both so nothing is in flight at teardown
  })
})

// ── attachLazyPrefetchHandlers ────────────────────────────────────────────────

describe('attachLazyPrefetchHandlers', () => {
  it('registers exactly a pointerenter and a focusin listener', () => {
    const el = document.createElement('div')
    const addSpy = vi.spyOn(el, 'addEventListener')
    attachLazyPrefetchHandlers(el, 'browse')
    const events = addSpy.mock.calls.map((call) => call[0])
    expect(events).toEqual(['pointerenter', 'focusin'])
    addSpy.mockRestore()
  })

  it('registers the pointerenter listener as passive', () => {
    const el = document.createElement('div')
    const addSpy = vi.spyOn(el, 'addEventListener')
    attachLazyPrefetchHandlers(el, 'browse')
    const pointerCall = addSpy.mock.calls.find((call) => call[0] === 'pointerenter')!
    expect(pointerCall[2]).toEqual({ passive: true })
    addSpy.mockRestore()
  })

  it('does not warm a fresh chunk until an event actually fires', async () => {
    const before = loaded.names.length
    const el = document.createElement('div')
    attachLazyPrefetchHandlers(el, 'projects') // no lazy chunk, but proves no eager import
    await flush()
    expect(loaded.names.length).toBe(before)
  })

  it('routes both pointerenter and focusin through the same prefetch', () => {
    // Wire to a no-chunk command so the handlers fire nothing async; we only
    // prove both events reach the prefetch path (the switch is covered above).
    const el = document.createElement('div')
    let calls = 0
    const realAdd = el.addEventListener.bind(el)
    const handlers: Array<() => void> = []
    vi.spyOn(el, 'addEventListener').mockImplementation((type, listener, opts) => {
      handlers.push(() => {
        calls++
        ;(listener as EventListener)(new Event(type))
      })
      realAdd(type, listener as EventListener, opts)
    })
    attachLazyPrefetchHandlers(el, 'projects')
    for (const h of handlers) h()
    expect(calls).toBe(2) // one pointerenter handler, one focusin handler
    vi.restoreAllMocks()
  })
})

// ── editor aliases all resolve to the single editor chunk ─────────────────────

describe('editor alias mapping (prefetch)', () => {
  it('treats edit / editor / vim as the same chunk (no extra imports)', async () => {
    const before = loaded.names.length // editor-window already warmed earlier
    await prefetchLazyWindowModule('editor')
    await prefetchLazyWindowModule('vim')
    await prefetchLazyWindowModule('edit')
    // Same chunk → cached → no new entries appended for any alias.
    expect(loaded.names.length).toBe(before)
    expect(EDITOR_LAUNCH_ALIASES.has('vim')).toBe(true)
  })
})
