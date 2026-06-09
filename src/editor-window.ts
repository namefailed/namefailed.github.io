/** Modal editor over the fake VFS (normal / insert / ex); not the terminal one-line vim widget. */

import { parseEditorExCommand } from './editor-ex-commands'
import { insertModeKeyAction, tryAppendCountDigit } from './editor-vim-keys'
import {
  applyReplaceRunsText,
  consumeCountDigits,
  consumeOptionalNat,
  deleteLineBlockText,
  deleteThroughEOLText,
  findNextOnLine,
  firstNonBlankOnLine,
  getLineCol,
  gotoLinePos,
  joinLinesText,
  lineBounds,
  lineCountTotal,
  lineEndCaretPos,
  moveHorizPos,
  moveVertPos,
  pasteYankText,
  reverseFindKind,
  wordBackPos,
  wordEndForwardPos,
  wordForwardPos,
  yankLineBlockText,
} from './editor-vim-ops'
import { editorPathsEqual, editorWindowTitle } from './editor-window-meta'
import { vfsFormatPath, vfsNormalize, vfsReadRaw, vfsWrite } from './os-fs'
import { createWindowChrome } from './window-chrome'

export interface EditorWindowOptions {
  initialPath: string
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onFocus: () => void
  /**
   * Invoked when the user runs `:run`, `:p5`, or presses F5 — opens the
   * current buffer's path in the p5 viewer. The editor saves before calling.
   */
  onRunInP5?: (absPath: string) => void
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
  private textareaWrap: HTMLElement
  /** NORMAL-mode block cursor — textareas ignore xterm-style cursor APIs; we draw like the terminal’s block. */
  private blockCaret: HTMLElement
  private cmdInput: HTMLInputElement
  private statusEl: HTMLElement
  /** Live position / breadcrumb fragments in the mode line */
  private modeMetaEl!: HTMLElement

  private titleEl: HTMLElement
  private measureCanvas: HTMLCanvasElement | null = null

  /** `f` / `F` / `t` / `T` awaiting the target character */
  private findAwait: null | 'f' | 'F' | 't' | 'T' = null
  private lastFind: null | { kind: 'f' | 'F' | 't' | 'T'; ch: string } = null
  private shiftGtArmed = false
  private shiftLtArmed = false
  private shiftChordTimer: ReturnType<typeof window.setTimeout> | null = null

  private snapshots: string[] = []
  private snapPtr = 0
  private readonly maxSnapshots = 80

  private onClose: () => void
  private onMinimize: () => void
  private onMaximize: () => void
  private onRunInP5: ((absPath: string) => void) | undefined

