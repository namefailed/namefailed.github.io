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

// ── Data helpers ───────────────────────────────────────────────────────────

function plainProjectsFromPortfolio(): PlainProject[] {
  return PORTFOLIO_PROJECTS.filter((p) => p.title !== 'Future entries').map((p) => ({
    title: p.title,
    meta: p.period,
    blurb: p.lines.map((ln) => ln.replace(/\s+/g, ' ').trim()).join(' ').trim(),
    url: p.web,
    repo: p.repo,
  }))
}

function spaHomeHref(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return new URL('../index.html', window.location.href).href
  }
  return '../'
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

// ── Counter animation ──────────────────────────────────────────────────────

function animateCounter(numEl: HTMLElement, target: number, suffix: string, durationMs = 950): void {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs)
    const eased = 1 - Math.pow(1 - t, 3)
    numEl.textContent = `${Math.round(eased * target)}${suffix}`
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
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

// ── Typewriter ─────────────────────────────────────────────────────────────

function typewriter(target: HTMLElement, text: string, speedMs = 22): void {
  target.textContent = ''
  const cursor = el('span', 'plain-cursor')
  target.appendChild(cursor)
  let i = 0
  const tick = () => {
    if (i < text.length) {
      cursor.insertAdjacentText('beforebegin', text[i++]!)
      setTimeout(tick, speedMs + Math.random() * 14)
    } else {
      setTimeout(() => cursor.classList.add('plain-cursor--done'), 2400)
    }
  }
  // Start after the fade-in transition completes (~550ms + margin)
  setTimeout(tick, 750)
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
  a.textContent = text
  row.appendChild(a)
  return row
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

  const homeHref = spaHomeHref()

  const NAV_SECTIONS: NavSection[] = [
    { id: 'sec-skills',     label: 'Skills'     },
    { id: 'sec-experience', label: 'Experience' },
    { id: 'sec-projects',   label: 'Projects'   },
    { id: 'sec-education',  label: 'Education'  },
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
  bannerInner.append(backLink, el('p', 'plain-banner-meta', 'Portfolio · mobile view'))
  banner.appendChild(bannerInner)

  // ── Hero ───────────────────────────────────────────────────────────────
  const hero = el('section', 'plain-hero')
  hero.setAttribute('aria-labelledby', 'plain-name')

  hero.appendChild(anim(avatarEl(), 0))

  const nameEl = anim(el('h1', 'plain-name', PROFILE.name), 80)
  nameEl.id = 'plain-name'
  hero.appendChild(nameEl)

  // Headline — rendered empty; typewriter fills it in after fade
  const headlineEl = anim(el('p', 'plain-headline'), 140)
  headlineEl.setAttribute('aria-label', `${PROFILE.headline} · ${PROFILE.location}`)
  typewriter(headlineEl, `${PROFILE.headline} · ${PROFILE.location}`)
  hero.appendChild(headlineEl)

  const pill = anim(document.createElement('span'), 200)
  pill.className = PROFILE.statusOpen ? 'plain-status' : 'plain-status plain-status--muted'
  pill.textContent = PROFILE.statusOpen ? 'Open to work' : 'Unavailable'
  hero.appendChild(pill)

  hero.appendChild(statsStrip())

  hero.appendChild(anim(el('p', 'plain-lede', PROFILE.summary), 280))

  mountScrollCue(hero)

  // ── Skills ─────────────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Skills', 'sec-skills'))

  const skillWrap = anim(el('div', 'plain-skills'), 60)
  SKILLS_PRIMARY.forEach((s, i) => {
    const chip = el('span', 'plain-skill-chip', s)
    chip.style.transitionDelay = `${i * 40}ms`
    skillWrap.appendChild(chip)
  })
  hero.appendChild(skillWrap)

  // ── Experience ─────────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Experience', 'sec-experience'))

  const expList = el('div', 'plain-exp-list')
  EXPERIENCE.forEach((entry, i) => expList.appendChild(experienceCard(entry, i * 65)))
  hero.appendChild(expList)

  // ── Projects ───────────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Selected projects', 'sec-projects'))

  const grid = el('div', 'plain-project-grid')
  plainProjectsFromPortfolio().forEach((p, i) => grid.appendChild(projectCard(p, i * 55)))
  hero.appendChild(grid)

  // ── Education ──────────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Education', 'sec-education'))

  const eduList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of EDUCATION) eduList.appendChild(el('li', undefined, tx))
  hero.appendChild(eduList)

  // ── Certifications ─────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Certifications', 'sec-certs'))

  const certList = anim(el('ul', 'plain-ul'), 60)
  for (const tx of CERTIFICATIONS) certList.appendChild(el('li', undefined, tx))
  hero.appendChild(certList)

  // ── Contact ────────────────────────────────────────────────────────────
  hero.appendChild(sectionHeading('Contact', 'sec-contact'))

  const contactBlock = anim(el('div', 'plain-contact-block'), 60)
  for (const item of CONTACT) contactBlock.appendChild(linkRow(item.label, item.href, item.text))
  hero.appendChild(contactBlock)

  // ── Footer ─────────────────────────────────────────────────────────────
  const footer = el('footer', 'plain-footer')
  const fLink = document.createElement('a')
  fLink.href = homeHref
  fLink.textContent = 'Back to interactive mrgrey.site →'
  footer.appendChild(fLink)

  const main = el('main', 'plain-main')
  main.id = 'content'
  main.setAttribute('role', 'main')
  main.append(hero, footer)

  root.replaceChildren(banner, main, sectionNav)

  document.title = `${PROFILE.name} — Portfolio`

  requestAnimationFrame(() => {
    observeAnimations()
    mountScrollSpy(sectionNav, NAV_SECTIONS)
  })
}

mount()
