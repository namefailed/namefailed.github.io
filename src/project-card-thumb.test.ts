// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import {
  inferProjectPreviewKind,
  buildProjectPreviewFigure,
  openProjectPreviewLightbox,
} from './project-card-thumb'
import { liveSiteScreenshotUrl } from './live-site-screenshot'

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

  it('treats any Topsarge* title as client work', () => {
    expect(inferProjectPreviewKind({ title: 'Topsarge Solutions', web: 'https://x.com' })).toBe(
      'client',
    )
  })

  it('falls back to website when a repo is present alongside a web URL', () => {
    expect(
      inferProjectPreviewKind({ title: 'Both', repo: 'https://gh/x', web: 'https://x.com' }),
    ).toBe('website')
  })

  it('falls back to website when neither repo nor web is given', () => {
    expect(inferProjectPreviewKind({ title: 'Nothing' })).toBe('website')
  })
})

// --- buildProjectPreviewFigure (DOM-driven) ----------------------------------

/** Fire a synthetic load failure on an <img> so the wired error handlers run. */
function failImage(img: HTMLImageElement): void {
  img.dispatchEvent(new Event('error'))
}

const q = <T extends Element>(root: ParentNode, sel: string): T => {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error(`missing element: ${sel}`)
  return el
}

afterEach(() => {
  // The module memoises a single lightbox node in <body> (see ensureLightbox).
  // Detaching it would orphan the module-level cache, so instead of wiping the
  // body we just force the dialog back to its closed/hidden resting state. The
  // figures themselves are never appended to <body> by the module, so there is
  // nothing else to clean up.
  const lb = document.body.querySelector<HTMLElement>('.project-preview-lightbox')
  if (lb) {
    lb.classList.remove('project-preview-lightbox--open')
    lb.setAttribute('aria-hidden', 'true')
    lb.querySelector('.project-preview-lightbox-img')?.removeAttribute('src')
  }
})

describe('buildProjectPreviewFigure — structure & labels', () => {
  it('renders chrome, viewport, meta and an expand button', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    expect(figure.tagName).toBe('FIGURE')
    expect(figure.className).toBe('project-preview')
    expect(q(figure, '.project-preview-chrome')).toBeTruthy()
    expect(q(figure, '.project-preview-viewport')).toBeTruthy()
    expect(q(figure, 'figcaption.project-preview-meta')).toBeTruthy()
    expect(q<HTMLButtonElement>(figure, '.project-preview-expand').textContent).toBe('Expand')
  })

  it('honours a custom class prefix throughout the tree', () => {
    const { figure } = buildProjectPreviewFigure(
      { title: 'Acme', web: 'https://acme.test' },
      'wm-card',
    )
    expect(figure.className).toBe('wm-card')
    expect(q(figure, '.wm-card-chrome')).toBeTruthy()
    expect(q(figure, '.wm-card-viewport')).toBeTruthy()
    expect(q(figure, '.wm-card-img')).toBeTruthy()
    expect(q(figure, '.wm-card-expand')).toBeTruthy()
  })

  it('escapes HTML in the chrome title but keeps the meta title as text', () => {
    const { figure } = buildProjectPreviewFigure({
      title: '<b>x&y</b>',
      web: 'https://x.test',
    })
    const chromeTitle = q(figure, '.project-preview-chrome-title')
    // escapeHtml output: entity-encoded, so no real <b> child element is created.
    expect(chromeTitle.querySelector('b')).toBeNull()
    expect(chromeTitle.innerHTML).toContain('&lt;b&gt;x&amp;y&lt;/b&gt;')
    // metaTitle uses textContent, so the raw string round-trips literally.
    expect(q(figure, '.project-preview-meta-title').textContent).toBe('<b>x&y</b>')
  })

  it('labels the alt text and kind badge per inferred kind (website)', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    expect(q<HTMLImageElement>(figure, '.project-preview-img').alt).toBe(
      'Acme — Website preview',
    )
    expect(q(figure, '.project-preview-kind').textContent).toBe('Website')
  })

  it('uses the Desktop app label for app-kind projects', () => {
    // A thumb keeps the <img> mounted so its alt text is assertable (an
    // app-kind card with no web URL would otherwise drop straight to the
    // placeholder).
    const { figure } = buildProjectPreviewFigure({
      title: 'Phoneme',
      repo: 'https://gh/p',
      thumb: 'phoneme.png',
    })
    expect(q<HTMLImageElement>(figure, '.project-preview-img').alt).toBe(
      'Phoneme — Desktop app preview',
    )
    expect(q(figure, '.project-preview-kind').textContent).toBe('Desktop app')
  })

  it('uses the This site label for the portfolio kind', () => {
    const { figure } = buildProjectPreviewFigure({
      title: 'mrgrey.site',
      web: 'https://mrgrey.site',
    })
    expect(q(figure, '.project-preview-kind').textContent).toBe('This site')
  })

  it('uses the Client work label for client projects', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Freelance web' })
    expect(q(figure, '.project-preview-kind').textContent).toBe('Client work')
  })

  it('honours an explicit previewKind override, bypassing inference', () => {
    // A title that would infer as "website" is forced to "client".
    const { figure } = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
      previewKind: 'client',
    })
    expect(q(figure, '.project-preview-kind').textContent).toBe('Client work')
    expect(q<HTMLImageElement>(figure, '.project-preview-img').alt).toBe(
      'Acme — Client work preview',
    )
  })

  it('sets standard lazy/async/no-referrer image attributes', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    expect(img.loading).toBe('lazy')
    expect(img.decoding).toBe('async')
    expect(img.referrerPolicy).toBe('no-referrer')
  })

  it('appends a period element only when a period is supplied', () => {
    const withPeriod = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
      period: '2021 – 2023',
    }).figure
    expect(q(withPeriod, '.project-preview-period').textContent).toBe('2021 – 2023')

    const noPeriod = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
    }).figure
    expect(noPeriod.querySelector('.project-preview-period')).toBeNull()
  })

  it('applies thumbPosition to object-position when provided', () => {
    const { figure } = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
      thumb: 'shot.png',
      thumbPosition: 'top center',
    })
    expect(q<HTMLImageElement>(figure, '.project-preview-img').style.objectPosition).toBe(
      'top center',
    )
  })

  it('leaves object-position unset when no thumbPosition is given', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    expect(q<HTMLImageElement>(figure, '.project-preview-img').style.objectPosition).toBe('')
  })

  it('labels the expand button with the project title', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    expect(q(figure, '.project-preview-expand').getAttribute('aria-label')).toBe(
      'View full Acme preview',
    )
  })
})

