/**
 * Shared project-card preview: browser chrome, readable labels, optional lightbox.
 */

import { liveSiteScreenshotUrl } from './live-site-screenshot'

export type ProjectPreviewKind = 'website' | 'app' | 'portfolio' | 'client'

const KIND_LABEL: Record<ProjectPreviewKind, string> = {
  website: 'Website',
  app: 'Desktop app',
  portfolio: 'This site',
  client: 'Client work',
}

export interface ProjectPreviewInput {
  title: string
  period?: string
  thumb?: string
  web?: string
  repo?: string
  skipLiveScreenshot?: boolean
  thumbPosition?: string
  previewKind?: ProjectPreviewKind
}

export function inferProjectPreviewKind(p: {
  title: string
  web?: string
  repo?: string
}): ProjectPreviewKind {
  if (p.title === 'Freelance web' || p.title.startsWith('Topsarge')) return 'client'
  if (p.title === 'mrgrey.site') return 'portfolio'
  if (p.repo && !p.web) return 'app'
  return 'website'
}

function resolveThumbPath(thumb?: string): string | null {
  if (!thumb) return null
  return thumb.startsWith('/') ? thumb : `/${thumb}`
}

function makePlaceholder(title: string, classPrefix: string): HTMLElement {
  const el = document.createElement('div')
  el.className = `${classPrefix}-placeholder`
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', `${title} preview`)
  const words = title.split(/\s+/).filter(Boolean)
  const ini =
    words.length >= 2
      ? `${words[0]![0]!}${words[1]![0]!}`
      : (words[0]?.slice(0, 2) ?? '?').toUpperCase()
  const span = document.createElement('span')
  span.className = `${classPrefix}-initials`
  span.setAttribute('aria-hidden', 'true')
  span.textContent = ini.toUpperCase()
  el.appendChild(span)
  return el
}

function wireImageSources(
  img: HTMLImageElement,
  viewport: HTMLElement,
  opts: {
    liveShot: string | null
    thumbPath: string | null
    placeholder: HTMLElement
    classPrefix: string
  },
): void {
  const { liveShot, thumbPath, placeholder, classPrefix } = opts
  const showPlaceholder = (): void => {
    viewport.replaceChildren(placeholder)
    viewport.classList.add(`${classPrefix}-viewport--empty`)
  }

  if (liveShot) {
    img.src = liveShot
    if (thumbPath) {
      img.addEventListener(
        'error',
        () => {
          img.src = thumbPath
          img.addEventListener('error', showPlaceholder, { once: true })
        },
        { once: true },
      )
    } else {
      img.addEventListener('error', showPlaceholder, { once: true })
    }
    return
  }

  if (thumbPath) {
    img.src = thumbPath
    img.addEventListener('error', showPlaceholder, { once: true })
    return
  }

  showPlaceholder()
}

let lightboxRoot: HTMLElement | null = null

function ensureLightbox(): HTMLElement {
  if (lightboxRoot) return lightboxRoot

  const root = document.createElement('div')
  root.className = 'project-preview-lightbox'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-hidden', 'true')

  const backdrop = document.createElement('button')
  backdrop.type = 'button'
  backdrop.className = 'project-preview-lightbox-backdrop'
  backdrop.setAttribute('aria-label', 'Close preview')

  const panel = document.createElement('div')
  panel.className = 'project-preview-lightbox-panel'

  const header = document.createElement('div')
  header.className = 'project-preview-lightbox-header'

  const titleEl = document.createElement('span')
  titleEl.className = 'project-preview-lightbox-title'

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'project-preview-lightbox-close'
  closeBtn.setAttribute('aria-label', 'Close preview')
  closeBtn.textContent = '✕'

  header.append(titleEl, closeBtn)

  const img = document.createElement('img')
  img.className = 'project-preview-lightbox-img'
  img.alt = ''

  panel.append(header, img)
  root.append(backdrop, panel)
  document.body.appendChild(root)

  const close = (): void => {
    root.classList.remove('project-preview-lightbox--open')
    root.setAttribute('aria-hidden', 'true')
    img.removeAttribute('src')
  }

  backdrop.addEventListener('click', close)
  closeBtn.addEventListener('click', close)

  document.addEventListener(
    'keydown',
    ev => {
      if (ev.key === 'Escape' && root.classList.contains('project-preview-lightbox--open')) {
        close()
        ev.stopPropagation()
      }
    },
    true,
  )

  lightboxRoot = root
  return root
}

