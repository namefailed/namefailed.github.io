import './phoeme.css'
import { initBrochureTheme } from '../brochure-theme'
import {
  PHOEME,
  PHOEME_COMPARISON,
  PHOEME_FAQS,
  PHOEME_FEATURES,
  PHOEME_PIPELINE,
  PHOEME_WORKFLOWS,
} from './phoeme-data'
import type { PhoemeCard, PhoemeFeature, PhoemeLink, PhoemePipelineStage } from './phoeme-data'
import { mountPhoemeHeader } from './phoeme-header'
import { resolveDesktopShellHref } from '../static-portfolio-href'

const PHOEME_HERO_FALLBACK = '/img/portfolio-phoneme.png'
const PHOEME_HERO_REMOTE_FALLBACK =
  'https://raw.githubusercontent.com/namefailed/phoneme/master/docs/screenshots/main.png'

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

function appendRichText(parent: HTMLElement, text: string): void {
  const parts = text.split(/`([^`]+)`/g)
  for (const [index, part] of parts.entries()) {
    if (!part) continue
    if (index % 2 === 1) {
      const code = el('code', 'pm-code', part)
      parent.appendChild(code)
    } else {
      parent.appendChild(document.createTextNode(part))
    }
  }
}

function rich<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = el(tag, className)
  appendRichText(node, text)
  return node
}

function extLink(href: string, label: string, className: string): HTMLAnchorElement {
  const a = document.createElement('a')
  a.href = href
  a.className = className
  a.textContent = label
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  return a
}

function ctaLink(link: PhoemeLink): HTMLAnchorElement {
  return extLink(link.href, link.label, `pm-button pm-button--${link.variant ?? 'secondary'}`)
}

function sectionIntro(id: string, eyebrow: string, title: string, lead?: string): HTMLElement {
  const intro = el('div', 'pm-section-intro')
  intro.append(el('p', 'pm-eyebrow', eyebrow))
  const heading = el('h2', 'pm-section-title', title)
  heading.id = id
  heading.tabIndex = -1
  intro.appendChild(heading)
  if (lead) intro.appendChild(rich('p', 'pm-section-lead', lead))
  return intro
}

function mountHero(): HTMLElement {
  const hero = el('section', 'pm-hero')
  hero.setAttribute('aria-labelledby', 'pm-title')

  const copy = el('div', 'pm-hero-copy')
  
  const heroHead = el('div', 'pm-hero-head')
  const icon = el('img', 'pm-hero-icon') as HTMLImageElement
  icon.src = '/img/phoneme-icon.png'
  icon.alt = 'Phoneme Icon'
  icon.width = 48
  icon.height = 48
  heroHead.append(icon, el('p', 'pm-eyebrow', PHOEME.tagline))
  
  copy.append(heroHead)

  const title = el('h1', 'pm-hero-title')
  title.id = 'pm-title'
  title.append(
    el('span', 'pm-hero-title-plain', PHOEME.headlineBefore),
    el('span', 'pm-hero-title-accent', PHOEME.headlineAccent),
  )

  const actions = el('div', 'pm-actions')
  for (const link of PHOEME.ctas) actions.appendChild(ctaLink(link))

  const facts = el('ul', 'pm-hero-facts')
  for (const fact of PHOEME.facts) facts.appendChild(el('li', undefined, fact))

  copy.append(title, rich('p', 'pm-hero-lede', PHOEME.intro), actions, facts)

  const figure = el('figure', 'pm-shot')
  const img = document.createElement('img')
  img.className = 'pm-shot-img'
  img.src = PHOEME.heroImage
  img.alt = PHOEME.heroImageAlt
  img.width = 960
  img.height = 540
  img.loading = 'eager'
  img.setAttribute('fetchpriority', 'high')
  img.decoding = 'async'
  img.referrerPolicy = 'no-referrer'
  img.addEventListener(
    'error',
    () => {
      const fallback = PHOEME.heroImage === PHOEME_HERO_FALLBACK ? PHOEME_HERO_REMOTE_FALLBACK : PHOEME_HERO_FALLBACK
      img.src = fallback
    },
    { once: true },
  )
  figure.append(
    img,
    el('figcaption', 'pm-shot-cap', 'Recordings catalog, waveform, transcript, tags, and notes'),
  )

  const visual = el('div', 'pm-hero-visual')
  visual.appendChild(figure)
  hero.append(copy, visual)
  return hero
}

function workflowCard(card: PhoemeCard): HTMLElement {
  const item = el('article', 'pm-workflow-card')
  if (card.kicker) item.appendChild(el('p', 'pm-card-kicker', card.kicker))
  item.append(el('h3', 'pm-card-title', card.title), rich('p', 'pm-card-body', card.body))
  return item
}

function mountWorkflows(): HTMLElement {
  const section = el('section', 'pm-section pm-section--workflows')
  section.setAttribute('aria-labelledby', 'workflows')
  section.appendChild(
    sectionIntro(
      'workflows',
      'Use cases',
      'Ways to use it',
      'Dictate into other apps, record meetings, search old recordings, and send transcripts into your own tools.',
    ),
  )

  const grid = el('div', 'pm-workflow-grid')
  for (const item of PHOEME_WORKFLOWS) grid.appendChild(workflowCard(item))
  section.appendChild(grid)
  return section
}

function pipelineCard(stage: PhoemePipelineStage, index: number): HTMLElement {
  const item = el('article', 'pm-pipeline-card')
  const step = el('span', 'pm-pipeline-step', String(index + 1).padStart(2, '0'))
  step.setAttribute('aria-hidden', 'true')
  item.append(
    step,
    el('p', 'pm-pipeline-signal', stage.signal),
    el('h3', 'pm-pipeline-title', stage.title),
    rich('p', 'pm-pipeline-body', stage.body),
  )
  return item
}

function mountPipeline(): HTMLElement {
  const section = el('section', 'pm-section pm-section--pipeline')
  section.setAttribute('aria-labelledby', 'pipeline')
  section.appendChild(
    sectionIntro(
      'pipeline',
      'Pipeline',
      'From audio to action',
      'Each stage stays explicit: where audio comes from, which provider transcribes it, what cleanup runs, and where the result goes.',
    ),
  )

  const rail = el('div', 'pm-pipeline')
  for (const [index, stage] of PHOEME_PIPELINE.entries()) rail.appendChild(pipelineCard(stage, index))
  section.appendChild(rail)
  return section
}

function featureCard(feature: PhoemeFeature): HTMLElement {
  const item = el('article', 'pm-feature-card')
  item.append(
    el('p', 'pm-card-kicker', feature.tag),
    el('h3', 'pm-feature-title', feature.title),
    rich('p', 'pm-card-body', feature.body),
  )
  return item
}

function mountFeatures(): HTMLElement {
  const section = el('section', 'pm-section pm-section--features')
  section.setAttribute('aria-labelledby', 'features')
  section.appendChild(
    sectionIntro(
      'features',
      'Details',
      'Built for local control',
      'Provider choices, reversible edits, search, export, and automation stay visible instead of disappearing behind a black box.',
    ),
  )

  const grid = el('div', 'pm-feature-grid')
  for (const feature of PHOEME_FEATURES) grid.appendChild(featureCard(feature))
  section.appendChild(grid)
  return section
}

function mountComparison(): HTMLElement {
  const section = el('section', 'pm-section pm-section--compare')
  section.setAttribute('aria-labelledby', 'compare')
  section.appendChild(
    sectionIntro(
      'compare',
      PHOEME_COMPARISON.eyebrow,
      PHOEME_COMPARISON.title,
      PHOEME_COMPARISON.lead,
    ),
  )

  const list = el('div', 'pm-compare-list')

  const head = el('div', 'pm-compare-head')
  head.append(el('span', 'pm-compare-head-cloud', 'Typical cloud'), el('span', 'pm-compare-head-phoneme', 'Phoneme'))
  list.appendChild(head)

  for (const point of PHOEME_COMPARISON.points) {
    const row = el('article', 'pm-compare-row')
    const cloud = el('div', 'pm-compare-col pm-compare-col--cloud')
    const phoneme = el('div', 'pm-compare-col pm-compare-col--phoneme')
    cloud.appendChild(el('p', 'pm-compare-mobile-label', 'Typical cloud'))
    cloud.appendChild(rich('p', 'pm-compare-col-body', point.cloud))
    phoneme.appendChild(el('p', 'pm-compare-mobile-label', 'Phoneme'))
    phoneme.appendChild(rich('p', 'pm-compare-col-body', point.phoneme))
    row.append(cloud, phoneme)
    list.appendChild(row)
  }

  section.appendChild(list)
  return section
}

function mountFaq(): HTMLElement {
  const section = el('section', 'pm-section pm-section--faq')
  section.setAttribute('aria-labelledby', 'faq')
  section.appendChild(
    sectionIntro(
      'faq',
      'FAQ',
      'Questions people ask',
      'Short answers on privacy, platform support, recording modes, search, and hooks.',
    ),
  )

  const list = el('div', 'pm-faq-list')
  list.setAttribute('role', 'region')
  list.setAttribute('aria-label', 'Frequently asked questions')
  const buttons: HTMLButtonElement[] = []
  PHOEME_FAQS.forEach((item, index) => {
    const article = el('article', 'pm-faq-item')
    const button = el('button', 'pm-faq-question', item.question)
    const panel = rich('p', 'pm-faq-answer', item.answer)
    const panelWrap = el('div', 'pm-faq-answer-wrap')
    const panelId = `pm-faq-${index}`
    const questionId = `pm-faq-question-${index}`

    button.type = 'button'
    button.id = questionId
    button.setAttribute('aria-expanded', 'false')
    button.setAttribute('aria-controls', panelId)
    panelWrap.id = panelId
    panelWrap.setAttribute('role', 'region')
    panelWrap.setAttribute('aria-labelledby', questionId)
    panelWrap.setAttribute('aria-hidden', 'true')
    panelWrap.appendChild(panel)

    const setExpanded = (open: boolean): void => {
      buttons.forEach((otherButton) => {
        const otherPanelId = otherButton.getAttribute('aria-controls')
        const otherPanel = otherPanelId ? list.querySelector<HTMLElement>(`#${otherPanelId}`) : null
        otherButton.setAttribute('aria-expanded', 'false')
        if (otherPanel) {
          otherPanel.setAttribute('aria-hidden', 'true')
          otherPanel.style.maxHeight = ''
        }
      })
      button.setAttribute('aria-expanded', String(open))
      panelWrap.setAttribute('aria-hidden', String(!open))
      // Drive the open height off the real content so long answers never clip;
      // the CSS max-height is only a no-JS fallback. Closing clears the inline
      // value so the aria-hidden rule animates back to 0.
      panelWrap.style.maxHeight = open ? `${panelWrap.scrollHeight}px` : ''
    }

    button.addEventListener('click', () => {
      setExpanded(button.getAttribute('aria-expanded') !== 'true')
    })

    button.addEventListener('keydown', (event) => {
      const currentIndex = buttons.indexOf(button)
      if (currentIndex < 0) return

      let targetIndex: number | null = null
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        targetIndex = (currentIndex + 1) % buttons.length
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        targetIndex = (currentIndex - 1 + buttons.length) % buttons.length
      } else if (event.key === 'Home') {
        targetIndex = 0
      } else if (event.key === 'End') {
        targetIndex = buttons.length - 1
      }

      if (targetIndex === null) return
      event.preventDefault()
      buttons[targetIndex]?.focus()
    })

    buttons.push(button)
    article.append(button, panelWrap)
    list.appendChild(article)
  })

  section.appendChild(list)
  return section
}

