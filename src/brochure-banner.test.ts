// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mountBrochureBanner } from './brochure-banner'

describe('brochure-banner', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('mounts shared banner chrome with theme select', () => {
    const banner = mountBrochureBanner({
      backHref: '/',
      backLabel: '← Home',
      title: 'Phoneme',
      subtitle: 'Product page',
    })
    document.body.appendChild(banner)

    expect(banner.classList.contains('brochure-banner')).toBe(true)
    expect(banner.querySelector('.brochure-banner-back')?.textContent).toBe('← Home')
    expect(banner.querySelector('.brochure-banner-title')?.textContent).toBe('Phoneme')
    expect(banner.querySelector('.brochure-theme-select')).not.toBeNull()
  })
})
