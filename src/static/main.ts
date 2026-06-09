import './static.css'
import { mountContactForm } from '../contact-form'
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
import { buildProjectPreviewFigure } from '../project-card-thumb'
import { resolveDesktopShellHref } from '../static-portfolio-href'
import { animateCounter, typewriter } from './static-motion'

// ── Data helpers ───────────────────────────────────────────────────────────

function plainProjectsFromPortfolio(): PlainProject[] {
  return PORTFOLIO_PROJECTS.filter((p) => p.title !== 'Future entries').map((p) => ({
    title: p.title,
    meta: p.period,
    blurb: p.lines.map((ln) => ln.replace(/\s+/g, ' ').trim()).join(' ').trim(),
    url: p.web,
    repo: p.repo,
    thumb: p.thumb,
    skipLiveScreenshot: p.skipLiveScreenshot,
    thumbPosition: p.thumbPosition,
    previewKind: p.previewKind,
  }))
}

// ── DOM helpers ────────────────────────────────────────────────────────────

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
  const h = anim(el('h2', 'plain-heading', text), 0)
  if (id) h.id = id
  return h
}

// ── Scroll progress bar ────────────────────────────────────────────────────

function mountProgressBar(): void {
  const bar = el('div', 'plain-progress-bar')
  document.body.prepend(bar)
  const update = () => {
    const h = document.documentElement.scrollHeight - window.innerHeight
    bar.style.width = h > 0 ? `${Math.min(100, (window.scrollY / h) * 100)}%` : '0%'
  }
  window.addEventListener('scroll', update, { passive: true })
  update()
}

// ── Stats strip ────────────────────────────────────────────────────────────

function statsStrip(): HTMLElement {
  const wrap = anim(el('div', 'plain-stats'), 220)
  const items: Array<{ val: number; suf: string; label: string }> = [
    { val: 9, suf: '+', label: 'years building' },
    { val: 15, suf: '+', label: 'projects shipped' },
    { val: 3, suf: '', label: 'industries' },
  ]
  for (const { val, suf, label } of items) {
    const item = el('div', 'plain-stat')
    const numEl = el('span', 'plain-stat-num', `${val}${suf}`)
    item.append(numEl, el('span', 'plain-stat-label', label))
    wrap.appendChild(item)
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          numEl.textContent = '0'
          animateCounter(numEl, val, suf)
          obs.disconnect()
        }
      },
      { threshold: 0.9 },
    )
    obs.observe(wrap)
  }
  return wrap
}

// ── Avatar ─────────────────────────────────────────────────────────────────

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

// ── Contact link row ───────────────────────────────────────────────────────

function linkRow(label: string, href: string, text: string): HTMLElement {
  const row = el('div', 'plain-contact-row')
  row.append(el('span', 'plain-contact-label', label))
  const a = document.createElement('a')
  a.href = href
  a.textContent = contactLinkText(label, text)
  if (href.startsWith('http')) {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  }
  if (text !== a.textContent) a.title = text
  row.appendChild(a)
  return row
}

/** Shorter anchor copy for the classic layout — full string kept in `title`. */
function contactLinkText(label: string, text: string): string {
  if (label === 'Phone') return '+1 254-534-9544'
  if (label === 'LinkedIn') return 'linkedin.com/in/matthew-grey-215615179'
  return text
}

// ── Experience card ────────────────────────────────────────────────────────