describe('buildProjectPreviewFigure — image source wiring', () => {
  it('uses the live mShots URL when a web URL is present', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    expect(q<HTMLImageElement>(figure, '.project-preview-img').src).toBe(
      liveSiteScreenshotUrl('https://acme.test'),
    )
  })

  it('skips the live screenshot when skipLiveScreenshot is set, using the thumb', () => {
    const { figure } = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
      thumb: 'shot.png',
      skipLiveScreenshot: true,
    })
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    expect(img.src).toContain('/shot.png')
    expect(img.src).not.toContain('mshots')
  })

  it('prefixes a leading slash for relative thumb paths and leaves absolute ones intact', () => {
    const rel = buildProjectPreviewFigure({
      title: 'A',
      thumb: 'img/shot.png',
    }).figure
    expect(q<HTMLImageElement>(rel, '.project-preview-img').src).toContain('/img/shot.png')

    const abs = buildProjectPreviewFigure({
      title: 'A',
      thumb: '/already/abs.png',
    }).figure
    // No double slash introduced for an already-absolute path.
    expect(q<HTMLImageElement>(abs, '.project-preview-img').src).toMatch(/\/already\/abs\.png$/)
  })

  it('falls back live → thumb → placeholder on successive load errors', () => {
    const { figure } = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
      thumb: 'shot.png',
    })
    const viewport = q(figure, '.project-preview-viewport')
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    expect(img.src).toContain('mshots')

    // First error: swap to the local thumb.
    failImage(img)
    expect(img.src).toContain('/shot.png')
    expect(viewport.classList.contains('project-preview-viewport--empty')).toBe(false)

    // Second error: the local thumb also fails → show the placeholder.
    failImage(img)
    expect(viewport.classList.contains('project-preview-viewport--empty')).toBe(true)
    const ph = q(viewport, '.project-preview-placeholder')
    expect(ph.getAttribute('role')).toBe('img')
    expect(ph.getAttribute('aria-label')).toBe('Acme preview')
  })

  it('falls back live → placeholder when there is no local thumb', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    const viewport = q(figure, '.project-preview-viewport')
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    failImage(img)
    expect(viewport.classList.contains('project-preview-viewport--empty')).toBe(true)
    expect(q(viewport, '.project-preview-placeholder')).toBeTruthy()
  })

  it('falls back thumb → placeholder when only a thumb is given', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', thumb: 'shot.png' })
    const viewport = q(figure, '.project-preview-viewport')
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    expect(img.src).toContain('/shot.png')
    failImage(img)
    expect(viewport.classList.contains('project-preview-viewport--empty')).toBe(true)
  })

  it('shows the placeholder immediately when there is no live shot and no thumb', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', repo: 'https://gh/a' })
    const viewport = q(figure, '.project-preview-viewport')
    expect(viewport.classList.contains('project-preview-viewport--empty')).toBe(true)
    // The <img> is replaced wholesale by the placeholder.
    expect(viewport.querySelector('.project-preview-img')).toBeNull()
    expect(q(viewport, '.project-preview-placeholder')).toBeTruthy()
  })
})

describe('buildProjectPreviewFigure — placeholder initials', () => {
  const initials = (title: string, input = {}): string => {
    const { figure } = buildProjectPreviewFigure({ title, ...input })
    return q(figure, '.project-preview-initials').textContent ?? ''
  }

  it('uses the first letter of the first two words for multi-word titles', () => {
    // No live shot / thumb → placeholder is mounted up front.
    expect(initials('Hello World', { repo: 'https://gh/x' })).toBe('HW')
  })

  it('uses the first two letters for a single-word title', () => {
    expect(initials('Phoneme', { repo: 'https://gh/x' })).toBe('PH')
  })

  it('uppercases initials drawn from lowercase titles', () => {
    expect(initials('alpha beta', { repo: 'https://gh/x' })).toBe('AB')
  })

  it('falls back to "?" for a whitespace-only title', () => {
    expect(initials('   ', { repo: 'https://gh/x' })).toBe('?')
  })
})

