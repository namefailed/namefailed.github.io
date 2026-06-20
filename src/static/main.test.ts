// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CERTIFICATIONS, CONTACT, EDUCATION, EXPERIENCE, PROFILE, SKILLS_PRIMARY } from './static-data'
import { PORTFOLIO_PROJECTS } from '../content/portfolio'

// ── Collaborator mocks ───────────────────────────────────────────────────────
// main.ts runs initBrochureTheme() + mount() at import time. Stub the
// side-effecting collaborators (theme init touches localStorage, the banner
// builds a theme picker, the contact form wires a submit handler) so the import
// is deterministic and exercises main.ts's own DOM-building code.

vi.mock('../brochure-theme', () => ({
  initBrochureTheme: vi.fn(),
}))

vi.mock('../brochure-banner', () => ({
  mountBrochureBanner: vi.fn((opts: { backHref: string; title: string }) => {
    const banner = document.createElement('header')
    banner.className = 'brochure-banner'
    banner.dataset['backHref'] = opts.backHref
    banner.dataset['title'] = opts.title
    return banner
  }),
}))

vi.mock('../contact-form', () => ({
  mountContactForm: vi.fn((variant: string) => {
    const form = document.createElement('form')
    form.className = 'contact-form'
    form.dataset['variant'] = variant
    return form
  }),
}))

vi.mock('../static-portfolio-href', () => ({
  resolveDesktopShellHref: vi.fn(() => 'https://mrgrey.site/home'),
}))

// Keep static-motion behaviour observable but synchronous/inert: animateCounter
// writes the final value, typewriter writes the full string (no rAF/timers).
vi.mock('./static-motion', () => ({
  animateCounter: vi.fn((numEl: { textContent: string | null }, target: number, suffix: string) => {
    numEl.textContent = `${target}${suffix}`
  }),
  typewriter: vi.fn((target: HTMLElement, text: string) => {
    target.textContent = text
  }),
}))

import { animateCounter as mockAnimateCounter, typewriter as mockTypewriter } from './static-motion'
import { mountBrochureBanner as mockMountBanner } from '../brochure-banner'
import { mountContactForm as mockMountContactForm } from '../contact-form'
import { initBrochureTheme as mockInitTheme } from '../brochure-theme'

// ── Global stubs the module touches at import / mount time ────────────────────

type IoEntry = { isIntersecting: boolean; target: Element }

/** Captured IntersectionObserver instances so tests can drive callbacks. */
const ioInstances: Array<{
  cb: (entries: IoEntry[]) => void
  options?: IntersectionObserverInit
  observed: Element[]
  disconnect: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
}> = []

const origIO = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
const origRAF = globalThis.requestAnimationFrame
const origMatchMedia = (globalThis as { matchMedia?: unknown }).matchMedia

/** rAF callbacks queued by mount() (it defers observeAnimations + scroll spy). */
let rafQueue: FrameRequestCallback[] = []

function installIntersectionObserver(): void {
  ;(globalThis as { IntersectionObserver: unknown }).IntersectionObserver = class {
    cb: (entries: IoEntry[]) => void
    options?: IntersectionObserverInit
    observed: Element[] = []
    disconnect = vi.fn()
    unobserve = vi.fn()
    constructor(cb: (entries: IoEntry[]) => void, options?: IntersectionObserverInit) {
      this.cb = cb
      this.options = options
      ioInstances.push(this)
    }
    observe(target: Element): void {
      this.observed.push(target)
    }
    takeRecords(): IoEntry[] {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  } as unknown as typeof IntersectionObserver
}

/** A no-reduced-motion matchMedia stub (the module's motion helpers are mocked,
 *  but a defined matchMedia keeps any incidental probe from throwing). */
function installMatchMedia(): void {
  ;(globalThis as { matchMedia: unknown }).matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof matchMedia
}

/** Prepare a fresh document with #static-root, then import (and run) main.ts. */
async function loadMain(opts: { withRoot?: boolean } = {}): Promise<void> {
  const withRoot = opts.withRoot !== false
  document.head.innerHTML = '<meta name="theme-color" content="#000000">'
  document.body.replaceChildren()
  if (withRoot) {
    const root = document.createElement('div')
    root.id = 'static-root'
    document.body.appendChild(root)
  }
  rafQueue = []
  ioInstances.length = 0
  vi.resetModules()
  await import('./main')
}

const root = (): HTMLElement => document.getElementById('static-root') as HTMLElement
const q = (sel: string): HTMLElement | null => document.querySelector(sel)
const qa = (sel: string): HTMLElement[] => Array.from(document.querySelectorAll(sel))

beforeEach(() => {
  installIntersectionObserver()
  installMatchMedia()
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
    rafQueue.push(cb)
    return rafQueue.length
  }) as unknown as typeof requestAnimationFrame
  vi.clearAllMocks()
})

