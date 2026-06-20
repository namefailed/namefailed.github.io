import { describe, expect, it } from 'vitest'
import { ECHO_FORTUNE_LINES } from './cli-fortunes'

describe('ECHO_FORTUNE_LINES', () => {
  it('exposes the exact, non-empty fortune pool', () => {
    expect(ECHO_FORTUNE_LINES).toEqual([
      'Your kernel is vibes; your scheduler is ADHD.',
      'Ship the demo. Complain about hydration in retrospective.',
      'localStorage persists more loyalty than half the recruiters in your inbox.',
      'Tabs are spaces that learned boundaries.',
      'This terminal is Turing-complete for procrastination.',
      'If it works on Chrome and vibes on Firefox, you have a product.',
      "The cloud is someone else's sticker-covered laptop lid.",
      'Ctrl+D closes nothing here — mastery is knowing when not to rage-quit.',
      'Good docs are UX for your future sleepy self.',
      'You do not chmod dream jobs; you open a DM and attach a concise diff.',
      'WASM wishes it had your CSS grid instincts.',
      'Every portfolio is fanfiction until someone pays for the paperback.',
      '`git blame` rarely points where you emotionally want it to.',
      'Hydrated React trees still need coffee—water is insufficient.',
      'Tab-completion is unconditional love.',
      '"Works on my machine" is a threat model admission.',
    ])
  })

  it('contains exactly 16 fortunes', () => {
    expect(ECHO_FORTUNE_LINES).toHaveLength(16)
  })

  it('has no empty or whitespace-only entries', () => {
    for (const line of ECHO_FORTUNE_LINES) {
      expect(line.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps every line short enough for narrow terminals (<= 80 cols)', () => {
    // The module comment promises lines short enough not to wrap narrow widths.
    for (const line of ECHO_FORTUNE_LINES) {
      expect(line.length).toBeLessThanOrEqual(80)
    }
  })

  it('has no leading/trailing whitespace on any line', () => {
    for (const line of ECHO_FORTUNE_LINES) {
      expect(line).toBe(line.trim())
    }
  })

  it('contains no duplicate fortunes', () => {
    expect(new Set(ECHO_FORTUNE_LINES).size).toBe(ECHO_FORTUNE_LINES.length)
  })

  it('contains no embedded newlines (single-line entries only)', () => {
    for (const line of ECHO_FORTUNE_LINES) {
      expect(line).not.toContain('\n')
    }
  })
})
