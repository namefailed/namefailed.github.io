import { describe, it, expect } from 'vitest'
import {
  PHOEME,
  PHOEME_FEATURES,
  PHOEME_PHILOSOPHY,
  PHOEME_WORKFLOWS,
} from './phoeme-data'

describe('phoeme-data', () => {
  it('exports product metadata aligned with phoneme docs', () => {
    expect(PHOEME.name).toBe('Phoneme')
    expect(PHOEME.repo).toContain('phoneme')
    expect(PHOEME.docs).toContain('docs')
    expect(PHOEME.heroImage).toContain('screenshots/main.png')
  })

  it('covers philosophy, workflows, and feature sections', () => {
    expect(PHOEME_PHILOSOPHY.length).toBe(3)
    expect(PHOEME_WORKFLOWS.length).toBe(4)
    expect(PHOEME_FEATURES.length).toBeGreaterThanOrEqual(6)
  })
})
