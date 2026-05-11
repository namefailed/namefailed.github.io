// ── editor-window.ts ────────────────────────────────────────────────────────────
// In-browser editor with normal / insert / ex-line modes over `vfsReadRaw` / `vfsWrite`.
// Separate from terminal-line editing in `vim.ts`.

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
  /** `d`/`y` awaiting second strike for `dd` / `yy`. */
  private pendingOp: null | 'd' | 'y' = null
  private pendingChordTimer: ReturnType<typeof window.setTimeout> | null = null
  /** First `g` in `gg`. */
  private gArm = false
  /** Digits buffered before an operator/motion (`3dd`, `15G`, …). */
  private countDigits = ''
  /** `r` / `{count}r`, awaiting the replacement glyph */
  private replacePending: null | { nRuns: number } = null

  private yankRegister = ''

  private textarea: HTMLTextAreaElement
  private cmdInput: HTMLInputElement
  private statusEl: HTMLElement
  /** Live position / breadcrumb fragments in the mode line */
  private modeMetaEl!: HTMLElement

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
        this.refreshModeMeta()
      }
    })

    this.cmdInput.addEventListener('keydown', e => this.onCmdKeydown(e))
    this.cmdInput.addEventListener('input', () => {
      if (!this.cmdInput.value.startsWith(':')) {
        this.cmdInput.value = ':' + this.cmdInput.value.replace(/^:*\s*/, '')
      }
    })

    document.addEventListener('selectionchange', () => {
      const ae = document.activeElement
      if (ae !== this.textarea && ae !== this.cmdInput) return
      this.refreshModeMeta()
    })
  }

  /** Clear motion / chord / count state (buffers + pending operators). */
  private clearChordStateHard(): void {
    this.clearPendingDy()
    this.gArm = false
    this.countDigits = ''
    this.replacePending = null
  }

  private clearPendingDy(): void {
    if (this.pendingChordTimer != null) {
      window.clearTimeout(this.pendingChordTimer)
      this.pendingChordTimer = null
    }
    this.pendingOp = null
  }

  private armPendingDyChord(): void {
    if (this.pendingChordTimer != null) window.clearTimeout(this.pendingChordTimer)
    this.pendingChordTimer = window.setTimeout(() => {
      this.pendingChordTimer = null
      this.pendingOp = null
    }, 640)
  }

  private consumeCount(defaultN = 1): number {
    if (!this.countDigits) return Math.max(1, defaultN)
    const v = parseInt(this.countDigits, 10)
    this.countDigits = ''
    if (!Number.isFinite(v) || v < 1) return Math.max(1, defaultN)
    return Math.min(v, 50_000)
  }

  /** First line touched by `:e` counts as line 1. */
  private consumeOptionalNat(): number | null {
    if (!this.countDigits) return null
    const v = parseInt(this.countDigits, 10)
    this.countDigits = ''
    if (!Number.isFinite(v) || v < 1) return null
    return Math.min(v, 50_000)
  }

  private lineCountTotal(): number {
    const t = this.textarea.value
    if (!t) return 1
    return Math.max(1, t.split('\n').length)
  }

  private getLineCol(): { line: number; col: number } {
    const t = this.textarea.value
    const p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const pref = t.slice(0, p)
    const line = pref.split('\n').length
    const li = pref.lastIndexOf('\n')
    const col = p - (li + 1) + 1
    return { line, col }
  }

  private gotoLine(oneBased: number): void {
    const t = this.textarea.value
    const lines = t.split('\n')
    const maxL = Math.max(1, lines.length)
    const n = Math.max(1, Math.min(oneBased, maxL))
    let pos = 0
    for (let i = 0; i < n - 1; i++) pos += lines[i].length + 1
    this.textarea.setSelectionRange(pos, pos)
    this.refreshModeMeta()
  }

  private gotoLastLine(): void {
    this.gotoLine(this.lineCountTotal())
  }

  private firstNonBlankOnLine(pos: number): number {
    const t = this.textarea.value
    const { start, end } = this.lineBounds(pos)
    let p = start
    while (p < end && /\s/.test(t[p]!)) p++
    return p < end ? p : start
  }

  private deleteLineBlock(nLines: number): void {
    const t = this.textarea.value
    const curLineIdx = this.getLineCol().line - 1
    const lines = t.split('\n')
    if (!lines.length) return
    const del = Math.max(1, Math.min(nLines, lines.length - curLineIdx))
    let a = 0
    for (let i = 0; i < curLineIdx; i++) a += lines[i].length + 1
    let b = a
    for (let i = curLineIdx; i < curLineIdx + del; i++) {
      b += lines[i].length
      if (i < lines.length - 1) b += 1
    }
    const next = t.slice(0, a) + t.slice(b)
    this.textarea.value = next
    const caret = Math.min(a, next.length)
    this.textarea.setSelectionRange(caret, caret)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  private yankLineBlock(nLines: number): void {
    const t = this.textarea.value
    const curLineIdx = this.getLineCol().line - 1
    const lines = t.split('\n')
    if (!lines.length) return
    const take = Math.max(1, Math.min(nLines, lines.length - curLineIdx))
    let a = 0
    for (let i = 0; i < curLineIdx; i++) a += lines[i].length + 1
    let b = a
    for (let i = curLineIdx; i < curLineIdx + take; i++) {
      b += lines[i].length
      if (i < lines.length - 1) b += 1
    }
    this.yankRegister = t.slice(a, b)
    if (!this.yankRegister.endsWith('\n')) this.yankRegister += '\n'
    this.flashStatus(`Yanked ${take} line(s)`, false)
  }

  private deleteThroughEOL(): void {
    const t = this.textarea.value
    const p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const { end } = this.lineBounds(p)
    const next = t.slice(0, p) + t.slice(end)
    this.textarea.value = next
    this.textarea.setSelectionRange(p, p)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** Join consecutive lines beginning at cursor line (minimal vi `J`): no extra spacing. */
  private joinBelow(): void {
    const span = this.consumeCount(1) + 1
    const t = this.textarea.value
    const lines = t.split('\n')
    const cur = this.getLineCol().line - 1
    if (cur >= lines.length - 1) return
    const maxSpan = Math.min(span, lines.length - cur)
    const merged = lines.slice(cur, cur + maxSpan).join('')
    let a = 0
    for (let i = 0; i < cur; i++) a += lines[i].length + 1
    let b = a
    for (let i = cur; i < cur + maxSpan; i++) {
      b += lines[i].length
      if (i < lines.length - 1) b += 1
    }
    const next = t.slice(0, a) + merged + t.slice(b)
    this.textarea.value = next
    const caret = Math.min(a + merged.length, next.length)
    this.textarea.setSelectionRange(caret, caret)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** `r` / `{count}r`: replace each of the next `n` glyphs with `ch` (minimal vi semantics). */
  private applyReplaceRuns(n: number, ch: string): void {
    const t = this.textarea.value
    const p = this.textarea.selectionStart
    const take = Math.min(n, Math.max(0, t.length - p))
    if (take <= 0) return
    const rep = ch.repeat(take)
    const next = t.slice(0, p) + rep + t.slice(p + take)
    this.textarea.value = next
    const c = Math.max(p, Math.min(p + take - 1, next.length - 1))
    this.textarea.setSelectionRange(c, c)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** Path matches the file currently loaded in this tile. */
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
    this.clearChordStateHard()
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

  /** Push undo snapshot after mutating buffer text. */
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
        ':w :wq :q :q! :e path — NORMAL: hjkl ^ 0 $ · G gg · r J D · x X · dd yy p · u · ^R · i I a A o O · counts (3j, 5yy) · Esc',
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
    this.statusEl.className =
      'editor-status editor-status--msg' + (isErr ? ' editor-status--error' : '')
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

    const modeCls =
      this.mode === 'insert'
        ? 'mode-insert'
        : this.mode === 'cmd'
          ? 'mode-command'
          : 'mode-normal'

    this.statusEl.className = ['editor-status', 'vim-mode-line', modeCls].join(' ')
    this.statusEl.replaceChildren()

    const glyph = document.createElement('span')
    glyph.className = 'vim-mode-glyph'
    glyph.textContent = '◆'
    glyph.setAttribute('aria-hidden', 'true')

    const core = document.createElement('span')
    core.className = 'vim-mode-core'

    const modeText = document.createElement('span')
    modeText.className = 'vim-mode-text'
    modeText.textContent =
      this.mode === 'insert' ? 'INSERT' : this.mode === 'cmd' ? 'COMMAND' : 'NORMAL'
    core.appendChild(modeText)

    const dash1 = document.createElement('span')
    dash1.className = 'vim-mode-dash'
    dash1.textContent = '·'

    this.modeMetaEl = document.createElement('span')
    this.modeMetaEl.className = 'editor-mode-meta'

    const dash2 = document.createElement('span')
    dash2.className = 'vim-mode-dash'
    dash2.textContent = '·'

    const pathSpan = document.createElement('span')
    pathSpan.className = 'editor-mode-path'
    pathSpan.textContent = vfsFormatPath(this.absPath)

    const dirtySpan = document.createElement('span')
    dirtySpan.className = 'editor-mode-dirty'
    dirtySpan.textContent = this.dirty ? '●' : ''
    dirtySpan.setAttribute('aria-hidden', 'true')

    const hints = document.createElement('span')
    hints.className = 'editor-mode-hints'
    hints.textContent =
      this.mode === 'cmd'
        ? 'Enter · Esc cancel · :w :q :e'
        : this.mode === 'insert'
          ? 'Esc → NORMAL · thin caret'
          : 'hjkl · ^ 0 $ · G gg · r · J · D · x X · dd yy p · u · ^R · i a'

    this.statusEl.append(glyph, core, dash1, this.modeMetaEl, dash2, pathSpan, dirtySpan, hints)
    this.refreshModeMeta()
  }

  /** Live line / column / count buffer without rebuilding the entire mode line. */
  private refreshModeMeta(): void {
    if (!this.modeMetaEl || !this.modeMetaEl.isConnected) return
    if (this.statusEl.classList.contains('editor-status--msg')) return

    const { line, col } = this.getLineCol()
    const tot = this.lineCountTotal()
    const pct =
      tot <= 1 ? 100 : Math.min(99, Math.max(1, Math.round((line / tot) * 100)))
    const countHint = this.countDigits ? ` · #${this.countDigits}` : ''
    const rep = this.replacePending ? ` · r×${this.replacePending.nRuns}` : ''
    const opHint = this.pendingOp ? ` · ${this.pendingOp}?` : ''
    const gArm = this.gArm ? ` · g?` : ''
    this.modeMetaEl.textContent = `L${line} · C${col} · ${pct}%${countHint}${rep}${opHint}${gArm}`

    const dirtyDot = this.statusEl.querySelector('.editor-mode-dirty')
    if (dirtyDot) dirtyDot.textContent = this.dirty ? '●' : ''
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
        this.clearChordStateHard()
        this.syncStatus()
        this.syncEditorChrome()
        this.refreshModeMeta()
      }
      return
    }

    // ── NORMAL mode (classic vi-ish)
    const k = e.key

    if (this.replacePending != null) {
      if (k === 'Escape') {
        e.preventDefault()
        this.replacePending = null
        this.refreshModeMeta()
        return
      }
      const ch =
        !e.ctrlKey && !e.metaKey && !e.altKey && k.length === 1
          ? k
          : !e.ctrlKey && !e.metaKey && !e.altKey && k === 'Enter'
            ? '\n'
            : null
      if (ch != null) {
        e.preventDefault()
        const nr = this.replacePending.nRuns
        this.replacePending = null
        this.applyReplaceRuns(nr, ch)
      } else if (k.length === 1 || k === 'Enter' || k === 'Tab' || k === 'Backspace') {
        e.preventDefault()
      }
      return
    }

    const cur = () =>
      Math.min(Math.max(0, this.textarea.selectionStart), this.textarea.value.length)

    const setCur = (p: number): void => {
      const max = this.textarea.value.length
      const n = Math.max(0, Math.min(max, p))
      this.textarea.setSelectionRange(n, n)
      this.refreshModeMeta()
    }

    const swallowPrintable = (): void => {
      if (k.length === 1 || k === 'Enter' || k === 'Tab' || k === 'Backspace') {
        e.preventDefault()
      }
    }

    // Redo (^R — not vim's replace)
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault()
      if (this.snapPtr < this.snapshots.length - 1) {
        this.snapPtr++
        this.textarea.value = this.snapshots[this.snapPtr]!
        this.dirty = this.textarea.value !== this.savedText
        this.syncTitle()
        this.refreshModeMeta()
      }
      return
    }

    // Count prefix (`3j`, `10G`, `{count}` on `yy`/`dd`, …).
    if (/^[1-9]$/.test(k) || (k === '0' && this.countDigits !== '')) {
      e.preventDefault()
      this.countDigits += k
      if (this.countDigits.length > 6) this.countDigits = this.countDigits.slice(0, 6)
      this.refreshModeMeta()
      return
    }

    const completesDy =
      (this.pendingOp === 'd' && k === 'd') || (this.pendingOp === 'y' && k === 'y')
    if (!completesDy && k !== 'd' && k !== 'y') this.clearPendingDy()

    if (k === 'Escape') {
      e.preventDefault()
      this.clearChordStateHard()
      return
    }

    if (k === ':') {
      e.preventDefault()
      this.clearChordStateHard()
      this.enterCmd()
      return
    }

    // `gg` goto line (`{count}`gg ; blank count → top)
    if (k === 'g') {
      e.preventDefault()
      this.clearPendingDy()
      if (this.gArm) {
        const lineNum = this.consumeOptionalNat() ?? 1
        this.gArm = false
        this.gotoLine(lineNum)
        return
      }
      this.gArm = true
      window.setTimeout(() => {
        this.gArm = false
        this.refreshModeMeta()
      }, 560)
      this.refreshModeMeta()
      return
    }

    if (k !== 'g') this.gArm = false

    if (k === 'd') {
      e.preventDefault()
      if (this.pendingOp === 'd') {
        const n = this.consumeCount(1)
        this.clearPendingDy()
        this.deleteLineBlock(n)
        return
      }
      this.pendingOp = 'd'
      this.armPendingDyChord()
      this.refreshModeMeta()
      return
    }

    if (k === 'y') {
      e.preventDefault()
      if (this.pendingOp === 'y') {
        const n = this.consumeCount(1)
        this.clearPendingDy()
        this.yankLineBlock(n)
        this.refreshModeMeta()
        return
      }
      this.pendingOp = 'y'
      this.armPendingDyChord()
      this.refreshModeMeta()
      return
    }

    // `:` prefix already cleared count
    const pasteAfter = (): void => {
      const ya = this.yankRegister
      if (!ya) return
      let t = this.textarea.value
      const p = cur()
      const { end } = this.lineBounds(p)
      const ins = end < t.length && t[end] === '\n' ? end + 1 : t.length
      t = t.slice(0, ins) + ya + t.slice(ins)
      this.textarea.value = t
      setCur(ins + ya.length - 1)
    }

    const pasteBeforeLine = (): void => {
      const ya = this.yankRegister
      if (!ya) return
      let t = this.textarea.value
      const { start } = this.lineBounds(cur())
      t = t.slice(0, start) + ya + t.slice(start)
      this.textarea.value = t
      setCur(start + ya.length - 1)
    }

    if (k === 'p' || k === 'P') {
      e.preventDefault()
      if (!this.yankRegister) return
      const times = this.consumeCount(1)
      for (let i = 0; i < times; i++) {
        if (k === 'p') pasteAfter()
        else pasteBeforeLine()
      }
      this.dirty = this.textarea.value !== this.savedText
      this.recordAfterMutation()
      this.syncTitle()
      return
    }

    if (k === '0') {
      e.preventDefault()
      this.consumeCount(1)
      const { start } = this.lineBounds(cur())
      setCur(start)
      return
    }

    if (k === '^') {
      e.preventDefault()
      this.consumeCount(1)
      setCur(this.firstNonBlankOnLine(cur()))
      return
    }

    if (k === '$') {
      e.preventDefault()
      this.consumeCount(1)
      const { start, end } = this.lineBounds(cur())
      const t = this.textarea.value
      let p = end - 1
      if (p >= start && t[p] === '\n') p--
      setCur(Math.max(start, p))
      return
    }

    if (k === 'G') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      const n = this.consumeOptionalNat()
      if (n == null) this.gotoLastLine()
      else this.gotoLine(n)
      return
    }

    if (k === 'D') {
      e.preventDefault()
      this.consumeCount(1)
      this.deleteThroughEOL()
      return
    }

    if (k === 'J') {
      e.preventDefault()
      this.joinBelow()
      return
    }

    if (k === 'r') {
      e.preventDefault()
      const nRuns = this.consumeCount(1)
      this.replacePending = { nRuns }
      this.refreshModeMeta()
      return
    }

    if (k === 'X') {
      e.preventDefault()
      const n = this.consumeCount(1)
      let t = this.textarea.value
      let p = cur()
      const chop = Math.min(n, p)
      if (!chop) return
      t = t.slice(0, p - chop) + t.slice(p)
      this.textarea.value = t
      setCur(p - chop)
      this.dirty = t !== this.savedText
      this.recordAfterMutation()
      this.syncTitle()
      return
    }

    if (k === 'w') {
      e.preventDefault()
      const n = this.consumeCount(1)
      let p = cur()
      for (let i = 0; i < n; i++) p = this.wordForward(p)
      setCur(p)
      return
    }
    if (k === 'b') {
      e.preventDefault()
      const n = this.consumeCount(1)
      let p = cur()
      for (let i = 0; i < n; i++) p = this.wordBack(p)
      setCur(p)
      return
    }

    if (k === 'i') {
      e.preventDefault()
      this.consumeCount(1)
      this.mode = 'insert'
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'a') {
      e.preventDefault()
      this.consumeCount(1)
      this.mode = 'insert'
      setCur(cur() + 1)
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'A') {
      e.preventDefault()
      this.consumeCount(1)
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
      this.consumeCount(1)
      this.mode = 'insert'
      setCur(this.firstNonBlankOnLine(cur()))
      this.syncStatus()
      this.syncEditorChrome()
      return
    }
    if (k === 'o') {
      e.preventDefault()
      this.consumeCount(1)
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
      this.consumeCount(1)
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
      const n = this.consumeCount(1)
      let p = cur()
      for (let i = 0; i < n; i++) p = Math.max(0, p - 1)
      setCur(p)
      return
    }
    if (k === 'l') {
      e.preventDefault()
      const n = this.consumeCount(1)
      const max = this.textarea.value.length
      let p = cur()
      for (let i = 0; i < n; i++) p = Math.min(max, p + 1)
      setCur(p)
      return
    }
    if (k === 'j') {
      e.preventDefault()
      const n = this.consumeCount(1)
      for (let i = 0; i < n; i++) {
        const np = this.moveVert(1)
        this.textarea.setSelectionRange(np, np)
      }
      this.refreshModeMeta()
      return
    }
    if (k === 'k') {
      e.preventDefault()
      const n = this.consumeCount(1)
      for (let i = 0; i < n; i++) {
        const np = this.moveVert(-1)
        this.textarea.setSelectionRange(np, np)
      }
      this.refreshModeMeta()
      return
    }

    if (k === 'x') {
      e.preventDefault()
      const n = this.consumeCount(1)
      const t = this.textarea.value
      let p = cur()
      const kill = Math.min(n, Math.max(0, t.length - p))
      if (!kill) return
      this.textarea.value = t.slice(0, p) + t.slice(p + kill)
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
      this.refreshModeMeta()
      return
    }

    swallowPrintable()
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
