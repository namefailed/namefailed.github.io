/**
 * Tests for the app-launcher / UI-toggle command stubs.
 *
 * Most of these commands are deliberately inert at the command layer: they
 * return [] and are intercepted by terminal/desktop code that opens a tile.
 * The four portfolio-content commands delegate to the copy functions and DO
 * return printable lines. We assert exact shapes/values for both groups.
 */

import { describe, it, expect } from 'vitest'

import { appCommands } from './app-commands'
import {
  linksAndContactLines,
  projectsLines,
  resumeAndSkillsLines,
  whoamiAboutLines,
} from '../content/portfolio'

// ── content tiles delegate to the portfolio copy functions ───────────────────

describe('portfolio content commands', () => {
  it('links returns exactly the contact copy lines', () => {
    expect(appCommands.links.run([])).toEqual(linksAndContactLines())
  })

  it('resume returns exactly the résumé/skills copy lines', () => {
    expect(appCommands.resume.run([])).toEqual(resumeAndSkillsLines())
  })

  it('projects returns exactly the projects copy lines', () => {
    expect(appCommands.projects.run([])).toEqual(projectsLines())
  })

  it('whoami returns exactly the about copy lines', () => {
    expect(appCommands.whoami.run([])).toEqual(whoamiAboutLines())
  })

  it('content commands ignore their args (run is arg-independent)', () => {
    expect(appCommands.links.run(['ignored', 'args'])).toEqual(appCommands.links.run([]))
    expect(appCommands.projects.run(['x'])).toEqual(appCommands.projects.run([]))
  })

  it('each content command yields a fresh array each call (no shared mutable state)', () => {
    const a = appCommands.resume.run([])
    const b = appCommands.resume.run([])
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('content commands produce non-empty printable output', () => {
    for (const name of ['links', 'resume', 'projects', 'whoami']) {
      const lines = appCommands[name].run([])
      expect(Array.isArray(lines)).toBe(true)
      expect(lines.length).toBeGreaterThan(0)
      // every entry is a string
      expect(lines.every((l) => typeof l === 'string')).toBe(true)
    }
  })

  it('contact output contains the known direct-line facts', () => {
    const text = appCommands.links.run([]).join('\n')
    expect(text).toContain('namefailedx@gmail.com')
    expect(text).toContain('github.com/namefailed')
    expect(text).toContain('+1 254-534-9544')
  })
})

// ── loadMs theatre hints ──────────────────────────────────────────────────────

describe('loadMs hints', () => {
  it('sets the exact documented fake-delay per content tile', () => {
    expect(appCommands.links.loadMs).toBe(400)
    expect(appCommands.resume.loadMs).toBe(800)
    expect(appCommands.projects.loadMs).toBe(800)
    expect(appCommands.whoami.loadMs).toBe(350)
  })

  it('leaves loadMs undefined on commands without a delay hint', () => {
    expect(appCommands.edit.loadMs).toBeUndefined()
    expect(appCommands.snake.loadMs).toBeUndefined()
    expect(appCommands.retro.loadMs).toBeUndefined()
    expect(appCommands.static.loadMs).toBeUndefined()
  })
})

// ── inert stub commands return [] and are intercepted elsewhere ───────────────

describe('stub commands', () => {
  const stubNames = [
    'edit',
    'editor',
    'vim',
    'explorer',
    'browse',
    'paint',
    'p5',
    'snake',
    'pong',
    'retro',
    'matrix',
    'theme',
    'sound',
    'reboot',
    'static',
    'plain',
    'x',
  ]

  it.each(stubNames)('%s returns an empty array regardless of args', (name) => {
    expect(appCommands[name].run([])).toEqual([])
    expect(appCommands[name].run(['on', '--help'])).toEqual([])
  })

  it('the inert stubs are exactly these keys (no content command leaks in)', () => {
    const inert = Object.keys(appCommands).filter(
      (name) => appCommands[name].run([]).length === 0,
    )
    expect(inert.sort()).toEqual([...stubNames].sort())
  })
})

// ── hidden / deprecated aliases ───────────────────────────────────────────────

describe('hidden aliases', () => {
  it('marks only plain and x as hidden', () => {
    const hidden = Object.keys(appCommands).filter((name) => appCommands[name].hidden)
    expect(hidden.sort()).toEqual(['plain', 'x'])
  })

  it('hidden flag is undefined (falsy) on visible commands', () => {
    expect(appCommands.links.hidden).toBeUndefined()
    expect(appCommands.static.hidden).toBeUndefined()
  })

  it('hidden aliases describe themselves as aliases for static', () => {
    expect(appCommands.plain.description).toBe('Hidden alias for `static`')
    expect(appCommands.x.description).toBe('Hidden alias for `static`')
  })
})

// ── editor aliases share the same inert behaviour ─────────────────────────────

describe('editor aliases', () => {
  it('edit, editor and vim all behave identically (empty output)', () => {
    expect(appCommands.edit.run([])).toEqual(appCommands.editor.run([]))
    expect(appCommands.editor.run([])).toEqual(appCommands.vim.run([]))
    expect(appCommands.vim.run([])).toEqual([])
  })
})

// ── shape invariants across the whole map ─────────────────────────────────────

describe('appCommands map shape', () => {
  it('every command has a non-empty description and a run function', () => {
    for (const [name, cmd] of Object.entries(appCommands)) {
      expect(typeof cmd.description, name).toBe('string')
      expect(cmd.description.length, name).toBeGreaterThan(0)
      expect(typeof cmd.run, name).toBe('function')
    }
  })

  it('every run returns an array of strings', () => {
    for (const [name, cmd] of Object.entries(appCommands)) {
      const out = cmd.run([])
      expect(Array.isArray(out), name).toBe(true)
      expect(out.every((l) => typeof l === 'string'), name).toBe(true)
    }
  })

  it('exposes the full known command keyset', () => {
    expect(Object.keys(appCommands).sort()).toEqual(
      [
        'links',
        'resume',
        'projects',
        'whoami',
        'edit',
        'editor',
        'vim',
        'explorer',
        'browse',
        'paint',
        'p5',
        'snake',
        'pong',
        'retro',
        'matrix',
        'theme',
        'sound',
        'reboot',
        'static',
        'plain',
        'x',
      ].sort(),
    )
  })
})
