/** File browser over the fake VFS: navigate, rename, delete, clipboard cut/copy/paste. */

import {
  vfsCat,
  vfsFormatPath,
  vfsListEntries,
  vfsNormalize,
  vfsRm,
  vfsMoveIntoDirectory,
  vfsCopyIntoDirectory,
  vfsMkdir,
  vfsTouch,
  FS_HOME,
} from './os-fs'
import { setWallpaper } from './wallpaper'
import { storageGet, storageSetJson } from './storage'
import { createWindowChrome } from './window-chrome'

/** Returns true when a filename has an image extension. */
function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(name)
}

/** Persisted explorer UI — safe to orphan on parse failure. */
const FE_PREFS_KEY = 'portfolio-fe-prefs-v1'

type ExplorerSortMode = 'folders-asc' | 'folders-desc' | 'mixed-asc' | 'mixed-desc'
type ExplorerViewMode = 'list' | 'grid'

type ExplorerPrefs = {
  sort: ExplorerSortMode
  view: ExplorerViewMode
}

export interface FileExplorerWindowOptions {
  initialPath: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
  onOpenInEditor: (absFilePath: string) => void
}

type Clip = { mode: 'copy' | 'cut'; paths: string[] }

type ListedEnt = { name: string; kind: 'd' | 'f' }

function parseFePrefs(raw: string | null): Partial<ExplorerPrefs> {
  if (!raw) return {}
  try {
    const o = JSON.parse(raw) as ExplorerPrefs
    return typeof o === 'object' && o ? o : {}
  } catch {
    return {}
  }
}

export class FileExplorerWindow {
  readonly el: HTMLElement
  readonly command = 'explorer' as const
  readonly onFocus: () => void

  private absPath: string
  private selected: ListedEnt | null = null

  private bodyEl: HTMLElement
  private pathEl: HTMLElement
  private statusEl: HTMLElement
  private sortSelect!: HTMLSelectElement
  private btnViewList!: HTMLButtonElement
  private btnViewGrid!: HTMLButtonElement

  private clip: Clip | null = null
  private lastEntryCount = 0

  private sortMode: ExplorerSortMode = 'folders-asc'
  private viewMode: ExplorerViewMode = 'list'

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

