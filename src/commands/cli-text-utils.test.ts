import { describe, expect, it } from 'vitest'
import { fmtHumanBytes, parseHeadTail, runCalAscii, wcStats } from './cli-text-utils'

// ─────────────────────────────────────────────────────────────────────────────
// fmtHumanBytes
// ─────────────────────────────────────────────────────────────────────────────
describe('fmtHumanBytes', () => {
  it('formats byte values under 1024 as "N B"', () => {
    expect(fmtHumanBytes(0)).toBe('0 B')
    expect(fmtHumanBytes(1)).toBe('1 B')
    expect(fmtHumanBytes(1023)).toBe('1023 B')
  })

  it('formats exact KiB boundaries without a decimal', () => {
    expect(fmtHumanBytes(1024)).toBe('1 KiB')
    expect(fmtHumanBytes(2048)).toBe('2 KiB')
  })

  it('formats fractional KiB with one decimal place', () => {
    expect(fmtHumanBytes(1536)).toBe('1.5 KiB')   // 1.5 * 1024
    expect(fmtHumanBytes(1025)).toBe('1.0 KiB')
  })

  it('formats values >= 1 MiB with one decimal place', () => {
    expect(fmtHumanBytes(1048576)).toBe('1.0 MiB')
    expect(fmtHumanBytes(1572864)).toBe('1.5 MiB') // 1.5 MiB
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// wcStats
// ─────────────────────────────────────────────────────────────────────────────
describe('wcStats', () => {
  it('returns zeros for an empty string', () => {
    expect(wcStats('')).toEqual({ lines: 0, words: 0, chars: 0 })
  })

  it('counts a single line with no trailing newline', () => {
    const s = 'hello world'
    expect(wcStats(s)).toMatchObject({ lines: 1, words: 2 })
    expect(wcStats(s).chars).toBeGreaterThan(0)
  })

  it('counts multiple lines', () => {
    expect(wcStats('a\nb\nc').lines).toBe(3)
  })

  it('counts words across lines', () => {
    expect(wcStats('foo bar\nbaz qux quux').words).toBe(5)
  })

  it('reports byte length via TextEncoder (ASCII = 1 byte/char)', () => {
    expect(wcStats('abc').chars).toBe(3)
  })

  it('handles whitespace-only input as zero words', () => {
    expect(wcStats('   \n  ').words).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// parseHeadTail
// ─────────────────────────────────────────────────────────────────────────────
describe('parseHeadTail', () => {
  it('defaults to n=10 and extracts the path', () => {
    const result = parseHeadTail('head', ['myfile.txt'])
    expect(result).toEqual({ n: 10, path: 'myfile.txt', err: null })
  })

  it('reads -n flag', () => {
    const result = parseHeadTail('head', ['-n', '5', 'myfile.txt'])
    expect(result).toEqual({ n: 5, path: 'myfile.txt', err: null })
  })

  it('reads --lines flag', () => {
    const result = parseHeadTail('tail', ['--lines', '20', 'myfile.txt'])
    expect(result).toEqual({ n: 20, path: 'myfile.txt', err: null })
  })

  it('returns a usage error when no path is provided', () => {
    const result = parseHeadTail('head', [])
    expect(result.err).toMatch(/head/)
    expect(result.path).toBeNull()
  })

  it('returns a usage error when only a flag is provided', () => {
    const result = parseHeadTail('tail', ['-n', '5'])
    expect(result.err).toMatch(/tail/)
  })

  it('ignores an invalid -n value and keeps the default', () => {
    const result = parseHeadTail('head', ['-n', 'abc', 'myfile.txt'])
    expect(result.n).toBe(10)
    expect(result.path).toBe('myfile.txt')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// runCalAscii
// ─────────────────────────────────────────────────────────────────────────────
describe('runCalAscii', () => {
  it('returns a non-empty array of strings', () => {
    const lines = runCalAscii([])
    expect(lines.length).toBeGreaterThan(0)
  })

  it('includes the day-of-week header', () => {
    const output = runCalAscii([]).join('\n')
    expect(output).toContain('Su Mo Tu We Th Fr Sa')
  })

  it('accepts a month argument (1-based)', () => {
    const output = runCalAscii(['1', '2000']).join('\n')
    expect(output).toContain('January 2000')
  })

  it('ignores out-of-range month values', () => {
    // Month 99 is invalid — falls back to current month, no crash
    expect(() => runCalAscii(['99'])).not.toThrow()
  })

  it('ignores out-of-range year values', () => {
    expect(() => runCalAscii(['1', '1800'])).not.toThrow()
  })
})
