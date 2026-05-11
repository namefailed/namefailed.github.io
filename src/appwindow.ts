/** Read-only tiled window chrome; `.win-body` renders ANSI-ish lines as HTML (editing → EditorWindow / terminal). */

import { ansiToHtmlWithLinks } from './ansi'
import type { PortfolioProjectEntry } from './content/portfolio'
import {
  RESUME_SKILL_MATRIX_SECTIONS,
  RESUME_WORKSTYLE_BULLETS,
} from './content/copy/resume-copy'

/** WordPress mShots — slow first load but real page pixels for project cards */
function liveSiteScreenshotUrl(web: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(web)}?w=900`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** `/portrait.jpg` with MG fallback — shared by contact / about / résumé lead. */
function mountPortfolioPortrait(
  holder: HTMLElement,
  imgClassName: string,
  opts?: { framePlaceholderClass?: string },
): void {
  const phClass = opts?.framePlaceholderClass ?? 'contact-photo-frame--placeholder'
  const img = document.createElement('img')
  img.className = imgClassName
  img.alt = 'Portrait'
  img.src = '/portrait.jpg'
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

    // ── shell ───────────────────────────────────────────────────────────────
    this.el = document.createElement('div')
    this.el.className = 'app-window content-window'
    this.el.dataset.app = opts.command
    this.el.addEventListener('mousedown', () => opts.onFocus())

    // ── title bar ───────────────────────────────────────────────────────────
    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">${opts.title}</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min"   title="minimize (ctrl+m)"></span>
        <span class="dot dot-max"   title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onClose()
    })
    bar.querySelector('.dot-min')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMinimize()
    })
    bar.querySelector('.dot-max')!.addEventListener('click', e => {
      e.stopPropagation()
      this.onMaximize()
    })
    bar.addEventListener('mousedown', () => opts.onFocus())

    // ── content ─────────────────────────────────────────────────────────────
    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'win-body'

    this.el.appendChild(bar)
    this.el.appendChild(this.bodyEl)

    if (opts.command === 'resume') {
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
      leadGrid.className = 'resume-lead-grid'

      const dropVisuallyBlank = (raw: string[]) =>
        raw.filter(l => stripAnsiForDetect(l).trim() !== '')

      const leadPhoto = document.createElement('figure')
      leadPhoto.className = 'resume-lead-photo'
      mountPortfolioPortrait(leadPhoto, 'resume-lead-photo__img resume-photo', {
        framePlaceholderClass: 'resume-lead-photo--placeholder',
      })

      const leadText = document.createElement('div')
      leadText.className = 'resume-lead-text'
      leadText.innerHTML = mapLines(dropVisuallyBlank(leadLines!))

      const bodyBlock = document.createElement('div')
      bodyBlock.className = 'resume-body-block'
      bodyBlock.innerHTML = mapBodyLines(dropVisuallyBlank(bodyLines!))

      leadGrid.append(leadPhoto, leadText, bodyBlock)
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
      asideHint: 'portrait.jpg · optional',
    })
  }

  /** About me — portrait column (moved off résumé) + ANSI lines */
  private renderAboutMe(lines: string[]): void {
    this.renderPortraitColumnLayout(lines, {
      asideHint: 'Drop portrait.jpg in /public if you want a face beside the rant.',
      variant: 'about',
    })
  }

  /** Shared by Links (`renderContact`) and About me (`whoami`). */
  private renderPortraitColumnLayout(
    lines: string[],
    options?: { asideHint?: string; variant?: 'contact' | 'about' },
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
    mountPortfolioPortrait(frame, 'resume-photo contact-photo-slot')

    aside.appendChild(orbit)
    aside.appendChild(frame)
    const hint = document.createElement('p')
    hint.className = 'contact-aside-hint'
    hint.textContent = options?.asideHint ?? 'portrait.jpg · optional'
    aside.appendChild(hint)

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
      'Live work — card art is a live screenshot when we have a URL (cached by wp.com); repo links stay manual.'
    head.appendChild(h2)
    head.appendChild(sub)

    const grid = document.createElement('div')
    grid.className = 'projects-grid'

    for (const p of projects) {
      const card = document.createElement('article')
      card.className = 'project-card'

      const thumbPath = p.thumb
        ? p.thumb.startsWith('/')
          ? p.thumb
          : `/${p.thumb}`
        : null
      const liveShot =
        p.web && !p.skipLiveScreenshot ? liveSiteScreenshotUrl(p.web) : null

      const mediaEl = p.web
        ? (() => {
            const a = document.createElement('a')
            a.className = 'project-card-thumb-hit'
            a.href = p.web!
            a.target = '_blank'
            a.rel = 'noopener noreferrer'
            a.setAttribute('aria-label', `${p.title} — open live site`)
            return a
          })()
        : (() => {
            const d = document.createElement('div')
            d.className = 'project-card-thumb-hit project-card-thumb-hit--static'
            return d
          })()

      const fig = document.createElement('figure')
      fig.className = 'project-card-figure'

      const img = document.createElement('img')
      img.className = 'project-card-thumb'
      img.alt = `${p.title} preview`
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      const ph = AppWindow.makeThumbPlaceholder(p.title)
      if (!liveShot && !thumbPath) {
        fig.appendChild(ph)
      } else {
        if (liveShot) {
          img.src = liveShot
          if (thumbPath) {
            img.addEventListener(
              'error',
              () => {
                img.src = thumbPath
                img.addEventListener('error', () => fig.replaceChildren(ph), { once: true })
              },
              { once: true },
            )
          } else {
            img.addEventListener('error', () => fig.replaceChildren(ph), { once: true })
          }
        } else {
          img.src = thumbPath!
          img.addEventListener('error', () => fig.replaceChildren(ph), { once: true })
        }
        fig.appendChild(img)
      }

      mediaEl.appendChild(fig)

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

  private static makeThumbPlaceholder(title: string): HTMLElement {
    const el = document.createElement('div')
    el.className = 'project-card-thumb-placeholder'
    el.setAttribute('role', 'img')
    const words = title.split(/\s+/).filter(Boolean)
    const ini =
      words.length >= 2
        ? `${words[0]![0]!}${words[1]![0]!}`
        : (words[0]?.slice(0, 2) ?? '?').toUpperCase()
    const span = document.createElement('span')
    span.className = 'project-card-thumb-initials'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = ini.toUpperCase()
    el.appendChild(span)
    el.setAttribute('aria-label', `${title} preview`)
    return el
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