function experienceCard(entry: ExperienceEntry, delay = 0): HTMLElement {
  const card = anim(el('article', 'plain-exp-card'), delay)
  if (entry.type) card.dataset['type'] = entry.type
  if (entry.featured) {
    card.dataset['featured'] = ''
    card.appendChild(el('span', 'plain-exp-badge', 'Featured'))
  }

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

// ── Project card ───────────────────────────────────────────────────────────

function projectCard(project: PlainProject, delay = 0): HTMLElement {
  const card = anim(el('article', 'plain-project plain-project--has-thumb'), delay)

  const { figure } = buildProjectPreviewFigure({
    title: project.title,
    period: project.meta,
    thumb: project.thumb,
    web: project.url,
    repo: project.repo,
    skipLiveScreenshot: project.skipLiveScreenshot,
    thumbPosition: project.thumbPosition,
    previewKind: project.previewKind,
  })
  card.appendChild(figure)

  // ── Text body ──────────────────────────────────────────────────────────
  const body = el('div', 'plain-project-body')

  const h = document.createElement('h3')
  h.appendChild(el('span', 'plain-project-title', project.title))
  if (project.meta) h.appendChild(el('span', 'plain-project-meta', ` · ${project.meta}`))
  body.appendChild(h)

  if (project.blurb) body.appendChild(el('p', 'plain-project-blurb', project.blurb))

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
  if (actions.childElementCount) body.appendChild(actions)

  card.appendChild(body)
  return card
}

// ── Scroll cue ─────────────────────────────────────────────────────────────

function mountScrollCue(hero: HTMLElement): void {
  const cue = el('div', 'plain-scroll-cue')
  cue.setAttribute('aria-hidden', 'true')
  cue.textContent = '↓'
  hero.appendChild(cue)
  window.addEventListener(
    'scroll',
    () => {
      cue.classList.toggle('plain-scroll-cue--gone', window.scrollY > 80)
    },
    { passive: true },
  )
}

// ── Section nav (floating dots) ────────────────────────────────────────────

type NavSection = { id: string; label: string }

function buildSectionNav(sections: NavSection[]): HTMLElement {
  const nav = el('nav', 'plain-section-nav')
  nav.setAttribute('aria-label', 'Page sections')
  for (const sec of sections) {
    const a = document.createElement('a')
    a.className = 'plain-nav-dot'
    a.href = `#${sec.id}`
    a.setAttribute('aria-label', sec.label)
    a.dataset['label'] = sec.label
    nav.appendChild(a)
  }
  return nav
}

function mountScrollSpy(navEl: HTMLElement, sections: NavSection[]): void {
  const dots = Array.from(navEl.querySelectorAll<HTMLAnchorElement>('.plain-nav-dot'))
  if (!dots.length) return
  const ids = sections.map((s) => s.id)
  let activeIdx = -1
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = ids.indexOf(entry.target.id)
          if (idx >= 0 && idx !== activeIdx) {
            dots[activeIdx]?.classList.remove('plain-nav-dot--active')
            dots[idx]?.classList.add('plain-nav-dot--active')
            activeIdx = idx
          }
        }
      }
    },
    { threshold: 0.35 },
  )
  for (const { id } of sections) {
    const target = document.getElementById(id)
    if (target) io.observe(target)
  }
}

// ── Scroll animations ──────────────────────────────────────────────────────

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
    { threshold: 0.06, rootMargin: '0px 0px -30px 0px' },
  )
  document.querySelectorAll('[data-anim]').forEach((n) => io.observe(n))
}

// ── Mount ──────────────────────────────────────────────────────────────────