    const chrome = createWindowChrome({
      title: 'files',
      onClose: () => this.onClose(),
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('file-explorer-app')
    this.el.tabIndex = -1

    const mkIcon = (
      glyph: string,
      title: string,
      fn: () => void,
      extraClass = '',
    ): HTMLButtonElement => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `fe-icon-btn ${extraClass}`.trim()
      b.title = title
      b.setAttribute('aria-label', title)
      b.innerHTML = `<span class="fe-icon-glyph" aria-hidden="true">${glyph}</span>`
      b.addEventListener('click', () => {
        opts.onFocus()
        fn()
      })
      return b
    }

    const toolbar = document.createElement('div')
    toolbar.className = 'fe-toolbar'

    const rowMain = document.createElement('div')
    rowMain.className = 'fe-toolbar-row fe-toolbar-row--main'

    const clusterNav = document.createElement('div')
    clusterNav.className = 'fe-cluster fe-cluster--nav'
    clusterNav.append(
      mkIcon('↑', 'Up to parent folder', () => this.goUp()),
      mkIcon('⌂', 'Home (~)', () => this.navigateTo(FS_HOME)),
      mkIcon('↻', 'Refresh', () => this.refresh()),
    )

    const clusterOps = document.createElement('div')
    clusterOps.className = 'fe-cluster fe-cluster--ops'
    this.btnRename = mkIcon('✎', 'Rename (F2)', () => this.renameSelection())
    this.btnDel = mkIcon('×', 'Delete (Del)', () => this.deleteSelection(), 'fe-icon-btn--danger')
    this.btnCut = mkIcon('✂', 'Cut (Ctrl+X)', () => this.cutSelection())
    this.btnCopy = mkIcon('⎘', 'Copy (Ctrl+C)', () => this.copySelection())
    this.btnPaste = mkIcon('▣', 'Paste (Ctrl+V)', () => this.pasteFromClip())
    clusterOps.append(this.btnRename, this.btnDel, this.btnCut, this.btnCopy, this.btnPaste)

    const clusterNew = document.createElement('div')
    clusterNew.className = 'fe-cluster fe-cluster--new'
    clusterNew.append(
      mkIcon('＋', 'New file…', () => this.newFile(), 'fe-icon-btn--ghost'),
      mkIcon('⊕', 'New folder…', () => this.newFolder(), 'fe-icon-btn--ghost'),
    )

    const clusterView = document.createElement('div')
    clusterView.className = 'fe-cluster fe-cluster--view'
    this.btnViewList = mkIcon('≡', 'List view', () => this.setViewMode('list'))
    this.btnViewGrid = mkIcon('▦', 'Grid / icon view', () => this.setViewMode('grid'))
    this.sortSelect = document.createElement('select')
    this.sortSelect.className = 'fe-sort-select'
    this.sortSelect.setAttribute('aria-label', 'Sort order')
    for (const opt of [
      ['folders-asc', 'Folders first · A→Z'],
      ['folders-desc', 'Folders first · Z→A'],
      ['mixed-asc', 'All items · A→Z'],
      ['mixed-desc', 'All items · Z→A'],
    ] as const) {
      const o = document.createElement('option')
      o.value = opt[0]
      o.textContent = opt[1]
      this.sortSelect.appendChild(o)
    }
    this.sortSelect.addEventListener('change', () => {
      opts.onFocus()
      this.sortMode = this.sortSelect.value as ExplorerSortMode
      this.persistFePrefs()
      this.refresh()
    })
    clusterView.append(this.btnViewList, this.btnViewGrid, this.sortSelect)

    rowMain.append(clusterNav, clusterOps, clusterNew, clusterView)

    const pathRow = document.createElement('div')
    pathRow.className = 'fe-path-row'

    this.pathEl = document.createElement('nav')
    this.pathEl.className = 'fe-path fe-path--crumbs'
    this.pathEl.setAttribute('aria-label', 'Path breadcrumbs')
    this.pathEl.setAttribute('aria-live', 'polite')

    pathRow.appendChild(this.pathEl)
    toolbar.append(rowMain, pathRow)

    this.bodyEl = document.createElement('div')
    this.bodyEl.className = 'fe-body win-body'
    this.bodyEl.setAttribute('role', 'listbox')
    this.bodyEl.tabIndex = 0
    this.bodyEl.addEventListener('keydown', e => this.onListKeydown(e))

    const foot = document.createElement('div')
    foot.className = 'fe-footer'

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'fe-status'

    this.btnEdit = document.createElement('button')
    this.btnEdit.type = 'button'
    this.btnEdit.className = 'fe-footer-btn fe-footer-btn--accent'
    this.btnEdit.textContent = 'open in editor'
    this.btnEdit.title = 'Opens the selected file in the editor tile'
    this.btnEdit.disabled = true
    this.btnEdit.addEventListener('click', () => {
      opts.onFocus()
      this.primaryFileAction()
    })

    foot.appendChild(this.statusEl)
    foot.appendChild(this.btnEdit)

    const stack = document.createElement('div')
    stack.className = 'fe-stack'
    stack.appendChild(toolbar)
    stack.appendChild(this.bodyEl)
    stack.appendChild(foot)

    this.el.appendChild(stack)

    this.loadFePrefs()
    this.sortSelect.value = this.sortMode
    this.applyBodyViewClass()
    this.syncViewChrome()

    this.renderBreadcrumbs()
    this.refresh()
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
    this.renderBreadcrumbs()
    this.syncToolbar()
  }

  private goUp(): void {
    this.navigateTo(`${this.absPath}/..`)
  }

  private loadFePrefs(): void {
    const p = parseFePrefs(storageGet(FE_PREFS_KEY))
    const sorts: ExplorerSortMode[] = ['folders-asc', 'folders-desc', 'mixed-asc', 'mixed-desc']
    if (p.sort && sorts.includes(p.sort)) this.sortMode = p.sort
    if (p.view === 'list' || p.view === 'grid') this.viewMode = p.view
  }

  private persistFePrefs(): void {
    const raw: ExplorerPrefs = { sort: this.sortMode, view: this.viewMode }
    storageSetJson(FE_PREFS_KEY, raw)
  }

