// ── appwindow.ts ──────────────────────────────────────────────────────────────
// Read-only tiled window: chrome + `.win-body` renders ANSI-ish lines as HTML.
// Editing lives in `EditorWindow` / the terminal, not here.

import { ansiToHtml } from './ansi'

export interface WindowSpec {
  command: string    // unique id — re-running the command toggles this window
  title:   string
  content: string[]
  /** When command === 'edit', path in the in-browser FS to open */
  editorPath?: string
  /** When command === 'explorer', starting directory (absolute or relative to vfs cwd) */
  explorerPath?: string
  /** When command === `browse`, initial URL (default: Linux article on Wikipedia) */
  browserUrl?: string
}

export interface AppWindowOptions extends WindowSpec {
  onClose:    () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus:    () => void
}

export class AppWindow {
  readonly el:      HTMLElement
  readonly command: string
  readonly title:   string
  private  bodyEl:  HTMLElement
  private  onClose:    () => void
  private  onMinimize: () => void
  private  onMaximize: () => void
  readonly onFocus: () => void

  constructor(opts: AppWindowOptions) {
    this.command    = opts.command
    this.title      = opts.title
    this.onClose    = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus    = opts.onFocus

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
      this.renderResume(opts.content)
    } else {
      this.render(opts.content)
    }
  }

  private render(lines: string[]): void {
    this.bodyEl.innerHTML = lines
      .map(line => `<div class="win-line">${ansiToHtml(line) || ' '}</div>`)
      .join('')
  }

  /** Side-by-side optional portrait (`/portrait.jpg`) + résumé columns */
  private renderResume(lines: string[]): void {
    const wrap = document.createElement('div')
    wrap.className = 'resume-layout'

    const img = document.createElement('img')
    img.className = 'resume-photo'
    img.src = '/portrait.jpg'
    img.alt = 'Portrait'
    img.loading = 'lazy'
    img.decoding = 'async'
    img.addEventListener('error', () => {
      img.remove()
      wrap.classList.add('resume-layout--no-photo')
    })

    const col = document.createElement('div')
    col.className = 'resume-text-col'
    col.innerHTML = lines
      .map(line => `<div class="win-line">${ansiToHtml(line) || ' '}</div>`)
      .join('')

    wrap.appendChild(img)
    wrap.appendChild(col)
    this.bodyEl.appendChild(wrap)
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
