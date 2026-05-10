// ── file-explorer-window.ts ───────────────────────────────────────────────────
// Virtual FS browser: navigate, rename, delete, clipboard cut/copy/paste.

import {
  vfsFormatPath,
  vfsListEntries,
  vfsNormalize,
  vfsRm,
  vfsMoveIntoDirectory,
  vfsCopyIntoDirectory,
  FS_HOME,
} from './os-fs'

export interface FileExplorerWindowOptions {
  initialPath: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
  onOpenInEditor: (absFilePath: string) => void
}

type Clip = { mode: 'copy' | 'cut'; paths: string[] }

export class FileExplorerWindow {
  readonly el: HTMLElement
  readonly command = 'explorer' as const
  readonly onFocus: () => void

  private absPath: string
  private selected: { name: string; kind: 'd' | 'f' } | null = null

  private bodyEl: HTMLElement
  private pathEl: HTMLElement
  private statusEl: HTMLElement

  private clip: Clip | null = null

  private btnRename!: HTMLButtonElement
  private btnDel!: HTMLButtonElement
  private btnCut!: HTMLButtonElement
  private btnCopy!: HTMLButtonElement
  private btnPaste!: HTMLButtonElement
  private btnEdit!: HTMLButtonElement

  private flashTimer: ReturnType<typeof window.setTimeout> | null = null

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void
  private onOpenInEditor: (abs: string) => void

  constructor(opts: FileExplorerWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus
    this.onOpenInEditor = opts.onOpenInEditor

    this.absPath = vfsNormalize(opts.initialPath)

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window file-explorer-app'
    this.el.tabIndex = -1
    this.el.addEventListener('mousedown', () => opts.onFocus())

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title">files</span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
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

    const mkBtn = (label: string, title: string, fn: () => void, variants = ''): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `fe-btn os-toolbar-btn ${variants}`.trim()
      b.title = title
      b.textContent = label
      b.addEventListener('click', () => {
        opts.onFocus()
        fn()
      })
      return b
    }

    const toolbar = document.createElement('div')
    toolbar.className = 'fe-toolbar'

    const toolbarActions = document.createElement('div')
    toolbarActions.className = 'fe-toolbar-actions'

    const btnUp = mkBtn('Up', 'Parent folder', () => this.goUp())
    const btnHome = mkBtn('Home', 'Go home (~)', () => this.navigateTo(FS_HOME))
    const btnRefresh = mkBtn('Refresh', 'Reload listing', () => this.refresh())

    this.btnRename = mkBtn('Rename', 'Rename selection (F2)', () => this.renameSelection())
    this.btnDel = mkBtn(
      'Delete',
      'Delete selection (Del)',
      () => this.deleteSelection(),
      'fe-btn--danger',
    )
    this.btnCut = mkBtn('Cut', 'Cut (Ctrl+X)', () => this.cutSelection())
    this.btnCopy = mkBtn('Copy', 'Copy (Ctrl+C)', () => this.copySelection())
    this.btnPaste = mkBtn('Paste', 'Paste here (Ctrl+V)', () => this.pasteFromClip())

    this.pathEl = document.createElement('div')
    this.pathEl.className = 'fe-path'
    this.pathEl.setAttribute('aria-live', 'polite')

    toolbarActions.append(btnUp, btnHome, btnRefresh, this.btnRename, this.btnDel, this.btnCut, this.btnCopy, this.btnPaste)
    toolbar.append(toolbarActions, this.pathEl)

    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'fe-body win-body'
    this.bodyEl.setAttribute('role', 'listbox')
    this.bodyEl.tabIndex = 0
    this.bodyEl.addEventListener('keydown', e => this.onListKeydown(e))

    const foot = document.createElement('div')
    foot.className = 'fe-footer'

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'fe-status'

    this.btnEdit = mkBtn(
      'Open in editor',
      'Opens selected file in the editor tile',
      () => this.openSelectedInEditor(),
      'fe-btn-primary os-toolbar-btn--accent',
    )
    this.btnEdit.disabled = true

    foot.appendChild(this.statusEl)
    foot.appendChild(this.btnEdit)

