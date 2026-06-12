/**
 * Shared sticky top bar for brochure pages (`/static/`, `/phoeme/`).
 */

import { mountBrochureThemeSwitcher } from './brochure-theme'

export type BrochureBannerOptions = {
  backHref: string
  backLabel: string
  /** Optional longer label for hover / screen-reader context */
  backTitle?: string
  title: string
  subtitle?: string
  withTheme?: boolean
}

export function mountBrochureBanner(opts: BrochureBannerOptions): HTMLElement {
  const banner = document.createElement('header')
  banner.className = 'brochure-banner'

  const inner = document.createElement('div')
  inner.className = 'brochure-banner-inner'

  const back = document.createElement('a')
  back.href = opts.backHref
  back.className = 'brochure-banner-back'
  back.textContent = opts.backLabel
  if (opts.backTitle) back.title = opts.backTitle

  const brand = document.createElement('div')
  brand.className = 'brochure-banner-brand'
  const titleEl = document.createElement('p')
  titleEl.className = 'brochure-banner-title'
  titleEl.textContent = opts.title
  brand.appendChild(titleEl)
  if (opts.subtitle) {
    const sub = document.createElement('p')
    sub.className = 'brochure-banner-sub'
    sub.textContent = opts.subtitle
    brand.appendChild(sub)
  }

  const actions = document.createElement('div')
  actions.className = 'brochure-banner-actions'
  if (opts.withTheme !== false) mountBrochureThemeSwitcher(actions)

  inner.append(back, brand, actions)
  banner.appendChild(inner)
  return banner
}
