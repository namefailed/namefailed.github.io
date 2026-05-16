import { describe, it, expect } from 'vitest'
import { terminalMotdLines } from './terminal'

describe('terminal motd', () => {
  it('returns a non-empty greeting block (more than 2 lines)', () => {
    const lines = terminalMotdLines()
    expect(lines.length).toBeGreaterThan(2)
  })

  it('contains an ASCII art line referencing mrgrey', () => {
    const text = terminalMotdLines().join('\n')
    expect(text).toMatch(/mrgrey/)
  })

  it('includes a "help" hint line', () => {
    const text = terminalMotdLines().join('\n')
    expect(text.toLowerCase()).toMatch(/help/)
  })

  it('returns strings only (no undefined or null entries)', () => {
    const lines = terminalMotdLines()
    for (const line of lines) {
      expect(typeof line).toBe('string')
    }
  })
})
