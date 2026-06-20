/** Modal editor over the fake VFS (normal / insert / ex); not the terminal one-line vim widget. */

import { parseEditorExCommand } from './editor-ex-commands'
import {
  applyBufferEditToState,
  applyStateToTextarea,
  bufferStateFromTextarea,
  type BufferEditResult,
} from './editor-buffer'
import { dispatchEditorNormalKey } from './editor-normal-handlers'
import { insertModeKeyAction, tryAppendCountDigit } from './editor-vim-keys'
import {
  applyReplaceRunsText,
  consumeCountDigits,
  consumeOptionalNat,
  deleteLineBlockText,
  deleteThroughEOLText,
  getLineCol,
  gotoLinePos,
  indentLinesText,
  joinLinesText,
  lineCountTotal,
  pasteYankText,
  repeatFindPos,
  reverseFindKind,
  unindentLinesText,
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

/**
 * Modal vim-style editor over the VFS — NORMAL / INSERT / EX modes, counts, and
 * a bounded undo stack. Distinct from the terminal's one-line widget (`vim.ts`).
 * `dispose()` drops its selectionchange and resize listeners and clears any
 * pending chord timers.
 */
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

  /** Long-lived listeners/observers torn down in dispose() to avoid leaks. */
  private resizeObserver: ResizeObserver | null = null
  private selectionChangeHandler: (() => void) | null = null

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
    this.resizeObserver = ro

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

    this.selectionChangeHandler = () => {
      const ae = document.activeElement
      if (ae !== this.textarea && ae !== this.cmdInput) return
      this.refreshModeMeta()
      this.syncBlockCaret()
    }
    document.addEventListener('selectionchange', this.selectionChangeHandler)
  }

  /**
   * WM closed the tile — release the document-level selectionchange listener,
   * the ResizeObserver, and any pending chord timers so a closed editor doesn't
   * keep firing callbacks against detached DOM.
   */
  dispose(): void {
    if (this.selectionChangeHandler) {
      document.removeEventListener('selectionchange', this.selectionChangeHandler)
      this.selectionChangeHandler = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.clearPendingDy()
    this.clearShiftChordArms()
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

  /** Take the pending NORMAL-mode count prefix (e.g. the 5 in `5j`), or null. */
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

  /** Apply a pure buffer edit result to the textarea + undo stack. */
  private applyBufferEdit(
    result: BufferEditResult | null | undefined,
    opts?: { enterInsert?: boolean },
  ): boolean {
    const state = bufferStateFromTextarea(this.textarea, this.savedText, this.dirty)
    if (!applyBufferEditToState(state, result)) return false
    applyStateToTextarea(this.textarea, state)
    this.dirty = state.dirty
    this.recordAfterMutation()
    this.syncTitle()
    if (opts?.enterInsert) {
      this.mode = 'insert'
      this.syncStatus()
      this.syncEditorChrome()
    }
    this.refreshModeMeta()
    return true
  }

  private deleteLineBlock(nLines: number): void {
    this.applyBufferEdit(
      deleteLineBlockText(this.textarea.value, this.getLineCol().line, nLines),
    )
  }

  private yankLineBlock(nLines: number): void {
    const result = yankLineBlockText(this.textarea.value, this.getLineCol().line, nLines)
    if (!result) return
    this.yankRegister = result.yank
    this.flashStatus(`Yanked ${result.lineCount} line(s)`, false)
  }

  private deleteThroughEOL(): void {
    this.applyBufferEdit(
      deleteThroughEOLText(this.textarea.value, this.textarea.selectionStart),
    )
  }

  /** Join consecutive lines beginning at cursor line (minimal vi `J`): no extra spacing. */
  private joinBelow(): void {
    const span = this.consumeCount(1) + 1
    this.applyBufferEdit(
      joinLinesText(this.textarea.value, this.getLineCol().line, span),
    )
  }

  /** `r` / `{count}r`: replace each of the next `n` glyphs with `ch` (minimal vi semantics). */
  private applyReplaceRuns(n: number, ch: string): void {
    this.applyBufferEdit(
      applyReplaceRunsText(this.textarea.value, this.textarea.selectionStart, n, ch),
    )
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

  /** Shared "buffer is dirty" warning; `forceHint` names the override for this context. */
  private flashUnsavedGuard(forceHint: string): void {
    this.flashStatus(`No write since last change (${forceHint})`, true)
  }

  private tryCloseFromChrome(): void {
    if (this.dirty) {
      this.flashUnsavedGuard(':wq to save, :q! to discard')
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
          this.flashUnsavedGuard(':q! to force')
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
        if (this.dirty && !action.force) {
          this.flashUnsavedGuard(':e! to force')
          this.leaveCmd()
          return
        }
        this.loadFile(action.path)
        this.leaveCmd()
        return
      case 'help':
        this.flashStatus(
          ':w :wq :q :q! :e path :e! path :run (F5 → play in p5) — NORMAL: hjkl ^ 0 $ · G gg · f F t T ; , · >> << · ~ s C Y · r J D · x X · dd yy p · u · ^R · Ctrl-f/b page · i I a A o O · w b e · counts · Esc',
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

    const self = this
    if (
      dispatchEditorNormalKey({
        key: k,
        prevent: () => e.preventDefault(),
        cur,
        setCur,
        text: () => self.textarea.value,
        consumeCount: (defaultN?: number) => self.consumeCount(defaultN),
        consumeOptionalNat: () => self.consumeOptionalNat(),
        applyEdit: (result, opts) => self.applyBufferEdit(result, opts),
        enterInsert: () => {
          self.mode = 'insert'
          self.syncStatus()
          self.syncEditorChrome()
        },
        enterInsertAt: pos => {
          self.mode = 'insert'
          setCur(pos)
          self.syncStatus()
          self.syncEditorChrome()
        },
        gotoLine: n => self.gotoLine(n),
        gotoLastLine: () => self.gotoLastLine(),
        deleteThroughEOL: () => self.deleteThroughEOL(),
        joinBelow: () => self.joinBelow(),
        get yankRegister() {
          return self.yankRegister
        },
        set yankRegister(v: string) {
          self.yankRegister = v
        },
        flash: msg => self.flashStatus(msg, false),
        armReplace: nRuns => {
          self.replacePending = { nRuns }
          self.refreshModeMeta()
        },
        undo: () => {
          if (self.snapPtr <= 0) return
          self.snapPtr--
          self.textarea.value = self.snapshots[self.snapPtr]!
          self.dirty = self.textarea.value !== self.savedText
          self.syncTitle()
          self.refreshModeMeta()
        },
        paste: (times, afterLine) => {
          if (!self.yankRegister) return
          for (let i = 0; i < times; i++) {
            const result = pasteYankText(self.textarea.value, cur(), self.yankRegister, afterLine)
            if (!result) return
            self.textarea.value = result.text
            setCur(result.pos)
          }
          self.dirty = self.textarea.value !== self.savedText
          self.recordAfterMutation()
          self.syncTitle()
        },
      })
    ) {
      return
    }

    swallowPrintable()
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
    const p0 = Math.min(Math.max(0, this.textarea.selectionStart), this.textarea.value.length)
    const np = repeatFindPos(this.textarea.value, times, kind, ch, p0)
    if (np == null) {
      this.flashStatus('f/F/t/T: not found on this line', true)
      return
    }
    this.textarea.setSelectionRange(np, np)
    if (remember) this.lastFind = { kind, ch }
    this.refreshModeMeta()
  }

  private runFindChord(kind: 'f' | 'F' | 't' | 'T', ch: string): void {
    const n = this.consumeCount(1)
    this.repeatFindMotion(n, kind, ch, true)
  }

  private indentLines(nLines: number): void {
    this.applyBufferEdit(
      indentLinesText(this.textarea.value, this.textarea.selectionStart, nLines),
    )
  }

  private unindentLines(nLines: number): void {
    this.applyBufferEdit(
      unindentLinesText(this.textarea.value, this.textarea.selectionStart, nLines),
    )
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
