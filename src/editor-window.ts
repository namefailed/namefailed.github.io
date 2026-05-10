// ── editor-window.ts ────────────────────────────────────────────────────────────
// Mini-vim buffer on top of `vfsReadRaw` / `vfsWrite`; chrome matches `AppWindow`.
// I keep normal / insert / `:` separate from my xterm prompt vim (`vim.ts`).

import { vfsFormatPath, vfsNormalize, vfsReadRaw, vfsWrite } from './os-fs'

export interface EditorWindowOptions {
  initialPath: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
}

type EditMode = 'normal' | 'insert' | 'cmd'

export class EditorWindow {
  readonly el: HTMLElement
  readonly command = 'edit' as const
  readonly onFocus: () => void

  private absPath: string
  private savedText: string
  private dirty = false

  private mode: EditMode = 'normal'
  private pendingD = false
  /** Partial chord for `gg` / `yy`. */
  private gArm = false
  private yArm = false
  private yankRegister = ''

  private textarea: HTMLTextAreaElement
  private cmdInput: HTMLInputElement
  private statusEl: HTMLElement
  private titleEl: HTMLElement

  private snapshots: string[] = []
  private snapPtr = 0
  private readonly maxSnapshots = 80

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void

  constructor(opts: EditorWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus

    this.absPath = vfsNormalize(opts.initialPath)
    const initial = vfsReadRaw(this.absPath)
    const startText = initial.ok ? initial.body : ''
    this.savedText = startText

    this.el = document.createElement('div')
    this.el.className = 'app-window content-window editor-app'
    this.el.addEventListener('mousedown', () => opts.onFocus())

    const bar = document.createElement('div')
    bar.className = 'win-titlebar'
    bar.innerHTML = `
      <div class="win-title-left">
        <span class="win-title"></span>
      </div>
      <div class="win-traffic">
        <span class="dot dot-min" title="minimize (ctrl+m)"></span>
        <span class="dot dot-max" title="maximize / restore (ctrl+f)"></span>
        <span class="dot dot-close" title="close (ctrl+q)"></span>
      </div>
    `
    this.titleEl = bar.querySelector('.win-title') as HTMLElement

    bar.querySelector('.dot-close')!.addEventListener('click', e => {
      e.stopPropagation()
      this.tryCloseFromChrome()
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

    const stack = document.createElement('div')
    stack.className = 'editor-stack'

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'editor-textarea'
    this.textarea.spellcheck = false
    this.textarea.autocapitalize = 'off'
    this.textarea.autocomplete = 'off'
    this.textarea.value = startText
    this.textarea.wrap = 'off'
    // Normal/command modes block edits via `beforeinput` — not `readOnly`, so the
    // caret stays visible (browsers often hide it on readonly textareas).

    this.cmdInput = document.createElement('input')
    this.cmdInput.type = 'text'
    this.cmdInput.className = 'editor-cmdline'
    this.cmdInput.spellcheck = false
    this.cmdInput.autocomplete = 'off'
    this.cmdInput.setAttribute('aria-label', 'Ex command')

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'editor-status'

    stack.appendChild(this.textarea)
    stack.appendChild(this.cmdInput)
    stack.appendChild(this.statusEl)

    this.el.appendChild(bar)
    this.el.appendChild(stack)

    this.resetUndoStack(startText)
    if (!initial.ok) {
      this.flashStatus(initial.msg + ' — empty buffer; :w creates the file', true)
    }

    this.syncTitle()
    this.syncStatus()
    this.syncEditorChrome()

    this.textarea.addEventListener('beforeinput', e => {
      if (this.mode !== 'insert') e.preventDefault()
    })
    this.textarea.addEventListener('paste', e => {
      if (this.mode !== 'insert') e.preventDefault()
    })
    this.textarea.addEventListener('keydown', e => this.onEditorKeydown(e))
    this.textarea.addEventListener('input', () => {
      if (this.mode === 'insert') {
        this.dirty = this.textarea.value !== this.savedText
        this.syncTitle()
      }
    })

    this.cmdInput.addEventListener('keydown', e => this.onCmdKeydown(e))
    this.cmdInput.addEventListener('input', () => {
      if (!this.cmdInput.value.startsWith(':')) {
        this.cmdInput.value = ':' + this.cmdInput.value.replace(/^:*\s*/, '')
      }
    })
  }

  /** True if the path I’m opening matches the buffer I already have */
  pathMatches(userPath: string): boolean {
    return this.absPath === vfsNormalize(userPath)
  }

  loadFile(path: string): void {
    this.absPath = vfsNormalize(path)
    const r = vfsReadRaw(this.absPath)
    const text = r.ok ? r.body : ''
    this.savedText = text
    this.textarea.value = text
    this.dirty = false
    this.mode = 'normal'
    this.pendingD = false
    this.cmdInput.style.display = 'none'
    this.cmdInput.value = ''
    this.resetUndoStack(text)
    if (!r.ok) {
      this.flashStatus(`${r.msg} — new file when you :w`, true)
    }
    this.syncTitle()
    this.syncStatus()
    this.syncEditorChrome()
  }

  private resetUndoStack(text: string): void {
    this.snapshots = [text]
    this.snapPtr = 0
  }

  /** I snapshot here after edits so `u` undo has something to pop */
  private recordAfterMutation(): void {
    const t = this.textarea.value
    if (this.snapshots[this.snapPtr] === t) return
    this.snapshots = this.snapshots.slice(0, this.snapPtr + 1)
    this.snapshots.push(t)
    this.snapPtr = this.snapshots.length - 1
    while (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift()
      this.snapPtr--
    }
  }

  private tryCloseFromChrome(): void {
    if (this.dirty) {
      this.flashStatus('No write since last change — use :wq or :q!', true)
      return
    }
    this.onClose()
  }

  private onCmdKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      this.leaveCmd()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      this.runExCommand(this.cmdInput.value)
    }
  }