describe('buildProjectPreviewFigure — previewSrc accessor', () => {
  it('reports the current image src while the image is showing', () => {
    const { figure, previewSrc } = buildProjectPreviewFigure({
      title: 'Acme',
      web: 'https://acme.test',
    })
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    expect(previewSrc()).toBe(img.src)
  })

  it('returns null once the viewport has fallen back to the placeholder', () => {
    const { figure, previewSrc } = buildProjectPreviewFigure({
      title: 'Acme',
      repo: 'https://gh/a',
    })
    // No source at all → placeholder shown immediately.
    expect(q(figure, '.project-preview-viewport').classList.contains(
      'project-preview-viewport--empty',
    )).toBe(true)
    expect(previewSrc()).toBeNull()
  })
})

describe('buildProjectPreviewFigure — expand button → lightbox', () => {
  it('opens the lightbox with the image src and title on click', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', web: 'https://acme.test' })
    const img = q<HTMLImageElement>(figure, '.project-preview-img')
    const src = img.src
    q<HTMLButtonElement>(figure, '.project-preview-expand').click()

    const lb = q(document.body, '.project-preview-lightbox')
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(true)
    expect(lb.getAttribute('aria-hidden')).toBe('false')
    expect(q(lb, '.project-preview-lightbox-title').textContent).toBe('Acme')
    const lbImg = q<HTMLImageElement>(lb, '.project-preview-lightbox-img')
    expect(lbImg.src).toBe(src)
    expect(lbImg.alt).toBe('Acme — full preview')
  })

  it('does not open the lightbox when the viewport is empty (placeholder)', () => {
    const { figure } = buildProjectPreviewFigure({ title: 'Acme', repo: 'https://gh/a' })
    q<HTMLButtonElement>(figure, '.project-preview-expand').click()
    expect(document.body.querySelector('.project-preview-lightbox--open')).toBeNull()
  })
})

describe('openProjectPreviewLightbox — open/close lifecycle', () => {
  // The module memoises one lightbox in <body>; afterEach wipes <body> but the
  // module-level cache survives, so the next open() recreates the root since the
  // cached node is detached. Each test asserts against the live <body> node.

  it('reuses a single lightbox root across multiple opens', () => {
    openProjectPreviewLightbox('https://img/one.png', 'One')
    openProjectPreviewLightbox('https://img/two.png', 'Two')
    expect(document.body.querySelectorAll('.project-preview-lightbox')).toHaveLength(1)
    expect(q(document.body, '.project-preview-lightbox-title').textContent).toBe('Two')
    expect(q<HTMLImageElement>(document.body, '.project-preview-lightbox-img').src).toBe(
      'https://img/two.png',
    )
  })

  it('marks the dialog open with the right ARIA + image alt', () => {
    openProjectPreviewLightbox('https://img/x.png', 'Xeno')
    const lb = q(document.body, '.project-preview-lightbox')
    expect(lb.getAttribute('role')).toBe('dialog')
    expect(lb.getAttribute('aria-modal')).toBe('true')
    expect(lb.getAttribute('aria-hidden')).toBe('false')
    expect(q<HTMLImageElement>(lb, '.project-preview-lightbox-img').alt).toBe(
      'Xeno — full preview',
    )
  })

  it('closes when the backdrop is clicked, clearing src and aria state', () => {
    openProjectPreviewLightbox('https://img/x.png', 'Xeno')
    const lb = q(document.body, '.project-preview-lightbox')
    q<HTMLButtonElement>(lb, '.project-preview-lightbox-backdrop').click()
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(false)
    expect(lb.getAttribute('aria-hidden')).toBe('true')
    expect(q<HTMLImageElement>(lb, '.project-preview-lightbox-img').hasAttribute('src')).toBe(
      false,
    )
  })

  it('closes when the close button is clicked', () => {
    openProjectPreviewLightbox('https://img/x.png', 'Xeno')
    const lb = q(document.body, '.project-preview-lightbox')
    q<HTMLButtonElement>(lb, '.project-preview-lightbox-close').click()
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(false)
    expect(lb.getAttribute('aria-hidden')).toBe('true')
  })

  it('closes on Escape while open, and ignores Escape when already closed', () => {
    openProjectPreviewLightbox('https://img/x.png', 'Xeno')
    const lb = q(document.body, '.project-preview-lightbox')
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(false)

    // A second Escape on the now-closed dialog is a no-op (guard branch).
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(false)
  })

  it('ignores non-Escape keydowns while open', () => {
    openProjectPreviewLightbox('https://img/x.png', 'Xeno')
    const lb = q(document.body, '.project-preview-lightbox')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(lb.classList.contains('project-preview-lightbox--open')).toBe(true)
  })
})
