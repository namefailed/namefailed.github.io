import { describe, it, expect } from 'vitest'
import {
  PHOEME,
  PHOEME_COMPARISON,
  PHOEME_FAQS,
  PHOEME_FEATURES,
  PHOEME_PIPELINE,
  PHOEME_WORKFLOWS,
} from './phoeme-data'

describe('phoeme-data', () => {
  it('exports product metadata', () => {
    expect(PHOEME.name).toBe('Phoneme')
    expect(PHOEME.releases).toBe('https://github.com/namefailed/phoneme/releases')
    expect(PHOEME.docs).toBe('https://github.com/namefailed/phoneme/tree/master/docs/README.md')
    expect(PHOEME.repo).toBe('https://github.com/namefailed/phoneme')
    expect(PHOEME.heroImage).toBe('/img/portfolio-phoneme.png')
    expect(PHOEME.headlineBefore.trim().split(/\s+/).at(-1)).not.toBe('a')
    expect(PHOEME.headlineAccent).not.toBe('workflow.')
  })

  it('defines complete marketing page sections', () => {
    expect(PHOEME_WORKFLOWS).toHaveLength(4)
    expect(PHOEME_PIPELINE.map((stage) => stage.title)).toEqual([
      'Capture',
      'Transcribe',
      'Enrich',
      'Route',
    ])
    expect(PHOEME_FEATURES).toHaveLength(9)
    expect(PHOEME_FEATURES.length % 3).toBe(0)
    expect(PHOEME_COMPARISON.points.length).toBeGreaterThanOrEqual(4)
    expect(PHOEME_FAQS.length).toBeGreaterThanOrEqual(6)
  })

  it('keeps product copy accurate to the docs', () => {
    const allCopy = JSON.stringify({
      PHOEME,
      PHOEME_COMPARISON,
      PHOEME_FAQS,
      PHOEME_FEATURES,
      PHOEME_PIPELINE,
      PHOEME_WORKFLOWS,
    })

    expect(allCopy).toContain('local')
    expect(allCopy).toContain('Meeting Mode')
    expect(allCopy).toContain('semantic')
    expect(allCopy).toContain('MIT / Apache-2.0')
    expect(allCopy).not.toMatch(/Ctrl\+Alt/i)
    expect(allCopy).not.toContain('speakrs')
  })
})