afterEach(() => {
  if (origIO === undefined) {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
  } else {
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = origIO
  }
  globalThis.requestAnimationFrame = origRAF
  if (origMatchMedia === undefined) {
    delete (globalThis as { matchMedia?: unknown }).matchMedia
  } else {
    ;(globalThis as { matchMedia?: unknown }).matchMedia = origMatchMedia
  }
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

// ── Import-time effects ──────────────────────────────────────────────────────

describe('module import / mount', () => {
  it('calls initBrochureTheme() once on import', async () => {
    await loadMain()
    expect(mockInitTheme).toHaveBeenCalledTimes(1)
  })

  it('does nothing when #static-root is absent (early return)', async () => {
    await loadMain({ withRoot: false })
    // No banner / main rendered, and no collaborators invoked by mount().
    expect(q('.brochure-banner')).toBeNull()
    expect(q('main.plain-main')).toBeNull()
    expect(mockMountBanner).not.toHaveBeenCalled()
    expect(mockMountContactForm).not.toHaveBeenCalled()
    // initBrochureTheme still runs (it is module-level, before mount()).
    expect(mockInitTheme).toHaveBeenCalledTimes(1)
  })

  it('replaces #static-root contents with banner, main, and section nav', async () => {
    await loadMain()
    const children = Array.from(root().children)
    expect(children).toHaveLength(3)
    expect(children[0]!.classList.contains('brochure-banner')).toBe(true)
    expect((children[1] as HTMLElement).tagName).toBe('MAIN')
    expect(children[2]!.classList.contains('plain-section-nav')).toBe(true)
  })

  it('sets the document title from the profile name', async () => {
    await loadMain()
    expect(document.title).toBe(`${PROFILE.name} — Software Engineer · mrgrey.site`)
  })
})

// ── Banner / contact-form wiring ─────────────────────────────────────────────

describe('banner and contact form wiring', () => {
  it('mounts the banner with the resolved desktop href as backHref', async () => {
    await loadMain()
    expect(mockMountBanner).toHaveBeenCalledTimes(1)
    const opts = (mockMountBanner as unknown as { mock: { calls: Array<[{ backHref: string; backLabel: string }]> } }).mock.calls[0]![0]
    expect(opts.backHref).toBe('https://mrgrey.site/home')
    expect(opts.backLabel).toBe('← Desktop')
    expect(q('.brochure-banner')!.dataset['backHref']).toBe('https://mrgrey.site/home')
  })

  it('mounts the contact form with the "plain" variant inside the contact section', async () => {
    await loadMain()
    expect(mockMountContactForm).toHaveBeenCalledWith('plain')
    const form = q('.plain-contact-form-section .contact-form')
    expect(form).not.toBeNull()
    expect(form!.dataset['variant']).toBe('plain')
  })

  it('renders the footer link using the resolved desktop href', async () => {
    await loadMain()
    const link = q('.plain-footer a') as HTMLAnchorElement
    expect(link).not.toBeNull()
    expect(link.getAttribute('href')).toBe('https://mrgrey.site/home')
    expect(link.textContent).toContain('Back to interactive mrgrey.site')
  })
})

// ── Hero ─────────────────────────────────────────────────────────────────────

describe('hero', () => {
  it('renders the name heading with the profile name', async () => {
    await loadMain()
    const name = q('#plain-name') as HTMLElement
    expect(name).not.toBeNull()
    expect(name.classList.contains('plain-name')).toBe(true)
    expect(name.textContent).toBe(PROFILE.name)
  })

  it('runs the typewriter on the headline with headline · location', async () => {
    await loadMain()
    const headline = q('.plain-headline') as HTMLElement
    expect(mockTypewriter).toHaveBeenCalledWith(headline, `${PROFILE.headline} · ${PROFILE.location}`)
    expect(headline.getAttribute('aria-label')).toBe(`${PROFILE.headline} · ${PROFILE.location}`)
    // The mocked typewriter fills the visible text.
    expect(headline.textContent).toBe(`${PROFILE.headline} · ${PROFILE.location}`)
  })

  it('shows the "Open to work" status pill when statusOpen is true', async () => {
    // PROFILE.statusOpen is true in the fixtures.
    await loadMain()
    const pill = q('.plain-status') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.textContent).toBe('Open to work')
    expect(pill.classList.contains('plain-status--muted')).toBe(false)
  })

  it('renders the lede paragraph with the profile summary', async () => {
    await loadMain()
    expect(q('.plain-lede')!.textContent).toBe(PROFILE.summary)
  })

  it('renders the avatar image and falls back to initials on error', async () => {
    await loadMain()
    const img = q('.plain-avatar-img') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/portrait.jpg')
    // Trigger the onerror fallback.
    img.dispatchEvent(new Event('error'))
    const fallback = q('.plain-avatar-fallback') as HTMLElement
    expect(fallback).not.toBeNull()
    expect(fallback.textContent).toBe('MG')
    expect(q('.plain-avatar')!.classList.contains('plain-avatar--fallback')).toBe(true)
  })

  it('mounts a scroll cue inside the hero', async () => {
    await loadMain()
    const cue = q('.plain-scroll-cue') as HTMLElement
    expect(cue).not.toBeNull()
    expect(cue.textContent).toBe('↓')
    expect(cue.closest('.plain-hero')).not.toBeNull()
  })
})

// ── Stats strip ──────────────────────────────────────────────────────────────

describe('stats strip', () => {
  it('renders the three stats with their static labels and initial values', async () => {
    await loadMain()
    const nums = qa('.plain-stat-num').map((n) => n.textContent)
    const labels = qa('.plain-stat-label').map((n) => n.textContent)
    expect(nums).toEqual(['9+', '15+', '4'])
    expect(labels).toEqual(['years building', 'projects shipped', 'client industries'])
  })

  it('exposes the "15+ projects shipped" and "4 client industries" stats', async () => {
    await loadMain()
    const stats = qa('.plain-stat').map((s) => s.textContent)
    expect(stats.some((t) => t!.includes('15+') && t!.includes('projects shipped'))).toBe(true)
    expect(stats.some((t) => t!.includes('4') && t!.includes('client industries'))).toBe(true)
  })

  it('animates a counter from 0 when the strip scrolls into view, then disconnects', async () => {
    await loadMain()
    // statsStrip creates one IntersectionObserver per stat (3 total), each
    // observing the wrap. Find them by their 0.9 threshold.
    const statObservers = ioInstances.filter((o) => o.options?.threshold === 0.9)
    expect(statObservers.length).toBe(3)

    const wrap = q('.plain-stats') as HTMLElement
    const firstNum = qa('.plain-stat-num')[0] as HTMLElement

    // Fire the first observer's callback with an intersecting entry.
    statObservers[0]!.cb([{ isIntersecting: true, target: wrap }])
    // animateCounter (mocked) writes the final value; the branch also resets to '0' first.
    expect(mockAnimateCounter).toHaveBeenCalledWith(firstNum, 9, '+')
    expect(firstNum.textContent).toBe('9+')
    expect(statObservers[0]!.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not animate when the entry is not intersecting', async () => {
    await loadMain()
    const statObservers = ioInstances.filter((o) => o.options?.threshold === 0.9)
    statObservers[0]!.cb([{ isIntersecting: false, target: q('.plain-stats')! }])
    expect(mockAnimateCounter).not.toHaveBeenCalled()
    expect(statObservers[0]!.disconnect).not.toHaveBeenCalled()
  })
})

// ── Skills ───────────────────────────────────────────────────────────────────

describe('skills section', () => {
  it('renders every primary skill chip in order with staggered delays', async () => {
    await loadMain()
    const chips = qa('.plain-skill-chip')
    expect(chips.map((c) => c.textContent)).toEqual([...SKILLS_PRIMARY])
    // The second chip gets a 40ms stagger.
    expect(chips[1]!.style.transitionDelay).toBe('40ms')
  })

  it('gives the skills section heading the sec-skills id', async () => {
    await loadMain()
    const heading = q('#sec-skills') as HTMLElement
    expect(heading).not.toBeNull()
    expect(heading.tagName).toBe('H2')
    expect(heading.textContent).toBe('Skills')
  })
})

// ── Experience ───────────────────────────────────────────────────────────────

describe('experience cards', () => {
  it('renders one card per experience entry', async () => {
    await loadMain()
    expect(qa('.plain-exp-card')).toHaveLength(EXPERIENCE.length)
  })

  it('marks the first card span-2 and reflects title/company/period/location', async () => {
    await loadMain()
    const cards = qa('.plain-exp-card')
    const first = cards[0]!
    expect(first.classList.contains('plain-span-2')).toBe(true)
    expect(first.querySelector('.plain-exp-title')!.textContent).toBe(EXPERIENCE[0]!.title)
    expect(first.querySelector('.plain-exp-company')!.textContent).toBe(EXPERIENCE[0]!.company)
    expect(first.querySelector('.plain-exp-period')!.textContent).toBe(EXPERIENCE[0]!.period)
    expect(first.querySelector('.plain-exp-location')!.textContent).toBe(EXPERIENCE[0]!.location)
    // Later cards are not span-2.
    expect(cards[1]!.classList.contains('plain-span-2')).toBe(false)
  })

  it('renders every bullet for an entry', async () => {
    await loadMain()
    const first = qa('.plain-exp-card')[0]!
    const bullets = Array.from(first.querySelectorAll('.plain-exp-bullets li')).map((li) => li.textContent)
    expect(bullets).toEqual([...EXPERIENCE[0]!.bullets])
  })

  it('sets a data-type attribute for typed entries', async () => {
    await loadMain()
    const first = qa('.plain-exp-card')[0]!
    expect(first.dataset['type']).toBe(EXPERIENCE[0]!.type)
  })

  it('adds a Featured badge and data-featured to the featured entry only', async () => {
    await loadMain()
    const badges = qa('.plain-exp-badge')
    const featuredCount = EXPERIENCE.filter((e) => e.featured).length
    expect(badges).toHaveLength(featuredCount)
    expect(badges[0]!.textContent).toBe('Featured')
    const featuredCard = badges[0]!.closest('.plain-exp-card') as HTMLElement
    expect(featuredCard.dataset['featured']).toBe('')
  })
})

// ── Projects ─────────────────────────────────────────────────────────────────

describe('project cards (plainProjectsFromPortfolio)', () => {
  const expectedProjects = PORTFOLIO_PROJECTS.filter((p) => p.title !== 'Future entries')

  it('renders one figure-bearing card per non-"Future entries" portfolio project', async () => {
    await loadMain()
    const cards = qa('.plain-project')
    expect(cards).toHaveLength(expectedProjects.length)
    // Each card carries a real preview figure from buildProjectPreviewFigure.
    expect(cards[0]!.querySelector('figure.project-preview')).not.toBeNull()
  })

  it('uses each project title and collapsed-whitespace blurb in the card body', async () => {
    await loadMain()
    const cards = qa('.plain-project')
    const first = cards[0]!
    const source = expectedProjects[0]!
    expect(first.querySelector('.plain-project-title')!.textContent).toBe(source.title)
    const expectedBlurb = source.lines.map((ln) => ln.replace(/\s+/g, ' ').trim()).join(' ').trim()
    expect(first.querySelector('.plain-project-blurb')!.textContent).toBe(expectedBlurb)
  })

  it('renders the project meta with a leading separator from the period', async () => {
    await loadMain()
    const source = expectedProjects[0]!
    // plainProjectsFromPortfolio maps period -> meta; the card prefixes " · ".
    const meta = qa('.plain-project')[0]!.querySelector('.plain-project-meta')
    expect(meta!.textContent).toBe(` · ${source.period}`)
  })

  it('renders GitHub and Live site chips driven by repo/url presence', async () => {
    await loadMain()
    const cards = qa('.plain-project')
    // Find a project that has both a repo and a web URL (e.g. Phoneme).
    const withBoth = expectedProjects.findIndex((p) => p.repo && p.web)
    expect(withBoth).toBeGreaterThanOrEqual(0)
    const actions = cards[withBoth]!.querySelector('.plain-project-actions') as HTMLElement
    const chipTexts = Array.from(actions.querySelectorAll('a')).map((a) => a.textContent)
    expect(chipTexts).toContain('GitHub')
    expect(chipTexts).toContain('Live site')
    const ghLink = Array.from(actions.querySelectorAll('a')).find((a) => a.textContent === 'GitHub') as HTMLAnchorElement
    expect(ghLink.getAttribute('href')).toBe(expectedProjects[withBoth]!.repo)
    expect(ghLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('omits the actions row for a project with neither repo nor url', async () => {
    await loadMain()
    const cards = qa('.plain-project')
    const noLinksIdx = expectedProjects.findIndex((p) => !p.repo && !p.web)
    if (noLinksIdx >= 0) {
      expect(cards[noLinksIdx]!.querySelector('.plain-project-actions')).toBeNull()
    } else {
      // No such fixture project — assert the helper still produced action rows elsewhere.
      expect(qa('.plain-project-actions').length).toBeGreaterThan(0)
    }
  })

  it('marks the first project card span-2', async () => {
    await loadMain()
    expect(qa('.plain-project')[0]!.classList.contains('plain-span-2')).toBe(true)
  })
})

// ── Education & certifications ────────────────────────────────────────────────

describe('education and certifications', () => {
  it('lists each education line', async () => {
    await loadMain()
    const items = Array.from(
      (q('#sec-education')!.closest('.plain-section') as HTMLElement).querySelectorAll('.plain-ul li'),
    ).map((li) => li.textContent)
    expect(items).toEqual([...EDUCATION])
  })

  it('lists each certification line', async () => {
    await loadMain()
    const items = Array.from(
      (q('#sec-certs')!.closest('.plain-section') as HTMLElement).querySelectorAll('.plain-ul li'),
    ).map((li) => li.textContent)
    expect(items).toEqual([...CERTIFICATIONS])
  })
})

// ── Contact links ────────────────────────────────────────────────────────────

describe('contact link rows', () => {
  it('renders a row per contact entry with label and anchor', async () => {
    await loadMain()
    const rows = qa('.plain-contact-row')
    expect(rows).toHaveLength(CONTACT.length)
    const labels = qa('.plain-contact-label').map((l) => l.textContent)
    expect(labels).toEqual(CONTACT.map((c) => c.label))
  })

  it('opens http links in a new tab with noopener and keeps the title attribute', async () => {
    await loadMain()
    const siteRow = qa('.plain-contact-row').find(
      (r) => r.querySelector('.plain-contact-label')!.textContent === 'Site',
    )!
    const a = siteRow.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('https://mrgrey.site')
    expect(a.target).toBe('_blank')
    expect(a.rel).toBe('noopener noreferrer')
  })

  it('does not add target/_blank to non-http links (mailto)', async () => {
    await loadMain()
    const emailRow = qa('.plain-contact-row').find(
      (r) => r.querySelector('.plain-contact-label')!.textContent === 'Email',
    )!
    const a = emailRow.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('href')).toBe('mailto:namefailedx@gmail.com')
    expect(a.target).toBe('')
  })

  it('shows the shortened anchor copy for Phone and keeps the full text in title', async () => {
    await loadMain()
    const phoneRow = qa('.plain-contact-row').find(
      (r) => r.querySelector('.plain-contact-label')!.textContent === 'Phone',
    )!
    const a = phoneRow.querySelector('a') as HTMLAnchorElement
    expect(a.textContent).toBe('+1 254-534-9544')
    const source = CONTACT.find((c) => c.label === 'Phone')!
    expect(a.title).toBe(source.text)
  })

  it('shows the shortened anchor copy for LinkedIn', async () => {
    await loadMain()
    const liRow = qa('.plain-contact-row').find(
      (r) => r.querySelector('.plain-contact-label')!.textContent === 'LinkedIn',
    )!
    const a = liRow.querySelector('a') as HTMLAnchorElement
    expect(a.textContent).toBe('linkedin.com/in/matthew-grey-215615179')
  })
})

// ── Section nav ──────────────────────────────────────────────────────────────

describe('section nav', () => {
  it('builds one labelled dot per nav section in order', async () => {
    await loadMain()
    const nav = q('.plain-section-nav') as HTMLElement
    expect(nav.getAttribute('aria-label')).toBe('Page sections')
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
    const expected = [
      { id: 'sec-skills', label: 'Skills' },
      { id: 'sec-experience', label: 'Experience' },
      { id: 'sec-projects', label: 'Projects' },
      { id: 'sec-education', label: 'Education' },
      { id: 'sec-certs', label: 'Certifications' },
      { id: 'sec-contact', label: 'Contact' },
    ]
    expect(dots).toHaveLength(expected.length)
    dots.forEach((dot, i) => {
      expect(dot.getAttribute('href')).toBe(`#${expected[i]!.id}`)
      expect(dot.getAttribute('aria-label')).toBe(expected[i]!.label)
      expect(dot.dataset['label']).toBe(expected[i]!.label)
    })
  })
})

// ── Progress bar ─────────────────────────────────────────────────────────────

describe('progress bar', () => {
  it('prepends a progress bar to the body and sets 0% when there is no scrollable height', async () => {
    await loadMain()
    const bar = document.body.firstElementChild as HTMLElement
    expect(bar.classList.contains('plain-progress-bar')).toBe(true)
    // scrollHeight - innerHeight <= 0 in happy-dom -> '0%'.
    expect(bar.style.width).toBe('0%')
  })

  it('recomputes width on scroll using scrollHeight and scrollY', async () => {
    await loadMain()
    const bar = q('.plain-progress-bar') as HTMLElement
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 })
    window.dispatchEvent(new Event('scroll'))
    // h = 1000, scrollY 500 -> 50%.
    expect(bar.style.width).toBe('50%')
    delete (document.documentElement as unknown as { scrollHeight?: number }).scrollHeight
  })
})

// ── Scroll cue toggle ────────────────────────────────────────────────────────

describe('scroll cue visibility', () => {
  it('hides the cue after scrolling past the threshold', async () => {
    await loadMain()
    const cue = q('.plain-scroll-cue') as HTMLElement
    expect(cue.classList.contains('plain-scroll-cue--gone')).toBe(false)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 200 })
    window.dispatchEvent(new Event('scroll'))
    expect(cue.classList.contains('plain-scroll-cue--gone')).toBe(true)
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    window.dispatchEvent(new Event('scroll'))
    expect(cue.classList.contains('plain-scroll-cue--gone')).toBe(false)
  })
})

