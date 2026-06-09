import './phoeme.css'
import {
  PHOEME,
  PHOEME_AUDIENCE,
  PHOEME_FEATURES,
  PHOEME_PHILOSOPHY,
  PHOEME_STEPS,
  PHOEME_WORKFLOWS,
  type PhoemeCopyBlock,
} from './phoeme-data'
import { resolveDesktopShellHref } from '../static-portfolio-href'
import { initBrochureTheme, mountBrochureThemeSwitcher } from '../brochure-theme'

initBrochureTheme()

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function anim(node: HTMLElement, delayMs = 0): HTMLElement {
  node.dataset['anim'] = ''
  if (delayMs) node.style.transitionDelay = `${delayMs}ms`
  return node
}

function sectionHeading(text: string, id?: string): HTMLElement {
  const h = anim(el('h2', 'phoeme-heading', text))
  if (id) h.id = id
  return h
}

function ctaLink(
  href: string,
  label: string,
  variant: 'primary' | 'ghost' = 'primary',
  external = false,
): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.className = variant === 'primary' ? 'phoeme-cta phoeme-cta--primary' : 'phoeme-cta phoeme-cta--ghost'
  a.textContent = label
  if (external) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  return a
}

function copyCard(block: PhoemeCopyBlock, className: string, delay = 0): HTMLElement {
  const card = anim(el('article', className), delay)
  card.append(el('h3', `${className}-title`, block.title), el('p', `${className}-body`, block.body))
  return card
}

