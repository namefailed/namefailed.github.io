import './plain.css'
import { PORTFOLIO_PROJECTS } from '../content/portfolio'
import {
  CERTIFICATIONS,
  CONTACT,
  EDUCATION,
  EXPERIENCE,
  PROFILE,
  type PlainProject,
  SKILLS_PRIMARY,
} from './plain-data'

/** Omit roadmap placeholder tiles; prose and links follow `portfolio.ts`. */
function plainProjectsFromPortfolio(): PlainProject[] {
  return PORTFOLIO_PROJECTS.filter((p) => p.title !== 'Future entries').map(
    (p) => ({
      title: p.title,
      meta: p.period,
      blurb: p.lines.map((ln) => ln.replace(/\s+/g, ' ').trim()).join(' ').trim(),
      url: p.web,
      repo: p.repo,
    }),
  )
}

/** SPA lives one level up (`/`) from `/plain/`; `file:` needs an explicit sibling `index.html`. */
function spaHomeHref(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return new URL('../index.html', window.location.href).href
  }
  return '../'
}

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

function linkRow(label: string, href: string, text: string): HTMLElement {
  const row = el('div', 'plain-contact-row')
  row.append(el('span', 'plain-contact-label', label))
  const a = document.createElement('a')
  a.href = href
  a.textContent = text
  row.appendChild(a)
  return row
}

function projectCard(project: PlainProject): HTMLElement {
  const card = el('article', 'plain-project')
  const h = document.createElement('h3')
  const title = el('span', 'plain-project-title', project.title)
  h.appendChild(title)
  if (project.meta) {
    h.appendChild(el('span', 'plain-project-meta', ` · ${project.meta}`))
  }
  card.appendChild(h)
  if (project.blurb) card.appendChild(el('p', 'plain-project-blurb', project.blurb))

  const actions = el('div', 'plain-project-actions')
  if (project.repo) {
    const a = document.createElement('a')
    a.className = 'plain-chip plain-chip--ghost'
    a.href = project.repo
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = 'GitHub'
    actions.appendChild(a)
  }
  if (project.url) {
    const a = document.createElement('a')
    a.className = 'plain-chip'
    a.href = project.url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.textContent = 'Live site'
    actions.appendChild(a)
  }
  if (actions.childElementCount) card.appendChild(actions)
  return card
}

function mount(): void {
  const root = document.getElementById('plain-root')
  if (!root) return

  const homeHref = spaHomeHref()

  const banner = el('header', 'plain-banner')
  const bannerInner = el('div', 'plain-banner-inner')
  const backLink = document.createElement('a')
  backLink.href = homeHref
  backLink.className = 'plain-back'
  backLink.textContent = '← Full desktop experience'
  bannerInner.appendChild(backLink)
  bannerInner.appendChild(
    el('p', 'plain-banner-meta', 'Static page · same substance, less chrome.'),
  )
  banner.appendChild(bannerInner)

  const hero = el('section', 'plain-hero')
  hero.setAttribute('aria-labelledby', 'plain-name')

  hero.appendChild(el('h1', 'plain-name', PROFILE.name))

  hero.appendChild(
    el('p', 'plain-headline', `${PROFILE.headline} · ${PROFILE.location}`),
  )

  const pill = document.createElement('span')
  pill.className = 'plain-status'
  pill.textContent = PROFILE.statusOpen ? 'Open to work' : 'Unavailable'
  if (!PROFILE.statusOpen) pill.classList.add('plain-status--muted')
  hero.appendChild(pill)

  hero.appendChild(el('p', 'plain-lede', PROFILE.summary))

  hero.appendChild(el('h2', 'plain-heading', 'Skills'))

  const skillWrap = el('div', 'plain-skills')
  for (const s of SKILLS_PRIMARY) {
    skillWrap.appendChild(el('span', 'plain-skill-chip', s))
  }
  hero.appendChild(skillWrap)

  hero.appendChild(el('h2', 'plain-heading', 'Experience'))

  const expList = el('ul', 'plain-ul')
  for (const tx of EXPERIENCE) expList.appendChild(el('li', undefined, tx))
  hero.appendChild(expList)

  hero.appendChild(el('h2', 'plain-heading', 'Education'))

  const eduList = el('ul', 'plain-ul')
  for (const tx of EDUCATION) eduList.appendChild(el('li', undefined, tx))
  hero.appendChild(eduList)

  hero.appendChild(el('h2', 'plain-heading', 'Certifications'))

  const certList = el('ul', 'plain-ul')
  for (const tx of CERTIFICATIONS) certList.appendChild(el('li', undefined, tx))
  hero.appendChild(certList)

  hero.appendChild(el('h2', 'plain-heading', 'Selected projects'))

  const grid = el('div', 'plain-project-grid')
  for (const p of plainProjectsFromPortfolio()) grid.appendChild(projectCard(p))
  hero.appendChild(grid)

  hero.appendChild(el('h2', 'plain-heading', 'Contact'))

  const contactBlock = el('div', 'plain-contact-block')
  for (const item of CONTACT) {
    contactBlock.appendChild(linkRow(item.label, item.href, item.text))
  }

  hero.appendChild(contactBlock)

  const footer = el('footer', 'plain-footer')

  const fLink = document.createElement('a')
  fLink.href = homeHref
  fLink.textContent = 'Back to interactive mrgrey.dev'
  footer.appendChild(fLink)

  const main = el('main', 'plain-main')
  main.id = 'content'
  main.setAttribute('role', 'main')
  main.appendChild(hero)
  main.appendChild(footer)

  root.replaceChildren(banner, main)

  document.title = `${PROFILE.name} — Portfolio`
}

mount()