// ── Deferred rAF: scroll animations + scroll spy ─────────────────────────────

describe('deferred animations and scroll spy', () => {
  it('observes [data-anim] nodes and reveals them as they intersect', async () => {
    await loadMain()
    // The boot rAF schedules observeAnimations + mountScrollSpy.
    expect(rafQueue.length).toBeGreaterThan(0)
    rafQueue.forEach((cb) => cb(0))

    // The anim observer uses threshold 0.06.
    const animObserver = ioInstances.find((o) => o.options?.threshold === 0.06)
    expect(animObserver).toBeDefined()
    expect(animObserver!.observed.length).toBeGreaterThan(0)

    const target = animObserver!.observed[0] as HTMLElement
    expect(target.classList.contains('is-visible')).toBe(false)
    animObserver!.cb([{ isIntersecting: true, target }])
    expect(target.classList.contains('is-visible')).toBe(true)
    expect(animObserver!.unobserve).toHaveBeenCalledWith(target)
  })

  it('does not reveal a node that is not intersecting', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    const animObserver = ioInstances.find((o) => o.options?.threshold === 0.06)!
    const target = animObserver.observed[0] as HTMLElement
    animObserver.cb([{ isIntersecting: false, target }])
    expect(target.classList.contains('is-visible')).toBe(false)
    expect(animObserver.unobserve).not.toHaveBeenCalled()
  })

  it('falls back to marking all [data-anim] visible when IntersectionObserver is missing', async () => {
    // statsStrip needs IO during mount; only observeAnimations (in the boot rAF)
    // has the 'IntersectionObserver in window' guard. Mount with IO present, then
    // remove it before the deferred rAF runs so the fallback branch is hit.
    await loadMain()
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    // observeAnimations runs first in the boot rAF and takes the fallback branch
    // (marking everything visible). mountScrollSpy runs next in the same callback
    // and legitimately needs IO, so re-install it for the retry. The fallback DOM
    // mutation has already happened, so re-running is idempotent for our assertion.
    rafQueue.forEach((cb) => {
      try {
        cb(0)
      } catch {
        installIntersectionObserver()
        cb(0)
      }
    })
    const animated = qa('[data-anim]')
    expect(animated.length).toBeGreaterThan(0)
    expect(animated.every((n) => n.classList.contains('is-visible'))).toBe(true)
  })

  it('scroll spy activates the dot for the section that scrolls into view', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    // The scroll-spy observer uses threshold 0.35 and observes section targets by id.
    const spy = ioInstances.find((o) => o.options?.threshold === 0.35)
    expect(spy).toBeDefined()
    const projectsTarget = document.getElementById('sec-projects') as HTMLElement
    expect(spy!.observed).toContain(projectsTarget)

    spy!.cb([{ isIntersecting: true, target: projectsTarget }])
    const nav = q('.plain-section-nav') as HTMLElement
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
    // sec-projects is index 2 in NAV_SECTIONS.
    expect(dots[2]!.classList.contains('plain-nav-dot--active')).toBe(true)
  })

  it('moves the active dot between sections and only one is active at a time', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    const spy = ioInstances.find((o) => o.options?.threshold === 0.35)!
    const nav = q('.plain-section-nav') as HTMLElement
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))

    spy.cb([{ isIntersecting: true, target: document.getElementById('sec-skills')! }])
    expect(dots[0]!.classList.contains('plain-nav-dot--active')).toBe(true)

    spy.cb([{ isIntersecting: true, target: document.getElementById('sec-contact')! }])
    expect(dots[0]!.classList.contains('plain-nav-dot--active')).toBe(false)
    expect(dots[5]!.classList.contains('plain-nav-dot--active')).toBe(true)
    expect(dots.filter((d) => d.classList.contains('plain-nav-dot--active'))).toHaveLength(1)
  })

  it('ignores a non-intersecting scroll-spy entry', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    const spy = ioInstances.find((o) => o.options?.threshold === 0.35)!
    const nav = q('.plain-section-nav') as HTMLElement
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
    spy.cb([{ isIntersecting: false, target: document.getElementById('sec-skills')! }])
    expect(dots.some((d) => d.classList.contains('plain-nav-dot--active'))).toBe(false)
  })

  it('ignores a scroll-spy entry whose id is not a known section (idx < 0)', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    const spy = ioInstances.find((o) => o.options?.threshold === 0.35)!
    const nav = q('.plain-section-nav') as HTMLElement
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
    const stranger = document.createElement('div')
    stranger.id = 'not-a-section'
    spy.cb([{ isIntersecting: true, target: stranger }])
    expect(dots.some((d) => d.classList.contains('plain-nav-dot--active'))).toBe(false)
  })

  it('does not thrash when the same section re-fires (idx === activeIdx)', async () => {
    await loadMain()
    rafQueue.forEach((cb) => cb(0))
    const spy = ioInstances.find((o) => o.options?.threshold === 0.35)!
    const nav = q('.plain-section-nav') as HTMLElement
    const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
    const skills = document.getElementById('sec-skills')!
    spy.cb([{ isIntersecting: true, target: skills }])
    expect(dots[0]!.classList.contains('plain-nav-dot--active')).toBe(true)
    // Re-firing the active section is a no-op (the inner branch is skipped).
    spy.cb([{ isIntersecting: true, target: skills }])
    expect(dots[0]!.classList.contains('plain-nav-dot--active')).toBe(true)
    expect(dots.filter((d) => d.classList.contains('plain-nav-dot--active'))).toHaveLength(1)
  })
})

