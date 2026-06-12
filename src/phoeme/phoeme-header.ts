import { mountBrochureThemeSwitcher } from '../brochure-theme'
import { PHOEME } from './phoeme-data'

export type PhoemeHeaderOptions = {
  backHref: string
  backTitle?: string
}

export function mountPhoemeHeader(opts: PhoemeHeaderOptions): HTMLElement {
  const header = document.createElement('header')
  header.className = 'pm-header'

  const inner = document.createElement('div')
  inner.className = 'pm-header-inner'

  const start = document.createElement('div')
  start.className = 'pm-header-start'

  const back = document.createElement('a')
  back.href = opts.backHref
  back.className = 'pm-header-back'
  back.textContent = '← mrgrey.site'
  back.title = opts.backTitle ?? 'Back to mrgrey.site'

  const mobileBrand = document.createElement('a')
  mobileBrand.href = '#content'
  mobileBrand.className = 'pm-header-brand pm-header-brand-mobile'
  mobileBrand.textContent = PHOEME.name
  mobileBrand.setAttribute('aria-label', `${PHOEME.name} — top of page`)

  start.appendChild(back)
  start.appendChild(mobileBrand)

  const center = document.createElement('div')
  center.className = 'pm-header-center'

  const brand = document.createElement('a')
  brand.href = '#content'
  brand.className = 'pm-header-brand'
  brand.textContent = PHOEME.name
  brand.setAttribute('aria-label', `${PHOEME.name} — top of page`)

  center.appendChild(brand)

  const end = document.createElement('div')
  end.className = 'pm-header-end'
  mountBrochureThemeSwitcher(end)
  end.querySelector('.brochure-theme-label-text')?.remove()

  inner.append(start, center, end)
  header.appendChild(inner)
  return header
}
