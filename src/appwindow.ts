/** Read-only tiled window chrome; `.win-body` renders ANSI-ish lines as HTML (editing → EditorWindow / terminal). */

import { ansiToHtmlWithLinks } from './ansi'
import { createWindowChrome, escapeHtml } from './window-chrome'
import type { PortfolioProjectEntry } from './content/portfolio'
import {
  RESUME_SKILL_MATRIX_SECTIONS,
  RESUME_WORKSTYLE_BULLETS,
} from './content/copy/resume-copy'
import { mountContactForm } from './contact-form'
import { buildProjectPreviewFigure } from './project-card-thumb'

/** Portrait photo with MG initials fallback — shared by contact and résumé. */
function mountPortfolioPortrait(
  holder: HTMLElement,
  imgClassName: string,
  opts?: { framePlaceholderClass?: string; src?: string },
): void {
  const phClass = opts?.framePlaceholderClass ?? 'contact-photo-frame--placeholder'
  const img = document.createElement('img')
  img.className = imgClassName
  img.alt = 'Portrait'
  img.src = opts?.src ?? '/portrait.jpg'
  img.loading = 'lazy'
  img.decoding = 'async'
  img.addEventListener(
    'error',
    () => {
      const ph = document.createElement('div')
      ph.className = 'contact-photo-placeholder'
      ph.setAttribute('role', 'img')
      ph.setAttribute('aria-label', 'Placeholder portrait')
      ph.innerHTML = '<span class="contact-photo-initials" aria-hidden="true">MG</span>'
      holder.replaceChildren(ph)
      holder.classList.add(phClass)
    },
    { once: true },
  )
  holder.appendChild(img)
}

/** Résumé tile: real layout + CSS tracks — avoids monospace ███ bars colliding with labels. */
function buildResumeSkillMeterRowHtml(label: string, pct: number): string {
  const n = Math.min(100, Math.max(0, Math.round(pct)))
  const display = label.length > 42 ? `${label.slice(0, 40)}…` : label
  return (
    `<div class="resume-skill-meter-row">` +
    `<span class="resume-skill-meter-label">${escapeHtml(display)}</span>` +
    `<span class="resume-skill-meter-track" aria-hidden="true">` +
    `<span class="resume-skill-meter-fill" style="width:${n}%"></span>` +
    `</span>` +
    `<span class="resume-skill-meter-pct">${n}%</span>` +
    `</div>`
  )
}

/** Structured matrix HTML for the skills rail (plain section titles + meter rows). */
function buildResumeSkillsMatrixInnerHtml(): string {
  const parts: string[] = []
  const sections = RESUME_SKILL_MATRIX_SECTIONS
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si]!
    parts.push(`<div class="resume-skills-section-head">${escapeHtml(sec.title)}</div>`)
    parts.push(`<div class="resume-skills-matrix-spacer" aria-hidden="true"></div>`)
    for (const [lab, pct] of sec.pairs) {
      parts.push(buildResumeSkillMeterRowHtml(lab, pct))
    }
    if (si < sections.length - 1) {
      parts.push(`<div class="resume-skills-matrix-spacer" aria-hidden="true"></div>`)
    }
  }
  return parts.join('')
}

export interface WindowSpec {
  /** Unique tile id — the same CLI again focuses or closes this window. */
  command: string
  title: string
  content: string[]
  /** Virtual path for `edit` / `vim` (in-browser FS). */
  editorPath?: string
  /** Starting directory for `explorer` (vfs path). */
  explorerPath?: string
  /** Initial URL for embedded `browse`. */
  browserUrl?: string
  /** When `command === 'resume'`, ANSI lines plus optional skills aside. */
  resumeSkills?: string[]
  /** Résumé header lines (name/contact) — paired with {@link resumeBody} when skills panel is shown. */
  resumeLead?: string[]
  /** PROFILE … certifications — full-width under header row in narrow layouts. */
  resumeBody?: string[]
  /** Thumbnail/metadata list for `projects` tile layout. */
  projectCards?: readonly PortfolioProjectEntry[]
  /** Tabbed portfolio hub — résumé / projects / about / contact in one window. */
  portfolioHub?: boolean
  hubWhoamiLines?: string[]
  hubContactLines?: string[]
  /** Initial VFS path for the p5 viewer. */
  p5SketchPath?: string
}

export interface AppWindowOptions extends WindowSpec {
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

export class AppWindow {
  readonly el: HTMLElement
  readonly command: string
  readonly title: string
  private bodyEl: HTMLElement
  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void
  readonly onFocus: () => void

