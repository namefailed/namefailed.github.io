// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initBrochureTheme, mountBrochureThemeSwitcher } from './brochure-theme'
import { getThemeId, listThemeSummaries } from './theme'

describe('brochure-theme', () => {
  beforeEach(() => {
    document.body.replaceChildren()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('mounts a theme select with all packs', () => {
    initBrochureTheme()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const select = mountBrochureThemeSwitcher(host)

    expect(select.tagName).toBe('SELECT')
    expect(select.options.length).toBe(listThemeSummaries().length)
    expect(select.value).toBe(getThemeId())
    expect(host.querySelector('.brochure-theme-select')).not.toBeNull()
  })
})
