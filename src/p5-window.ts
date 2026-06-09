/**
 * p5.js sketch viewer.
 *
 * Sandboxed iframe loads the p5 library from a CDN, then executes the
 * user's sketch in global mode. Sketches can come from:
 *   — the built-in Examples dropdown
 *   — drag-and-drop of a .js file
 *   — `Open…` against the VFS (terminal `p5 /path.js` form)
 *
 * On open with no `initialVfsPath`, the first example auto-runs so the
 * tile is never blank.
 *
 * Iframe error/console messages are forwarded to the parent via a
 * window.onerror shim injected into the sketch HTML — surfaced as a
 * red error banner inside the tile.
 */

import type { WindowSpec } from './appwindow'
import { createWindowChrome } from './window-chrome'
import { P5_EXAMPLES } from './p5-sketches'
import { vfsReadRaw, vfsMkdir, vfsWrite } from './os-fs'

export interface P5WindowOptions {
  initialVfsPath?: string | null
  onOpenWindow: (spec: WindowSpec) => void
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

const P5_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.0/p5.min.js'

/** Random nonce identifies postMessage events from this tile's iframe. */
function makeNonce(): string {
  return `p5${Math.random().toString(36).slice(2, 10)}`
}

function buildHtml(code: string, nonce: string): string {
  // The error shim catches sketch errors before p5 starts AND runtime errors
  // during draw(). It posts `{ kind: 'p5-error', nonce, message }` to the
  // parent window so the tile can render the failure as a banner.
  const errorShim = `
    (function () {
      var nonce = ${JSON.stringify(nonce)};
      function post(message) {
        try { parent.postMessage({ kind: 'p5-error', nonce: nonce, message: message }, '*'); } catch (e) {}
      }
      window.addEventListener('error', function (e) {
        post((e && e.message) ? e.message + (e.lineno ? ' (line ' + e.lineno + ')' : '') : 'Unknown error');
      });
      window.addEventListener('unhandledrejection', function (e) {
        var r = e && e.reason;
        post(r && r.message ? r.message : String(r));
      });
    })();
  `
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #1e1e2e; overflow: hidden; }
  canvas { display: block; }
</style>
</head>
<body>
<script>${errorShim}<\/script>
<script src="${P5_CDN}"><\/script>
<script>
${code}
<\/script>
</body>
</html>`
}

export class P5Window {
  readonly el: HTMLElement
  /** Literal — must match a launcher cmd so dock/taskbar icon lookup succeeds. */
  readonly command = 'p5' as const
  readonly onFocus: () => void

  private iframe!: HTMLIFrameElement
  private blobUrl: string | null = null
  private currentCode: string | null = null
  private currentLabel = 'untitled.js'
  private currentVfsPath: string | null = null
  /** Unique-per-instance — filters postMessage events from other tiles' iframes. */
  private iframeNonce = makeNonce()

  private dropdown: HTMLElement | null = null

  private labelEl!: HTMLElement
  private runBtn!: HTMLButtonElement
  private editBtn!: HTMLButtonElement
  private emptyState!: HTMLElement
  private dropOverlay!: HTMLElement
  private errorBanner!: HTMLElement

  private onOpenWindowFn: (spec: WindowSpec) => void
  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  private readonly onDocClick = (e: MouseEvent): void => {
    if (this.dropdown && !this.dropdown.contains(e.target as Node)) {
      this.closeDropdown()
    }
  }

  private readonly onWinMessage = (e: MessageEvent): void => {
    const data = e.data
    if (!data || typeof data !== 'object') return
    if (data.kind !== 'p5-error') return
    if (data.nonce !== this.iframeNonce) return
    const message = typeof data.message === 'string' ? data.message : 'Sketch failed'
    this.showError(message)
  }

  constructor(opts: P5WindowOptions) {
    this.onFocus = opts.onFocus
    this.onOpenWindowFn = opts.onOpenWindow
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize

    const chrome = createWindowChrome({
      title: 'p5.js',
      onClose: () => this.onClose(),
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('p5-app')
    this.el.dataset.app = 'p5'

    this.el.appendChild(this.buildBody())

    document.addEventListener('click', this.onDocClick)
    window.addEventListener('message', this.onWinMessage)

    // First-run: load initial VFS path if provided, otherwise auto-run the
    // first example so the user always sees a working sketch.
    if (opts.initialVfsPath) {
      void this.loadFromVfs(opts.initialVfsPath)
    } else {
      const first = P5_EXAMPLES[0]
      if (first) this.runExample(first.label, first.code)
    }
  }

  // ── DOM construction ────────────────────────────────────────────────────────

  private buildBody(): HTMLElement {
    const stack = document.createElement('div')
    stack.className = 'p5-stack'

    // ── toolbar ─────────────────────────────────────────────────────────────
    const toolbar = document.createElement('div')
    toolbar.className = 'p5-toolbar'

    this.runBtn = document.createElement('button')
    this.runBtn.className = 'os-toolbar-btn'
    this.runBtn.title = 'Run / reload sketch'
    this.runBtn.textContent = '▶ Run'
    this.runBtn.disabled = true
    this.runBtn.addEventListener('click', () => { if (this.currentCode) this.run(this.currentCode) })

    const sep1 = document.createElement('span')
    sep1.className = 'p5-toolbar-sep'

    this.labelEl = document.createElement('span')
    this.labelEl.className = 'p5-label'
    this.labelEl.textContent = '—'

    const sep2 = document.createElement('span')
    sep2.className = 'p5-toolbar-sep'

    this.editBtn = document.createElement('button')
    this.editBtn.className = 'os-toolbar-btn'
    this.editBtn.textContent = 'Edit'
    this.editBtn.title = 'Open current sketch in the mini-vim editor'
    this.editBtn.disabled = true
    this.editBtn.addEventListener('click', () => void this.editCurrent())

    const openBtn = document.createElement('button')
    openBtn.className = 'os-toolbar-btn'
    openBtn.textContent = 'Open…'
    openBtn.title = 'Load a sketch from the virtual filesystem'
    openBtn.addEventListener('click', () => this.showVfsModal())

    const examplesWrap = document.createElement('div')
    examplesWrap.className = 'p5-examples-wrap'
    const examplesBtn = document.createElement('button')
    examplesBtn.className = 'os-toolbar-btn'
    examplesBtn.textContent = 'Examples ▾'
    examplesBtn.title = 'Built-in p5.js demo sketches'
    examplesBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleDropdown(examplesWrap) })
    examplesWrap.appendChild(examplesBtn)

    toolbar.append(this.runBtn, sep1, this.labelEl, sep2, this.editBtn, openBtn, examplesWrap)

    // ── iframe host ─────────────────────────────────────────────────────────
    const iframeHost = document.createElement('div')
    iframeHost.className = 'p5-iframe-host'

    this.iframe = document.createElement('iframe')
    this.iframe.className = 'p5-iframe'
    this.iframe.setAttribute('sandbox', 'allow-scripts')
    this.iframe.title = 'p5.js sketch'

    this.emptyState = document.createElement('div')
    this.emptyState.className = 'p5-empty-state'
    this.emptyState.innerHTML = `<div class="p5-empty-icon">⬡</div><div>pick an example or open a sketch</div>`

    this.errorBanner = document.createElement('div')
    this.errorBanner.className = 'p5-error-banner'
    this.errorBanner.hidden = true

    this.dropOverlay = document.createElement('div')
    this.dropOverlay.className = 'p5-drop-overlay'
    this.dropOverlay.textContent = 'Drop .js here'

    iframeHost.append(this.iframe, this.emptyState, this.errorBanner, this.dropOverlay)

    // drag-and-drop
    iframeHost.addEventListener('dragover', e => {
      e.preventDefault()
      this.dropOverlay.classList.add('p5-drop-overlay--active')
    })
    iframeHost.addEventListener('dragleave', () => {
      this.dropOverlay.classList.remove('p5-drop-overlay--active')
    })
    iframeHost.addEventListener('drop', e => {
      e.preventDefault()
      this.dropOverlay.classList.remove('p5-drop-overlay--active')
      const file = e.dataTransfer?.files[0]
      if (file) this.handleDrop(file)
    })

    stack.append(toolbar, iframeHost)
    return stack
  }

  // ── Sketch loading / running ────────────────────────────────────────────────

  private run(code: string): void {
    this.currentCode = code
    this.hideError()
    const html = buildHtml(code, this.iframeNonce)
    const blob = new Blob([html], { type: 'text/html' })
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl)
    this.blobUrl = URL.createObjectURL(blob)
    this.iframe.src = this.blobUrl
    this.emptyState.style.display = 'none'
    this.runBtn.disabled = false
    this.editBtn.disabled = false
  }

  private runExample(label: string, code: string): void {
    this.currentVfsPath = null
    this.currentLabel = `${label}.js`
    this.labelEl.textContent = label
    this.run(code)
  }

  /** Public so the desktop can reuse an existing p5 tile when a new path is requested. */
  async loadFromVfs(path: string): Promise<void> {
    const result = vfsReadRaw(path)
    if (!result.ok) {
      this.labelEl.textContent = `not found: ${path}`
      this.showError(`Could not read ${path} — file does not exist in the VFS`)
      return
    }
    this.currentVfsPath = result.abs
    this.currentLabel = path.split('/').pop() ?? path
    this.labelEl.textContent = this.currentLabel
    this.run(result.body)
  }

  private async editCurrent(): Promise<void> {
    if (!this.currentCode) return

    let vfsPath = this.currentVfsPath
    if (!vfsPath) {
      // Sketch came from an Example or drag-drop — persist it before editing.
      const dir = '/home/namefailed/p5.js'
      vfsMkdir(dir)
      const label = this.currentLabel.endsWith('.js') ? this.currentLabel : `${this.currentLabel}.js`
      const fullPath = `${dir}/${label}`
      const err = vfsWrite(fullPath, this.currentCode)
      if (err) {
        this.showError(`Could not save sketch to ${fullPath}: ${err}`)
        return
      }
      vfsPath = fullPath
      this.currentVfsPath = fullPath
    }

    this.onOpenWindowFn({
      command: 'edit',
      title: `edit — ${vfsPath}`,
      content: [],
      editorPath: vfsPath,
    })
  }

  // ── Error banner ────────────────────────────────────────────────────────────

  private showError(message: string): void {
    this.errorBanner.textContent = `⚠ ${message}`
    this.errorBanner.hidden = false
  }

  private hideError(): void {
    this.errorBanner.hidden = true
    this.errorBanner.textContent = ''
  }

  // ── Examples dropdown ───────────────────────────────────────────────────────

  private toggleDropdown(anchor: HTMLElement): void {
    if (this.dropdown) {
      this.closeDropdown()
      return
    }

    const menu = document.createElement('div')
    menu.className = 'p5-dropdown'
    this.dropdown = menu

    for (const ex of P5_EXAMPLES) {
      const btn = document.createElement('button')
      btn.className = 'p5-dropdown-item'
      btn.textContent = ex.label
      btn.addEventListener('click', e => {
        e.stopPropagation()
        this.runExample(ex.label, ex.code)
        this.closeDropdown()
      })
      menu.appendChild(btn)
    }

    anchor.appendChild(menu)
  }

  private closeDropdown(): void {
    if (this.dropdown) {
      this.dropdown.remove()
      this.dropdown = null
    }
  }

  // ── VFS open modal ──────────────────────────────────────────────────────────

  private showVfsModal(): void {
    const existing = this.el.querySelector('.p5-vfs-modal')
    if (existing) { existing.remove(); return }

    const modal = document.createElement('div')
    modal.className = 'p5-vfs-modal'

    const label = document.createElement('label')
    label.className = 'p5-vfs-modal-label'
    label.textContent = 'VFS path:'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'p5-vfs-modal-input'
    input.placeholder = '/home/namefailed/p5.js/my-sketch.js'
    input.value = this.currentVfsPath ?? ''

    const row = document.createElement('div')
    row.className = 'p5-vfs-modal-row'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'os-toolbar-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => modal.remove())

    const okBtn = document.createElement('button')
    okBtn.className = 'os-toolbar-btn os-toolbar-btn--accent'
    okBtn.textContent = 'Open'
    const doOpen = (): void => {
      const path = input.value.trim()
      if (path) void this.loadFromVfs(path)
      modal.remove()
    }
    okBtn.addEventListener('click', doOpen)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') doOpen()
      if (e.key === 'Escape') modal.remove()
    })

    row.append(cancelBtn, okBtn)
    modal.append(label, input, row)
    this.el.appendChild(modal)
    input.focus()
    input.select()
  }

  // ── File drop ───────────────────────────────────────────────────────────────

  private handleDrop(file: File): void {
    if (!file.name.endsWith('.js')) {
      this.showError(`Only .js files are accepted (got ${file.name})`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const code = reader.result as string
      this.currentVfsPath = null
      this.currentLabel = file.name
      this.labelEl.textContent = file.name
      this.run(code)
    }
    reader.onerror = () => {
      this.showError(`Could not read ${file.name}`)
    }
    reader.readAsText(file)
  }

  // ── External API ────────────────────────────────────────────────────────────

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }

  /** No-op — the iframe canvas fills the pane and handles its own resizing. */
  scrollBy(_delta: number): void { /* intentionally empty */ }

  dispose(): void {
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
    // Stop the iframe's animation loop and free its globals.
    this.iframe.src = 'about:blank'
    document.removeEventListener('click', this.onDocClick)
    window.removeEventListener('message', this.onWinMessage)
    this.closeDropdown()
  }
}
