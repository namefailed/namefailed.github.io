import { describe, it, expect } from 'vitest'
import { inferProjectPreviewKind } from './project-card-thumb'

describe('inferProjectPreviewKind', () => {
  it('marks Phoneme as desktop app', () => {
    expect(
      inferProjectPreviewKind({
        title: 'Phoneme',
        repo: 'https://github.com/namefailed/phoneme',
      }),
    ).toBe('app')
  })

  it('marks mrgrey.site as portfolio', () => {
    expect(inferProjectPreviewKind({ title: 'mrgrey.site', web: 'https://mrgrey.site' })).toBe(
      'portfolio',
    )
  })

  it('marks Vertalo as website', () => {
    expect(inferProjectPreviewKind({ title: 'Vertalo', web: 'https://vertalo.com' })).toBe(
      'website',
    )
  })

  it('marks freelance as client work', () => {
    expect(inferProjectPreviewKind({ title: 'Freelance web' })).toBe('client')
  })
})