function mount(): void {
  const root = document.getElementById('static-root')
  if (!root) return

  mountProgressBar()

  const homeHref = resolveDesktopShellHref()

  const NAV_SECTIONS: NavSection[] = [
    { id: 'sec-skills',     label: 'Skills'     },
    { id: 'sec-experience', label: 'Experience' },
    { id: 'sec-projects',   label: 'Projects'   },
    { id: 'sec-education',  label: 'Education'  },
    { id: 'sec-certs',      label: 'Certifications' },
    { id: 'sec-contact',    label: 'Contact'    },
  ]

  const sectionNav = buildSectionNav(NAV_SECTIONS)

  // ── Banner ─────────────────────────────────────────────────────────────
  const banner = el('header', 'plain-banner')
  const bannerInner = el('div', 'plain-banner-inner')
  const backLink = document.createElement('a')
  backLink.href = homeHref
  backLink.className = 'plain-back'
  backLink.textContent = '← Full desktop experience'
  const bannerMeta = el('div', 'plain-banner-meta-wrap')
  bannerMeta.append(
    el('p', 'plain-banner-title', 'Classic portfolio'),
    el('p', 'plain-banner-sub', 'Same content — optimized for reading'),
  )
  bannerInner.append(backLink, bannerMeta)
  banner.appendChild(bannerInner)

  // ── Hero ───────────────────────────────────────────────────────────────
  const hero = el('section', 'plain-hero')
  hero.setAttribute('aria-labelledby', 'plain-name')

  const heroIntro = el('div', 'plain-hero-intro')
  const heroIntroCopy = el('div', 'plain-hero-intro-copy')

  heroIntro.appendChild(anim(avatarEl(), 0))

  const nameEl = anim(el('h1', 'plain-name', PROFILE.name), 80)
  nameEl.id = 'plain-name'
  heroIntroCopy.appendChild(nameEl)

  // Headline — rendered empty; typewriter fills it in after fade
  const headlineEl = anim(el('p', 'plain-headline'), 140)
  headlineEl.setAttribute('aria-label', `${PROFILE.headline} · ${PROFILE.location}`)
  typewriter(headlineEl, `${PROFILE.headline} · ${PROFILE.location}`)
  heroIntroCopy.appendChild(headlineEl)

  const pill = anim(document.createElement('span'), 200)
  pill.className = PROFILE.statusOpen ? 'plain-status' : 'plain-status plain-status--muted'
  pill.textContent = PROFILE.statusOpen ? 'Open to work' : 'Unavailable'
  heroIntroCopy.appendChild(pill)

  heroIntroCopy.appendChild(statsStrip())
  heroIntroCopy.appendChild(anim(el('p', 'plain-lede', PROFILE.summary), 280))
  heroIntro.appendChild(heroIntroCopy)
  hero.appendChild(heroIntro)

  mountScrollCue(hero)

  // ── Skills ─────────────────────────────────────────────────────────────
  const skillsSection = el('section', 'plain-section')
  skillsSection.setAttribute('aria-labelledby', 'sec-skills')
  skillsSection.appendChild(sectionHeading('Skills', 'sec-skills'))

  const skillWrap = anim(el('div', 'plain-skills'), 60)
  SKILLS_PRIMARY.forEach((s, i) => {
    const chip = el('span', 'plain-skill-chip', s)
    chip.style.transitionDelay = `${i * 40}ms`
    skillWrap.appendChild(chip)
  })
  skillsSection.appendChild(skillWrap)

  // ── Experience ─────────────────────────────────────────────────────────
  const experienceSection = el('section', 'plain-section')
  experienceSection.setAttribute('aria-labelledby', 'sec-experience')
  experienceSection.appendChild(sectionHeading('Experience', 'sec-experience'))

  const expList = el('div', 'plain-exp-list')
  EXPERIENCE.forEach((entry, i) => expList.appendChild(experienceCard(entry, i * 65)))
  experienceSection.appendChild(expList)

  // ── Projects ───────────────────────────────────────────────────────────
  const projectsSection = el('section', 'plain-section')
  projectsSection.setAttribute('aria-labelledby', 'sec-projects')
  projectsSection.appendChild(sectionHeading('Selected projects', 'sec-projects'))

  const grid = el('div', 'plain-project-grid')
  plainProjectsFromPortfolio().forEach((p, i) => grid.appendChild(projectCard(p, i * 55)))
  projectsSection.appendChild(grid)

  // ── Education ──────────────────────────────────────────────────────────
  const educationSection = el('section', 'plain-section')
  educationSection.setAttribute('aria-labelledby', 'sec-education')
  educationSection.appendChild(sectionHeading('Education', 'sec-education'))

  const eduList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of EDUCATION) eduList.appendChild(el('li', undefined, tx))
  educationSection.appendChild(eduList)

  // ── Certifications ─────────────────────────────────────────────────────
  const certsSection = el('section', 'plain-section')
  certsSection.setAttribute('aria-labelledby', 'sec-certs')
  certsSection.appendChild(sectionHeading('Certifications', 'sec-certs'))

  const certList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of CERTIFICATIONS) certList.appendChild(el('li', undefined, tx))
  certsSection.appendChild(certList)

  // ── Contact ────────────────────────────────────────────────────────────
  const contactSection = el('section', 'plain-section')
  contactSection.setAttribute('aria-labelledby', 'sec-contact')
  contactSection.appendChild(sectionHeading('Contact', 'sec-contact'))

  const contactBlock = anim(el('div', 'plain-contact-block'), 60)
  const contactLinks = el('div', 'plain-contact-links')
  for (const item of CONTACT) contactLinks.appendChild(linkRow(item.label, item.href, item.text))
  const contactFormWrap = el('div', 'plain-contact-form-section')
  contactFormWrap.appendChild(mountContactForm('plain'))
  contactBlock.append(contactLinks, contactFormWrap)
  contactSection.appendChild(contactBlock)

  // ── Footer ─────────────────────────────────────────────────────────────
  const footer = el('footer', 'plain-footer')
  const fLink = document.createElement('a')
  fLink.href = homeHref
  fLink.textContent = 'Back to interactive mrgrey.site →'
  footer.appendChild(fLink)

  const main = el('main', 'plain-main')
  main.id = 'content'
  main.setAttribute('role', 'main')
  main.append(
    hero,
    skillsSection,
    experienceSection,
    projectsSection,
    educationSection,
    certsSection,
    contactSection,
    footer,
  )

  root.replaceChildren(banner, main, sectionNav)

  document.title = `${PROFILE.name} — Portfolio`

  requestAnimationFrame(() => {
    observeAnimations()
    mountScrollSpy(sectionNav, NAV_SECTIONS)
  })
}

mount()
