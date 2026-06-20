import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { windowSpawnEcho } from './cli-window-echo'
import { c } from './theme'

/**
 * randomPick uses Math.random(); pin it so flavor lines are deterministic.
 * With a return of 0, randomPick always yields the first element of the list.
 */
let randomSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  randomSpy.mockRestore()
})

describe('windowSpawnEcho', () => {
  describe('resume / skills', () => {
    it('returns the résumé banner with the first flavor line for "resume"', () => {
      expect(windowSpawnEcho('resume', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}raising résumé tile (${c.blue}portfolio + skill matrix${c.dim}) …${c.reset}`,
        `  ${c.dim}paper PDF still validates in elevators.${c.reset}`,
        '',
      ])
    })

    it('treats "skills" identically to "resume"', () => {
      expect(windowSpawnEcho('skills', [])).toEqual(windowSpawnEcho('resume', []))
    })

    it('picks a later flavor line when Math.random points at it', () => {
      randomSpy.mockReturnValue(0.99) // last of 3 entries
      const out = windowSpawnEcho('resume', [])
      expect(out[2]).toBe(`  ${c.dim}HIRING=yes in this universe.${c.reset}`)
    })
  })

  describe('links / contact', () => {
    it('returns the 3-line contact banner for "links"', () => {
      expect(windowSpawnEcho('links', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}contact tile — photo rail + GitHub/LinkedIn/email/phone …${c.reset}`,
        '',
      ])
    })

    it('treats "contact" identically to "links"', () => {
      expect(windowSpawnEcho('contact', [])).toEqual(windowSpawnEcho('links', []))
    })
  })

  describe('projects', () => {
    it('returns the mosaic banner with the first flavor line', () => {
      expect(windowSpawnEcho('projects', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}project mosaic tiling … ship logs attached later.${c.reset}`,
        '',
      ])
    })
  })

  describe('whoami', () => {
    it('returns the about-me banner with the first flavor line', () => {
      expect(windowSpawnEcho('whoami', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}about-me tile — SCA stories live next to the engineer ones.${c.reset}`,
        '',
      ])
    })
  })

  describe('browse', () => {
    it('uses the default start URL hint when no args given', () => {
      expect(windowSpawnEcho('browse', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}iframe browser ⇢ ${c.reset}${c.blue}(default start URL)${c.reset}`,
        `  ${c.dim}(embed blockers apply — blank frame → Open tab.)${c.reset}`,
        '',
      ])
    })

    it('joins args with spaces into the URL hint', () => {
      const out = windowSpawnEcho('browse', ['https://example.com', 'foo'])
      expect(out[1]).toBe(
        `  ${c.green}►${c.reset} ${c.dim}iframe browser ⇢ ${c.reset}${c.blue}https://example.com foo${c.reset}`,
      )
    })

    it('passes through a hint of exactly 56 chars untruncated', () => {
      const arg = 'a'.repeat(56)
      const out = windowSpawnEcho('browse', [arg])
      expect(out[1]).toContain(arg)
      expect(out[1]).not.toContain('…')
    })

    it('truncates a hint longer than 56 chars to 54 chars + ellipsis', () => {
      const arg = 'b'.repeat(80)
      const out = windowSpawnEcho('browse', [arg])
      expect(out[1]).toContain('b'.repeat(54) + '…')
      expect(out[1]).not.toContain('b'.repeat(55))
    })
  })

  describe('explorer', () => {
    it('defaults the path to "cwd" when no args', () => {
      expect(windowSpawnEcho('explorer', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}file browser @ cwd … clipboard glue ready.${c.reset}`,
        '',
      ])
    })

    it('uses the joined args as the path', () => {
      const out = windowSpawnEcho('explorer', ['/home', 'grey'])
      expect(out[1]).toBe(
        `  ${c.green}►${c.reset} ${c.dim}file browser @ /home grey … clipboard glue ready.${c.reset}`,
      )
    })
  })

  describe('paint', () => {
    it('returns the fixed paint banner', () => {
      expect(windowSpawnEcho('paint', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}MS Paint energy unlocked — Undo is therapy.${c.reset}`,
        '',
      ])
    })
  })

  describe('snake', () => {
    it('returns the fixed snake banner', () => {
      expect(windowSpawnEcho('snake', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}Snake HUD allocated — collisions are pedagogical.${c.reset}`,
        '',
      ])
    })
  })

  describe('pong', () => {
    it('returns the fixed pong banner', () => {
      expect(windowSpawnEcho('pong', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}CRT paddle physics — WASD ⇄ arrows rivalry.${c.reset}`,
        '',
      ])
    })
  })

  describe('edit / editor / vim', () => {
    it('defaults the filename to notes.txt when no args', () => {
      expect(windowSpawnEcho('vim', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}mini‑vim ⇢ ${c.blue}notes.txt${c.reset}${c.dim} · :wq writes to fake disk.${c.reset}`,
        '',
      ])
    })

    it('uses the first arg (trimmed) as the filename', () => {
      const out = windowSpawnEcho('edit', ['  main.ts  '])
      expect(out[1]).toBe(
        `  ${c.green}►${c.reset} ${c.dim}mini‑vim ⇢ ${c.blue}main.ts${c.reset}${c.dim} · :wq writes to fake disk.${c.reset}`,
      )
    })

    it('falls back to notes.txt when the first arg is whitespace only', () => {
      const out = windowSpawnEcho('editor', ['   '])
      expect(out[1]).toContain('notes.txt')
    })

    it('treats edit, editor and vim identically', () => {
      const a = windowSpawnEcho('edit', ['x.txt'])
      const b = windowSpawnEcho('editor', ['x.txt'])
      const d = windowSpawnEcho('vim', ['x.txt'])
      expect(a).toEqual(b)
      expect(b).toEqual(d)
    })
  })

  describe('default / unknown command', () => {
    it('echoes the raw command name in the compositor banner', () => {
      expect(windowSpawnEcho('frobnicate', [])).toEqual([
        '',
        `  ${c.green}►${c.reset} ${c.dim}Compositor allocated tile: frobnicate${c.reset}`,
        '',
      ])
    })

    it('ignores args in the default branch', () => {
      const out = windowSpawnEcho('mystery', ['these', 'are', 'ignored'])
      expect(out[1]).toBe(`  ${c.green}►${c.reset} ${c.dim}Compositor allocated tile: mystery${c.reset}`)
    })
  })

  describe('structural invariants', () => {
    const cmds = [
      'resume', 'skills', 'links', 'contact', 'projects', 'whoami',
      'browse', 'explorer', 'paint', 'snake', 'pong', 'edit', 'editor', 'vim', 'unknown',
    ]

    it('every command returns string-only arrays bracketed by blank lines', () => {
      for (const cmd of cmds) {
        const out = windowSpawnEcho(cmd, [])
        expect(Array.isArray(out)).toBe(true)
        expect(out.length).toBeGreaterThanOrEqual(3)
        expect(out[0]).toBe('')
        expect(out[out.length - 1]).toBe('')
        for (const line of out) expect(typeof line).toBe('string')
      }
    })
  })
})