  private runExCommand(raw: string): void {
    let line = raw.trim()
    if (line.startsWith(':')) line = line.slice(1).trim()

    const lower = line.toLowerCase()
    if (lower === 'w' || lower === 'write') {
      this.saveFile()
      this.leaveCmd()
      return
    }
    if (lower === 'q' || lower === 'quit') {
      if (this.dirty) {
        this.flashStatus('No write since last change (use :q! to force)', true)
        this.leaveCmd()
        return
      }
      this.onClose()
      return
    }
    if (lower === 'q!' || lower === 'quit!') {
      this.onClose()
      return
    }
    if (lower === 'wq' || lower === 'x' || lower === 'xit') {
      if (this.saveFile()) {
        this.onClose()
      }
      return
    }
    const em = /^e(?:dit)?\s+(.+)$/.exec(line)
    if (em) {
      this.loadFile(em[1].trim())
      this.leaveCmd()
      return
    }
    if (line === '' || lower === 'help') {
      this.flashStatus(
        ':w :wq :q :q! :e path — normal: hjkl 0 $ G gg yy p P x dd u · ^R redo · i a o O · Esc',
        false,
      )
      this.leaveCmd()
      return
    }

    this.flashStatus(`Not an editor command: ${line}`, true)
    this.leaveCmd()
  }

  private leaveCmd(): void {
    this.mode = 'normal'
    this.cmdInput.style.display = 'none'
    this.cmdInput.value = ''
    this.syncStatus()
    this.syncEditorChrome()
    this.textarea.focus()
  }

  private enterCmd(): void {
    this.mode = 'cmd'
    this.cmdInput.style.display = 'block'
    this.cmdInput.value = ':'
    this.syncStatus()
    this.syncEditorChrome()
    requestAnimationFrame(() => {
      this.cmdInput.focus()
      this.cmdInput.setSelectionRange(1, 1)
    })
  }

  private saveFile(): boolean {
    const err = vfsWrite(this.absPath, this.textarea.value)
    if (err) {
      this.flashStatus(err, true)
      return false
    }
    this.savedText = this.textarea.value
    this.dirty = false
    this.flashStatus(`Written ${vfsFormatPath(this.absPath)}`, false)
    this.syncTitle()
    return true
  }

  private flashStatus(msg: string, isErr: boolean): void {
    this.statusEl.classList.toggle('editor-status--error', isErr)
    this.statusEl.classList.add('editor-status--msg')
    this.statusEl.textContent = msg
    window.setTimeout(() => {
      this.statusEl.classList.remove('editor-status--msg', 'editor-status--error')
      this.syncStatus()
    }, 3800)
  }

  private syncTitle(): void {
    const path = vfsFormatPath(this.absPath)
    this.titleEl.textContent = `edit — ${path}${this.dirty ? ' +' : ''}`
  }

  private syncStatus(): void {
    if (this.statusEl.classList.contains('editor-status--msg')) return
    const path = vfsFormatPath(this.absPath)
    const modeLabel =
      this.mode === 'insert' ? 'INSERT' : this.mode === 'cmd' ? 'COMMAND' : 'NORMAL'
    this.statusEl.textContent = `${modeLabel}  ${path}  hjkl · wb · 0$ · G gg · yy p · u · ^R · i · :w · :q`
  }

  /** Cursor / caret styling follows vim-like mode. */
  private syncEditorChrome(): void {
    this.textarea.classList.remove(
      'editor-textarea--normal',
      'editor-textarea--insert',
      'editor-textarea--cmd',
    )
    if (this.mode === 'insert') this.textarea.classList.add('editor-textarea--insert')
    else if (this.mode === 'cmd') this.textarea.classList.add('editor-textarea--cmd')
    else this.textarea.classList.add('editor-textarea--normal')
  }