  constructor(opts: AppWindowOptions) {
    this.command = opts.command
    this.title = opts.title
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    const chrome = createWindowChrome({
      title: opts.title,
      onClose: () => this.onClose(),
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.dataset.app = opts.command

    // ── content ─────────────────────────────────────────────────────────────
    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'win-body'

    this.el.appendChild(this.bodyEl)

    if (opts.portfolioHub) {
      this.el.classList.add('portfolio-hub-window')
      this.renderPortfolioHub(opts)
    } else if (opts.command === 'resume') {
      this.el.classList.add('resume-window')
      this.renderResume(opts.content, opts.resumeSkills, opts.resumeLead, opts.resumeBody)
    } else if (opts.command === 'links') {
      this.el.classList.add('contact-window')
      this.renderContact(opts.content)
    } else if (opts.command === 'whoami') {
      this.el.classList.add('whoami-window')
      this.renderAboutMe(opts.content)
    } else if (opts.command === 'projects' && opts.projectCards?.length) {
      this.el.classList.add('projects-window')
      this.renderProjectCards(opts.projectCards)
    } else {
      this.render(opts.content)
    }
  }

  private render(lines: string[]): void {
    this.bodyEl.innerHTML = lines
      .map(line => `<div class="win-line">${ansiToHtmlWithLinks(line) || ' '}</div>`)
      .join('')
  }

  /** Tabbed hub for recruiters — one window, four sections. */
  private renderPortfolioHub(opts: AppWindowOptions): void {
    type TabId = 'resume' | 'projects' | 'whoami' | 'links'
    const tabs: Array<{ id: TabId; label: string; panelClass: string }> = [
      { id: 'resume', label: 'Résumé', panelClass: 'resume-window' },
      { id: 'projects', label: 'Projects', panelClass: 'projects-window' },
      { id: 'whoami', label: 'About', panelClass: 'whoami-window' },
      { id: 'links', label: 'Contact', panelClass: 'contact-window' },
    ]

    this.bodyEl.classList.add('portfolio-hub-body')

    const nav = document.createElement('nav')
    nav.className = 'portfolio-hub-tabs'
    nav.setAttribute('role', 'tablist')
    nav.setAttribute('aria-label', 'Portfolio sections')

    const panelsWrap = document.createElement('div')
    panelsWrap.className = 'portfolio-hub-panels'

    const panelInners = new Map<TabId, HTMLElement>()
    let active: TabId = 'resume'

    for (const t of tabs) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'portfolio-hub-tab'
      btn.dataset.tab = t.id
      btn.setAttribute('role', 'tab')
      btn.textContent = t.label
      nav.appendChild(btn)

      const panel = document.createElement('section')
      panel.className = `portfolio-hub-panel ${t.panelClass}`
      panel.dataset.tab = t.id
      panel.setAttribute('role', 'tabpanel')

      const inner = document.createElement('div')
      inner.className = 'portfolio-hub-panel-inner'
      panel.appendChild(inner)
      panelInners.set(t.id, inner)
      panelsWrap.appendChild(panel)
    }

    const showTab = (id: TabId): void => {
      active = id
      for (const btn of nav.querySelectorAll<HTMLButtonElement>('.portfolio-hub-tab')) {
        const on = btn.dataset.tab === id
        btn.classList.toggle('portfolio-hub-tab--active', on)
        btn.setAttribute('aria-selected', on ? 'true' : 'false')
        btn.tabIndex = on ? 0 : -1
      }
      for (const panel of panelsWrap.querySelectorAll<HTMLElement>('.portfolio-hub-panel')) {
        const on = panel.dataset.tab === id
        panel.hidden = !on
      }
    }

    nav.addEventListener('click', e => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.portfolio-hub-tab')
      if (!btn?.dataset.tab) return
      showTab(btn.dataset.tab as TabId)
    })

    const shellBody = this.bodyEl
    const renderInto = (target: HTMLElement, fn: () => void): void => {
      this.bodyEl = target
      fn()
      this.bodyEl = shellBody
    }

    renderInto(panelInners.get('resume')!, () => {
      this.renderResume(opts.content, opts.resumeSkills, opts.resumeLead, opts.resumeBody)
    })
    renderInto(panelInners.get('projects')!, () => {
      if (opts.projectCards?.length) this.renderProjectCards(opts.projectCards)
    })
    renderInto(panelInners.get('whoami')!, () => {
      this.renderAboutMe(opts.hubWhoamiLines ?? [])
    })
    renderInto(panelInners.get('links')!, () => {
      this.renderContact(opts.hubContactLines ?? [])
    })

    shellBody.append(nav, panelsWrap)
    showTab(active)
  }