export function openProjectPreviewLightbox(src: string, title: string): void {
  const root = ensureLightbox()
  const titleEl = root.querySelector<HTMLElement>('.project-preview-lightbox-title')
  const img = root.querySelector<HTMLImageElement>('.project-preview-lightbox-img')
  if (!titleEl || !img) return
  titleEl.textContent = title
  img.alt = `${title} — full preview`
  img.src = src
  root.classList.add('project-preview-lightbox--open')
  root.setAttribute('aria-hidden', 'false')
  root.querySelector<HTMLButtonElement>('.project-preview-lightbox-close')?.focus()
}

export interface ProjectPreviewFigure {
  figure: HTMLElement
  /** Best-effort URL currently shown (for lightbox). */
  previewSrc: () => string | null
}

/** Build a framed preview figure for WM or static project cards. */
export function buildProjectPreviewFigure(
  input: ProjectPreviewInput,
  classPrefix = 'project-preview',
): ProjectPreviewFigure {
  const kind = input.previewKind ?? inferProjectPreviewKind(input)
  const thumbPath = resolveThumbPath(input.thumb)
  const liveShot =
    input.web && !input.skipLiveScreenshot ? liveSiteScreenshotUrl(input.web) : null
  const placeholder = makePlaceholder(input.title, classPrefix)

  const figure = document.createElement('figure')
  figure.className = classPrefix

  const chrome = document.createElement('div')
  chrome.className = `${classPrefix}-chrome`
  chrome.innerHTML =
    `<span class="${classPrefix}-dots" aria-hidden="true"></span>` +
    `<span class="${classPrefix}-chrome-title">${input.title}</span>`

  const viewport = document.createElement('div')
  viewport.className = `${classPrefix}-viewport`

  const img = document.createElement('img')
  img.className = `${classPrefix}-img`
  img.alt = `${input.title} — ${KIND_LABEL[kind]} preview`
  img.loading = 'lazy'
  img.decoding = 'async'
  img.referrerPolicy = 'no-referrer'
  if (input.thumbPosition) img.style.objectPosition = input.thumbPosition

  viewport.appendChild(img)
  wireImageSources(img, viewport, { liveShot, thumbPath, placeholder, classPrefix })

  const meta = document.createElement('figcaption')
  meta.className = `${classPrefix}-meta`

  const metaTitle = document.createElement('span')
  metaTitle.className = `${classPrefix}-meta-title`
  metaTitle.textContent = input.title

  const kindBadge = document.createElement('span')
  kindBadge.className = `${classPrefix}-kind`
  kindBadge.textContent = KIND_LABEL[kind]

  meta.append(metaTitle, kindBadge)
  if (input.period) {
    const period = document.createElement('span')
    period.className = `${classPrefix}-period`
    period.textContent = input.period
    meta.appendChild(period)
  }

  const expandBtn = document.createElement('button')
  expandBtn.type = 'button'
  expandBtn.className = `${classPrefix}-expand`
  expandBtn.setAttribute('aria-label', `View full ${input.title} preview`)
  expandBtn.textContent = 'Expand'

  expandBtn.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    const src = img.currentSrc || img.src
    if (src && !viewport.classList.contains(`${classPrefix}-viewport--empty`)) {
      openProjectPreviewLightbox(src, input.title)
    }
  })

  figure.append(chrome, viewport, meta, expandBtn)

  return {
    figure,
    previewSrc: () => {
      if (viewport.classList.contains(`${classPrefix}-viewport--empty`)) return null
      return img.currentSrc || img.src || null
    },
  }
}