  private onEditorKeydown(e: KeyboardEvent): void {
    if (this.mode === 'cmd') return

    if (this.mode === 'insert') {
      if (e.key === 'Escape' || (e.ctrlKey && e.key === '[')) {
        e.preventDefault()
        this.recordAfterMutation()
        this.mode = 'normal'
        this.syncStatus()
        this.syncEditorChrome()
      }
      return
    }

    // normal mode
    const k = e.key

    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      if (this.snapPtr < this.snapshots.length - 1) {
        this.snapPtr++
        this.textarea.value = this.snapshots[this.snapPtr]!
        this.dirty = this.textarea.value !== this.savedText
        this.syncTitle()
      }
      return
    }

    if (k !== 'g' && k !== 'y') {
      this.gArm = false
      this.yArm = false
    }

    const cur = () => this.textarea.selectionStart
    const setCur = (p: number) => {
      const max = this.textarea.value.length
      const n = Math.max(0, Math.min(max, p))
      this.textarea.setSelectionRange(n, n)
    }

    if (k === ':') {
      e.preventDefault()
      this.enterCmd()
      return
    }

    if (k === 'g') {
      e.preventDefault()
      if (this.gArm) {
        setCur(0)
        this.gArm = false
        return
      }
      this.gArm = true
      this.yArm = false
      window.setTimeout(() => {
        this.gArm = false
      }, 420)
      return
    }

    if (k === 'y') {
      e.preventDefault()
      if (this.yArm) {
        const { start, end } = this.lineBounds(cur())
        const t = this.textarea.value
        const slice = t.slice(start, end) + '\n'
        this.yankRegister = slice
        this.flashStatus(`Yanked ${slice.split('\n').length - 1 || 1} line(s)`, false)
        this.yArm = false
        return
      }
      this.yArm = true
      this.gArm = false
      window.setTimeout(() => {
        this.yArm = false
      }, 420)
      return
    }

    if (k === 'p' || k === 'P') {
      e.preventDefault()
      if (!this.yankRegister) return
      const t = this.textarea.value
      const p = cur()
      const { start } = this.lineBounds(p)
      if (k === 'p') {
        const { end } = this.lineBounds(p)
        const ins = end < t.length && t[end] === '\n' ? end + 1 : t.length
        this.textarea.value = t.slice(0, ins) + this.yankRegister + t.slice(ins)
        setCur(ins + this.yankRegister.length - 1)
      } else {
        this.textarea.value = t.slice(0, start) + this.yankRegister + t.slice(start)
        setCur(start + this.yankRegister.length - 1)
      }
      this.dirty = this.textarea.value !== this.savedText
      this.recordAfterMutation()
      this.syncTitle()
      return
    }

    if (k === '0') {
      e.preventDefault()
      const { start } = this.lineBounds(cur())
      setCur(start)
      return
    }
    if (k === '$') {
      e.preventDefault()
      const { start, end } = this.lineBounds(cur())
      const t = this.textarea.value
      let p = end - 1
      if (p >= start && t[p] === '\n') p--
      setCur(Math.max(start, p))
      return
    }
    if (k === 'G') {
      e.preventDefault()
      setCur(this.textarea.value.length)
      return
    }

    if (k === 'w') {
      e.preventDefault()
      setCur(this.wordForward(cur()))
      return
    }
    if (k === 'b') {
      e.preventDefault()
      setCur(this.wordBack(cur()))
      return
    }

    if (k === 'i') {
      e.preventDefault()
      this.mode = 'insert'
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'a') {
      e.preventDefault()
      this.mode = 'insert'
      setCur(cur() + 1)
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'A') {
      e.preventDefault()
      const t = this.textarea.value
      const pos = cur()
      const rest = t.slice(pos)
      const nl = rest.indexOf('\n')
      const end = nl === -1 ? t.length : pos + nl
      this.mode = 'insert'
      setCur(end)
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'I') {
      e.preventDefault()
      const t = this.textarea.value
      const pos = cur()
      const lineStart = t.lastIndexOf('\n', pos - 1) + 1
      this.mode = 'insert'
      setCur(lineStart)
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'o') {
      e.preventDefault()
      const t = this.textarea.value
      const pos = cur()
      const nl = t.indexOf('\n', pos)
      const insAt = nl === -1 ? t.length : nl
      const next = t.slice(0, insAt) + '\n' + t.slice(insAt)
      this.textarea.value = next
      setCur(insAt + 1)
      this.dirty = this.textarea.value !== this.savedText
      this.mode = 'insert'
      this.recordAfterMutation()
      this.syncTitle()
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'O') {
      e.preventDefault()
      const t = this.textarea.value
      const pos = cur()
      const lineStart = t.lastIndexOf('\n', pos - 1) + 1
      const next = t.slice(0, lineStart) + '\n' + t.slice(lineStart)
      this.textarea.value = next
      setCur(lineStart)
      this.dirty = this.textarea.value !== this.savedText
      this.mode = 'insert'
      this.recordAfterMutation()
      this.syncTitle()
      this.syncStatus()
      this.syncEditorChrome()
      return
    }