// ── Sparse data shapes (defensive conditional rendering) ─────────────────────
// The real fixtures always carry type/featured/meta/blurb, so these conditional
// branches only differ for sparser inputs. Inject minimal data to exercise them.

describe('sparse entry rendering', () => {
  async function loadWithData(overrides: {
    experience?: unknown
    projects?: unknown
  }): Promise<void> {
    if (overrides.experience) {
      vi.doMock('./static-data', async () => {
        const actual = await vi.importActual<typeof import('./static-data')>('./static-data')
        return { ...actual, EXPERIENCE: overrides.experience }
      })
    }
    if (overrides.projects) {
      vi.doMock('../content/portfolio', async () => {
        const actual = await vi.importActual<typeof import('../content/portfolio')>('../content/portfolio')
        return { ...actual, PORTFOLIO_PROJECTS: overrides.projects }
      })
    }
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    document.body.replaceChildren()
    const r = document.createElement('div')
    r.id = 'static-root'
    document.body.appendChild(r)
    rafQueue = []
    ioInstances.length = 0
    vi.resetModules()
    await import('./main')
  }

  afterEach(() => {
    vi.doUnmock('./static-data')
    vi.doUnmock('../content/portfolio')
  })

  it('omits data-type and the Featured badge for a typeless, unfeatured entry', async () => {
    await loadWithData({
      experience: [
        {
          title: 'Plain Role',
          company: 'Nowhere Inc',
          period: '2020',
          location: 'Remote',
          bullets: ['did things'],
        },
      ],
    })
    const card = q('.plain-exp-card') as HTMLElement
    expect(card).not.toBeNull()
    expect('type' in card.dataset).toBe(false)
    expect('featured' in card.dataset).toBe(false)
    expect(q('.plain-exp-badge')).toBeNull()
  })

  it('omits meta, blurb, and the actions row for a bare project', async () => {
    await loadWithData({
      projects: [
        {
          title: 'Bare Project',
          // no period (meta), no lines content (blurb), no repo, no web
          lines: ['   '],
        },
      ],
    })
    const card = q('.plain-project') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.querySelector('.plain-project-title')!.textContent).toBe('Bare Project')
    // lines collapse to empty -> no blurb paragraph.
    expect(card.querySelector('.plain-project-blurb')).toBeNull()
    // no period -> no meta span.
    expect(card.querySelector('.plain-project-meta')).toBeNull()
    // neither repo nor url -> no actions row.
    expect(card.querySelector('.plain-project-actions')).toBeNull()
  })
})

// ── Status pill variant (statusOpen=false) ───────────────────────────────────

describe('status pill when not open to work', () => {
  it('renders the muted "Unavailable" pill when PROFILE.statusOpen is false', async () => {
    vi.doMock('./static-data', async () => {
      const actual = await vi.importActual<typeof import('./static-data')>('./static-data')
      return { ...actual, PROFILE: { ...actual.PROFILE, statusOpen: false } }
    })
    document.head.innerHTML = '<meta name="theme-color" content="#000000">'
    document.body.replaceChildren()
    const r = document.createElement('div')
    r.id = 'static-root'
    document.body.appendChild(r)
    rafQueue = []
    ioInstances.length = 0
    vi.resetModules()
    await import('./main')

    const pill = q('.plain-status') as HTMLElement
    expect(pill).not.toBeNull()
    expect(pill.textContent).toBe('Unavailable')
    expect(pill.classList.contains('plain-status--muted')).toBe(true)
    vi.doUnmock('./static-data')
  })
})
