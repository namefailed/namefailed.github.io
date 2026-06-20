import { describe, expect, it } from 'vitest'
import { aboutInfoLines, whoamiAboutLines } from './about-copy'
import { c } from '../../theme'

/** Strip ANSI escape codes so assertions can target the visible text. */
function plain(line: string): string {
  return line.replace(/\x1b\[[0-9;]*m/g, '')
}

const plainAll = (lines: string[]): string[] => lines.map(plain)

/** All ANSI escape codes appearing in a single line, in order. */
function escapes(line: string): string[] {
  return line.match(/\x1b\[[0-9;]*m/g) ?? []
}

describe('aboutInfoLines', () => {
  it('returns a non-empty array of strings', () => {
    const lines = aboutInfoLines()
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => typeof l === 'string')).toBe(true)
  })

  it('surfaces the key identity and contact facts in visible text', () => {
    const text = plainAll(aboutInfoLines()).join('\n')
    expect(text).toContain('Matt Grey')
    expect(text).toContain('github:')
    expect(text).toContain('namefailed')
    expect(text).toContain('linkedin.com/in/matthew-grey-215615179')
    expect(text).toContain('Killeen, TX')
    expect(text).toContain('open to work')
  })

  it('names the SCA persona and kingdom', () => {
    const text = plainAll(aboutInfoLines()).join('\n')
    expect(text).toContain('SCA')
    expect(text).toContain('Graee na Uile')
    expect(text).toContain('Ansteorra')
  })

  it('describes the role / stack / platform column', () => {
    const text = plainAll(aboutInfoLines()).join('\n')
    expect(text).toContain('Software engineer')
    expect(text).toContain('TypeScript')
    expect(text).toContain('Windows 11')
    expect(text).toContain('theme list')
  })

  it('every line containing ANSI is reset-terminated (no colour bleed)', () => {
    for (const line of aboutInfoLines()) {
      const esc = escapes(line)
      if (esc.length === 0) continue
      // A styled line both contains a reset and ends its escape run with one,
      // so colour cannot leak past the final styled segment.
      expect(line).toContain(c.reset)
      expect(esc[esc.length - 1]).toBe(c.reset)
    }
  })

  it('emits raw ANSI escape codes (not stripped) in output', () => {
    const lines = aboutInfoLines()
    const joined = lines.join('')
    expect(joined).toContain(c.blue)
    expect(joined).toContain(c.pink)
    expect(joined).toContain(c.reset)
    // The first line carries the bolded name in blue.
    expect(lines[0]).toContain(c.bold)
    expect(plain(lines[0]!)).toContain('Matt Grey')
  })
})

describe('whoamiAboutLines', () => {
  it('returns a non-empty array of strings', () => {
    const lines = whoamiAboutLines()
    expect(Array.isArray(lines)).toBe(true)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => typeof l === 'string')).toBe(true)
  })

  it('opens and closes with blank spacer lines', () => {
    const lines = whoamiAboutLines()
    expect(lines[0]).toBe('')
    expect(lines[lines.length - 1]).toBe('')
  })

  it('surfaces the headline identity facts in visible text', () => {
    const text = plainAll(whoamiAboutLines()).join('\n')
    expect(text).toContain('Matt Grey')
    expect(text).toContain('software engineer')
    expect(text).toContain('Killeen, TX')
    expect(text).toContain('mrgrey.site')
  })

  it('includes the section headings', () => {
    const text = plainAll(whoamiAboutLines()).join('\n')
    expect(text).toContain('Work')
    expect(text).toContain('This site')
    expect(text).toContain('SCA — Graee na Uile')
    expect(text).toContain('Outside the terminal')
    expect(text).toContain('Links')
  })

  it('leads the "Outside the terminal" list with "Dad first"', () => {
    const text = plainAll(whoamiAboutLines()).join('\n')
    expect(text).toContain('Dad first')
  })

  it('lists every contact link with its visible URL', () => {
    const text = plainAll(whoamiAboutLines()).join('\n')
    expect(text).toContain('github.com/namefailed')
    expect(text).toContain('linkedin.com/in/matthew-grey-215615179')
    expect(text).toContain('namefailedx@gmail.com')
    expect(text).toContain('op.ansteorra.org/people/id/12122')
  })

  it('names the SCA society, kingdom, and awards', () => {
    const text = plainAll(whoamiAboutLines()).join('\n')
    expect(text).toContain('Society for Creative Anachronism')
    expect(text).toContain('Ansteorra')
    expect(text).toContain("Queen's Rapier of Ansteorra")
    expect(text).toContain('Award of Arms')
  })

  it('every line containing ANSI is reset-terminated (no colour bleed)', () => {
    for (const line of whoamiAboutLines()) {
      const esc = escapes(line)
      if (esc.length === 0) continue
      expect(line).toContain(c.reset)
      expect(esc[esc.length - 1]).toBe(c.reset)
    }
  })

  it('emits raw ANSI escape codes (not stripped) in output', () => {
    const joined = whoamiAboutLines().join('')
    expect(joined).toContain(c.pink)
    expect(joined).toContain(c.green)
    expect(joined).toContain(c.cyan)
    expect(joined).toContain(c.reset)
  })
})

describe('about-copy — purity', () => {
  it('returns fresh, equal arrays on each call (no shared mutable state)', () => {
    const a1 = aboutInfoLines()
    const a2 = aboutInfoLines()
    expect(a1).toEqual(a2)
    expect(a1).not.toBe(a2)

    const w1 = whoamiAboutLines()
    const w2 = whoamiAboutLines()
    expect(w1).toEqual(w2)
    expect(w1).not.toBe(w2)
  })
})