    const stack = document.createElement('div')
    stack.className = 'fe-stack'
    stack.appendChild(toolbar)
    stack.appendChild(this.bodyEl)
    stack.appendChild(foot)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.refresh()
    this.syncPathLabel()
    this.clipboardStatus()
    this.syncToolbar()
  }

  getAbsPath(): string {
    return this.absPath
  }

  pathMatches(userPath: string): boolean {
    return this.absPath === vfsNormalize(userPath)
  }

  navigateTo(absOrRel: string): void {
    this.absPath = vfsNormalize(absOrRel)
    this.selected = null
    this.refresh()
    this.syncPathLabel()
    this.syncToolbar()
  }

  private goUp(): void {
    this.navigateTo(`${this.absPath}/..`)
  }

  private syncPathLabel(): void {
    this.pathEl.textContent = vfsFormatPath(this.absPath)
  }

  private selectedAbs(): string | null {
    if (!this.selected) return null
    return vfsNormalize(`${this.absPath}/${this.selected.name}`)
  }

  private clipboardStatus(): string {
    if (!this.clip) return 'Clipboard empty.'
    const p = this.clip.paths[0] ?? ''
    const leaf = p.split('/').filter(Boolean).pop() ?? p
    return `${this.clip.mode === 'cut' ? 'Cut' : 'Copied'} · ${vfsFormatPath(p) || leaf} (${leaf})`
  }

  private pushStatusWhenIdle(text: string, isErr = false): void {
    if (this.flashTimer) window.clearTimeout(this.flashTimer)
    this.statusEl.textContent = text
    this.statusEl.classList.toggle('fe-status--error', isErr)
    this.flashTimer = window.setTimeout(() => {
      this.flashTimer = null
      this.statusEl.textContent = this.clipboardStatus()
      this.statusEl.classList.remove('fe-status--error')
    }, 3400)
  }

  private setClip(mode: 'copy' | 'cut'): void {
    const abs = this.selectedAbs()
    if (!abs) return
    this.clip = { mode, paths: [abs] }
    this.clipboardLine()
    this.syncToolbar()
    this.pushStatusWhenIdle(mode === 'cut' ? 'Cut → choose folder, Paste to move.' : 'Copied → Paste duplicates here.')
  }

  private clipboardLine(): void {
    if (this.flashTimer) return
    this.statusEl.textContent = this.clipboardStatus()
  }

  private syncToolbar(): void {
    const hasSel = !!this.selected
    this.btnRename.disabled = !hasSel
    this.btnDel.disabled = !hasSel
    this.btnCut.disabled = !hasSel
    this.btnCopy.disabled = !hasSel
    this.btnPaste.disabled = !this.clip
    this.btnEdit.disabled = !hasSel || this.selected?.kind !== 'f'
    this.clipboardLine()
  }

  private pasteFromClip(): void {
    if (!this.clip?.paths.length) return

    const dest = this.absPath
    const resDir = vfsListEntries(dest)
    if (!resDir.ok) {
      this.pushStatusWhenIdle(resDir.msg, true)
      return
    }

    let lastErr: string | null = null
    let moved = false
    const wasCut = this.clip.mode === 'cut'

    for (const src of this.clip.paths) {
      const err =
        wasCut ? vfsMoveIntoDirectory(src, dest) : vfsCopyIntoDirectory(src, dest)
      if (err) lastErr = err
      else moved = true
    }

    if (wasCut && moved && !lastErr) this.clip = null

    if (lastErr && !moved) this.pushStatusWhenIdle(lastErr, true)
    else if (lastErr) this.pushStatusWhenIdle(`Paste issue: ${lastErr}`, true)
    else if (wasCut) this.pushStatusWhenIdle(`Moved into ${vfsFormatPath(dest)}`)
    else this.pushStatusWhenIdle(`Copied into ${vfsFormatPath(dest)}`)

    this.selected = null
    this.refresh()
    this.syncToolbar()
  }

  private renameSelection(): void {
    const abs = this.selectedAbs()
    if (!abs || !this.selected) return
    const next = window.prompt('New name:', this.selected.name)?.trim()
    if (next === undefined || next === '') return
    const err = vfsMoveIntoDirectory(abs, this.absPath, next)
    if (err) {
      this.pushStatusWhenIdle(err, true)
      return
    }
    this.selected = { name: next, kind: this.selected.kind }
    this.pushStatusWhenIdle(`Renamed → ${next}`)
    this.refresh()
    this.syncToolbar()
    queueMicrotask(() => this.focusRowNamed(next))
  }

  private deleteSelection(): void {
    const abs = this.selectedAbs()
    if (!abs || !this.selected) return

    const q =
      this.selected.kind === 'd'
        ? `Delete folder "${this.selected.name}" and everything inside?`
        : `Delete file "${this.selected.name}"?`
    if (!window.confirm(q)) return

    const err = vfsRm(abs)
    if (err) this.pushStatusWhenIdle(err, true)
    else this.pushStatusWhenIdle(`Removed ${this.selected.name}`)
    this.selected = null
    this.refresh()
    this.syncToolbar()
  }

  private cutSelection(): void {
    this.setClip('cut')
    this.refresh()
    this.syncToolbar()
  }

  private copySelection(): void {
    this.setClip('copy')
    this.syncToolbar()
  }

  private focusRowNamed(name: string): void {
    const list = vfsListEntries(this.absPath)
    if (!list.ok) return
    const ent = list.entries.find(e => e.name === name)
    if (!ent) return
    const row = [...this.bodyEl.querySelectorAll<HTMLButtonElement>('.fe-row')].find(
      x => x.querySelector('.fe-row-name')?.textContent === name,
    )
    if (!row) return
    row.focus()
    this.selectRow(ent, row)
  }

  private openSelectedInEditor(): void {
    if (!this.selected || this.selected.kind !== 'f') return
    this.onOpenInEditor(vfsNormalize(`${this.absPath}/${this.selected.name}`))
  }

  private onListKeydown(e: KeyboardEvent): void {
    const mod = e.ctrlKey || e.metaKey
    const k = e.key

    if (mod && k.toLowerCase() === 'x') {
      e.preventDefault()
      if (!this.btnCut.disabled) this.cutSelection()
      return
    }
    if (mod && k.toLowerCase() === 'c') {
      e.preventDefault()
      if (!this.btnCopy.disabled) this.copySelection()
      return
    }
    if (mod && k.toLowerCase() === 'v') {
      e.preventDefault()
      if (!this.btnPaste.disabled) this.pasteFromClip()
      return
    }
    if (k === 'F2') {
      e.preventDefault()
      if (!this.btnRename.disabled) this.renameSelection()
      return
    }
    if (k === 'Delete') {
      e.preventDefault()
      if (!this.btnDel.disabled) this.deleteSelection()
    }
  }

  refresh(): void {
    const res = vfsListEntries(this.absPath)
    this.bodyEl.replaceChildren()

    if (!res.ok) {
      const err = document.createElement('div')
      err.className = 'fe-error'
      err.textContent = res.msg
      this.bodyEl.appendChild(err)
      this.syncToolbar()
      return
    }

    if (res.entries.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'fe-empty'
      empty.textContent = '(empty folder)'
      this.bodyEl.appendChild(empty)
      this.syncToolbar()
      return
    }

    for (const ent of res.entries) {
      const row = document.createElement('button')
      row.type = 'button'
      row.className = 'fe-row'
      row.setAttribute('role', 'option')
      const icon = document.createElement('span')
      icon.className = 'fe-row-icon'
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = ent.kind === 'd' ? '📁' : '📄'
      const label = document.createElement('span')
      label.className = 'fe-row-name'
      label.textContent = ent.name
      const meta = document.createElement('span')
      meta.className = 'fe-row-kind'
      meta.textContent = ent.kind === 'd' ? 'folder' : 'file'
      row.append(icon, label, meta)

      row.addEventListener('click', () => this.selectRow(ent, row))
      row.addEventListener('dblclick', ev => {
        ev.preventDefault()
        if (ent.kind === 'd') {
          this.navigateTo(`${this.absPath}/${ent.name}`)
        } else {
          this.onOpenInEditor(vfsNormalize(`${this.absPath}/${ent.name}`))
        }
      })

      this.bodyEl.appendChild(row)
      if (
        this.selected &&
        ent.name === this.selected.name &&
        ent.kind === this.selected.kind
      ) {
        row.classList.add('fe-row--active')
      }
    }

    if (!this.bodyEl.querySelector('.fe-row--active')) this.selected = null
    this.syncToolbar()
  }

  private selectRow(
    ent: { name: string; kind: 'd' | 'f' },
    row: HTMLButtonElement,
  ): void {
    this.selected = ent
    this.bodyEl.querySelectorAll('.fe-row').forEach(r => r.classList.remove('fe-row--active'))
    row.classList.add('fe-row--active')
    this.syncToolbar()
  }

  focusPanel(): void {
    this.bodyEl.focus()
    if (!this.flashTimer) this.statusEl.textContent = this.clipboardStatus()
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