function mountFinalCta(): HTMLElement {
  const section = el('section', 'pm-section pm-section--cta')
  section.setAttribute('aria-labelledby', 'get-started')

  const panel = el('div', 'pm-cta-panel')
  panel.appendChild(
    sectionIntro(
      'get-started',
      'Get started',
      'Download the installer, then make it yours.',
      'The First Run Wizard can set up a local model, connect optional providers, and choose destinations. The docs cover hooks, CLI commands, provider settings, and troubleshooting.',
    ),
  )

  const actions = el('div', 'pm-actions')
  actions.append(ctaLink(PHOEME.ctas[0]), ctaLink(PHOEME.ctas[1]))
  panel.appendChild(actions)
  section.appendChild(panel)
  return section
}

function mountFooter(): HTMLElement {
  const footer = el('footer', 'pm-footer')
  footer.setAttribute('role', 'contentinfo')
  const inner = el('div', 'pm-footer-inner')

  const brand = el('div', 'pm-footer-brand')
  brand.append(el('p', 'pm-footer-name', PHOEME.name), el('p', 'pm-footer-tagline', PHOEME.tagline))

  const nav = el('nav', 'pm-footer-nav')
  nav.setAttribute('aria-label', 'Footer')
  for (const link of PHOEME.ctas) {
    nav.appendChild(extLink(link.href, link.label, 'pm-footer-nav-link'))
  }

  const stack = el('ul', 'pm-footer-stack')
  for (const chip of PHOEME.stackChips) {
    const item = el('li', 'pm-footer-stack-item', chip)
    stack.appendChild(item)
  }

  const bottom = el('div', 'pm-footer-bottom')
  const credit = el('p', 'pm-footer-credit')
  credit.append('Built by Matt Grey / ')
  credit.appendChild(extLink('https://github.com/namefailed', 'namefailed', 'pm-footer-credit-link'))
  credit.append('.')
  bottom.append(el('span', 'pm-footer-license', PHOEME.license), credit)

  inner.append(brand, nav, stack, bottom)
  footer.appendChild(inner)
  return footer
}

function mount(): void {
  const root = document.getElementById('phoeme-root')
  if (!root) return

  const header = mountPhoemeHeader({
    backHref: resolveDesktopShellHref(),
    backTitle: 'mrgrey.site desktop',
  })

  const main = el('main', 'pm-main')
  main.id = 'content'
  main.tabIndex = -1
  main.append(
    mountHero(),
    mountWorkflows(),
    mountPipeline(),
    mountFeatures(),
    mountComparison(),
    mountFaq(),
    mountFinalCta(),
  )

  root.replaceChildren(header, main, mountFooter())
  document.title = `${PHOEME.name} — ${PHOEME.tagline}`
}

mount()
