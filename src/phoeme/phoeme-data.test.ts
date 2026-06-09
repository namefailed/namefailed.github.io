import { describe, it, expect } from 'vitest'
import { PHOEME, PHOEME_FEATURES } from './phoeme-data'

describe('phoeme-data', () => {
  it('exports product name and feature list', () => {
    expect(PHOEME.name).toBe('Phoneme')
    expect(PHOEME.repo).toContain('phoneme')
    expect(PHOEME_FEATURES.length).toBeGreaterThan(3)
  })
})