  constructor(opts: EditorWindowOptions) {
    this.onClose = opts.onClose
    this.onMinimize = opts.onMinimize
    this.onMaximize = opts.onMaximize
    this.onFocus = opts.onFocus
    this.onRunInP5 = opts.onRunInP5

    this.absPath = vfsNormalize(opts.initialPath)
    const initial = vfsReadRaw(this.absPath)
    const startText = initial.ok ? initial.body : ''
    this.savedText = startText

    const chrome = createWindowChrome({
      title: '',
      onClose: () => this.tryCloseFromChrome(),
      onMinimize: () => this.onMinimize(),
      onMaximize: () => this.onMaximize(),
      onFocus: opts.onFocus,
    })
    this.el = chrome.el
    this.el.classList.add('editor-app')
    this.titleEl = chrome.titleEl

    const stack = document.createElement('div')
    stack.className = 'editor-stack'

    this.textareaWrap = document.createElement('div')
    this.textareaWrap.className = 'editor-textarea-wrap'

    this.textarea = document.createElement('textarea')
    this.textarea.className = 'editor-textarea'
    this.textarea.spellcheck = false
    this.textarea.autocapitalize = 'off'
    this.textarea.autocomplete = 'off'
    this.textarea.value = startText
    this.textarea.wrap = 'off'
    this.textarea.setAttribute('tabsize', '2')
    // Normal/command modes block edits via `beforeinput` — not `readOnly`, so the
    // caret stays visible (browsers often hide it on readonly textareas).

    this.blockCaret = document.createElement('div')
    this.blockCaret.className = 'editor-block-caret'
    this.blockCaret.setAttribute('aria-hidden', 'true')
    this.blockCaret.hidden = true

    this.textareaWrap.appendChild(this.textarea)
    this.textareaWrap.appendChild(this.blockCaret)

    this.cmdInput = document.createElement('input')
    this.cmdInput.type = 'text'
    this.cmdInput.className = 'editor-cmdline'
    this.cmdInput.spellcheck = false
    this.cmdInput.autocomplete = 'off'
    this.cmdInput.setAttribute('aria-label', 'Ex command')

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'editor-status'

    stack.appendChild(this.textareaWrap)
    stack.appendChild(this.cmdInput)
    stack.appendChild(this.statusEl)

    this.textarea.addEventListener('scroll', () => this.syncBlockCaret())
    this.textarea.addEventListener('focus', () => this.syncBlockCaret())
    this.textarea.addEventListener('blur', () => this.syncBlockCaret())
    const ro = new ResizeObserver(() => this.syncBlockCaret())
    ro.observe(this.textareaWrap)

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
      this.syncBlockCaret()
    })
  }

  /** Clear motion / chord / count state (buffers + pending operators). */
  private clearChordStateHard(): void {
    this.clearPendingDy()
    this.gArm = false
    this.countDigits = ''
    this.replacePending = null
    this.findAwait = null
    this.clearShiftChordArms()
  }

  private clearShiftChordArms(): void {
    this.shiftGtArmed = false
    this.shiftLtArmed = false
    if (this.shiftChordTimer != null) {
      window.clearTimeout(this.shiftChordTimer)
      this.shiftChordTimer = null
    }
  }

  private armShiftGtChord(): void {
    this.clearShiftChordArms()
    this.shiftGtArmed = true
    this.shiftChordTimer = window.setTimeout(() => {
      this.shiftChordTimer = null
      this.shiftGtArmed = false
    }, 520)
  }

  private armShiftLtChord(): void {
    this.clearShiftChordArms()
    this.shiftLtArmed = true
    this.shiftChordTimer = window.setTimeout(() => {
      this.shiftChordTimer = null
      this.shiftLtArmed = false
    }, 520)
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
    const n = consumeCountDigits(this.countDigits, defaultN)
    this.countDigits = ''
    return n
  }

  /** First line touched by `:e` counts as line 1. */
  private consumeOptionalNat(): number | null {
    const n = consumeOptionalNat(this.countDigits)
    this.countDigits = ''
    return n
  }

  private lineCountTotal(): number {
    return lineCountTotal(this.textarea.value)
  }

  private getLineCol(): { line: number; col: number } {
    const t = this.textarea.value
    const p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    return getLineCol(t, p)
  }

  private gotoLine(oneBased: number): void {
    const pos = gotoLinePos(this.textarea.value, oneBased)
    this.textarea.setSelectionRange(pos, pos)
    this.refreshModeMeta()
  }

  private gotoLastLine(): void {
    this.gotoLine(this.lineCountTotal())
  }

  private firstNonBlankOnLine(pos: number): number {
    return firstNonBlankOnLine(this.textarea.value, pos)
  }

  private deleteLineBlock(nLines: number): void {
    const line = this.getLineCol().line
    const result = deleteLineBlockText(this.textarea.value, line, nLines)
    if (!result) return
    this.textarea.value = result.text
    this.textarea.setSelectionRange(result.pos, result.pos)
    this.dirty = result.text !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  private yankLineBlock(nLines: number): void {
    const result = yankLineBlockText(this.textarea.value, this.getLineCol().line, nLines)
    if (!result) return
    this.yankRegister = result.yank
    this.flashStatus(`Yanked ${result.lineCount} line(s)`, false)
  }

  private deleteThroughEOL(): void {
    const result = deleteThroughEOLText(this.textarea.value, this.textarea.selectionStart)
    this.textarea.value = result.text
    this.textarea.setSelectionRange(result.pos, result.pos)
    this.dirty = result.text !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** Join consecutive lines beginning at cursor line (minimal vi `J`): no extra spacing. */
  private joinBelow(): void {
    const span = this.consumeCount(1) + 1
    const result = joinLinesText(this.textarea.value, this.getLineCol().line, span)
    if (!result) return
    this.textarea.value = result.text
    this.textarea.setSelectionRange(result.pos, result.pos)
    this.dirty = result.text !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** `r` / `{count}r`: replace each of the next `n` glyphs with `ch` (minimal vi semantics). */
  private applyReplaceRuns(n: number, ch: string): void {
    const result = applyReplaceRunsText(this.textarea.value, this.textarea.selectionStart, n, ch)
    if (!result) return
    this.textarea.value = result.text
    this.textarea.setSelectionRange(result.pos, result.pos)
    this.dirty = result.text !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  /** Path matches the file currently loaded in this tile. */
  pathMatches(userPath: string): boolean {
    return editorPathsEqual(this.absPath, userPath)
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
    const action = parseEditorExCommand(raw)
    switch (action.type) {
      case 'write':
        this.saveFile()
        this.leaveCmd()
        return
      case 'quit':
        if (this.dirty) {
          this.flashStatus('No write since last change (use :q! to force)', true)
          this.leaveCmd()
          return
        }
        this.onClose()
        return
      case 'quit-force':
        this.onClose()
        return
      case 'write-quit':
        if (this.saveFile()) this.onClose()
        return
      case 'run-p5':
        this.runInP5()
        this.leaveCmd()
        return
      case 'edit':
        this.loadFile(action.path)
        this.leaveCmd()
        return
      case 'help':
        this.flashStatus(
          ':w :wq :q :q! :e path :run (F5 → play in p5) — NORMAL: hjkl ^ 0 $ · G gg · f F t T ; , · >> << · ~ s C Y · r J D · x X · dd yy p · u · ^R · Ctrl-f/b page · i I a A o O · w b e · counts · Esc',
          false,
        )
        this.leaveCmd()
        return
      case 'unknown':
        this.flashStatus(`Not an editor command: ${action.line}`, true)
        this.leaveCmd()
        return
    }
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

  /**
   * Save the current buffer and open it in the p5 viewer. Falls through with a
   * status message if the host didn't wire `onRunInP5` (e.g., embedded preview).
   */
  private runInP5(): void {
    if (!this.onRunInP5) {
      this.flashStatus('Run-in-p5 not available in this context', true)
      return
    }
    if (this.dirty && !this.saveFile()) return
    this.onRunInP5(this.absPath)
    this.flashStatus(`Running in p5 — ${vfsFormatPath(this.absPath)}`, false)
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
    this.titleEl.textContent = editorWindowTitle(this.absPath, this.dirty)
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
          ? 'Esc → NORMAL · bar caret'
          : 'hjkl · fFtT · >> · ~ s C · Ctrl-f/b · r · J · D · x X · dd yy p · u · ^R · w b e · i a'

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
    const findHint = this.findAwait ? ` · ${this.findAwait}_` : ''
    this.modeMetaEl.textContent = `L${line} · C${col} · ${pct}%${countHint}${rep}${opHint}${gArm}${findHint}`

    const dirtyDot = this.statusEl.querySelector('.editor-mode-dirty')
    if (dirtyDot) dirtyDot.textContent = this.dirty ? '●' : ''
    this.syncBlockCaret()
  }

  /** Canvas text metrics — matches textarea computed font (terminal uses real block cursor; we fake it). */
  private measurePrefixWidth(prefix: string): number {
    const tab = parseInt(this.textarea.getAttribute('tabsize') || '2', 10) || 2
    const expanded = prefix.replace(/\t/g, ' '.repeat(tab))
    if (!this.measureCanvas) this.measureCanvas = document.createElement('canvas')
    const ctx = this.measureCanvas.getContext('2d')
    if (!ctx) return expanded.length * 8
    const cs = getComputedStyle(this.textarea)
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    return ctx.measureText(expanded).width
  }

  private measureCharCell(ch: string): { w: number; h: number } {
    const cs = getComputedStyle(this.textarea)
    const fs = parseFloat(cs.fontSize) || 14
    const lhRaw = cs.lineHeight
    const lh =
      lhRaw === 'normal' || !parseFloat(lhRaw) ? Math.round(fs * 1.375) : parseFloat(lhRaw)
    const probe = ch === '\n' || ch === '\r' ? ' ' : ch === '\t' ? 'M' : ch
    const w = Math.max(1, this.measurePrefixWidth(probe))
    return { w, h: lh }
  }

  /** Block caret overlay — only in NORMAL while textarea is focused (xterm: `cursorStyle = 'block'`). */
  private syncBlockCaret(): void {
    const show =
      this.mode === 'normal' &&
      document.activeElement === this.textarea &&
      !this.el.classList.contains('minimized')

    if (!show) {
      this.blockCaret.hidden = true
      this.textarea.style.caretColor = ''
      return
    }

    const t = this.textarea.value
    const pos = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const before = t.slice(0, pos)
    const row = before.split('\n').length - 1
    const lineStart = before.lastIndexOf('\n') + 1
    const prefix = t.slice(lineStart, pos)
    const chHere = pos < t.length ? t[pos]! : ' '

    const cs = getComputedStyle(this.textarea)
    const padL = parseFloat(cs.paddingLeft) || 0
    const padT = parseFloat(cs.paddingTop) || 0
    const scrollL = this.textarea.scrollLeft
    const scrollT = this.textarea.scrollTop

    const xOff = padL + this.measurePrefixWidth(prefix) - scrollL
    const { w: cw, h: ch } = this.measureCharCell(chHere)
    const yOff = padT + row * ch - scrollT

    this.textarea.style.caretColor = 'transparent'
    this.blockCaret.hidden = false
    this.blockCaret.style.left = `${Math.max(0, xOff)}px`
    this.blockCaret.style.top = `${Math.max(0, yOff)}px`
    this.blockCaret.style.width = `${cw}px`
    this.blockCaret.style.height = `${ch}px`
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

    const st = this.textarea.style as CSSStyleDeclaration & { caretShape?: string }
    if (this.mode === 'normal') {
      st.caretColor = 'transparent'
      st.caretShape = 'block'
    } else {
      st.caretColor = ''
      st.caretShape = this.mode === 'insert' ? 'bar' : 'auto'
    }
    this.syncBlockCaret()
  }

  private onEditorKeydown(e: KeyboardEvent): void {
    // F5 — save + open the current buffer in the p5 viewer. Works in any
    // mode so users don't have to drop out of insert to play their sketch.
    if (e.key === 'F5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.runInP5()
      return
    }

    if (this.mode === 'cmd') return

    if (this.mode === 'insert') {
      if (insertModeKeyAction(e.key, { ctrlKey: e.ctrlKey, metaKey: e.metaKey }) === 'leave-normal') {
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

    if (this.findAwait != null) {
      e.preventDefault()
      if (k === 'Escape') {
        this.findAwait = null
        this.refreshModeMeta()
        return
      }
      const pick =
        !e.ctrlKey && !e.metaKey && !e.altKey && k.length === 1
          ? k
          : !e.ctrlKey && !e.metaKey && !e.altKey && k === 'Enter'
            ? '\n'
            : !e.ctrlKey && !e.metaKey && !e.altKey && k === 'Tab'
              ? '\t'
              : null
      if (pick != null) {
        const kind = this.findAwait
        this.findAwait = null
        this.runFindChord(kind, pick)
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

    if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      this.textarea.scrollTop += Math.max(48, Math.floor(this.textarea.clientHeight * 0.85))
      return
    }
    if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault()
      this.textarea.scrollTop -= Math.max(48, Math.floor(this.textarea.clientHeight * 0.85))
      return
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

    const nextDigits = tryAppendCountDigit(this.countDigits, k)
    if (nextDigits != null) {
      e.preventDefault()
      this.countDigits = nextDigits
      this.refreshModeMeta()
      return
    }

    if (k === ';') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      if (this.lastFind) {
        const n = this.consumeCount(1)
        this.repeatFindMotion(n, this.lastFind.kind, this.lastFind.ch, false)
      }
      return
    }
    if (k === ',') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      if (this.lastFind) {
        const n = this.consumeCount(1)
        this.repeatFindMotion(n, this.reverseFindKind(this.lastFind.kind), this.lastFind.ch, false)
      }
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

    if (k === 'f' || k === 'F' || k === 't' || k === 'T') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      this.findAwait = k
      this.refreshModeMeta()
      return
    }

    // `gg` goto line (`{count}`gg ; blank count → top)
    if (k === 'g') {
      e.preventDefault()
      this.findAwait = null
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
      this.findAwait = null
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
      this.findAwait = null
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
      const result = pasteYankText(this.textarea.value, cur(), this.yankRegister, true)
      if (!result) return
      this.textarea.value = result.text
      setCur(result.pos)
    }

    const pasteBeforeLine = (): void => {
      const result = pasteYankText(this.textarea.value, cur(), this.yankRegister, false)
      if (!result) return
      this.textarea.value = result.text
      setCur(result.pos)
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

    if (k === '>') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      if (this.shiftGtArmed) {
        this.clearShiftChordArms()
        this.indentLines(this.consumeCount(1))
        return
      }
      this.armShiftGtChord()
      return
    }
    if (k === '<') {
      e.preventDefault()
      this.clearPendingDy()
      this.gArm = false
      if (this.shiftLtArmed) {
        this.clearShiftChordArms()
        this.unindentLines(this.consumeCount(1))
        return
      }
      this.armShiftLtChord()
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
      setCur(lineEndCaretPos(this.textarea.value, cur()))
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

    if (k === 'C') {
      e.preventDefault()
      this.consumeCount(1)
      this.changeThroughEOL()
      return
    }

    if (k === 's') {
      e.preventDefault()
      this.substituteChars(this.consumeCount(1))
      return
    }

    if (k === '~') {
      e.preventDefault()
      this.toggleCaseRun(this.consumeCount(1))
      return
    }

    if (k === 'Y') {
      e.preventDefault()
      this.consumeCount(1)
      const t = this.textarea.value
      const p = cur()
      const { end } = this.lineBounds(p)
      this.yankRegister = t.slice(p, end)
      this.flashStatus('Yanked to end of line', false)
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
      const t = this.textarea.value
      for (let i = 0; i < n; i++) p = wordForwardPos(t, p)
      setCur(p)
      return
    }
    if (k === 'b') {
      e.preventDefault()
      const n = this.consumeCount(1)
      let p = cur()
      const t = this.textarea.value
      for (let i = 0; i < n; i++) p = wordBackPos(t, p)
      setCur(p)
      return
    }

    if (k === 'e') {
      e.preventDefault()
      const n = this.consumeCount(1)
      let p = cur()
      const t = this.textarea.value
      for (let i = 0; i < n; i++) p = wordEndForwardPos(t, p)
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
      setCur(moveHorizPos(this.textarea.value, cur(), -1, this.consumeCount(1)))
      return
    }
    if (k === 'l') {
      e.preventDefault()
      setCur(moveHorizPos(this.textarea.value, cur(), 1, this.consumeCount(1)))
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
    return lineBounds(this.textarea.value, pos)
  }

  private findNextOnLine(kind: 'f' | 'F' | 't' | 'T', ch: string, fromPos: number): number | null {
    return findNextOnLine(this.textarea.value, kind, ch, fromPos)
  }

  private reverseFindKind(kind: 'f' | 'F' | 't' | 'T'): 'f' | 'F' | 't' | 'T' {
    return reverseFindKind(kind)
  }

  private repeatFindMotion(
    times: number,
    kind: 'f' | 'F' | 't' | 'T',
    ch: string,
    remember: boolean,
  ): void {
    let p = Math.min(Math.max(0, this.textarea.selectionStart), this.textarea.value.length)
    for (let i = 0; i < times; i++) {
      const np = this.findNextOnLine(kind, ch, p)
      if (np == null) {
        if (i === 0) this.flashStatus('f/F/t/T: not found on this line', true)
        return
      }
      p = np
    }
    this.textarea.setSelectionRange(p, p)
    if (remember) this.lastFind = { kind, ch }
    this.refreshModeMeta()
  }

  private runFindChord(kind: 'f' | 'F' | 't' | 'T', ch: string): void {
    const n = this.consumeCount(1)
    this.repeatFindMotion(n, kind, ch, true)
  }

  private indentLines(nLines: number): void {
    const t = this.textarea.value
    const p0 = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const li = t.slice(0, p0).split('\n').length - 1
    const lines = t.split('\n')
    const take = Math.max(1, Math.min(nLines, lines.length - li))
    for (let j = 0; j < take; j++) lines[li + j] = '  ' + (lines[li + j] ?? '')
    const next = lines.join('\n')
    const curLineIdx = t.slice(0, p0).split('\n').length - 1
    let newP = p0
    if (curLineIdx >= li && curLineIdx < li + take) newP += 2
    this.textarea.value = next
    this.textarea.setSelectionRange(newP, newP)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  private unindentLines(nLines: number): void {
    const t = this.textarea.value
    const p0 = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const li = t.slice(0, p0).split('\n').length - 1
    const lines = t.split('\n')
    const take = Math.max(1, Math.min(nLines, lines.length - li))
    const curLineIdx = t.slice(0, p0).split('\n').length - 1
    let removedBefore = 0
    for (let j = 0; j < take; j++) {
      const idx = li + j
      let s = lines[idx] ?? ''
      let cut = 0
      if (s.startsWith('  ')) cut = 2
      else if (s.startsWith('\t')) cut = 1
      else if (s.startsWith(' ')) cut = 1
      if (cut && idx === curLineIdx) {
        const lineStart = t.lastIndexOf('\n', p0 - 1) + 1
        const col = p0 - lineStart
        removedBefore = Math.min(cut, col)
      }
      lines[idx] = s.slice(cut)
    }
    const next = lines.join('\n')
    const newP = Math.max(0, p0 - removedBefore)
    this.textarea.value = next
    this.textarea.setSelectionRange(newP, newP)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  private toggleCaseRun(n: number): void {
    const t = this.textarea.value
    let p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    let buf = t
    for (let i = 0; i < n && p < buf.length; ) {
      const ch = buf[p]!
      if (ch === '\n') {
        p++
        continue
      }
      const repl = ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()
      buf = buf.slice(0, p) + repl + buf.slice(p + 1)
      p++
      i++
    }
    if (buf === t) return
    this.textarea.value = buf
    const endPos = Math.min(p, buf.length)
    this.textarea.setSelectionRange(endPos, endPos)
    this.dirty = buf !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.refreshModeMeta()
  }

  private changeThroughEOL(): void {
    const t = this.textarea.value
    const p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const { end } = this.lineBounds(p)
    const next = t.slice(0, p) + t.slice(end)
    this.textarea.value = next
    this.textarea.setSelectionRange(p, p)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.mode = 'insert'
    this.syncStatus()
    this.syncEditorChrome()
    this.refreshModeMeta()
  }

  private substituteChars(n: number): void {
    const take = Math.max(1, n)
    const t = this.textarea.value
    const p = Math.min(Math.max(0, this.textarea.selectionStart), t.length)
    const del = Math.min(take, Math.max(0, t.length - p))
    const next = t.slice(0, p) + t.slice(p + del)
    this.textarea.value = next
    this.textarea.setSelectionRange(p, p)
    this.dirty = next !== this.savedText
    this.recordAfterMutation()
    this.syncTitle()
    this.mode = 'insert'
    this.syncStatus()
    this.syncEditorChrome()
    this.refreshModeMeta()
  }

  private moveVert(delta: -1 | 1): number {
    return moveVertPos(this.textarea.value, this.textarea.selectionStart, delta)
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
    else {
      this.textarea.focus()
      requestAnimationFrame(() => this.syncBlockCaret())
    }
  }
}