  private setViewMode(v: ExplorerViewMode): void {
    if (this.viewMode === v) return
    this.viewMode = v
    this.persistFePrefs()
    this.applyBodyViewClass()
    this.syncViewChrome()
  }

  private applyBodyViewClass(): void {
    this.bodyEl.classList.toggle('fe-view-grid', this.viewMode === 'grid')
    this.bodyEl.classList.toggle('fe-view-list', this.viewMode === 'list')
  }

  private syncViewChrome(): void {
    const on = (btn: HTMLButtonElement, pressed: boolean): void => {
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false')
      btn.classList.toggle('fe-icon-btn--pressed', pressed)
    }
    on(this.btnViewList, this.viewMode === 'list')
    on(this.btnViewGrid, this.viewMode === 'grid')
  }

  private sortEntries(entries: ListedEnt[]): ListedEnt[] {
    const out = [...entries]
    const cmpName = (a: ListedEnt, b: ListedEnt, dir: 1 | -1): number =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir

    switch (this.sortMode) {
      case 'folders-asc':
        return out.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'd' ? -1 : 1
          return cmpName(a, b, 1)
        })
      case 'folders-desc':
        return out.sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'd' ? -1 : 1
          return cmpName(a, b, -1)
        })
      case 'mixed-asc':
        return out.sort((a, b) => cmpName(a, b, 1))
      case 'mixed-desc':
        return out.sort((a, b) => cmpName(a, b, -1))
      default:
        return out
    }
  }

  private renderBreadcrumbs(): void {
    this.pathEl.replaceChildren()
    const abs = vfsNormalize(this.absPath)

    const addSep = (): void => {
      const s = document.createElement('span')
      s.className = 'fe-crumb-sep'
      s.textContent = '/'
      s.setAttribute('aria-hidden', 'true')
      this.pathEl.appendChild(s)
    }

    const here = (label: string): void => {
      const cur = document.createElement('span')
      cur.className = 'fe-crumb fe-crumb--here'
      cur.textContent = label
      this.pathEl.appendChild(cur)
    }

    const crumb = (label: string, target: string): void => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'fe-crumb'
      b.textContent = label
      b.title = vfsFormatPath(target)
      b.addEventListener('click', () => {
        this.onFocus()
        this.navigateTo(target)
      })
      this.pathEl.appendChild(b)
    }

    if (abs === FS_HOME || abs.startsWith(FS_HOME + '/')) {
      if (abs === FS_HOME) {
        here('~')
        return
      }
      crumb('~', FS_HOME)
      const tail = abs.slice(FS_HOME.length).replace(/^\/+/, '')
      const parts = tail.split('/').filter(Boolean)
      let cur = FS_HOME
      for (let i = 0; i < parts.length; i++) {
        addSep()
        cur = vfsNormalize(`${cur}/${parts[i]!}`)
        const last = i === parts.length - 1
        if (last) here(parts[i]!)
        else crumb(parts[i]!, cur)
      }
      return
    }

    const span = document.createElement('span')
    span.className = 'fe-path-fallback'
    span.textContent = vfsFormatPath(abs)
    this.pathEl.appendChild(span)
  }

  private selectedAbs(): string | null {
    if (!this.selected) return null
    return vfsNormalize(`${this.absPath}/${this.selected.name}`)
  }

  private clipboardStatus(): string {
    const n = this.lastEntryCount
    const hint = `${n} ${n === 1 ? 'item' : 'items'}`
    if (!this.clip) return `${hint} · Clipboard empty.`
    const p = this.clip.paths[0] ?? ''
    const leaf = p.split('/').filter(Boolean).pop() ?? p
    return `${hint} · ${this.clip.mode === 'cut' ? 'Cut' : 'Copied'} · ${vfsFormatPath(p) || leaf}`
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
    const isFile = hasSel && this.selected?.kind === 'f'
    this.btnEdit.disabled = !isFile
    const name = this.selected?.name ?? ''
    this.btnEdit.textContent = isFile && isImageFile(name)
      ? 'set as wallpaper'
      : isFile && name.endsWith('.js')
      ? 'open in p5.js'
      : 'open in editor'
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

  private primaryFileAction(): void {
    if (!this.selected || this.selected.kind !== 'f') return
    if (isImageFile(this.selected.name)) {
      this.setSelectedAsWallpaper()
    } else {
      this.openSelectedInEditor()
    }
  }

  private setSelectedAsWallpaper(): void {
    const abs = this.selectedAbs()
    if (!abs) return
    const url = vfsCat(abs)
    if (!url?.trim()) {
      this.pushStatusWhenIdle('Wallpaper file is empty', true)
      return
    }
    setWallpaper(url.trim())
    this.pushStatusWhenIdle('Wallpaper applied ✓')
  }

  private openSelectedInEditor(): void {
    if (!this.selected || this.selected.kind !== 'f') return
    this.onOpenInEditor(vfsNormalize(`${this.absPath}/${this.selected.name}`))
  }

  private newFile(): void {
    const name = window.prompt('New file name:', 'notes.txt')?.trim()
    if (!name) return
    const err = vfsTouch(vfsNormalize(`${this.absPath}/${name}`))
    if (err) {
      this.pushStatusWhenIdle(err, true)
      return
    }
    this.selected = { name, kind: 'f' }
    this.pushStatusWhenIdle(`Created ${name}`)
    this.refresh()
    this.syncToolbar()
    queueMicrotask(() => this.focusRowNamed(name))
  }

  private newFolder(): void {
    const name = window.prompt('New folder name:', 'untitled-folder')?.trim()
    if (!name) return
    const err = vfsMkdir(vfsNormalize(`${this.absPath}/${name}`))
    if (err) {
      this.pushStatusWhenIdle(err, true)
      return
    }
    this.selected = { name, kind: 'd' }
    this.pushStatusWhenIdle(`Created folder ${name}`)
    this.refresh()
    this.syncToolbar()
    queueMicrotask(() => this.focusRowNamed(name))
  }

  private entFromRow(row: HTMLButtonElement): ListedEnt | null {
    const name = row.querySelector('.fe-row-name')?.textContent
    const k = row.querySelector('.fe-row-kind')?.textContent
    if (!name || !k) return null
    return { name, kind: k === 'folder' ? 'd' : 'f' }
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
      return
    }

    if (k === 'Escape') {
      e.preventDefault()
      this.selected = null
      this.bodyEl.querySelectorAll('.fe-row').forEach(r => r.classList.remove('fe-row--active'))
      this.syncToolbar()
      return
    }

    const rows = (): HTMLButtonElement[] => [
      ...this.bodyEl.querySelectorAll<HTMLButtonElement>('.fe-row'),
    ]

    if (k === 'Enter') {
      const ent = this.selected
      if (!ent) return
      e.preventDefault()
      if (ent.kind === 'd') {
        this.navigateTo(`${this.absPath}/${ent.name}`)
      } else {
        this.onOpenInEditor(vfsNormalize(`${this.absPath}/${ent.name}`))
      }
      return
    }

    if (k === 'ArrowDown' || k === 'ArrowUp') {
      const list = rows()
      if (!list.length) return
      e.preventDefault()
      const ae = document.activeElement
      let idx = ae ? list.indexOf(ae as HTMLButtonElement) : -1
      if (idx < 0) idx = k === 'ArrowDown' ? -1 : list.length
      const next =
        k === 'ArrowDown'
          ? Math.min(idx + 1, list.length - 1)
          : Math.max(idx - 1, 0)
      const row = list[next]!
      const ent = this.entFromRow(row)
      if (!ent) return
      row.focus()
      this.selectRow(ent, row)
    }
  }

  refresh(): void {
    const res = vfsListEntries(this.absPath)
    this.bodyEl.replaceChildren()

    if (!res.ok) {
      this.lastEntryCount = 0
      const err = document.createElement('div')
      err.className = 'fe-error'
      err.textContent = res.msg
      this.bodyEl.appendChild(err)
      this.syncToolbar()
      return
    }

    const sorted = this.sortEntries(res.entries)

    if (sorted.length === 0) {
      this.lastEntryCount = 0
      const empty = document.createElement('div')
      empty.className = 'fe-empty'
      empty.textContent = '(empty folder)'
      this.bodyEl.appendChild(empty)
      this.syncToolbar()
      return
    }

    this.lastEntryCount = sorted.length

    for (const ent of sorted) {
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
