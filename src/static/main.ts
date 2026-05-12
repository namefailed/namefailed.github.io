import './static.css'
import { PORTFOLIO_PROJECTS } from '../content/portfolio'
import {
  CERTIFICATIONS,
  CONTACT,
  EDUCATION,
  EXPERIENCE,
  type ExperienceEntry,
  PROFILE,
  type PlainProject,
  SKILLS_PRIMARY,
} from './static-data'

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

/** SPA lives one level up (`/`) from `/static/`; `file:` needs an explicit sibling `index.html`. */
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

function anim(node: HTMLElement, delayMs = 0): HTMLElement {
  node.dataset['anim'] = ''
  if (delayMs) node.style.transitionDelay = `${delayMs}ms`
  return node
}

/** Avatar with spinning ring + portrait.jpg → MG fallback. */
function avatarEl(): HTMLElement {
  const wrap = el('div', 'plain-avatar-wrap')
  wrap.setAttribute('aria-hidden', 'true')

  const ring = el('div', 'plain-avatar-ring')
  const fig = el('figure', 'plain-avatar')
  fig.style.margin = '0'

  const img = document.createElement('img')
  img.className = 'plain-avatar-img'
  img.src = '/portrait.jpg'
  img.alt = ''
  img.loading = 'eager'
  img.decoding = 'async'
  img.onerror = () => {
    const fb = el('div', 'plain-avatar-fallback')
    fb.textContent = 'MG'
    fig.replaceChildren(fb)
    fig.classList.add('plain-avatar--fallback')
  }

  fig.appendChild(img)
  wrap.append(ring, fig)
  return wrap
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

function experienceCard(entry: ExperienceEntry, delay = 0): HTMLElement {
  const card = anim(el('article', 'plain-exp-card'), delay)

  const header = el('div', 'plain-exp-header')
  header.append(
    el('span', 'plain-exp-title', entry.title),
    el('span', 'plain-exp-company', entry.company),
  )
  card.appendChild(header)

  const meta = el('div', 'plain-exp-meta')
  meta.append(
    el('span', 'plain-exp-period', entry.period),
    el('span', 'plain-exp-location', entry.location),
  )
  card.appendChild(meta)

  const ul = el('ul', 'plain-exp-bullets')
  for (const b of entry.bullets) ul.appendChild(el('li', undefined, b))
  card.appendChild(ul)

  return card
}

function projectCard(project: PlainProject, delay = 0): HTMLElement {
  const card = anim(el('article', 'plain-project'), delay)
  const h = document.createElement('h3')
  h.appendChild(el('span', 'plain-project-title', project.title))
  if (project.meta) h.appendChild(el('span', 'plain-project-meta', ` · ${project.meta}`))
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

/** Fade-up each [data-anim] element as it scrolls into view. */
function observeAnimations(): void {
  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll<HTMLElement>('[data-anim]').forEach(n => n.classList.add('is-visible'))
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
    { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
  )
  document.querySelectorAll('[data-anim]').forEach(n => io.observe(n))
}

function mount(): void {
  const root = document.getElementById('static-root')
  if (!root) return

  const homeHref = spaHomeHref()

  // ── Banner ──────────────────────────────────────────────────────────────
  const banner = el('header', 'plain-banner')
  const bannerInner = el('div', 'plain-banner-inner')
  const backLink = document.createElement('a')
  backLink.href = homeHref
  backLink.className = 'plain-back'
  backLink.textContent = '← Full desktop experience'
  bannerInner.append(backLink, el('p', 'plain-banner-meta', 'Portfolio · mobile view'))
  banner.appendChild(bannerInner)

  // ── Hero ─────────────────────────────────────────────────────────────────
  const hero = el('section', 'plain-hero')
  hero.setAttribute('aria-labelledby', 'plain-name')

  // Avatar
  hero.appendChild(anim(avatarEl(), 0))

  // Name
  const nameEl = anim(el('h1', 'plain-name', PROFILE.name), 80)
  nameEl.id = 'plain-name'
  hero.appendChild(nameEl)

  // Headline
  hero.appendChild(anim(el('p', 'plain-headline', `${PROFILE.headline} · ${PROFILE.location}`), 140))

  // Status pill
  const pill = anim(document.createElement('span'), 200)
  pill.className = PROFILE.statusOpen ? 'plain-status' : 'plain-status plain-status--muted'
  pill.textContent = PROFILE.statusOpen ? 'Open to work' : 'Unavailable'
  hero.appendChild(pill)

  // Summary
  hero.appendChild(anim(el('p', 'plain-lede', PROFILE.summary), 260))

  // ── Skills ───────────────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Skills'), 0))

  const skillWrap = anim(el('div', 'plain-skills'), 60)
  SKILLS_PRIMARY.forEach((s, i) => {
    const chip = el('span', 'plain-skill-chip', s)
    chip.style.transitionDelay = `${i * 35}ms`
    skillWrap.appendChild(chip)
  })
  hero.appendChild(skillWrap)

  // ── Experience ───────────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Experience'), 0))

  const expList = el('div', 'plain-exp-list')
  EXPERIENCE.forEach((entry, i) => expList.appendChild(experienceCard(entry, i * 60)))
  hero.appendChild(expList)

  // ── Education ────────────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Education'), 0))

  const eduList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of EDUCATION) eduList.appendChild(el('li', undefined, tx))
  hero.appendChild(eduList)

  // ── Certifications ───────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Certifications'), 0))

  const certList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of CERTIFICATIONS) certList.appendChild(el('li', undefined, tx))
  hero.appendChild(certList)

  // ── Projects ─────────────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Selected projects'), 0))

  const grid = el('div', 'plain-project-grid')
  plainProjectsFromPortfolio().forEach((p, i) => grid.appendChild(projectCard(p, i * 55)))
  hero.appendChild(grid)

  // ── Contact ──────────────────────────────────────────────────────────────
  hero.appendChild(anim(el('h2', 'plain-heading', 'Contact'), 0))

  const contactBlock = anim(el('div', 'plain-contact-block'), 60)
  for (const item of CONTACT) contactBlock.appendChild(linkRow(item.label, item.href, item.text))
  hero.appendChild(contactBlock)

  // ── Footer ───────────────────────────────────────────────────────────────
  const footer = el('footer', 'plain-footer')
  const fLink = document.createElement('a')
  fLink.href = homeHref
  fLink.textContent = 'Back to interactive mrgrey.dev'
  footer.appendChild(fLink)

  const main = el('main', 'plain-main')
  main.id = 'content'
  main.setAttribute('role', 'main')
  main.append(hero, footer)

  root.replaceChildren(banner, main)

  document.title = `${PROFILE.name} — Portfolio`

  // Boot scroll animations on the next frame so elements are in the DOM
  requestAnimationFrame(() => observeAnimations())
}

mount()