    if (k === 'h') {
      e.preventDefault()
      setCur(cur() - 1)
      return
    }
    if (k === 'l') {
      e.preventDefault()
      setCur(cur() + 1)
      return
    }
    if (k === 'j') {
      e.preventDefault()
      setCur(this.moveVert(1))
      return
    }
    if (k === 'k') {
      e.preventDefault()
      setCur(this.moveVert(-1))
      return
    }

    if (k === 'x') {
      e.preventDefault()
      const t = this.textarea.value
      const p = cur()
      if (p >= t.length) return
      this.textarea.value = t.slice(0, p) + t.slice(p + 1)
      setCur(p)
      this.dirty = this.textarea.value !== this.savedText
      this.recordAfterMutation()
      this.syncTitle()
      return
    }

    if (k === 'u') {
      e.preventDefault()
      if (this.snapPtr <= 0) return
      this.snapPtr--
      this.textarea.value = this.snapshots[this.snapPtr]!
      this.dirty = this.textarea.value !== this.savedText
      this.syncTitle()
      return
    }

    if (k === 'd') {
      e.preventDefault()
      if (this.pendingD) {
        this.pendingD = false
        const t = this.textarea.value
        const p = cur()
        const lineStart = t.lastIndexOf('\n', p - 1) + 1
        let lineEnd = t.indexOf('\n', p)
        if (lineEnd === -1) lineEnd = t.length
        else lineEnd++
        this.textarea.value = t.slice(0, lineStart) + t.slice(lineEnd)
        setCur(Math.min(lineStart, this.textarea.value.length))
        this.dirty = this.textarea.value !== this.savedText
        this.recordAfterMutation()
        this.syncTitle()
      } else {
        this.pendingD = true
        window.setTimeout(() => {
          this.pendingD = false
        }, 400)
      }
      return
    }

    // swallow printable keys in normal mode (except those above)
    if (k.length === 1 || k === 'Enter' || k === 'Tab' || k === 'Backspace') {
      e.preventDefault()
    }
  }

  private lineBounds(pos: number): { start: number; end: number } {
    const t = this.textarea.value
    const lineStart = t.lastIndexOf('\n', pos - 1) + 1
    let lineEnd = t.indexOf('\n', pos)
    if (lineEnd === -1) lineEnd = t.length
    return { start: lineStart, end: lineEnd }
  }

  private isWordChar(ch: string): boolean {
    return /[A-Za-z0-9_]/.test(ch)
  }

  /** Next word start — vim-like `w` on [A-Za-z0-9_] tokens */
  private wordForward(pos: number): number {
    const t = this.textarea.value
    let p = Math.min(pos, t.length)
    while (p < t.length && !this.isWordChar(t[p]!)) p++
    while (p < t.length && this.isWordChar(t[p]!)) p++
    return p
  }

  /** Previous word start — vim-like `b` */
  private wordBack(pos: number): number {
    const t = this.textarea.value
    let p = Math.min(pos, t.length)
    if (p > 0) p--
    while (p > 0 && !this.isWordChar(t[p]!)) p--
    while (p > 0 && this.isWordChar(t[p - 1]!)) p--
    return p
  }

  private moveVert(delta: -1 | 1): number {
    const t = this.textarea.value
    const p = this.textarea.selectionStart
    const before = t.slice(0, p)
    const lineStart = before.lastIndexOf('\n') + 1
    const col = p - lineStart
    const lines = t.split('\n')
    const lineIdx = before.split('\n').length - 1
    const targetLine = Math.max(0, Math.min(lines.length - 1, lineIdx + delta))
    const targetText = lines[targetLine] ?? ''
    const newCol = Math.min(col, targetText.length)
    let pos = 0
    for (let i = 0; i < targetLine; i++) pos += lines[i].length + 1
    return pos + newCol
  }

  setActive(active: boolean): void {
    this.el.classList.toggle('active', active)
  }

  setMinimized(min: boolean): void {
    this.el.classList.toggle('minimized', min)
  }

  scrollBy(delta: number): void {
    this.textarea.scrollBy({ top: delta, behavior: 'smooth' })
  }

  isMaximized(): boolean {
    return this.el.classList.contains('maximized')
  }

  /** WM focused me — pull keyboard here */
  focusEditor(): void {
    if (this.mode === 'cmd') this.cmdInput.focus()
    else this.textarea.focus()
  }
}
