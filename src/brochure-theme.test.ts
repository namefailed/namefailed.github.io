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

  it('uses compact option labels so the narrow picker does not clip', () => {
    initBrochureTheme()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const select = mountBrochureThemeSwitcher(host)

    const byValue = (value: string): string =>
      Array.from(select.options).find((opt) => opt.value === value)?.textContent ?? ''

    // Default Catppuccin Mocha label clips in the mobile banner; show "Mocha".
    expect(byValue('mocha')).toBe('Mocha')
    expect(byValue('gruvbox')).toBe('Gruvbox')
    expect(byValue('solarized')).toBe('Solarized')
    // No brochure option keeps a clip-prone full pack name.
    for (const opt of Array.from(select.options)) {
      expect(opt.textContent).not.toBe('Catppuccin Mocha')
      expect(opt.textContent).not.toBe('Gruvbox Dark')
      expect(opt.textContent).not.toBe('Solarized Dark')
    }
  })
})
