/**
 * Brochure pages (`/static/`, `/phoeme/`) — reuse desktop Catppuccin theme packs
 * and `mrgrey-theme` localStorage so palette choice stays in sync with mrgrey.site.
 */

import { applyTheme, getThemeId, initThemeFromStorage, listThemeSummaries } from './theme'

export function initBrochureTheme(): void {
  initThemeFromStorage()
  syncBrochureMetaThemeColor()
  window.addEventListener('mrgrey-theme-change', syncBrochureMetaThemeColor)
}

function syncBrochureMetaThemeColor(): void {
  const surface =
    getComputedStyle(document.documentElement).getPropertyValue('--th-surface1').trim() ||
    '#1e1e2e'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
}

/** Theme picker for sticky brochure banners. */
export function mountBrochureThemeSwitcher(container: HTMLElement): HTMLSelectElement {
  const wrap = document.createElement('div')
  wrap.className = 'brochure-theme-wrap'

  const label = document.createElement('label')
  label.className = 'brochure-theme-label'
  label.textContent = 'Theme'

  const select = document.createElement('select')
  select.className = 'brochure-theme-select'
  select.setAttribute('aria-label', 'Color theme')
  select.setAttribute('autocomplete', 'off')

  for (const { id, label: name } of listThemeSummaries()) {
    const opt = document.createElement('option')
    opt.value = id
    opt.textContent = name
    select.appendChild(opt)
  }

  select.value = getThemeId()
  select.addEventListener('change', () => {
    applyTheme(select.value)
  })

  label.appendChild(select)
  wrap.appendChild(label)
  container.appendChild(wrap)
  return select
}
