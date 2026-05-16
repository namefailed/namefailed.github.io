import { describe, it, expect } from 'vitest'
import { P5_EXAMPLES, sketchFilename } from './p5-sketches'

describe('sketchFilename', () => {
  it('lowercases and hyphenates label, appending .js', () => {
    expect(sketchFilename('Flow Field')).toBe('flow-field.js')
    expect(sketchFilename('Game of Life')).toBe('game-of-life.js')
  })

  it('collapses multiple spaces and strips non-alphanumerics', () => {
    expect(sketchFilename('Mandelbrot   Set!')).toBe('mandelbrot-set.js')
    expect(sketchFilename('A/B test')).toBe('a-b-test.js')
  })

  it('returns a single-word slug intact', () => {
    expect(sketchFilename('Plasma')).toBe('plasma.js')
  })
})

describe('P5_EXAMPLES', () => {
  it('contains at least 8 sketches', () => {
    expect(P5_EXAMPLES.length).toBeGreaterThanOrEqual(8)
  })

  it('every sketch has a non-empty label and code', () => {
    for (const sketch of P5_EXAMPLES) {
      expect(sketch.label.length).toBeGreaterThan(0)
      expect(sketch.code.length).toBeGreaterThan(0)
    }
  })

  it('every sketch code contains setup() and draw()', () => {
    for (const sketch of P5_EXAMPLES) {
      expect(sketch.code).toMatch(/function\s+setup\s*\(/)
      expect(sketch.code).toMatch(/function\s+draw\s*\(/)
    }
  })

  it('produces unique filenames', () => {
    const names = P5_EXAMPLES.map(s => sketchFilename(s.label))
    expect(new Set(names).size).toBe(names.length)
  })
})