  /**
   * Résumé: narrative · optional skills aside. Lead/body split when {@link resumeSkills} is set.
   */
  private renderResume(
    lines: string[],
    skillsLines?: string[],
    leadLines?: string[],
    bodyLines?: string[],
  ): void {
    const wrap = document.createElement('div')
    wrap.className = 'resume-layout'

    const hasSkills = !!(skillsLines && skillsLines.length)
    if (hasSkills) {
      wrap.classList.add('resume-layout--with-skills')
    } else {
      /* Narrative-only tile: no portrait column (skills path uses two-column layout below) */
      wrap.classList.add('resume-layout--no-photo')
    }

    const stripAnsiForDetect = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

    const mapLines = (raw: string[]) =>
      raw.map(line => `<div class="win-line">${ansiToHtmlWithLinks(line) || ' '}</div>`).join('')

    /** Body bullets (·) get a hanging indent when wrapped */
    const mapBodyLines = (raw: string[]) =>
      raw
        .map(line => {
          const visual = stripAnsiForDetect(line)
          const hang = /^\s*·/.test(visual)
          const cls = hang ? 'win-line win-line--hang' : 'win-line'
          return `<div class="${cls}">${ansiToHtmlWithLinks(line) || ' '}</div>`
        })
        .join('')

    const narrativeCol = document.createElement('div')
    narrativeCol.className = 'resume-main-col resume-text-col'

    const structuredLead =
      hasSkills &&
      leadLines &&
      bodyLines &&
      leadLines.length > 0 &&
      bodyLines.length > 0

    if (structuredLead) {
      const leadGrid = document.createElement('div')
      leadGrid.className = 'resume-lead-grid resume-lead-grid--no-photo'

      const dropVisuallyBlank = (raw: string[]) =>
        raw.filter(l => stripAnsiForDetect(l).trim() !== '')

      const leadText = document.createElement('div')
      leadText.className = 'resume-lead-text'
      leadText.innerHTML = mapLines(dropVisuallyBlank(leadLines!))

      const bodyBlock = document.createElement('div')
      bodyBlock.className = 'resume-body-block'
      bodyBlock.innerHTML = mapBodyLines(dropVisuallyBlank(bodyLines!))

      leadGrid.append(leadText, bodyBlock)
      narrativeCol.appendChild(leadGrid)
    } else {
      narrativeCol.innerHTML = mapLines(lines)
    }

    wrap.appendChild(narrativeCol)

    if (hasSkills) {
      const aside = document.createElement('aside')
      aside.className = 'resume-skills-panel'
      aside.setAttribute('aria-label', 'Skills matrix')

      const skillsInner = document.createElement('div')
      skillsInner.className = 'resume-skills-body'

      const matrixEl = document.createElement('div')
      matrixEl.className = 'resume-skills-matrix'
      matrixEl.innerHTML = buildResumeSkillsMatrixInnerHtml()
      skillsInner.appendChild(matrixEl)

      const notesEl = document.createElement('div')
      notesEl.className = 'resume-skills-notes'
      const heading = document.createElement('div')
      heading.className = 'resume-skills-notes-heading'
      heading.textContent = 'how I like to work'
      notesEl.appendChild(heading)
      const ul = document.createElement('ul')
      ul.className = 'resume-skills-notes-list'
      for (const line of RESUME_WORKSTYLE_BULLETS) {
        const li = document.createElement('li')
        li.className = 'resume-skills-notes-item'
        li.textContent = line
        ul.appendChild(li)
      }
      notesEl.appendChild(ul)
      skillsInner.appendChild(notesEl)

      aside.appendChild(skillsInner)
      wrap.appendChild(aside)
    }

    this.bodyEl.appendChild(wrap)
  }

  /** Portrait / placeholder + animated rail beside contact lines */
  private renderContact(lines: string[]): void {
    this.renderPortraitColumnLayout(lines, {
      asideHint: '',
      photoSrc: '/son.jpg',
    })
    const col = this.bodyEl.querySelector('.contact-text-col')
    col?.appendChild(mountContactForm('wm'))
  }

  /** About me — fencing banner across the top, text column below. */
  private renderAboutMe(lines: string[]): void {
    const statusRow = document.createElement('div')
    statusRow.className = 'about-status-row'
    const badge = document.createElement('span')
    badge.className = 'about-open-badge'
    badge.textContent = 'Open to work'
    const hint = document.createElement('p')
    hint.className = 'about-status-hint'
    hint.textContent = 'Remote / hybrid · US Central'
    statusRow.append(badge, hint)
    this.bodyEl.appendChild(statusRow)

    const banner = document.createElement('div')
    banner.className = 'about-banner'
    const bannerImg = document.createElement('img')
    bannerImg.className = 'about-banner-img'
    bannerImg.src = '/fencing.jpg'
    bannerImg.alt = 'Fencing'
    bannerImg.loading = 'eager'
    bannerImg.decoding = 'async'
    banner.appendChild(bannerImg)
    this.bodyEl.appendChild(banner)

    const col = document.createElement('div')
    col.className = 'about-text-col'
    col.innerHTML = lines
      .map(line => `<div class="win-line">${ansiToHtmlWithLinks(line) || ' '}</div>`)
      .join('')
    this.bodyEl.appendChild(col)
  }

