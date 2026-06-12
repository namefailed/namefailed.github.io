// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mountPhoemeHeader } from './phoeme-header'

describe('phoeme-header', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('mounts header with back link, desktop+mobile brand, and theme picker', () => {
    const header = mountPhoemeHeader({ backHref: '/', backTitle: 'mrgrey.site desktop' })
    document.body.appendChild(header)

    expect(header.classList.contains('pm-header')).toBe(true)
    expect(header.querySelector('.pm-header-back')?.textContent).toBe('← mrgrey.site')
    expect(header.querySelector('.pm-header-back')?.getAttribute('href')).toBe('/')
    expect(header.querySelector('.pm-header-center .pm-header-brand')?.textContent).toBe('Phoneme')
    expect(header.querySelector('.pm-header-start .pm-header-brand-mobile')?.textContent).toBe('Phoneme')
    expect(header.querySelector('.pm-header-start .pm-header-brand-mobile')?.getAttribute('href')).toBe('#content')
    expect(header.querySelector('.brochure-theme-select')).not.toBeNull()
    expect(header.querySelector('.pm-header-cta')).toBeNull()
  })
})
