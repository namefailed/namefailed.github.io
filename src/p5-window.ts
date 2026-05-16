/** p5.js sketch viewer — run built-in examples, drop a .js file, or open from the VFS. */

import type { WindowSpec } from './appwindow'
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

function buildHtml(code: string): string {
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
<script src="${P5_CDN}"><\/script>
<script>
${code}
<\/script>
</body>
</html>`
}

export class P5Window {
  readonly el: HTMLElement
  readonly command: string
  readonly onFocus: () => void

  private iframe: HTMLIFrameElement
  private blobUrl: string | null = null
  private currentCode: string | null = null
  private currentLabel = 'untitled.js'
  private currentVfsPath: string | null = null

  private ro: ResizeObserver | null = null
  private dropdown: HTMLElement | null = null

  private labelEl!: HTMLElement
  private editBtn!: HTMLButtonElement
  private emptyState!: HTMLElement
  private dropOverlay!: HTMLElement

  private onOpenWindowFn: (spec: WindowSpec) => void
  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  private readonly onDocClick = (e: MouseEvent): void => {
    if (this.dropdown && !this.dropdown.contains(e.target as Node)) {
      this.closeDropdown()
    }
  }

  constructor(opts: P5WindowOptions) {
    this.command = `p5-${Date.now()}`
    this.onFocus = opts.onFocus
    this.onOpenWindowFn = opts.onOpenWindow
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize

    // ── shell ───────────────────────────────────────────────────────────────
    this.el = document.createElement('div')
    this.el.className = 'app-window p5-app'
    this.el.dataset.app = 'p5'
    this.el.addEventListener('mousedown', () => opts.onFocus())

    // ── title bar ───────────────────────────────────────────────────────────
    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">p5.js</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min"   title="minimize"></span>
        <span class="dot dot-max"   title="maximize / restore"></span>
        <span class="dot dot-close" title="close"></span>
      </div>
    `
    bar.querySelector('.dot-close')!.addEventListener('click', e => { e.stopPropagation(); this.onClose() })
    bar.querySelector('.dot-min')!.addEventListener('click', e => { e.stopPropagation(); this.onMinimize() })
    bar.querySelector('.dot-max')!.addEventListener('click', e => { e.stopPropagation(); this.onMaximize() })
    bar.addEventListener('mousedown', () => opts.onFocus())

    // ── toolbar ─────────────────────────────────────────────────────────────
    const toolbar = document.createElement('div')
    toolbar.className = 'p5-toolbar'

    const runBtn = document.createElement('button')
    runBtn.className = 'os-toolbar-btn'
    runBtn.title = 'Run / reload sketch'
    runBtn.textContent = '▶ Run'
    runBtn.addEventListener('click', () => { if (this.currentCode) this.run(this.currentCode) })

    const sep = document.createElement('span')
    sep.className = 'p5-toolbar-sep'

    this.labelEl = document.createElement('span')
    this.labelEl.className = 'p5-label'
    this.labelEl.textContent = '—'

    const sep2 = document.createElement('span')
    sep2.className = 'p5-toolbar-sep'

    this.editBtn = document.createElement('button')
    this.editBtn.className = 'os-toolbar-btn'
    this.editBtn.textContent = 'Edit'
    this.editBtn.disabled = true
    this.editBtn.addEventListener('click', () => void this.editCurrent())

    const openBtn = document.createElement('button')
    openBtn.className = 'os-toolbar-btn'
    openBtn.textContent = 'Open…'
    openBtn.addEventListener('click', () => this.showVfsModal())

    // examples dropdown wrapper
    const exWrap = document.createElement('div')
    exWrap.className = 'p5-examples-wrap'
    const exBtn = document.createElement('button')
    exBtn.className = 'os-toolbar-btn'
    exBtn.textContent = 'Examples ▾'
    exBtn.addEventListener('click', e => { e.stopPropagation(); this.toggleDropdown(exWrap) })
    exWrap.appendChild(exBtn)

    toolbar.append(runBtn, sep, this.labelEl, sep2, this.editBtn, openBtn, exWrap)

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

    this.dropOverlay = document.createElement('div')
    this.dropOverlay.className = 'p5-drop-overlay'
    this.dropOverlay.textContent = 'Drop .js here'

    iframeHost.appendChild(this.iframe)
    iframeHost.appendChild(this.emptyState)
    iframeHost.appendChild(this.dropOverlay)

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

    // ── stack ────────────────────────────────────────────────────────────────
    const stack = document.createElement('div')
    stack.className = 'p5-stack'
    stack.appendChild(bar)
    stack.appendChild(toolbar)
    stack.appendChild(iframeHost)
    this.el.appendChild(stack)

    document.addEventListener('click', this.onDocClick)

    // load initial VFS path if provided
    if (opts.initialVfsPath) {
      void this.loadFromVfs(opts.initialVfsPath)
    }
  }

  private run(code: string): void {
    this.currentCode = code
    const html = buildHtml(code)
    const blob = new Blob([html], { type: 'text/html' })
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl)
    this.blobUrl = URL.createObjectURL(blob)
    this.iframe.src = this.blobUrl
    this.emptyState.style.display = 'none'
    this.editBtn.disabled = false
  }

  private async loadFromVfs(path: string): Promise<void> {
    const result = vfsReadRaw(path)
    if (!result.ok) {
      this.labelEl.textContent = `not found: ${path}`
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
      const dir = '/home/namefailed/sketches'
      vfsMkdir(dir)
      const label = this.currentLabel.endsWith('.js') ? this.currentLabel : `${this.currentLabel}.js`
      const fullPath = `${dir}/${label}`
      const err = vfsWrite(fullPath, this.currentCode)
      if (err) {
        // VFS write failed — silently skip save (err is the string error message)
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
        this.currentVfsPath = null
        this.currentLabel = `${ex.label}.js`
        this.labelEl.textContent = ex.label
        this.run(ex.code)
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
    input.placeholder = '/home/namefailed/sketch.js'
    input.value = this.currentVfsPath ?? ''

    const row = document.createElement('div')
    row.className = 'p5-vfs-modal-row'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'os-toolbar-btn'
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => modal.remove())

    const okBtn = document.createElement('button')
    okBtn.className = 'os-toolbar-btn p5-vfs-modal-ok'
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

  private handleDrop(file: File): void {
    if (!file.name.endsWith('.js')) return
    const reader = new FileReader()
    reader.onload = () => {
      const code = reader.result as string
      this.currentVfsPath = null
      this.currentLabel = file.name
      this.labelEl.textContent = file.name
      this.run(code)
    }
    reader.readAsText(file)
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }

  scrollBy(_delta: number): void { /* no-op: canvas fills the pane */ }

  dispose(): void {
    this.ro?.disconnect()
    this.ro = null
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl)
      this.blobUrl = null
    }
    document.removeEventListener('click', this.onDocClick)
    this.closeDropdown()
  }
}