  /** Shared by Links (`renderContact`) and About me (`whoami`). */
  private renderPortraitColumnLayout(
    lines: string[],
    options?: { asideHint?: string; variant?: 'contact' | 'about'; photoSrc?: string },
  ): void {
    const wrap = document.createElement('div')
    wrap.className =
      options?.variant === 'about' ? 'contact-layout contact-layout--about' : 'contact-layout'

    const aside = document.createElement('aside')
    aside.className = 'contact-aside'

    const orbit = document.createElement('div')
    orbit.className = 'contact-orbit'
    orbit.setAttribute('aria-hidden', 'true')
    const ring = document.createElement('span')
    ring.className = 'contact-orbit-ring'
    orbit.appendChild(ring)

    const frame = document.createElement('figure')
    frame.className = 'contact-photo-frame'
    mountPortfolioPortrait(frame, 'resume-photo contact-photo-slot', { src: options?.photoSrc })

    aside.appendChild(orbit)
    aside.appendChild(frame)
    const hintText = options?.asideHint ?? ''
    if (hintText) {
      const hint = document.createElement('p')
      hint.className = 'contact-aside-hint'
      hint.textContent = hintText
      aside.appendChild(hint)
    }

    const col = document.createElement('div')
    col.className = 'contact-text-col'
    col.innerHTML = lines
      .map(line => `<div class="win-line">${ansiToHtmlWithLinks(line) || ' '}</div>`)
      .join('')

    wrap.appendChild(aside)
    wrap.appendChild(col)
    this.bodyEl.appendChild(wrap)
  }

  /** Card grid: thumbnail, copy, repo / live links (Projects tile). */
  private renderProjectCards(projects: readonly PortfolioProjectEntry[]): void {
    const shell = document.createElement('div')
    shell.className = 'projects-shell'

    const head = document.createElement('header')
    head.className = 'projects-head'
    const h2 = document.createElement('h2')
    h2.className = 'projects-head-title'
    h2.textContent = 'work & roadmap'
    const sub = document.createElement('p')
    sub.className = 'projects-head-sub'
    sub.textContent =
      'Each card shows a labeled preview — expand for full size, or follow repo / web links below.'
    head.appendChild(h2)
    head.appendChild(sub)

    const grid = document.createElement('div')
    grid.className = 'projects-grid'

    for (const p of projects) {
      const card = document.createElement('article')
      card.className = 'project-card'

      const mediaEl = document.createElement('div')
      mediaEl.className = 'project-card-media'

      const { figure } = buildProjectPreviewFigure({
        title: p.title,
        period: p.period,
        thumb: p.thumb,
        web: p.web,
        repo: p.repo,
        skipLiveScreenshot: p.skipLiveScreenshot,
        thumbPosition: p.thumbPosition,
        previewKind: p.previewKind,
      })
      mediaEl.appendChild(figure)

      const body = document.createElement('div')
      body.className = 'project-card-body'

      const h3 = document.createElement('h3')
      h3.className = 'project-card-title'
      const titleSpan = document.createElement('span')
      titleSpan.className = 'project-card-title-text'
      titleSpan.textContent = p.title
      h3.appendChild(titleSpan)
      if (p.period) {
        const per = document.createElement('span')
        per.className = 'project-card-period'
        per.textContent = p.period
        h3.appendChild(per)
      }

      for (const ln of p.lines) {
        const para = document.createElement('p')
        para.className = 'project-card-desc'
        para.textContent = ln
        body.appendChild(para)
      }

      const links = document.createElement('div')
      links.className = 'project-card-links'
      if (p.repo) {
        const a = document.createElement('a')
        a.className = 'project-card-linktag'
        a.href = p.repo
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.textContent = 'repo'
        links.appendChild(a)
      }
      if (p.web) {
        const a = document.createElement('a')
        a.className = 'project-card-linktag project-card-linktag--live'
        a.href = p.web
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.textContent = 'web'
        links.appendChild(a)
      }
      if (links.childElementCount) body.appendChild(links)

      card.appendChild(mediaEl)
      card.appendChild(body)
      grid.appendChild(card)
    }

    shell.appendChild(head)
    shell.appendChild(grid)
    this.bodyEl.appendChild(shell)
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  scrollBy(delta: number): void {
    this.bodyEl.scrollBy({ top: delta, behavior: 'smooth' })
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }
}