function observeAnimations(): void {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll<HTMLElement>('[data-anim]').forEach((n) => n.classList.add('is-visible'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
  )
  document.querySelectorAll('[data-anim]').forEach((n) => io.observe(n))
}

function mount(): void {
  const root = document.getElementById('phoeme-root')
  if (!root) return

  const homeHref = resolveDesktopShellHref()

  const banner = el('header', 'phoeme-banner')
  const bannerInner = el('div', 'phoeme-banner-inner')
  const backLink = document.createElement('a')
  backLink.href = homeHref
  backLink.className = 'phoeme-back'
  backLink.textContent = '← mrgrey.site'
  const bannerMeta = el('div', 'phoeme-banner-meta')
  bannerMeta.append(
    el('p', 'phoeme-banner-title', 'Phoneme'),
    el('p', 'phoeme-banner-sub', 'Product page'),
  )
  bannerInner.append(backLink)
  mountBrochureThemeSwitcher(bannerInner)
  bannerInner.append(bannerMeta)
  banner.appendChild(bannerInner)

  const main = el('main', 'phoeme-main')
  main.id = 'content'
  main.setAttribute('role', 'main')

  const hero = el('section', 'phoeme-hero')
  hero.setAttribute('aria-labelledby', 'phoeme-title')

  const heroCopy = el('div', 'phoeme-hero-copy')
  const badgeRow = el('div', 'phoeme-badges')
  for (const label of ['Windows', 'Local-first', 'Open source', 'No telemetry']) {
    badgeRow.appendChild(el('span', 'phoeme-badge', label))
  }

  const title = anim(el('h1', 'phoeme-title', PHOEME.name), 40)
  title.id = 'phoeme-title'
  const tagline = anim(el('p', 'phoeme-tagline', PHOEME.tagline), 80)
  const summary = anim(el('p', 'phoeme-summary', PHOEME.summary), 120)
  const status = anim(el('p', 'phoeme-status', PHOEME.status), 140)

  const actions = anim(el('div', 'phoeme-actions'), 160)
  actions.append(
    ctaLink(PHOEME.releases, 'Download for Windows', 'primary', true),
    ctaLink(PHOEME.docs, 'Documentation', 'ghost', true),
    ctaLink(PHOEME.repo, 'GitHub', 'ghost', true),
  )

  heroCopy.append(badgeRow, title, tagline, summary, status, actions)

  const heroVisual = anim(el('figure', 'phoeme-hero-visual'), 100)
  const img = document.createElement('img')
  img.className = 'phoeme-hero-img'
  img.src = PHOEME.heroImage
  img.alt = PHOEME.heroImageAlt
  img.width = 960
  img.height = 540
  img.loading = 'eager'
  img.decoding = 'async'
  img.referrerPolicy = 'no-referrer'
  heroVisual.appendChild(img)

  hero.append(heroCopy, heroVisual)

  const philosophySection = el('section', 'phoeme-section')
  philosophySection.setAttribute('aria-labelledby', 'sec-philosophy')
  philosophySection.appendChild(sectionHeading('Philosophy', 'sec-philosophy'))
  const philosophyGrid = el('div', 'phoeme-philosophy-grid')
  PHOEME_PHILOSOPHY.forEach((item, i) =>
    philosophyGrid.appendChild(copyCard(item, 'phoeme-philosophy', i * 45)),
  )
  philosophySection.appendChild(philosophyGrid)

  const workflowsSection = el('section', 'phoeme-section')
  workflowsSection.setAttribute('aria-labelledby', 'sec-workflows')
  workflowsSection.appendChild(sectionHeading('Core workflows', 'sec-workflows'))
  const workflowGrid = el('div', 'phoeme-workflow-grid')
  PHOEME_WORKFLOWS.forEach((item, i) =>
    workflowGrid.appendChild(copyCard(item, 'phoeme-workflow', i * 45)),
  )
  workflowsSection.appendChild(workflowGrid)

  const featuresSection = el('section', 'phoeme-section')
  featuresSection.setAttribute('aria-labelledby', 'sec-features')
  featuresSection.appendChild(sectionHeading('Features', 'sec-features'))
  const featureGrid = el('div', 'phoeme-feature-grid')
  PHOEME_FEATURES.forEach((f, i) => featureGrid.appendChild(copyCard(f, 'phoeme-feature', i * 40)))
  featuresSection.appendChild(featureGrid)

  const stepsSection = el('section', 'phoeme-section')
  stepsSection.setAttribute('aria-labelledby', 'sec-how')
  stepsSection.appendChild(sectionHeading('How it works', 'sec-how'))
  const stepsList = el('ol', 'phoeme-steps')
  PHOEME_STEPS.forEach((step, i) => {
    const li = anim(el('li', 'phoeme-step'), i * 60)
    li.append(el('h3', 'phoeme-step-title', step.title), el('p', 'phoeme-step-body', step.body))
    stepsList.appendChild(li)
  })
  stepsSection.appendChild(stepsList)

  const audience = anim(el('p', 'phoeme-audience', PHOEME_AUDIENCE), 80)

  const stackSection = el('section', 'phoeme-section phoeme-section--stack')
  stackSection.setAttribute('aria-labelledby', 'sec-stack')
  stackSection.appendChild(sectionHeading('Built with', 'sec-stack'))
  const stackWrap = anim(el('div', 'phoeme-stack'), 40)
  for (const tech of PHOEME.stack) stackWrap.appendChild(el('span', 'phoeme-stack-chip', tech))
  const license = el('p', 'phoeme-license', `License: ${PHOEME.license}`)
  stackSection.append(stackWrap, license)

  const footer = el('footer', 'phoeme-footer')
  footer.append(
    ctaLink(PHOEME.docs, 'Read the docs →', 'ghost', true),
    ctaLink(PHOEME.repo, 'Source on GitHub →', 'ghost', true),
    el(
      'p',
      'phoeme-footer-note',
      'Phoneme is open source by Matt Grey — not affiliated with any STT vendor.',
    ),
  )

  main.append(
    hero,
    philosophySection,
    workflowsSection,
    featuresSection,
    stepsSection,
    audience,
    stackSection,
    footer,
  )
  root.replaceChildren(banner, main)

  document.title = `${PHOEME.name} — ${PHOEME.tagline}`

  requestAnimationFrame(() => observeAnimations())
}

mount()
